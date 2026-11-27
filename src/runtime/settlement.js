import {clone,settleEvents,applyOperation,poolParts,withdrawalQuote,projection,requireRule,computeCycle,seedAnatomy,seedOutfit,abilityBonus,effectiveProwess,evolvePrivateState,ASSET_VALUATION_BOUNDS,sanitizeInventoryAndUnlocks,syncChokerAccessory,syncImprintText,reconcileCharacterAge} from '../core/engine.js';

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
  const s=clone(state),value=schemas.appointment.parse(command.value);s.calendar.appointments[value.id]=value;
  // rc.37：日程一落地/取消就现场核销券状态，不等下一轮模型生成。
  syncWheelInventory(s);
  s.meta.revision++;
  s.operationHistory[command.operationId]={type:'PLAYER_APPOINTMENT',status:'COMMITTED',revision:s.meta.revision};return s;
}
export function settleNative(before,candidate,anchor,source,schemas,auditInput){
  requireRule(before?.meta.initialized&&candidate,'INVALID_NATIVE_STATE');
  let s=clone(candidate);const diagnostics=[],body=withoutUpdates(source),queue=clone(s.pendingEvents||[]),affectionEvents=[];
  // Rounds that actually touched her body unlock the prowess bonus on corruption.
  const intimateBehaviors=new Set();
  for(const e of queue)if(e&&['BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE'].includes(e.type)&&Number(e.score)>=60&&typeof e.personRef==='string')intimateBehaviors.add(e.personRef);
  // rc.25 Bug #4：本轮已经发生 60+ 正向破防或亲密暴击时，好感只许升不许扣。
  const positiveRounds=new Set();
  for(const e of queue)if(e&&['BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE'].includes(e.type)&&(Number(e.score)>=60||e.mode==='INTIMATE')&&typeof e.personRef==='string')positiveRounds.add(e.personRef);
  // These fields are written only by deterministic settlement or a confirmed player operation.
  for(const k of ['schemaVersion','finance','rewardEvents','withdrawals','recoveries','operationHistory','notifications','facts','hiddenTemporary','identityMap','wheel','inventory'])s[k]=clone(before[k]);
  s.meta=clone(before.meta);s.meta.branchKey=anchor.branchKey;
  for(const k of ['user','world','scene','calendar'])s[k]=acceptFields(s[k],before[k],schemas.state.shape[k],k,diagnostics);
  if(!s.characters||typeof s.characters!=='object'||Array.isArray(s.characters)){s.characters=clone(before.characters);diagnostics.push({field:'characters',code:'INVALID_FIELD'});}
  for(const k of ['id','name','age','beautyScore','gender','appearance','body','occupation','background','workLifeDescription','initialCashCents','cashCents','abilities'])s.user[k]=clone(before.user[k]);
  for(const k of ['heightCm','weightKg','shoeSizeEu']){if(before.user[k]!==null&&before.user[k]!==undefined)s.user[k]=before.user[k];}
  for(const [cid,prior] of Object.entries(before.characters)){
    const proposed=s.characters[cid];
    if(!proposed||prior.trackingState==='HIDDEN'){s.characters[cid]=clone(prior);continue;}
    if(typeof proposed!=='object'||Array.isArray(proposed)){s.characters[cid]=clone(prior);diagnostics.push({person:cid,field:'characters.'+cid,code:'INVALID_FIELD'});continue;}
    // starred is a player switch: the mobile UI owns it, the model never does.
    // rc.55 / B-06：choker 与 imprints 是脚本独占字段（schema 里是 .nullable()），
    // 模型发整对象 replace 时带上 choker:null 会把玩家已佩戴的项圈与已铭刻的印记抹掉。
    // 路径守卫只拦 characters.<id>.choker 这种点路径，整对象提交绕得过，必须在这里兜。
    for(const k of ['id','name','age','profileFixed','profileLocked','aliases','trackingState','starred','avatarRef','portraitRef','contactConfirmed','firstContactEvidence','choker','imprints'])proposed[k]=clone(prior[k]??null);
  proposed.lastSexSceneRevision=Number(prior.lastSexSceneRevision||0);
    // Initial acquaintances may have blanks. A normal story update fills only
    // missing basics; established author/player facts stay immutable.
    for(const k of ['beautyScore','personalityTags','appearance','body','heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu']){
      const known=prior[k];if(known!==null&&known!==undefined&&known!==''&&(!Array.isArray(known)||known.length))proposed[k]=clone(known);
    }
    // rc.58（玩家反馈）：模型整对象提交时会把没写到的档案字段写成空串，本轮 seedAnatomy
    // 随后就把它换成池子里的默认值——玩家在开局写好的长期梦想/近期目标/暗伤/职业凭空消失。
    // 空串不覆盖非空旧值；模型真写了新内容照旧采纳（不锁死）。
    for(const k of ['occupation','recentGoal','longTermDream','hiddenScar','knownFacts','relationshipNotes','addressing']){
      const known=prior[k],next=proposed[k];
      if(typeof known==='string'&&known.trim()&&!(typeof next==='string'&&next.trim()))proposed[k]=known;
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
    s.characters[cid]=acceptFields(proposed,prior,schemas.character,'characters.'+cid,diagnostics,true);
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
  // rc.41：同轮刚建档的第 2 人也要能留在名单里，姓名/别名/中文 ID 全部兜底解析后再过滤。
  s.scene.presentCharacterIds=resolvePresentIds(s.scene.presentCharacterIds,before,s).filter(cid=>s.characters[cid]?.trackingState==='RECORDED');
  s.scene.temporaryActors=s.scene.temporaryActors.filter(t=>!s.hiddenTemporary[t.tempId]&&!s.identityMap[t.tempId]);
  s.scene.sceneRevision=before.scene.sceneRevision+1;s.scene.timeHint=s.world.date+' '+s.world.time;s.user.location=s.scene.location;
  s.pendingEvents=[];
  const result=settleEvents(s,queue,anchor,body,affectionEvents);diagnostics.push(...result.diagnostics);
  s=schemas.state.parse(result.state);
  // Deterministic back-fill: the model writes the story, the script keeps the
  // private records consistent even when the model forgets those field paths.
  // rc.42：自定义资产若这一轮模型没补估值，脚本按类别中位价兜底（能算的不干等模型）。
  fallbackPendingValuations(s,before);
  syncPrivateRecords(s,before,queue,body);
  applyCycles(s,before);
  // rc.34：日程被模型标为 COMPLETED 时，脚本自动核销对应背包票券；取消则退回背包。
  syncWheelInventory(s);
  // rc.46：旧存档清洗 + 装置派生守护（模型换装/改肉体档案都不会把项圈与印记冲掉）。
  sanitizeInventoryAndUnlocks(s);
  syncDevices(s);
  s=schemas.state.parse(s);refreshContext(s);
  // rc.56b（方案 B §1）：本轮字段覆盖审计 + 被丢弃补丁留痕（非阻断，不进玩家红字）。
  const audit=buildRoundAudit(before,s,anchor,auditInput);
  // 审计不进 diagnostics：existing 单测与玩家诊断都要求它保持干净；由 host 另行挂到自己的 diagnostics/inspect。
  return {state:s,diagnostics,audit};
}

// rc.56b：给每位在场角色标注本轮 currentThought / addressing 的落库结果，用于证伪「模型漏写」还是「脚本丢弃」。
function buildRoundAudit(before,s,anchor,auditInput){
  const present=(s.scene?.presentCharacterIds||[]).filter((cid)=>s.characters?.[cid]);
  if(!present.length)return null;
  const received=new Set((auditInput?.receivedPaths||[]).map((p)=>String(p)));
  const dropped=auditInput?.droppedCommands||[];
  const touched=(cid,field)=>received.has(`characters.${cid}.${field}`)||received.has(`characters.${cid}`);
  const droppedFor=(cid,field)=>dropped.some((d)=>{const p=String(d?.rawPath||'');return p.includes(cid)&&p.includes(field);});
  const perChar={};
  for(const cid of present){
    const priorT=String(before.characters?.[cid]?.currentThought??'');
    const nextT=String(s.characters?.[cid]?.currentThought??'');
    const thoughtStatus=!touched(cid,'currentThought')?(droppedFor(cid,'currentThought')?'DROPPED':'MISSING'):(nextT!==priorT?'UPDATED':'SAME_VALUE');
    const priorA=String(before.characters?.[cid]?.addressing??'');
    const nextA=String(s.characters?.[cid]?.addressing??'');
    const addressingStatus=!touched(cid,'addressing')?(droppedFor(cid,'addressing')?'DROPPED':'UNCHANGED'):(nextA!==priorA?'UPDATED':'UNCHANGED');
    perChar[cid]={thoughtStatus,addressingStatus,prior:priorA,next:nextA};
  }
  return {code:'ROUND_FIELD_AUDIT',floor:anchor?.messageId??null,presentCount:present.length,perChar,droppedCount:dropped.length,droppedCommands:dropped.slice(0,20)};
}
// rc.46：项圈句与印记派生句每轮重算，保证「脚本只读字段」始终压过模型的手写。
function syncDevices(s){
  for(const c of Object.values(s.characters||{})){
    if(!c)continue;
    syncChokerAccessory(c);
    syncImprintText(c);
  }
}
// rc.42：自定义资产登记后，若这一轮模型没提交 ASSET_VALUATION，脚本按类别中位价兜底；
// 只兜「上一轮就已经在等估值」的项，本轮刚登记的资产留给下一轮让模型补。
function fallbackPendingValuations(s,before){
  for(const a of Object.values(s.finance?.assets||{})){
    if(!a||a.ownerId!=='USER'||a.status!=='OWNED'||a.valuationPending!==true)continue;
    if(before?.finance?.assets?.[a.assetId]?.valuationPending!==true)continue;
    const bound=ASSET_VALUATION_BOUNDS[a.kind]||ASSET_VALUATION_BOUNDS.OTHER;
    a.bookValueCents=bound.fallback;a.valuationPending=false;
  }
}
// 背包票券与日历的自动核销（铁律一：能由脚本算的绝不交给模型）。
function syncWheelInventory(s){  if(!s.inventory)return;
  for(const a of Object.values(s.calendar?.appointments||{})){
    const itemId=a.sourceItemId;
    if(!itemId)continue;
    const item=s.inventory[itemId];
    if(!item)continue;
    // rc.55 / B-03：只让「当前绑定的那一场日程」改变这张券。否则「取消 A → 把券重排到 B」
    // 之后，A 那条 CANCELLED 记录会把仍在 B 上有效的券打回 READY，背包与日历就分叉了。
    if(item.scheduledAppointmentId!==a.id)continue;
    if(a.status==='COMPLETED'&&item.status!=='USED'){item.status='USED';item.usedDate=s.world.date;item.scheduledAppointmentId=a.id;}
    else if(a.status==='CANCELLED'&&item.status==='SCHEDULED'){item.status='READY';item.scheduledAppointmentId=null;}
  }
}

function acceptFields(proposal,prior,schema,path,diagnostics,mergeNested=false){
  const out={};
  for(const [field,rule] of Object.entries(schema.shape)){
    // A field the model never mentions keeps its stored value. Defaults only
    // apply to genuinely new records, otherwise an omitted nested record
    // (physiology / intimacy) would be reset to empty every round.
    if(proposal?.[field]===undefined){out[field]=clone(prior[field]);continue;}
    // rc.58（玩家反馈）：整对象提交只该改它写到的子项。旧行为下 Zod 的默认值会把没写的
    // 子键清零，于是模型提交整个 physiology / outfit / intimacy / limits 时，未列出的子项
    // 被 seedAnatomy / seedOutfit 重新播成脚本默认值，玩家改过的私密档案看起来「被重置」。
    const raw=proposal[field],base=prior?.[field];
    const value=mergeNested&&raw&&typeof raw==='object'&&!Array.isArray(raw)&&base&&typeof base==='object'&&!Array.isArray(base)?{...clone(base),...raw}:raw;
    const parsed=rule.safeParse(value);
    if(parsed.success)out[field]=parsed.data;
    else {out[field]=clone(prior[field]);diagnostics.push({field:path+'.'+field,code:'INVALID_FIELD'});}
  }
  return out;
}

// ----- rc.23 deterministic private-record back-fill -----
// The model reports story facts; these two passes keep physiology / intimacy
// consistent from scores, dates and counts so blank fields never reach the UI.
const REAL_SEX=/交欢|初夜|破处|插入|做爱|内射|中出|本垒|云雨|同床共枕|占有|承欢|留宿/;
// rc.32：情欲值（arousal）五段护栏。协议里给模型数值锚点，这里管「模型忘了降」的兜底。
// 分支互斥：续战 > 正戏 > 事后退潮 > 日常自然回落，其余情况保留模型原值。
const AFTERGLOW_RE=/事后|完事|结束后|余韵|平复|沉睡|相拥而眠|各自歇息/;
const ENCORE_RE=/再来一次|还要一次|继续要|再来一轮|第二回合|梅开二度|要不够/;
export function arousalGuard({prior,current,behaviorText='',last='',lastChanged=false,score=0,body='',countIncreased=false,prevRoundHadSex=false,mode=''}){
  const priorArousal=Number(prior)||0,currentArousal=Number(current)||0;
  const wrote=currentArousal!==priorArousal;
  const sexThisRound=Number(score)>=90||countIncreased||(lastChanged&&REAL_SEX.test(String(last)))||REAL_SEX.test(String(behaviorText));
  const cue=`${behaviorText} ${lastChanged?last:''} ${String(body||'').slice(-400)}`;
  const isEncore=ENCORE_RE.test(cue),isAfterglow=AFTERGLOW_RE.test(cue);
  const continuedIntimate=sexThisRound||isEncore||(Number(score)>=60&&mode==='INTIMATE');
  if(isEncore&&(sexThisRound||priorArousal>0||lastChanged))return Math.max(currentArousal,72);
  if(sexThisRound&&!isAfterglow)return Math.max(currentArousal,88);
  if((isAfterglow&&!isEncore&&(sexThisRound||priorArousal>=40))||(prevRoundHadSex&&!continuedIntimate))return wrote&&currentArousal<=20?currentArousal:12;
  if(!sexThisRound&&Number(score)<60&&!lastChanged&&!wrote&&currentArousal>0)return Math.max(0,currentArousal-20);
  return currentArousal;
}
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
  if(list.includes(value))return false;
  // rc.38 A-2：标签满 24 个后原先直接 return false，新玩法再也进不来，
  // syncLimits 也就拿不到新标签。改成滑窗：淘汰最早的非里程碑标签后继续追加。
  if(list.length>=24){
    const keep=/初夜|破处/;
    const idx=list.findIndex(t=>!keep.test(String(t)));
    if(idx<0)return false;
    list.splice(idx,1);
  }
  list.push(value);return true;
}
// Behaviour tags may arrive as an array or a delimited string; 60+ scores and a
// changed lastIntimate also feed the keyword table so the tag cloud always fills.
export function syncPrivateRecords(s,before,queue,body=''){
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
      const prowess=s.user?.prowessScore??70;
      if(!c.intimacy.abilityComment){
        c.intimacy.abilityComment=prowess>=75
          ?'尺寸惊人且持久滚烫，每次深入都让她食髓知味、难以招架'
          :prowess>=50
            ?'滚烫充实且节奏沉稳，紧密贴合的深入交融让她由衷迷恋'
            :'虽非猛烈冲击，但细腻耐心的前戏爱抚与温存耳语依然让她羞耻动情';
      }
    }
    if(behavior.score>=60||lastChanged){
      for(const [rule,tag] of INTIMATE_TAG_RULES)if(rule.test(text))addTag(c,tag);
      for(const tag of behavior.tags)addTag(c,tag);
      if(behavior.score>=75&&!INTIMATE_TAG_RULES.some(([rule])=>rule.test(text))){
        const label=String(behavior.text).replace(/[，。！？、,.!?；;：:"'“”‘’（）()【】[\]\s]/g,'').slice(0,6);
        if(label)addTag(c,label);
      }
    }
    // rc.25 / rc.30：下体状态随情动值、实战及玩家性能力档位自动演进；模型本轮亲手写过的值优先保留。
    const priorVagina=String(prior.physiology?.vaginaState||'');
    const wroteVagina=typeof c.physiology.vaginaState==='string'&&c.physiology.vaginaState.trim()&&c.physiology.vaginaState!==priorVagina;
    // rc.32：情欲值兜底放在气质判定之前，后续 vaginaState / complexion 才读得到降下来的值。
    const countIncreased=(c.intimacy?.withUserCount||0)>(prior.intimacy?.withUserCount||0);
    const prevRoundHadSex=Number(prior.lastSexSceneRevision||0)>0&&Number(prior.lastSexSceneRevision)===Number(before?.scene?.sceneRevision||0);
    const cueText=`${behavior.text} ${lastChanged?last:''} ${String(body||'').slice(-400)}`;
    const sexNow=behavior.score>=90||countIncreased||(lastChanged&&REAL_SEX.test(last))||REAL_SEX.test(behavior.text);
    const inScene=s.scene.presentCharacterIds.includes(cid);
    c.arousal=arousalGuard({prior:prior.arousal,current:c.arousal,behaviorText:behavior.text,last,lastChanged,score:behavior.score,body:inScene?body:'',countIncreased,prevRoundHadSex,mode:behavior.mode});
    // rc.36：催情香（ab_scent）抬高情欲下限；只在已有情欲时生效，不凭空造情。
    {const floor=abilityBonus(s,'ab_scent');if(floor&&Number(c.arousal)>0)c.arousal=Math.min(100,Math.max(Number(c.arousal),floor));}
    if(sexNow&&(!AFTERGLOW_RE.test(cueText)||ENCORE_RE.test(cueText)))c.lastSexSceneRevision=s.scene.sceneRevision;
    if(sexNow&&!wroteVagina){
      const prowess=effectiveProwess(s);
      const creampie=(c.intimacy?.unlockedTags||[]).some(t=>/内射|灌满|中出/.test(t));
      c.physiology.vaginaState=creampie
        ?(prowess>=75
          ?'经受巨物深度开发，内壁滚烫痉挛，花穴微张、深处灌满浓稠精液'
          :'经受深入交合开发，内壁温热痉挛，花穴深处灌满滚烫精液')
        :(prowess>=75
          ?'刚经受强悍肉体充分开发，内壁温热紧箍、春水泥泞泛红，余韵微颤'
          :'刚经历亲密交欢，内壁温热湿润、软肉轻颤，犹带缠绵余韵');
    }else if(!sexNow&&!wroteVagina){
      const arousal=Number(c.arousal)||0;
      if(arousal>=65)c.physiology.vaginaState='情动难耐，透明爱液泌出湿透底裤，花唇充血微张、阴蒂敏感挺立';
      else if(arousal>=40)c.physiology.vaginaState='芳心微乱，秘处温热湿润，内壁随呼吸轻度收缩';
      else c.physiology.vaginaState='';
    }
    // rc.38 A-4：后庭状态 / 最近自慰 / 印象由脚本按确定性规则演进（文案为 agy 定稿，逐字照抄）。
    {const cue=`${behavior.text} ${behavior.tags.join(' ')}`;
     const priorAnus=String(prior.physiology?.anusState||'');
     const wroteAnus=typeof c.physiology.anusState==='string'&&c.physiology.anusState.trim()&&c.physiology.anusState!==priorAnus;
     evolvePrivateState(c,{prowess:effectiveProwess(s),date:s.world.date,analCue:/后庭|肛|菊/.test(cue),wroteAnus,sexNow});}
    syncOutfit(c,prior);
    syncLimits(c);
  }
  return s;
}
// Outfit and currentClothes are mirrors of each other: whichever the model
// filled last wins, and the other side is completed from it.
function syncOutfit(c,prior={}){
  const o=c.outfit;if(!o)return;
  const clothes=String(c.currentClothes||'').trim();
  // rc.25 Bug #3：开局或换装后两边都空时，从外貌提取或按职业补一套，绝不空着。
  if(!clothes&&!o.top&&!Object.entries(o).some(([k,v])=>k!=='complexion'&&typeof v==='string'&&v.trim())){
    const look=defaultOutfit(c);if(look){o.top=look;c.currentClothes=look;}
  }
  const parts=[o.top,o.bottom,o.socks,o.shoes].filter(v=>typeof v==='string'&&v.trim());
  if(clothes&&!o.top)o.top=clothes.slice(0,200);
  if(!c.currentClothes&&parts.length)c.currentClothes=parts.join('；').slice(0,300);
  // rc.33：seedOutfit 会先给一份静态气色，情动时按情欲值覆盖成动情气色。
  const AROUSAL_COMPLEXION='双颊绯红，眼波含春，呼吸微促';
  const wroteComplexion=typeof o.complexion==='string'&&o.complexion&&o.complexion!==String(prior.outfit?.complexion||'');
  if(Number(c.arousal)>=50){if(!wroteComplexion)o.complexion=AROUSAL_COMPLEXION;}
  else if(o.complexion===AROUSAL_COMPLEXION){o.complexion='';seedOutfit(c);}
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

// rc.38 A-1：协议示例里曾出现 char_在场ID 这类中文占位，模型照抄后整条人物命令会被
// Zod 校验静默丢弃。这里统一归一化成稳定 ASCII 键名：先按姓名复用已有角色，找不到
// 再按 FNV-1a 生成 char_<8位十六进制>，命令路径一并改写，避免丢更新。
const ASCII_ID=/^[a-zA-Z0-9_-]{1,100}$/;
function fnv8Id(value){let h=0x811c9dc5;const s=String(value??'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h*0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}
function asciiIdFor(raw,value,before){
  const candidate=String(raw??'').trim();
  if(ASCII_ID.test(candidate))return candidate;
  // rc.56b（方案 B §3.2）：单字段 replace 时 value 是字段值（如心声字符串），没有 value.name，
  // 原来只按 value?.name 反查，导致「characters.苏晚.currentThought」生成假 ID 后被静默丢弃。
  const lookup=(needle)=>{
    const n=String(needle||'').trim();if(!n)return '';
    for(const c of Object.values(before?.characters||{})){
      if(!c)continue;const id=String(c.id||'');
      if(!ASCII_ID.test(id))continue;
      if(String(c.name||'')===n)return id;
      if(Array.isArray(c.aliases)&&c.aliases.map(x=>String(x??'')).includes(n))return id;
    }
    return '';
  };
  const byPath=lookup(candidate);if(byPath)return byPath;
  const byValue=lookup(value?.name);if(byValue)return byValue;
  if(Array.isArray(value?.aliases))for(const a of value.aliases){const hit=lookup(a);if(hit)return hit;}
  return 'char_'+fnv8Id(value?.name||candidate);
}
// A new person needs an id and a name. Missing or malformed body details are
// dropped field by field so the record still enters and pendingBasicProfiles
// can complete it later; only an unusable identity rejects the person.
function newCharacter(cid,value,schemas){
  // rc.55 / B-04：落库用哪个键，人物 id 就必须是哪个键。原先优先接受对象自带的 value.id，
  // 一旦它与路径键不同，人物会存在 characters[cid] 下却带着另一个 id；经济校验按 c.id 查人
  // 立刻 UNKNOWN_PERSON，把整轮（含同轮有效的时间、经济、好感更新）一起回滚丢掉。
  const id=ASCII_ID.test(String(cid??''))?String(cid):'char_'+fnv8Id(value?.name||cid);
  const base={id,age:25,beautyScore:null,affection:20,corruption:0,relationshipLabel:'熟人',occupation:''};
  const raw={...value,id,name:typeof value.name==='string'?value.name.trim().slice(0,50):''};
  // rc.58（4A 方案 A §6.1）：年龄交给 reconcileCharacterAge —— 玩家显式岁数优先、职业/身份区间收敛、
  // 骨架默认 25 岁纠偏。旧版「写坏就删字段落回 25」与「25 岁的高二学生」两条路径一并关掉。
  const ageBefore=raw.age;
  raw.age=reconcileCharacterAge(raw,{skeletonDefault:25});
  if(raw.age!==ageBefore)console.log('[神豪终端] 人物年龄已按身份收敛',cid,String(ageBefore),'->',raw.age);
  let parsed=schemas.character.safeParse({...base,...raw});
  if(!parsed.success){
    for(const issue of parsed.error.issues){const k=issue.path[0];if(typeof k==='string'&&!['id','name'].includes(k))delete raw[k];}
    parsed=schemas.character.safeParse({...base,...raw});
  }
  return parsed.success?parsed.data:null;
}

// Drop or normalize malformed character commands before the native Zod command
// handler can reject them with a player-facing red toast.
export function prepareModelCommand(command,before,schemas){
  const parts=commandPath(command).split('.');
  // rc.41：先接住 presentCharacterIds，避免中文/姓名 ID 触发 z.array(id) 校验失败整组回滚。
  if(parts[0]==='shenghao'&&parts[1]==='scene'&&parts[2]==='presentCharacterIds'){
    const raw=command.args?.at(-1);
    let value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{return false;}
    command.type='set';
    command.args=['shenghao.scene.presentCharacterIds',JSON.stringify(resolvePresentIds(value,before))];
    return true;
  }
  if(parts[0]!=='shenghao'||parts[1]!=='characters')return true;
  // Case 0: insert on /shenghao/characters with [path, key, value]
  if(parts.length===2&&command.type==='insert'&&command.args?.length>=3){
    const rawCid=String(command.args[1]??'').trim().replace(/^['"`]|['"`]$/g,'');
    const raw=command.args.at(-1);
    let value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{return false;}
    if(!rawCid||!value||typeof value!=='object'||Array.isArray(value))return false;
    const cid=asciiIdFor(rawCid,value,before);
    const merged=before?.characters?.[cid]
      ?acceptFields(value,before.characters[cid],schemas.character,'characters.'+cid,[],true)
      :newCharacter(cid,value,schemas);
    if(!merged)return false;
    command.type='set';
    command.args=['shenghao.characters.'+cid,JSON.stringify(merged)];
    return true;
  }
  if(parts.length<3)return true;
  const raw=command.args.at(-1);
  let value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{return false;}
  if(!ASCII_ID.test(String(parts[2]??''))){
    const resolved=asciiIdFor(parts[2],value,before);
    if(resolved!==parts[2]){parts[2]=resolved;command.args[0]='shenghao.characters.'+parts.slice(2).join('.');}
  }
  const prior=before?.characters?.[parts[2]];
  // Case 1: brand-new character written at /shenghao/characters/<cid>.
  if(!prior){
    if(parts.length!==3||!value||typeof value!=='object'||Array.isArray(value))return false;
    const created=newCharacter(parts[2],value,schemas);
    if(!created){console.log('[神豪终端] 新人物缺少必要身份字段，已忽略',parts[2]);return false;}
    command.type='set';
    command.args[command.args.length-1]=JSON.stringify(created);
    return true;
  }
  // Case 2: existing character — normalize an accidental add/insert into set.
  if(['add','insert'].includes(command.type))command.type='set';
  if(command.type!=='set')return true;
  // Four levels reach a character field, five reach physiology.* / intimacy.* / outfit.* / limits.*.
  if(parts.length>5)return false;
  const nested=parts.length>3?unwrapSchema(schemas.character.shape[parts[3]]):null;
  let parsed;
  if(parts.length===3){
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    parsed=schemas.character.safeParse(acceptFields(value,prior,schemas.character,parts.slice(1).join('.'),[],true));
  }
  // Writing a whole sub-object keeps the untouched siblings instead of wiping them.
  else if(parts.length===4)parsed=nested?.safeParse(value&&typeof value==='object'&&!Array.isArray(value)?{...(prior[parts[3]]||{}),...value}:value);
  else parsed=nested?.shape?.[parts[4]]?.safeParse(value);
  if(!parsed?.success){console.log('[神豪终端] 已保留人物字段原值',parts.slice(1).join('.'));return false;}
  command.args[command.args.length-1]=JSON.stringify(parsed.data);return true;
}
// rc.41：presentCharacterIds 里的姓名、中文 ID、带空格 ID 一律归一成合法 ASCII 键。
// 以前这里不归一，一个坏元素就会让整组数组校验失败、被整组回滚成上一轮的名单，
// 表现就是「两个人同时在场，只显示一个人」。
function resolvePresentIds(value,before,merged){
  const list=Array.isArray(value)?value:typeof value==='string'?[value]:[];
  const pool={...(before?.characters||{}),...(merged?.characters||{})};
  const byName=new Map();
  for(const [cid,c] of Object.entries(pool)){
    if(!c)continue;
    if(c.name)byName.set(String(c.name).trim(),cid);
    for(const alias of c.aliases||[])if(alias)byName.set(String(alias).trim(),cid);
  }
  const out=[];
  for(const raw of list){
    const tag=String(raw??'').trim().replace(/^['"`]|['"`]$/g,'');
    if(!tag)continue;
    if(pool[tag])out.push(tag);
    else if(byName.has(tag))out.push(byName.get(tag));
    else if(ASCII_ID.test(tag))out.push(tag);
    else out.push(asciiIdFor(tag,null,{characters:pool}));
  }
  return [...new Set(out)];
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
  // rc.33：身高/体重/鞋码是开局可留空的字段，protocol 要求模型按 pendingProfileFields 补齐；
  // 已填值由 settleNative 第 57 行锁住，模型只可能补空，改不了玩家已定的数据。
  if(relative.startsWith('user.'))return /^user\.(?:location|city|currentClothes|currentPose|currentAction|heightCm|weightKg|shoeSizeEu)$/.test(relative);
  if(relative.startsWith('characters.')||relative==='characters'&&command.type==='insert') {
    const fields=relative.split('.');
    // rc.46：choker / imprints 是脚本独占只读字段，模型改不动（派生句由脚本自动写）。
    if(fields.length>=3&&['profileFixed','profileLocked','choker','imprints'].includes(fields[2]))return false;
    return true;
  }
  return false;
}
