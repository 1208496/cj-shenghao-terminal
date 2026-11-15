import config from '../../project.json' with {type:'json'};

export const PROFILE_KEYS = ['identity','appearance','body','personality','habits','style','family','career','social'];
export const PROFILE_LABELS = ['基础身份','容貌形象','身体特征','性格价值观','兴趣与生活习惯','长期穿衣风格','家庭与成长','事业与人生经历','社交与情感背景'];
export const clone = value => JSON.parse(JSON.stringify(value));
export class RuleError extends Error { constructor(code) { super(code); this.name = 'RuleError'; } }
export function requireRule(ok, code) { if (!ok) throw new RuleError(code); }
export function text(value, max = 500, allowEmpty = false) {
  requireRule(typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0), 'INVALID_TEXT');
  return value.trim();
}
export function integer(n, min = 0, max = Number.MAX_SAFE_INTEGER) {
  requireRule(typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max, 'INVALID_INTEGER'); return n;
}
export function add(a, b) { const n = a + b; requireRule(Number.isSafeInteger(n), 'MONEY_OVERFLOW'); return n; }
export function cents(value) {
  const s = String(value).trim(); requireRule(/^\d{1,13}(\.\d{1,2})?$/.test(s), 'INVALID_MONEY');
  const [a,b=''] = s.split('.'); return integer(Number(a) * 100 + Number(b.padEnd(2,'0')));
}
export function id(value) { requireRule(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !['__proto__','prototype','constructor'].includes(value), 'INVALID_ID'); return value; }
export const key = (...args) => JSON.stringify(args);
export function reward(score) {
  integer(score,0,100); return [...config.rewardTiers].reverse().find(t => score >= t.minScore);
}
export function stage(n) {
  integer(n,0,100); return n === 100 ? '极致倾心' : n >= 95 ? '极深羁绊' : n >= 90 ? '高度投入' : n >= 80 ? '深厚情感' : n >= 70 ? '恋爱发展' : n >= 60 ? '亲近与好感' : n >= 40 ? '朋友与信任' : n >= 20 ? '初步熟悉' : '陌生与戒备';
}
export function profile(p) {
  requireRule(p && !Array.isArray(p) && typeof p === 'object', 'PROFILE_INCOMPLETE');
  const result = {}; for (const k of PROFILE_KEYS) result[k] = text(p[k],750); return result;
}
function character(c) {
  const name = text(c.name,50), age = integer(c.age,18,120);
  return {id:id(c.id), aliases:(c.aliases || []).map(x => text(x,50)).slice(0,20), name, age,
    occupation:text(c.occupation ?? '',100,true), affection:integer(c.affection ?? 20,0,100),
    relationshipLabel:text(c.relationshipLabel || '熟人',12), relationshipNotes:text(c.relationshipNotes ?? '',300,true),
    profileFixed:profile(c.profileFixed), trackingState:'RECORDED', rewardBaseCents:1000000,
    withdrawal:null, currentClothes:'',currentPose:'',currentExpression:'', avatarRef:null,portraitRef:null};
}
export function validateDraft(d) {
  requireRule(d && typeof d === 'object', 'INVALID_DRAFT');
  const user = {id:'USER', name:text(d.name,50),age:integer(d.age,18,120),gender:text(d.gender ?? '',40,true),
    appearance:text(d.appearance ?? '',500,true),occupation:text(d.occupation ?? '',100,true),background:text(d.background ?? '',1200,true),
    city:text(d.city,100),location:text(d.currentLocation,150),housingMode:text(d.housingMode,30),residenceDescription:text(d.residenceDescription ?? '',600,true),
    workLifeDescription:text(d.workLifeDescription ?? '',600,true),cashCents:integer(d.initialCashCents),initialCashCents:d.initialCashCents,
    currentClothes:'',currentPose:'',currentAction:''};
  requireRule(Array.isArray(d.initialAssets) && d.initialAssets.length <= 100 && Array.isArray(d.contacts) && d.contacts.length <= 20, 'DRAFT_LIMIT');
  const assets = d.initialAssets.map(a => ({assetId:id(a.assetId),kind:assetKind(a.kind),name:text(a.name,120),ownerId:'USER',
    bookValueCents:integer(a.bookValueCents),basisCents:null,status:'OWNED',acquisitionEventId:'INITIAL',acquisitionIsInitial:true,
    locationNote:text(a.locationNote ?? '',300,true),ownershipNote:text(a.ownershipNote ?? '本人全额所有，无债务',300)}));
  const contacts = d.contacts.map(c => ({...c,id:id(c.id),name:text(c.name,50),age:integer(c.age,18,120),
    affection:integer(c.affection,0,100),occupation:text(c.occupation ?? '',100,true),relationshipLabel:text(c.relationshipLabel || '熟人',12),
    notes:text(c.notes ?? '',1200,true),present:c.present === true}));
  requireRule(new Set(assets.map(a=>a.assetId)).size === assets.length && new Set(contacts.map(c=>c.id)).size === contacts.length,'DUPLICATE_ID');
  return {user,assets,contacts};
}
export function initialize(draft, completedProfiles, initKey, branchKey) {
  const {user,assets,contacts} = validateDraft(draft);
  requireRule(completedProfiles && Object.keys(completedProfiles).length === contacts.length,'PROFILE_INCOMPLETE');
  const chars = {};
  for (const c of contacts) chars[c.id] = character({...c,profileFixed:completedProfiles[c.id]});
  const state = {schemaVersion:2,meta:{initialized:true,initKey:id(initKey),branchKey:text(branchKey,300),revision:0,sourceAnchor:null},user,
    scene:{sceneId:'initial',location:user.location,timeHint:'故事开始',presentCharacterIds:contacts.filter(c=>c.present).map(c=>c.id),temporaryActors:[],sceneRevision:0},
    characters:chars,identityMap:{},hiddenTemporary:{},finance:{ledger:{},assets:Object.fromEntries(assets.map(a=>[a.assetId,a]))},
    rewardEvents:{},operationHistory:{},notifications:{},facts:{}};
  assertState(state); return state;
}
function assetKind(k) { requireRule(['HOUSE','CAR','LUXURY','OTHER'].includes(k),'INVALID_ASSET_KIND');return k; }
function active(s, personId) { const c=s.characters[id(personId)];requireRule(c,'UNKNOWN_PERSON');return c; }
function tracked(c) { return c.trackingState === 'RECORDED'; }
function addLedger(s, entryId, e, anchor) {
  requireRule(!Object.hasOwn(s.finance.ledger,entryId),'DUPLICATE_LEDGER');
  s.finance.ledger[entryId] = {entryId,eventId:e.factId,kind:e.kind,direction:e.direction,amountCents:e.amountCents,
    payerId:e.direction === 'OUT' ? 'USER' : text(e.payer || 'EXTERNAL',100),beneficiaryCharacterId:e.personRef || null,
    allocations:clone(e.allocations || []),assetId:e.asset?.assetId || e.assetId || null,status:'CONFIRMED',refundOf:e.refundOf || null,
    sourceAnchor:clone(anchor),memo:text(e.memo || e.evidence,360),recordedAtScene:s.scene.timeHint,createdRevision:s.meta.revision+1};
}
function credit(s,cid,amount,eventId,anchor,type='SPEND_CREDIT',extra={}) {
  const c=active(s,cid);if (!tracked(c) || c.withdrawal || !amount) return;
  s.rewardEvents[eventId] = {eventId,characterId:cid,eventType:type,sourceAnchor:clone(anchor),cashbackCents:amount,
    valid:true,ruleTableVersion:config.rewardTableVersion,createdRevision:s.meta.revision+1,...extra};
}
export function poolParts(s,cid) {
  const c=active(s,cid);let spend=0,crit=0;
  for (const e of Object.values(s.rewardEvents)) if (e.characterId === cid && e.valid) {
    if (e.eventType === 'SPEND_CREDIT') spend=add(spend,e.cashbackCents);else crit=add(crit,e.cashbackCents);
  }
  return {base:c.rewardBaseCents,spend,crit,total:add(c.rewardBaseCents,add(spend,crit))};
}
export function totals(s) {
  let assets=0,income=0,expense=0;
  for (const a of Object.values(s.finance.assets)) if (a.ownerId === 'USER' && a.status === 'OWNED') assets=add(assets,a.bookValueCents);
  for (const e of Object.values(s.finance.ledger)) {if(e.direction==='IN') income=add(income,e.amountCents);else expense=add(expense,e.amountCents);}
  return {cash:s.user.cashCents,assets,total:add(s.user.cashCents,assets),income,expense};
}
export function assertState(s) {
  requireRule(s?.schemaVersion === 2 && s.meta.initialized,'INVALID_STATE');
  integer(s.user.cashCents);integer(s.meta.revision);
  const t=totals(s);requireRule(s.user.cashCents === add(s.user.initialCashCents,add(t.income,-t.expense)),'LEDGER_MISMATCH');
  for (const c of Object.values(s.characters)) {
    integer(c.affection,0,100);requireRule(c.rewardBaseCents===1000000,'INVALID_BASE');profile(c.profileFixed);
    const p=poolParts(s,c.id);integer(p.total);integer(p.spend);integer(p.crit);
    if(c.withdrawal) requireRule(c.withdrawal.amountCents===p.total,'SEALED_POOL_CHANGED');
  }
  return true;
}
function markFact(s,e,anchor) {
  const fid=id(e.factId); if (Object.hasOwn(s.facts,fid)) return false;
  s.facts[fid] = {type:e.type,sourceAnchor:clone(anchor)}; return true;
}
function applyEvent(s,e,eventKey,anchor) {
  const requirePerson = () => active(s,e.personRef);
  switch(e.type) {
    case 'CHARACTER_PROFILE_PROPOSED': {
      const cid=id(e.character?.id); const old=s.characters[cid];
      if(old) return;
      const tempId=e.tempId ? id(e.tempId) : null;
      if(tempId && (s.hiddenTemporary[tempId] || s.identityMap[tempId])) return;
      requireRule(e.contacted === true && e.adultConfirmed === true,'CONTACT_NOT_CONFIRMED');
      const c=character(e.character);s.characters[cid]=c;
      if(tempId) {s.identityMap[tempId]=cid;s.scene.temporaryActors=s.scene.temporaryActors.filter(t=>t.tempId!==tempId);}
      if(e.present===true && !s.scene.presentCharacterIds.includes(cid)) s.scene.presentCharacterIds.push(cid);
      return;
    }
    case 'CHARACTER_PROFILE_CORRECTION': {
      const c=requirePerson();if(!tracked(c)) return;
      requireRule(e.explicitCorrection===true,'CORRECTION_NOT_CONFIRMED');c.profileFixed=profile(e.profileFixed);return;
    }
    case 'SCENE_REPLACE': {
      s.scene.sceneId=id(e.sceneId);s.scene.location=text(e.location,150);s.scene.timeHint=text(e.timeHint ?? s.scene.timeHint,100);
      requireRule(Array.isArray(e.presentCharacterIds) && e.presentCharacterIds.length<=100,'INVALID_SCENE');
      s.scene.presentCharacterIds=[...new Set(e.presentCharacterIds.map(x=>id(x)))].filter(x=>tracked(active(s,x)));
      requireRule(Array.isArray(e.temporaryActors || []) && (e.temporaryActors || []).length<=30,'INVALID_SCENE');
      s.scene.temporaryActors=(e.temporaryActors || []).map(t=>({tempId:id(t.tempId),name:text(t.name,50),description:text(t.description,400),adultConfirmed:t.adultConfirmed===true}))
        .filter(t=>!s.hiddenTemporary[t.tempId] && !s.identityMap[t.tempId]);
      s.scene.sceneRevision++;s.user.location=s.scene.location;return;
    }
    case 'SCENE_ENTER': {
      const c=requirePerson();if(tracked(c)&&!s.scene.presentCharacterIds.includes(c.id))s.scene.presentCharacterIds.push(c.id);return;
    }
    case 'SCENE_LEAVE': {s.scene.presentCharacterIds=s.scene.presentCharacterIds.filter(x=>x!==e.personRef);return;}
    case 'CURRENT_STATE': {
      const target=e.personRef==='USER'?s.user:requirePerson();if(target.id!=='USER'&&!tracked(target))return;
      for(const k of ['currentClothes','currentPose','currentAction','currentExpression']) if(e[k]!==undefined) target[k]=text(e[k],300,true);return;
    }
    case 'AFFECTION_CHANGE': {
      const c=requirePerson();if(!tracked(c))return;
      const delta=integer(e.delta,-100,100);requireRule(Math.abs(delta)<=12 || e.majorTurningPoint===true,'AFFECTION_JUMP');
      c.affection=integer(c.affection+delta,0,100);return;
    }
    case 'RELATIONSHIP_CHANGE': {
      const c=requirePerson();if(!tracked(c))return;
      requireRule(e.confirmed===true,'RELATIONSHIP_NOT_CONFIRMED');c.relationshipLabel=text(e.label,12);
      c.relationshipNotes=text(e.notes || '',300,true);return;
    }
    case 'CASH_TRANSACTION': {
      requireRule(e.completed===true,'NOT_COMPLETED');integer(e.amountCents,1);requireRule(['IN','OUT'].includes(e.direction),'INVALID_DIRECTION');
      const out=['SHOPPING','DINING','TRAVEL','GIFT','TRANSFER_OUT','PROPERTY_PURCHASE','VEHICLE_PURCHASE'];
      const incoming=['SALARY','BUSINESS_INCOME','OTHER_INCOME','TRANSFER_IN','ASSET_SALE'];
      requireRule((e.direction==='OUT'?out:incoming).includes(e.kind),'INVALID_TRANSACTION_KIND');
      if(e.direction==='OUT' && e.payer!=='USER')return;
      requireRule(!['REFUND','WITHDRAWAL_REWARD'].includes(e.kind),'FORBIDDEN_CASH_WRITE');
      const allocations=e.allocations || [];
      requireRule(Array.isArray(allocations)&&allocations.length<=100,'INVALID_ALLOCATION');
      let allocated=0;const seen=new Set();
      for(const a of allocations){active(s,a.personRef);requireRule(!seen.has(a.personRef),'DUPLICATE_ALLOCATION');seen.add(a.personRef);allocated=add(allocated,integer(a.amountCents,0));}
      requireRule(allocated<=e.amountCents && (e.direction==='OUT'||allocated===0),'ALLOCATION_EXCEEDS_COST');
      if(e.direction==='OUT')requireRule(s.user.cashCents>=e.amountCents,'INSUFFICIENT_CASH');
      if(e.asset){
        requireRule(e.direction==='OUT','INVALID_ASSET_TRANSACTION');const a=e.asset;id(a.assetId);
        requireRule(!s.finance.assets[a.assetId],'DUPLICATE_ASSET');
        const owner=a.ownerId || 'USER';if(owner!=='USER')active(s,owner);
        requireRule(owner!=='USER'||allocated===0,'SELF_PURCHASE_NOT_GIFT');
        requireRule(owner==='USER'||allocations.every(x=>x.personRef===owner),'ASSET_BENEFICIARY_MISMATCH');
        s.finance.assets[a.assetId]={assetId:a.assetId,kind:assetKind(a.kind),name:text(a.name,120),ownerId:owner,
          bookValueCents:integer(a.bookValueCents ?? e.amountCents),basisCents:e.amountCents,status:owner==='USER'?'OWNED':'TRANSFERRED',
          acquisitionEventId:e.factId,acquisitionIsInitial:false,locationNote:text(a.locationNote ?? '',300,true),ownershipNote:'本人全额所有，无债务'};
      } else requireRule(!['PROPERTY_PURCHASE','VEHICLE_PURCHASE'].includes(e.kind),'ASSET_REQUIRED');
      if(e.kind==='ASSET_SALE') {
        const a=s.finance.assets[id(e.assetId)];requireRule(a?.ownerId==='USER'&&a.status==='OWNED','ASSET_NOT_OWNED');a.status='SOLD';a.ownerId='EXTERNAL';
      }
      if(!markFact(s,e,anchor))return;
      s.user.cashCents=add(s.user.cashCents,e.direction==='OUT'?-e.amountCents:e.amountCents);
      addLedger(s,eventKey,e,anchor);
      for(let i=0;i<allocations.length;i++){const a=allocations[i];credit(s,a.personRef,a.amountCents,key(eventKey,i),anchor,'SPEND_CREDIT',{relatedLedgerId:eventKey,originalCents:a.amountCents});}
      return;
    }
    case 'ASSET_TRANSFER': {
      requireRule(e.completed===true,'NOT_COMPLETED');const a=s.finance.assets[id(e.assetId)];
      requireRule(a?.ownerId==='USER'&&a.status==='OWNED','ASSET_NOT_OWNED');active(s,e.personRef);
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');a.ownerId=e.personRef;a.status='TRANSFERRED';a.transferEventId=e.factId;
      const basis=a.acquisitionIsInitial?0:integer(a.basisCents??0);
      credit(s,e.personRef,basis,eventKey,anchor,'SPEND_CREDIT',{relatedAssetId:a.assetId,originalCents:basis});return;
    }
    case 'TRANSACTION_REFUND': {
      integer(e.amountCents,1);requireRule(e.completed===true,'NOT_COMPLETED');
      const original=Object.values(s.finance.ledger).find(l=>l.eventId===e.refundOf&&l.direction==='OUT');requireRule(original,'REFUND_SOURCE_MISSING');
      const returned=Object.values(s.finance.ledger).filter(l=>l.refundOf===e.refundOf).reduce((v,l)=>add(v,l.amountCents),0);
      requireRule(add(returned,e.amountCents)<=original.amountCents,'REFUND_EXCEEDS_PAYMENT');
      const rewards=Object.values(s.rewardEvents).filter(r=>r.relatedLedgerId===original.entryId);
      for(const r of rewards)requireRule(!s.characters[r.characterId].withdrawal,'REFUND_AFTER_WITHDRAWAL_REVIEW');
      if(original.assetId){requireRule(returned===0&&e.amountCents===original.amountCents,'ASSET_PARTIAL_REFUND_REVIEW');
        const a=s.finance.assets[original.assetId];requireRule(a?.status==='OWNED'&&a.ownerId==='USER','ASSET_RETURN_NOT_OWNED');a.status='RETURNED';a.ownerId='EXTERNAL';}
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');
      // Cumulative rounding avoids drift when a bill is refunded in multiple pieces.
      for(const r of rewards){const net=original.amountCents-returned-e.amountCents;
        r.cashbackCents=Number(BigInt(r.originalCents)*BigInt(net)/BigInt(original.amountCents));}
      s.user.cashCents=add(s.user.cashCents,e.amountCents);addLedger(s,eventKey,{...e,direction:'IN',kind:'REFUND',payer:'EXTERNAL'},anchor);return;
    }
    case 'SIGNIFICANT_BEHAVIOR_SCORE': {
      const c=requirePerson();if(!tracked(c)||c.withdrawal)return;
      requireRule(e.completed===true&&e.consensual===true&&e.independent===true,'BEHAVIOR_NOT_ELIGIBLE');
      integer(e.score,0,100);text(e.action,80);text(e.reason,300);
      if(e.milestone) {id(e.milestone);if(Object.values(s.rewardEvents).some(r=>r.characterId===c.id&&r.milestone===e.milestone))return;}
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');const tier=reward(e.score);if(!tier.amountCents)return;
      credit(s,c.id,tier.amountCents,eventKey,anchor,'CRITICAL',{score:e.score,title:e.action,label:tier.label,milestone:e.milestone || null});
      s.notifications[eventKey]={notificationId:eventKey,relatedEventId:eventKey,type:'CRITICAL'};return;
    }
    default: throw new RuleError('UNKNOWN_EVENT');
  }
}
export function applyEnvelope(state,envelope,anchor,sourceText) {
  requireRule(envelope?.schemaVersion===2 && Array.isArray(envelope.events) && envelope.events.length<=40,'INVALID_ENVELOPE');
  requireRule(anchor?.branchKey===state.meta.branchKey && typeof anchor.fingerprint==='string','STALE_SOURCE');
  const s=clone(state);const ordinals=new Set();let critical=0;
  for(let i=0;i<envelope.events.length;i++) {
    const e=envelope.events[i];requireRule(e && typeof e==='object','INVALID_EVENT');
    const ordinal=integer(e.ordinal,0,100);requireRule(!ordinals.has(ordinal),'DUPLICATE_ORDINAL');ordinals.add(ordinal);
    const evidence=text(e.evidence,360);requireRule(hasEvidence(sourceText,evidence),'EVIDENCE_NOT_IN_SOURCE');
    const eventKey=key(anchor.branchKey,anchor.messageId,anchor.swipeId,anchor.fingerprint,ordinal,e.type,e.personRef || '');
    if(s.operationHistory[eventKey])continue;
    if(e.factId && Object.hasOwn(s.facts,id(e.factId)))continue;
    if(e.type==='SIGNIFICANT_BEHAVIOR_SCORE')requireRule(++critical<=3,'TOO_MANY_CRITICAL_EVENTS');
    applyEvent(s,e,eventKey,anchor);s.operationHistory[eventKey]={type:e.type,status:'COMMITTED',revision:s.meta.revision+1};
  }
  s.meta.revision++;s.meta.sourceAnchor=clone(anchor);assertState(s);return s;
}
export function hasEvidence(source,evidence) {
  if(typeof source!=='string'||typeof evidence!=='string')return false;
  if(source.includes(evidence))return true;
  // A quote may join several verbatim sentences from one scene. Each fragment must
  // still occur in source order; no fuzzy matching or invented replacement text.
  const parts=evidence.match(/[^。！？!?]+[。！？!?]?/g)||[];
  if(parts.length<2||parts.length>8)return false;
  let from=0;
  for(const part of parts){const p=part.trim();if(p.length<6)return false;const at=source.indexOf(p,from);if(at<0)return false;from=at+p.length;}
  return true;
}
export function canWithdraw(s,cid) { const c=s.characters[cid];return !!(c&&tracked(c)&&!c.withdrawal&&c.affection>=90); }
export function applyOperation(state,op,anchor) {
  id(op.operationId);requireRule(anchor.branchKey===state.meta.branchKey,'STALE_SOURCE');
  if(state.operationHistory[op.operationId])return clone(state);
  requireRule(op.expectedRevision===state.meta.revision,'STALE_REVISION');
  const s=clone(state);let result={};
  if(op.type==='PLAYER_HIDE_TEMP') {
    id(op.tempId);s.hiddenTemporary[op.tempId]=true;s.scene.temporaryActors=s.scene.temporaryActors.filter(t=>t.tempId!==op.tempId);
  } else {
    const c=active(s,op.personRef);
    if(op.type==='PLAYER_WITHDRAW') {
      requireRule(canWithdraw(s,c.id),'WITHDRAWAL_LOCKED');const amount=poolParts(s,c.id).total;
      c.withdrawal={status:'COMMITTED',operationId:op.operationId,amountCents:amount,sourceAnchor:clone(anchor)};
      s.user.cashCents=add(s.user.cashCents,amount);
      addLedger(s,op.operationId,{factId:op.operationId,kind:'WITHDRAWAL_REWARD',direction:'IN',amountCents:amount,payer:'TERMINAL',personRef:c.id,memo:c.name+' · 奖池提现'},anchor);
      result={amountCents:amount,personRef:c.id};
    } else if(op.type==='PLAYER_HIDE') {
      c.trackingState='HIDDEN';s.scene.presentCharacterIds=s.scene.presentCharacterIds.filter(x=>x!==c.id);
    } else if(op.type==='PLAYER_RESTORE') {
      c.trackingState='RECORDED';
      if(op.restorePresent===true&&!s.scene.presentCharacterIds.includes(c.id))s.scene.presentCharacterIds.push(c.id);
    } else throw new RuleError('UNKNOWN_OPERATION');
  }
  s.meta.revision++;s.meta.sourceAnchor=clone(anchor);s.operationHistory[op.operationId]={type:op.type,status:'COMMITTED',revision:s.meta.revision,result};
  assertState(s);return s;
}
export function unwrapMvu(value) {return Array.isArray(value)&&value.length===2&&typeof value[1]==='string'?value[0]:value;}
export function parseEnvelope(source) {
  const matches=[...source.matchAll(/<SH_EVENTS>\s*([\s\S]*?)\s*<\/SH_EVENTS>/g)];
  requireRule(matches.length<=1,'MULTIPLE_ENVELOPES');if(!matches.length)return null;
  const raw=matches[0][1];requireRule(raw.length<=160000,'ENVELOPE_TOO_LARGE');
  return JSON.parse(raw,(k,v)=>{requireRule(!['__proto__','prototype','constructor'].includes(k),'UNSAFE_JSON_KEY');return v;});
}
export function narrative(source) {return source.replace(/<SH_EVENTS>[\s\S]*?<\/SH_EVENTS>/g,'').replace(/<StatusPlaceHolderImpl\s*\/>/gi,'').trim();}
export function projection(s) {
  const people=Object.values(s.characters).map(c=>({id:c.id,name:c.name,age:c.age,occupation:c.occupation,
    affection:c.affection,relationship:c.relationshipLabel,hidden:!tracked(c),withdrawn:!!c.withdrawal,
    ...(s.scene.presentCharacterIds.includes(c.id)?{personality:c.profileFixed.personality,habits:c.profileFixed.habits}: {})}));
  return {schemaVersion:2,revision:s.meta.revision,user:s.user,scene:s.scene,people,
    assets:Object.values(s.finance.assets).filter(a=>a.ownerId==='USER'&&a.status==='OWNED').map(a=>({assetId:a.assetId,name:a.name,kind:a.kind})),
    recentFacts:Object.keys(s.facts).slice(-60),rule:'只提出新事实，不直接写现金、奖池或提现。已列factId不得再次入账。'};
}
