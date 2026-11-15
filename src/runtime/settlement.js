import {clone,applyEnvelope,applyOperation,poolParts,assertState,hasEvidence,projection,requireRule} from '../core/engine.js';

export function withoutUpdates(source){return String(source).replace(/<(think_nya|think|analysis)>[\s\S]*?<\/\1>/gi,'').replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'').replace(/<StatusPlaceHolderImpl\s*\/>/gi,'').trim();}
export function refreshContext(s){s._context=JSON.stringify({...projection(s),world:s.world,calendar:s.calendar});return s;}
export function completeInitialState(base,draft){
  const s=clone(base);
  s.world={date:draft.startDate,time:draft.startTime,weather:draft.weather||'晴',timeZone:'Asia/Shanghai'};
  s.calendar={appointments:{}};s.pendingEvents=[];
  for(const c of Object.values(s.characters)){c.contactConfirmed=true;c.firstContactEvidence='玩家确认的初始熟人';c.relationshipEvidence='';}
  refreshContext(s);return s;
}
export function replayPlayerCommand(state,command,anchor,schemas){
  if(command.kind==='action'){
    if(command.value.type==='PLAYER_WITHDRAW'&&!state.operationHistory[command.value.operationId]&&command.expectedPoolCents!==undefined)requireRule(poolParts(state,command.value.personRef).total===command.expectedPoolCents,'WITHDRAWAL_REVIEW_REQUIRED');
    return applyOperation(state,{...command.value,expectedRevision:state.meta.revision},anchor);
  }
  requireRule(command.kind==='appointment','UNKNOWN_PLAYER_COMMAND');
  if(state.operationHistory[command.operationId])return state;
  const s=clone(state),value=schemas.appointment.parse(command.value);s.calendar.appointments[value.id]=value;s.meta.revision++;
  s.operationHistory[command.operationId]={type:'PLAYER_APPOINTMENT',status:'COMMITTED',revision:s.meta.revision};return s;
}
export function settleNative(before,candidate,anchor,source,schemas){
  requireRule(before?.meta.initialized&&candidate,'INVALID_NATIVE_STATE');
  let s=clone(candidate);const diagnostics=[],body=withoutUpdates(source);
  // These fields are written only by deterministic settlement or a confirmed player operation.
  for(const k of ['schemaVersion','finance','rewardEvents','operationHistory','notifications','facts','hiddenTemporary','identityMap'])s[k]=clone(before[k]);
  s.meta=clone(before.meta);s.meta.branchKey=anchor.branchKey;
  for(const k of ['id','name','age','gender','appearance','occupation','background','housingMode','residenceDescription','workLifeDescription','initialCashCents','cashCents'])s.user[k]=clone(before.user[k]);
  for(const [cid,prior] of Object.entries(before.characters)){
    const proposed=s.characters[cid];
    if(!proposed||prior.trackingState==='HIDDEN'){s.characters[cid]=clone(prior);continue;}
    for(const k of ['id','name','age','profileFixed','aliases','rewardBaseCents','withdrawal','trackingState','avatarRef','portraitRef','contactConfirmed','firstContactEvidence'])proposed[k]=clone(prior[k]??null);
    if(Math.abs(proposed.affection-prior.affection)>12){proposed.affection=prior.affection;diagnostics.push({person:cid,code:'AFFECTION_JUMP'});}
    if(proposed.relationshipLabel!==prior.relationshipLabel&&!hasEvidence(body,proposed.relationshipEvidence)){
      proposed.relationshipLabel=prior.relationshipLabel;proposed.relationshipNotes=prior.relationshipNotes;diagnostics.push({person:cid,code:'RELATIONSHIP_EVIDENCE_MISSING'});
    }
  }
  for(const [cid,c] of Object.entries(s.characters)){
    if(before.characters[cid])continue;
    if(c.id!==cid||c.age<18||c.contactConfirmed!==true||!hasEvidence(body,c.firstContactEvidence)){
      delete s.characters[cid];diagnostics.push({person:cid,code:'CONTACT_NOT_CONFIRMED'});continue;
    }
    c.rewardBaseCents=1000000;c.withdrawal=null;c.trackingState='RECORDED';
    c.avatarRef=null;c.portraitRef=null;
    const matched=s.scene.temporaryActors.find(t=>t.name===c.name);
    if(matched)s.identityMap[matched.tempId]=cid;
  }
  s.scene.presentCharacterIds=[...new Set(s.scene.presentCharacterIds)].filter(cid=>s.characters[cid]?.trackingState==='RECORDED');
  s.scene.temporaryActors=s.scene.temporaryActors.filter(t=>!s.hiddenTemporary[t.tempId]&&!s.identityMap[t.tempId]);
  s.scene.sceneRevision=before.scene.sceneRevision+1;s.scene.timeHint=s.world.date+' '+s.world.time;s.user.location=s.scene.location;
  const queue=s.pendingEvents||[];s.pendingEvents=[];
  // Independent candidate validation does not discard valid scene/person/time changes.
  const excessiveScores=queue.filter(e=>e.type==='SIGNIFICANT_BEHAVIOR_SCORE').length>3;
  for(let i=0;i<queue.length;i++){
    const e={...queue[i],ordinal:i};
    if(excessiveScores&&e.type==='SIGNIFICANT_BEHAVIOR_SCORE'){diagnostics.push({factId:e.factId,code:'TOO_MANY_CRITICAL_EVENTS'});continue;}
    try{s=applyEnvelope(s,{schemaVersion:2,events:[e]},anchor,body);}
    catch(error){diagnostics.push({factId:e.factId,code:error.message});}
  }
  s.meta.revision=Math.max(s.meta.revision,before.meta.revision+1);s.meta.sourceAnchor=clone(anchor);
  refreshContext(s);assertState(s);
  return {state:schemas.state.parse(s),diagnostics};
}

export function commandPath(command){
  let raw=String(command.args?.[0]??'').trim();
  if(raw.startsWith('[')){
    const matches=[...raw.matchAll(/\["((?:[^"\\]|\\.)*)"\]/g)];
    if(matches.map(m=>m[0]).join('')!==raw)return '';
    raw=matches.map(m=>JSON.parse('"'+m[1]+'"')).join('.');
  }else raw=raw.replace(/^['"`]|['"`]$/g,'');
  return raw.replace(/^stat_data\./,'');
}
export function allowModelCommand(command,before,{trustedInitialization=false}={}){
  const path=commandPath(command);
  if(!['set','add','insert','delete'].includes(command.type)||path.split('.').some(p=>['__proto__','constructor','prototype'].includes(p)))return false;
  // Native JSONPatch arguments are strict JSON literals. Do not reach the upstream JS-literal fallback.
  try{for(const value of (command.args||[]).slice(1))if(typeof value==='string')JSON.parse(value, (k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('UNSAFE_KEY');return v;});}catch{return false;}
  if(path==='shenghao')return !before&&trustedInitialization;
  if(!before)return false;
  if(!path.startsWith('shenghao.'))return false;
  const relative=path.slice('shenghao.'.length);
  if(relative.startsWith('world.')||relative==='world'||relative.startsWith('scene.')||relative==='scene'||relative.startsWith('calendar.')||relative==='calendar'||relative==='pendingEvents'||relative.startsWith('pendingEvents[')||relative.startsWith('pendingEvents.'))return true;
  if(relative.startsWith('user.'))return /^user\.(?:location|city|currentClothes|currentPose|currentAction)$/.test(relative);
  if(relative.startsWith('characters.')||relative==='characters'&&command.type==='insert')return true;
  return false;
}
