import {clone,settleEvents,applyOperation,poolParts,withdrawalQuote,projection,requireRule,computeCycle,seedAnatomy} from '../core/engine.js';

export function withoutUpdates(source){return String(source).replace(/<(think_nya|think|analysis)>[\s\S]*?<\/\1>/gi,'').replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'').replace(/<StatusPlaceHolderImpl\s*\/>/gi,'').trim();}
export function refreshContext(s){s._context=JSON.stringify({...projection(s),world:s.world,calendar:s.calendar});return s;}
// rc.25 Bug #3：开场第一轮她的「行头」不能是空白。先从外貌描述里抠穿搭短语，
// 抠不到才按职业给一套得体默认，然后走正常的 outfit ⇄ currentClothes 同步。
const APPEARANCE_CLOTHES=/(?:穿着|身着|一袭|一身|偏好)([^。，；,;]{2,40})/;
function defaultOutfit(c){
  const look=String(c?.appearance||'').match(APPEARANCE_CLOTHES);
  if(look&&look[1])return look[1].trim().slice(0,40);
  const job=String(c?.occupation||'');
  if(/医|护/.test(job))return '白色修身工作服，内搭浅色圆领，配低跟软底鞋';
  if(/教师|老师|讲师/.test(job))return '剪裁利落的通勤套装，浅色内搭与低跟鞋';
  if(/设计|艺术|编辑|文案/.test(job))return '宽松针织上衣与直筒长裤，配简约帆布鞋';
  if(/律|金融|投行|经理|主管|总裁|顾问/.test(job))return '深色西装外套与同色半裙，白衬衫与细高跟';
  if(/花|咖啡|烘焙|店主/.test(job))return '棉麻围裙连衣裙，素色内搭与舒适的平底鞋';
  return '剪裁利落的通勤套装，搭配浅色内搭与低跟鞋';
}
export function completeInitialState(base,draft){
  const s=clone(base);
  s.world={date:draft.startDate,time:draft.startTime,weather:draft.weather||'晴',timeZone:'Asia/Shanghai'};
  s.calendar={appointments:{}};s.pendingEvents=[];
  for(const c of Object.values(s.characters)){c.contactConfirmed=true;c.firstContactEvidence='玩家确认的初始熟人';c.relationshipEvidence='';
    seedAnatomy(c);
    c.outfit=c.outfit&&typeof c.outfit==='object'?c.outfit:{};
    if(!c.currentClothes&&!c.outfit.top){const look=defaultOutfit(c);c.outfit.top=look;c.currentClothes=look;}
    if(c.physiology&&!c.physiology.cycle)c.physiology.cycle=computeCycle(c.id,s.world.date,c.physiology.pregnancy);
    syncOutfit(c);}
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
  // Rounds that actually touched her body unlock the prowess bonus on corruption.
  const intimateBehaviors=new Set();
  for(const e of queue)if(e&&['BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE'].includes(e.type)&&Number(e.score)>=60&&typeof e.personRef==='string')intimateBehaviors.add(e.personRef);
  // rc.25 Bug #4：本轮已经发生 60+ 正向破防或亲密暴击时，好感只许升不许扣。
  const positiveRounds=new Set();
  for(const e of queue)if(e&&['BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE'].includes(e.type)&&(Number(e.score)>=60||e.mode==='INTIMATE')&&typeof e.personRef==='string')positiveRounds.add(e.personRef);
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
    let affectionDelta=Number.isSafeInteger(want)?want-prior.affection:0;
    if(affectionDelta<0&&positiveRounds.has(cid))affectionDelta=0;
    if(Number.isSafeInteger(want)&&affectionDelta!==0)affectionEvents.push({type:'AFFECTION_CHANGE',personRef:cid,delta:affectionDelta,auto:true});
    proposed.affection=prior.affection;
    const wantCorruption=typeof proposed.corruption==='number'||typeof proposed.corruption==='string'&&proposed.corruption.trim()?Number(proposed.corruption):NaN;
    if(Number.isSafeInteger(wantCorruption)&&wantCorruption!==(prior.corruption??0)){
      const priorLast=prior.intimacy?.lastIntimate??'';
      const proposedLast=proposed.intimacy?.lastIntimate??priorLast;
      const intimateRound=Number(proposed.arousal)>=30||proposedLast!==priorLast||Number(proposed.intimacy?.withUserCount??0)>Number(prior.intimacy?.withUserCount??0)||intimateBehaviors.has(cid);
      affectionEvents.push({type:'CORRUPTION_CHANGE',personRef:cid,delta:wantCorruption-(prior.corruption??0),auto:true,prowessBonus:intimateRound});
    }
    proposed.corruption=prior.corruption??0;
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
  s=schemas.state.parse(result.state);
  // Deterministic back-fill: the model writes the story, the script keeps the
  // private records consistent even when the model forgets those field paths.
  syncPrivateRecords(s,before,queue);
  applyCycles(s,before);
  s=schemas.state.parse(s);refreshContext(s);
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

// ----- rc.23 deterministic private-record back-fill -----
// The model reports story facts; these two passes keep physiology / intimacy
// consistent from scores, dates and counts so blank fields never reach the UI.
const REAL_SEX=/交欢|初夜|破处|首次|插入|做爱|内射|中出|本垒|云雨|同床|占有|承欢|留宿/;
const INTIMATE_TAG_RULES=[
  [/初夜|破处|首次交欢|第一次/,'初夜夺取'],
  [/湿吻|热吻|深吻|接吻|亲吻|索吻/,'深情热吻'],
  [/丝袜|黑丝|白丝|渔网|制服|旗袍|泳装|情趣/,'丝袜制服'],
  [/口交|口侍|吞吐|含住|唇舌侍奉/,'口唇侍奉'],
  [/乳交|酥胸|揉胸|埋胸/,'酥胸侍奉'],
  [/足交|玉足|美足|腿交|脚踝/,'美足把玩'],
  [/内射|灌满|中出|无套/,'无套内射'],
  [/后入|骑乘|侧入|抱操|落地窗|对镜/,'解锁新姿'],
  [/办公室|车内|试衣间|露台|包厢|走廊|半公开/,'背德偷欢'],
  [/高潮|痉挛|求饶|失神|潮吹/,'极致高潮'],
  [/交欢|插入|占有|本垒|承欢|云雨|同眠|留宿/,'鱼水之欢'],
  [/爱抚|揉捏|掀裙|解扣|耳鬓厮磨|敏感带/,'贴身爱抚']
];
function addTag(c,tag){
  if(!c.intimacy)return false;
  const value=String(tag??'').trim().slice(0,16);if(!value)return false;
  const list=c.intimacy.unlockedTags=c.intimacy.unlockedTags||[];
  if(list.includes(value)||list.length>=24)return false;
  list.push(value);return true;
}
// Behaviour tags may arrive as an array or a delimited string; 60+ scores and a
// changed lastIntimate also feed the keyword table so the tag cloud always fills.
export function syncPrivateRecords(s,before,queue){
  const behaviors=new Map();
  for(const e of Array.isArray(queue)?queue:[]){
    if(!e||!['BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE'].includes(e.type))continue;
    const cid=typeof e.personRef==='string'?e.personRef:'';
    if(!cid)continue;
    const rec=behaviors.get(cid)||{score:0,text:'',tags:[]};
    rec.score=Math.max(rec.score,Number(e.score)||0);
    rec.text+=' '+String(e.action||'');
    if(Array.isArray(e.tags))rec.tags.push(...e.tags);
    else if(typeof e.tags==='string'&&e.tags.trim())rec.tags.push(...e.tags.split(/[、,，/／;；·|]/));
    behaviors.set(cid,rec);
  }
  for(const [cid,c] of Object.entries(s.characters)){
    if(!c||c.trackingState!=='RECORDED')continue;
    // rc.25：静态肉体档案先由脚本补齐（户型、色泽、阴毛、乳晕、体香、敏感带）。
    seedAnatomy(c);
    const prior=before?.characters?.[cid]||{};
    const behavior=behaviors.get(cid)||{score:0,text:'',tags:[]};
    const last=String(c.intimacy?.lastIntimate||'');
    const lastChanged=last!==String(prior.intimacy?.lastIntimate||'');
    const text=`${behavior.text} ${last} ${c.physiology?.traits||''}`;
    const realSex=behavior.score>=90||(c.intimacy?.withUserCount||0)>0||REAL_SEX.test(last);
    if(realSex){
      // Unknown (null) counts as "not yet confirmed", so her first on-screen
      // consummation is the first night; an explicit false is a known past.
      const firstNight=c.physiology?.virgin!==false;
      if(firstNight)c.physiology.virgin=false;
      if((c.intimacy?.withUserCount||0)<1)c.intimacy.withUserCount=1;
      if(firstNight)addTag(c,'初夜夺取');
      if(firstNight&&(!c.physiology.hymenNote||/处女膜完好|未经人事/.test(c.physiology.hymenNote)))c.physiology.hymenNote='初夜已由你夺取';
      if((c.intimacy.sexPartnerCount||0)<1)c.intimacy.sexPartnerCount=1;
      if(!c.intimacy.abilityComment&&(s.user?.prowessScore??70)>=75)c.intimacy.abilityComment='尺寸惊人且持久滚烫，每次深入都让她食髓知味、难以招架';
    }
    if(behavior.score>=60||lastChanged){
      for(const [rule,tag] of INTIMATE_TAG_RULES)if(rule.test(text))addTag(c,tag);
      for(const tag of behavior.tags)addTag(c,tag);
      if(behavior.score>=75&&!INTIMATE_TAG_RULES.some(([rule])=>rule.test(text))){
        const label=String(behavior.text).replace(/[，。！？、,.!?；;：:"'“”‘’（）()【】[\]\s]/g,'').slice(0,6);
        if(label)addTag(c,label);
      }
    }
    // rc.25：下体状态随情动值与实战自动演进；模型本轮亲手写过的值优先保留。
    const priorVagina=String(prior.physiology?.vaginaState||'');
    const wroteVagina=typeof c.physiology.vaginaState==='string'&&c.physiology.vaginaState.trim()&&c.physiology.vaginaState!==priorVagina;
    if(realSex){
      const creampie=(c.intimacy?.unlockedTags||[]).some(t=>/内射|灌满|中出/.test(t));
      if(creampie)c.physiology.vaginaState='经受巨物深度开发，内壁滚烫痉挛，花穴微张、深处灌满浓稠精液';
      else if(!wroteVagina)c.physiology.vaginaState='刚经受强悍肉体充分开发，内壁温热紧箍、春水泥泞泛红，余韵微颤';
    }else if(!wroteVagina){
      const arousal=Number(c.arousal)||0;
      if(arousal>=65)c.physiology.vaginaState='情动难耐，透明爱液泌出湿透底裤，花唇充血微张、阴蒂敏感挺立';
      else if(arousal>=40)c.physiology.vaginaState='芳心微乱，秘处温热湿润，内壁随呼吸轻度收缩';
    }
    syncOutfit(c);
    syncLimits(c);
  }
  return s;
}
// Outfit and currentClothes are mirrors of each other: whichever the model
// filled last wins, and the other side is completed from it.
function syncOutfit(c){
  const o=c.outfit;if(!o)return;
  const clothes=String(c.currentClothes||'').trim();
  // rc.25 Bug #3：开局或换装后两边都空时，从外貌提取或按职业补一套，绝不空着。
  if(!clothes&&!o.top&&!Object.entries(o).some(([k,v])=>k!=='complexion'&&typeof v==='string'&&v.trim())){
    const look=defaultOutfit(c);if(look){o.top=look;c.currentClothes=look;}
  }
  const parts=[o.top,o.bottom,o.socks,o.shoes].filter(v=>typeof v==='string'&&v.trim());
  if(clothes&&!o.top)o.top=clothes.slice(0,200);
  if(!c.currentClothes&&parts.length)c.currentClothes=parts.join('；').slice(0,300);
  if(Number(c.arousal)>=50&&!o.complexion)o.complexion='雙頰緋紅，眼波含春，呼吸微促';
}
// Level and the eight limits are derived, never asked of the model: openness
// follows whichever axis moved further, and unlocked tags jump straight to 3.
const LIMIT_GATES={cosplay:30,exposure:40,foreplay:50,intercourse:65,creampie:75,publicPlay:72,anal:82,multi:90};
const LIMIT_TAGS=[[/丝袜|制服|旗袍|情趣|泳装/,'cosplay'],[/露点|走光|全裸|脱光|裸裎/,'exposure'],[/口交|口侍|吞吐|足交|手口|侍奉/,'foreplay'],[/交欢|插入|鱼水|本垒|承欢|云雨/,'intercourse'],[/内射|中出|无套|灌满/,'creampie'],[/后庭|肛|菊/,'anal'],[/半公开|偷欢|办公室|车内|试衣间|包厢|落地窗/,'publicPlay'],[/多人|三人|双飞|同床侍奉/,'multi']];
function syncLimits(c){
  const l=c.limits;if(!l)return;
  const openness=Math.max(Number(c.affection)||0,(Number(c.corruption)||0)*1.15);
  const autoLevel=openness>=90?6:openness>=78?5:openness>=65?4:openness>=50?3:openness>=35?2:openness>=20?1:0;
  l.scaleLevel=Math.max(l.scaleLevel||0,autoLevel);
  for(const [key,threshold] of Object.entries(LIMIT_GATES)){
    const auto=openness>=threshold+30?3:openness>=threshold+15?2:openness>=threshold?1:0;
    l[key]=Math.max(l[key]||0,auto);
  }
  const tags=(c.intimacy?.unlockedTags||[]).join(' ');
  if(tags)for(const [rule,key] of LIMIT_TAGS)if(rule.test(tags))l[key]=3;
}
// Cycle is date-driven: recompute when it is blank or when the story day moved.
function applyCycles(s,before){
  const moved=s.world?.date!==before?.world?.date;
  for(const [cid,c] of Object.entries(s.characters)){
    if(!c?.physiology)continue;
    const prior=before?.characters?.[cid];
    const current=String(c.physiology.cycle||'').trim();
    const explicit=current&&current!==String(prior?.physiology?.cycle||'');
    if(explicit&&!moved)continue;
    c.physiology.cycle=computeCycle(cid,s.world?.date,c.physiology.pregnancy);
  }
  return s;
}

// A new person needs an id and a name. Missing or malformed body details are
// dropped field by field so the record still enters and pendingBasicProfiles
// can complete it later; only an unusable identity rejects the person.
function newCharacter(cid,value,schemas){
  const id=typeof value.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)?value.id:cid;
  const base={id,age:25,beautyScore:null,affection:20,corruption:0,relationshipLabel:'熟人',occupation:''};
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
