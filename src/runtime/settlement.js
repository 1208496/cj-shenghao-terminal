import {clone,settleEvents,applyOperation,poolParts,withdrawalQuote,projection,requireRule} from '../core/engine.js';

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
    if(command.value.type==='PLAYER_WITHDRAW'&&!state.operationHistory[command.value.operationId]&&command.expectedQuote)requireRule(JSON.stringify(withdrawalQuote(state,command.value.personRef))===JSON.stringify(command.expectedQuote),'WITHDRAWAL_REVIEW_REQUIRED');
    return applyOperation(state,{...command.value,expectedRevision:state.meta.revision},anchor);
  }
  requireRule(command.kind==='appointment','UNKNOWN_PLAYER_COMMAND');
  if(state.operationHistory[command.operationId])return state;
  const s=clone(state),value=schemas.appointment.parse(command.value);s.calendar.appointments[value.id]=value;s.meta.revision++;
  s.operationHistory[command.operationId]={type:'PLAYER_APPOINTMENT',status:'COMMITTED',revision:s.meta.revision};return s;
}
export function settleNative(before,candidate,anchor,source,schemas){
  requireRule(before?.meta.initialized&&candidate,'INVALID_NATIVE_STATE');
  let s=clone(candidate);const diagnostics=[],body=withoutUpdates(source),queue=clone(s.pendingEvents||[]),affectionEvents=[];
  // These fields are written only by deterministic settlement or a confirmed player operation.
  for(const k of ['schemaVersion','finance','rewardEvents','withdrawals','recoveries','operationHistory','notifications','facts','hiddenTemporary','identityMap'])s[k]=clone(before[k]);
  s.meta=clone(before.meta);s.meta.branchKey=anchor.branchKey;
  for(const k of ['user','world','scene','calendar'])s[k]=acceptFields(s[k],before[k],schemas.state.shape[k],k,diagnostics);
  if(!s.characters||typeof s.characters!=='object'||Array.isArray(s.characters)){s.characters=clone(before.characters);diagnostics.push({field:'characters',code:'INVALID_FIELD'});}
  for(const k of ['id','name','age','beautyScore','gender','appearance','body','occupation','background','housingMode','residenceDescription','workLifeDescription','initialCashCents','cashCents'])s.user[k]=clone(before.user[k]);
  for(const [cid,prior] of Object.entries(before.characters)){
    const proposed=s.characters[cid];
    if(!proposed||prior.trackingState==='HIDDEN'){s.characters[cid]=clone(prior);continue;}
    if(typeof proposed!=='object'||Array.isArray(proposed)){s.characters[cid]=clone(prior);diagnostics.push({person:cid,field:'characters.'+cid,code:'INVALID_FIELD'});continue;}
    // starred is a player switch: the mobile UI owns it, the model never does.
    for(const k of ['id','name','age','profileFixed','profileLocked','aliases','trackingState','starred','avatarRef','portraitRef','contactConfirmed','firstContactEvidence'])proposed[k]=clone(prior[k]??null);
    // Initial acquaintances may have blanks. A normal story update fills only
    // missing basics; established author/player facts stay immutable.
    for(const k of ['beautyScore','personalityTags','appearance','body','heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu']){
      const known=prior[k];if(known!==null&&known!==undefined&&known!==''&&(!Array.isArray(known)||known.length))proposed[k]=clone(known);
    }
    const want=typeof proposed.affection==='number'||typeof proposed.affection==='string'&&proposed.affection.trim()?Number(proposed.affection):NaN;
    if(Number.isSafeInteger(want)&&want!==prior.affection)affectionEvents.push({type:'AFFECTION_CHANGE',personRef:cid,delta:want-prior.affection,auto:true});
    proposed.affection=prior.affection;
    s.characters[cid]=acceptFields(proposed,prior,schemas.character,'characters.'+cid,diagnostics);
  }
  for(const [cid,value] of Object.entries(s.characters)){
    if(before.characters[cid])continue;
    if(!value||typeof value!=='object'||Array.isArray(value)){delete s.characters[cid];diagnostics.push({person:cid,field:'characters.'+cid,code:'INVALID_FIELD'});continue;}
    // A new person needs only an id and a name to enter the record. Missing or
    // malformed body data (and a missing verbatim first-contact quote) must not
    // delete the whole person; blanks are listed in pendingBasicProfiles and
    // completed by a later round.
    const c=newCharacter(cid,value,schemas);
    if(!c){delete s.characters[cid];diagnostics.push({person:cid,code:'PROFILE_INCOMPLETE'});continue;}
    s.characters[cid]=c;
    Object.assign(s.characters[cid],{profileFixed:null,profileLocked:false,trackingState:'RECORDED',avatarRef:null,portraitRef:null});
    const matched=s.scene.temporaryActors.find(t=>t.name===c.name);
    if(matched)s.identityMap[matched.tempId]=cid;
  }
  s.scene.presentCharacterIds=[...new Set(s.scene.presentCharacterIds)].filter(cid=>s.characters[cid]?.trackingState==='RECORDED');
  s.scene.temporaryActors=s.scene.temporaryActors.filter(t=>!s.hiddenTemporary[t.tempId]&&!s.identityMap[t.tempId]);
  s.scene.sceneRevision=before.scene.sceneRevision+1;s.scene.timeHint=s.world.date+' '+s.world.time;s.user.location=s.scene.location;
  s.pendingEvents=[];
  const result=settleEvents(s,queue,anchor,body,affectionEvents);diagnostics.push(...result.diagnostics);
  s=schemas.state.parse(result.state);refreshContext(s);
  return {state:s,diagnostics};
}

