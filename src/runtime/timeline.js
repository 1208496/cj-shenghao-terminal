import {clone,applyEnvelope,applyOperation,parseEnvelope,narrative,requireRule,assertState} from '../core/engine.js';

export async function digest(s) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function messageText(m) { return m.swipes[m.swipe_id] || ''; }
export function messageData(m) { return m.swipes_data?.[m.swipe_id] || {}; }
export const cleanSource = s => s.replace(/\s*<StatusPlaceHolderImpl\s*\/>/gi,'').trim();

// Every selected swipe contributes to the lineage. A stale descendant operation is never replayed.
export async function replay(messages,branchKey,mode='inline') {
  let state=null,lineage='',baselineIndex=-1;const diagnostics=[];let head=null;
  for(const m of messages) {
    const source=cleanSource(messageText(m));const fingerprint=await digest(source);const data=messageData(m);
    const stored=data.cj_shenghao || {};
    const record=stored.sourceHash===fingerprint?clone(stored):{};
    if(m.role!=='user')delete record.baseline;
    const anchor={branchKey,messageId:m.message_id,swipeId:m.swipe_id,fingerprint};
    if(!state && m.role==='user' && record.baseline && record.sourceHash===fingerprint) {
      assertState(record.baseline);state=clone(record.baseline);state.meta.branchKey=branchKey;
      baselineIndex=m.message_id;lineage=await digest('BASE:'+state.meta.initKey+':'+fingerprint);
    } else if(state) {
      lineage=await digest(lineage+':'+m.message_id+':'+m.swipe_id+':'+fingerprint);
      if(m.role==='assistant') {
        try {
          const inline=parseEnvelope(source);
          const selectedMode=record.parseMode || (inline?'inline':mode);
          const envelope=selectedMode==='extra' ? (record.extraHash===fingerprint ? record.extraEnvelope : null) : inline;
          if(envelope)state=applyEnvelope(state,envelope,anchor,narrative(source));
        } catch(e) { diagnostics.push({messageId:m.message_id,code:e.message}); }
      }
    }
    if(state) {
      const ownedOperations=[];
      for(const saved of record.operations || []) {
        // Helper versions may copy the previous floor's entire variable table.
        // A previously committed operation is inherited data, never a new request.
        if(state.operationHistory[saved.operation.operationId])continue;
        ownedOperations.push(saved);
        if(saved.baseLineage!==lineage) {diagnostics.push({messageId:m.message_id,code:'STALE_OPERATION'});continue;}
        try {state=applyOperation(state,{...saved.operation,expectedRevision:state.meta.revision},anchor);lineage=await digest(lineage+':'+saved.operation.operationId);}
        catch(e){diagnostics.push({messageId:m.message_id,code:e.message});}
      }
      if(record.operations)record.operations=ownedOperations;
      state.meta.sourceAnchor=anchor;
    }
    head={message:m,record,anchor};
  }
  return {state,lineage,head,baselineIndex,diagnostics};
}

export class Coordinator {
  constructor(adapter) {this.adapter=adapter;this.queue=Promise.resolve();this.busy=false;this.disposed=false;this.last=null;}
  serial(fn) {
    const p=this.queue.then(()=>{requireRule(!this.disposed,'DISPOSED');return fn();});this.queue=p.catch(()=>{});return p;
  }
  async read() {
    const branchKey=this.adapter.branch();const messages=await this.adapter.messages();
    const result=await replay(messages,branchKey,this.adapter.mode());
    requireRule(branchKey===this.adapter.branch(),'STALE_CHAT');this.last=result;return result;
  }
  async persist(result,record) {
    const now=await this.adapter.messages();const head=now.at(-1);
    requireRule(head?.message_id===result.head.message.message_id && head.swipe_id===result.head.anchor.swipeId,'STALE_SOURCE');
    requireRule(this.adapter.branch()===result.head.anchor.branchKey && await digest(cleanSource(messageText(head)))===result.head.anchor.fingerprint,'STALE_SOURCE');
    const id=head.message_id;const expected=JSON.stringify(messageData(head).cj_shenghao || {});
    await this.adapter.write(id,vars=>{
      requireRule(JSON.stringify(vars.cj_shenghao || {})===expected,'CONCURRENT_WRITE');
      return {...vars,stat_data:{...(vars.stat_data || {}),shenghao:clone(result.state)},cj_shenghao:{...record,sourceHash:result.head.anchor.fingerprint}};
    });
    const verified=await this.adapter.messages();const actual=messageData(verified.at(-1));
    requireRule(this.adapter.branch()===result.head.anchor.branchKey&&verified.at(-1)?.swipe_id===result.head.anchor.swipeId,'STALE_SOURCE');
    requireRule(JSON.stringify(actual.stat_data?.shenghao)===JSON.stringify(result.state),'WRITE_VERIFICATION_FAILED');
    this.last=result;return result;
  }
  refresh() {return this.serial(async()=>{
    const r=await this.read();if(r.state&&!this.busy&&(JSON.stringify(messageData(r.head.message).stat_data?.shenghao)!==JSON.stringify(r.state)||JSON.stringify(messageData(r.head.message).cj_shenghao||{})!==JSON.stringify(r.head.record)))await this.persist(r,r.head.record);return r;
  });}
  operate(operation,expectedLineage) {return this.serial(async()=>{
    requireRule(!this.busy,'GENERATION_BUSY');const r=await this.read();
    requireRule(!this.busy,'GENERATION_BUSY');requireRule(r.state&&r.lineage===expectedLineage,'STALE_SOURCE');
    const state=applyOperation(r.state,operation,r.head.anchor);
    if(r.head.record.operations?.some(x=>x.operation.operationId===operation.operationId))return r;
    const record={...r.head.record,operations:[...(r.head.record.operations || []),{baseLineage:r.lineage,operation:clone(operation)}]};
    const next={...r,state,lineage:await digest(r.lineage+':'+operation.operationId)};
    requireRule(!this.busy,'GENERATION_BUSY');return this.persist(next,record);
  });}
}