function acceptFields(proposal,prior,schema,path,diagnostics){
  const out={};
  for(const [field,rule] of Object.entries(schema.shape)){
    // A field the model never mentions keeps its stored value. Defaults only
    // apply to genuinely new records, otherwise an omitted nested record
    // (physiology / intimacy) would be reset to empty every round.
    if(proposal?.[field]===undefined){out[field]=clone(prior[field]);continue;}
    const parsed=rule.safeParse(proposal[field]);
    if(parsed.success)out[field]=parsed.data;
    else {out[field]=clone(prior[field]);diagnostics.push({field:path+'.'+field,code:'INVALID_FIELD'});}
  }
  return out;
}

// A new person needs an id and a name. Missing or malformed body details are
// dropped field by field so the record still enters and pendingBasicProfiles
// can complete it later; only an unusable identity rejects the person.
function newCharacter(cid,value,schemas){
  const id=typeof value.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)?value.id:cid;
  const base={id,age:25,beautyScore:null,affection:20,relationshipLabel:'熟人',occupation:''};
  const raw={...value,id,name:typeof value.name==='string'?value.name.trim().slice(0,50):''};
  let parsed=schemas.character.safeParse({...base,...raw});
  if(!parsed.success){
    for(const issue of parsed.error.issues){const k=issue.path[0];if(typeof k==='string'&&!['id','name'].includes(k))delete raw[k];}
    parsed=schemas.character.safeParse({...base,...raw});
  }
  return parsed.success?parsed.data:null;
}

// Drop malformed existing-character fields before the native Zod command handler
// can reject them with a player-facing popup. Settlement still owns protected data.
export function prepareModelCommand(command,before,schemas){
  const parts=commandPath(command).split('.');
  if(parts[0]!=='shenghao'||parts[1]!=='characters'||!before?.characters[parts[2]])return true;
  if(command.type!=='set'||parts.length<3)return true;
  const prior=before.characters[parts[2]];
  // Four levels reach a character field, five reach physiology.* / intimacy.*.
  if(parts.length>5)return false;
  const raw=command.args.at(-1),value=typeof raw==='string'?JSON.parse(raw):raw;
  const nested=parts.length>3?unwrapSchema(schemas.character.shape[parts[3]]):null;
  let parsed;
  if(parts.length===3)parsed={success:true,data:acceptFields(value,prior,schemas.character,parts.slice(1).join('.'),[])};
  // Writing a whole sub-object keeps the untouched siblings instead of wiping them.
  else if(parts.length===4)parsed=nested?.safeParse(value&&typeof value==='object'&&!Array.isArray(value)?{...(prior[parts[3]]||{}),...value}:value);
  else parsed=nested?.shape?.[parts[4]]?.safeParse(value);
  if(!parsed?.success){console.log('[神豪终端] 已保留人物字段原值',parts.slice(1).join('.'));return false;}
  command.args[command.args.length-1]=JSON.stringify(parsed.data);return true;
}
function unwrapSchema(schema){return schema?._def?.innerType??schema;}

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
  if(relative.startsWith('characters.')||relative==='characters'&&command.type==='insert') {
    const fields=relative.split('.');
    if(fields.length>=3&&['profileFixed','profileLocked'].includes(fields[2]))return false;
    return true;
  }
  return false;
}
