import config from '../../project.json' with {type:'json'};

export const PROFILE_KEYS = ['identity','appearance','body','personality','habits','style','family','career','social'];
export const PROFILE_LABELS = ['基础身份','容貌形象','身体特征','性格价值观','兴趣与生活习惯','长期穿衣风格','家庭与成长','事业与人生经历','社交与情感背景'];
export const clone = value => JSON.parse(JSON.stringify(value));
export class RuleError extends Error { constructor(code,field) { super(code); this.name = 'RuleError'; if(field)this.field=field; } }
export function requireRule(ok, code) { if (!ok) throw new RuleError(code); }
export function text(value, max = 500, allowEmpty = false, field) {
  if(!(typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0)))throw new RuleError('INVALID_TEXT',field);
  return value.trim();
}
export function integer(n, min = 0, max = Number.MAX_SAFE_INTEGER) {
  requireRule(typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max, 'INVALID_INTEGER'); return n;
}
export function add(a, b) { const n = a + b; requireRule(Number.isSafeInteger(n), 'MONEY_OVERFLOW'); return n; }
export function cents(value) {
  const s = String(value).trim(),m=s.match(/^[¥￥]?(\d{1,14})(?:\.(\d{1,2}))?([万亿]?)(?:元)?$/);
  requireRule(m,'INVALID_MONEY');const n=(BigInt(m[1])*100n+BigInt((m[2]||'').padEnd(2,'0')))*({万:10000n,亿:100000000n}[m[3]]||1n);
  requireRule(n<=BigInt(Number.MAX_SAFE_INTEGER),'MONEY_OVERFLOW');return Number(n);
}
export function multiply(a,b){integer(a);integer(b);const n=BigInt(a)*BigInt(b);requireRule(n<=BigInt(Number.MAX_SAFE_INTEGER),'MONEY_OVERFLOW');return Number(n);}
export function wealthTier(cash){integer(cash);return cash<1000000000?{id:'trainee',label:'见习·十倍',multiplier:10}:cash<10000000000?{id:'junior',label:'初级·八倍',multiplier:8}:cash<100000000000?{id:'middle',label:'中级·五倍',multiplier:5}:cash<1000000000000?{id:'senior',label:'高级·三倍',multiplier:3}:{id:'max',label:'满级·一倍',multiplier:1};}
export function beautyTier(score){integer(score,1,100);return score<20?{label:'丑陋无比',modifier:-2}:score<50?{label:'有点难看的路人',modifier:-1}:score<70?{label:'平平无奇的普通人，还算看得过去',modifier:0}:score<90?{label:'颜值出众，更容易获得好感',modifier:1}:{label:'倾国倾城，万中无一',modifier:2};}
export function sourceId(value){let h=14695981039346656037n;for(const c of value){h^=BigInt(c.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return 'fact_'+h.toString(16);}
export function id(value) { requireRule(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !['__proto__','prototype','constructor'].includes(value), 'INVALID_ID'); return value; }
export const key = (...args) => JSON.stringify(args);
export function reward(score) {
  integer(score,0,100); return [...config.rewardTiers].reverse().find(t => score >= t.minScore);
}
export function stage(n) {
  integer(n,0,100); return n === 100 ? '极致倾心' : n >= 95 ? '极深羁绊' : n >= 90 ? '高度投入' : n >= 80 ? '深厚情感' : n >= 70 ? '恋爱发展' : n >= 60 ? '亲近与好感' : n >= 40 ? '朋友与信任' : n >= 20 ? '初步熟悉' : '陌生与戒备';
}
export function basicProfile(c) {
  requireRule(Array.isArray(c.personalityTags??[])&&(c.personalityTags??[]).length<=6,'INVALID_BASIC_PROFILE');
  const result={personalityTags:(c.personalityTags??[]).map(v=>text(v,12)),appearance:text(c.appearance ?? '',500,true),body:text(c.body ?? '',500,true)};
  for(const [k,min,max] of [['heightCm',100,230],['weightKg',25,250],['bustCm',40,200],['waistCm',30,200],['hipCm',40,200],['shoeSizeEu',25,55]]) {const v=c[k]??null;requireRule(v===null||typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'INVALID_BASIC_PROFILE');result[k]=v;}
  return result;
}
export function completeBasicProfile(c){const b=basicProfile(c);requireRule(b.appearance&&b.body&&b.personalityTags.length>0&&['heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu'].every(k=>b[k]!==null),'PROFILE_INCOMPLETE');return b;}
export function assetDescription(a){
  if(typeof a.description==='string'&&a.description.trim())return text(a.description,800);
  const name=text(a.name,120),where=text(a.locationNote||'',300,true);
  if(a.kind==='HOUSE'){const large=/大平层|别墅|庄园/.test(name)||(a.bookValueCents??0)>=500000000;return `${name}位于${where||'云澜市江城区的成熟住宅片区'}，建筑面积约${large?220:90}平方米，${large?'四室两厅，带独立书房与宽敞观景客厅，浅色石材和木饰面营造安静舒展的居住氛围':'两室一厅，南向客厅与卧室采光充足，浅木色家具和整洁厨房适合日常居住'}，配有小区停车位。`;}
  if(a.kind==='CAR'){const sport=/跑车|超跑|911|法拉利|兰博/.test(name),suv=/SUV|越野|卡宴/i.test(name);return `${name}是一辆${sport?'双门运动跑车，搭载高功率动力总成，百公里加速约4秒，低趴车身配深灰金属漆，座舱采用黑色真皮运动座椅与碳纤维饰板':suv?'五座中大型SUV，搭载2.0T涡轮动力与四驱系统，深灰色车身搭配黑色真皮内饰，底盘稳健，兼顾通勤舒适与周末出游':'以中型四门行政轿车设定，搭载2.0T涡轮动力与自动变速箱，银灰色金属漆车身，黑色皮质座椅搭配简洁中控，隔音舒适，动力适合日常通勤与高速巡航'}，平时停放在${where||'住所附近的固定车位'}。`;}
  if(a.kind==='LUXURY')return `${name}${/表/.test(name)?'采用精钢表壳与自动机械机芯，浅银色表盘配简洁时标，棕色皮革表带，透底可见机芯运转，适合商务与日常佩戴':/包|皮具/.test(name)?'采用细腻小牛皮与金属扣件，线条利落，内部分区清楚，可搭配日常通勤或正式社交穿着':'以细致的材质处理和简洁考究的造型见长，表面质感温润，适合收藏陈列或在正式场合使用'}。`;
  return `${name}${/电脑|笔记本/.test(name)?'配有14英寸轻薄屏幕、16GB内存与512GB固态硬盘，深灰金属机身，键盘手感清晰，适合日常办公、资料整理与外出携带':'造型简洁，材质结实，维护状态良好，便于日常使用与妥善保管'}，收纳在${where||'玩家住所的常用物品区'}。`;
}
export function profile(p) {
  requireRule(p && !Array.isArray(p) && typeof p === 'object', 'PROFILE_INCOMPLETE');
  const result = {}; for (const k of PROFILE_KEYS) result[k] = text(p[k],750); return result;
}
function character(c) {
  const name = text(c.name,50), age = integer(c.age,1,120);
  return {id:id(c.id), aliases:(c.aliases || []).map(x => text(x,50)).slice(0,20), name, age,
    occupation:text(c.occupation ?? '',100,true), affection:integer(c.affection ?? 20,0,100),
    relationshipLabel:text(c.relationshipLabel || '熟人',12), relationshipNotes:text(c.relationshipNotes ?? '',300,true),
    ...basicProfile(c),beautyScore:c.beautyScore==null?null:integer(c.beautyScore,1,100),knownFacts:text(c.knownFacts ?? c.notes ?? '',1200,true),profileFixed:null,profileLocked:false, trackingState:'RECORDED',
    currentClothes:'',currentPose:'',currentExpression:'', avatarRef:null,portraitRef:null};
}
export function validateDraft(d) {
  requireRule(d && typeof d === 'object', 'INVALID_DRAFT');
  const user = {id:'USER', name:text(d.name,50),age:integer(d.age,1,120),beautyScore:integer(d.beautyScore,1,100),gender:text(d.gender ?? '',40,true),
    appearance:text(d.appearance ?? '',500,true),body:text(d.body ?? '',500,true),occupation:text(d.occupation ?? '',100,true),background:text(d.background ?? '',1200,true),
    city:'云澜市',location:text(d.currentLocation,150),housingMode:text(d.housingMode,30),residenceDescription:text(d.residenceDescription ?? '',600,true),
    workLifeDescription:text(d.workLifeDescription ?? '',600,true),cashCents:integer(d.initialCashCents),initialCashCents:d.initialCashCents,
    currentClothes:'',currentPose:'',currentAction:''};
  requireRule(Array.isArray(d.initialAssets) && d.initialAssets.length <= 100 && Array.isArray(d.contacts) && d.contacts.length <= 20, 'DRAFT_LIMIT');
  const assets = d.initialAssets.map(a => ({assetId:id(a.assetId),kind:assetKind(a.kind),name:text(a.name,120),ownerId:'USER',
    bookValueCents:integer(a.bookValueCents),basisCents:null,status:'OWNED',acquisitionEventId:'INITIAL',acquisitionIsInitial:true,
    description:assetDescription(a),locationNote:text(a.locationNote ?? '',300,true),ownershipNote:text(a.ownershipNote ?? '本人全额所有，无债务',300)}));
  const contacts = d.contacts.map(c => ({...c,...basicProfile(c),id:id(c.id),name:text(c.name,50),age:integer(c.age,1,120),
    beautyScore:c.beautyScore===undefined?undefined:integer(c.beautyScore,1,100),affection:integer(c.affection,0,100),occupation:text(c.occupation ?? '',100,true),relationshipLabel:text(c.relationshipLabel || '熟人',12),
    notes:text(c.notes ?? '',1200,true),present:c.present === true}));
  requireRule(new Set(assets.map(a=>a.assetId)).size === assets.length && new Set(contacts.map(c=>c.id)).size === contacts.length,'DUPLICATE_ID');
  return {user,assets,contacts};
}
export function initialize(draft, completedProfiles, initKey, branchKey) {
  const {user,assets,contacts} = validateDraft(draft);
  requireRule(completedProfiles && typeof completedProfiles==='object','INVALID_BASIC_PROFILE');
  const chars = {};
  for (const c of contacts) {const basics=basicProfile({...c,...completedProfiles[c.id]});chars[c.id] = character({...c,...basics,beautyScore:c.beautyScore??completedProfiles[c.id]?.beautyScore??null,profileFixed:null});}
  const state = {schemaVersion:3,meta:{initialized:true,initKey:id(initKey),branchKey:text(branchKey,300),revision:0,sourceAnchor:null},user,
    scene:{sceneId:'initial',location:user.location,timeHint:'故事开始',presentCharacterIds:contacts.filter(c=>c.present).map(c=>c.id),temporaryActors:[],sceneRevision:0},
    characters:chars,identityMap:{},hiddenTemporary:{},finance:{ledger:{},assets:Object.fromEntries(assets.map(a=>[a.assetId,a]))},
    rewardEvents:{},withdrawals:{},recoveries:{},operationHistory:{},notifications:{},facts:{}};
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
    itemName:text(e.itemName||e.asset?.name||'',120,true),merchantOrPlace:text(e.merchantOrPlace||'',150,true),
    sourceAnchor:clone(anchor),memo:text(e.memo || e.evidence,360),recordedAtScene:s.scene.timeHint,createdRevision:s.meta.revision+1};
}
function credit(s,cid,amount,eventId,anchor,type='SPEND_CREDIT',extra={}) {
  const c=active(s,cid);if (!tracked(c) || !amount) return;
  requireRule(!s.rewardEvents[eventId],'DUPLICATE_REWARD');
  s.rewardEvents[eventId] = {eventId,characterId:cid,eventType:type,sourceAnchor:clone(anchor),cashbackCents:amount,
    refundedCents:0,withdrawalId:null,claimedCents:0,valid:true,ruleTableVersion:config.rewardTableVersion,createdRevision:s.meta.revision+1,...extra};
}
export function poolParts(s,cid) {
  active(s,cid);let spend=0,crit=0;
  for (const e of Object.values(s.rewardEvents)) if (e.characterId === cid && e.valid && !e.withdrawalId) {
    const net=e.cashbackCents-e.refundedCents;if (e.eventType === 'SPEND_CREDIT') spend=add(spend,net);else crit=add(crit,net);
  }
  return {spend,crit,total:add(spend,crit)};
}
export function recoveryDue(s,cid){return Object.values(s.recoveries).filter(r=>r.characterId===cid).reduce((n,r)=>add(n,r.amountCents-r.settledCents),0);}
export function withdrawalQuote(s,cid){const p=poolParts(s,cid),tier=wealthTier(s.user.cashCents),gross=multiply(p.total,tier.multiplier),debt=recoveryDue(s,cid);return {...p,tier,gross,recoveryCents:Math.min(gross,debt),paidCents:Math.max(0,gross-debt),debt};}
export function totals(s) {
  let assets=0,income=0,expense=0;
  for (const a of Object.values(s.finance.assets)) if (a.ownerId === 'USER' && a.status === 'OWNED') assets=add(assets,a.bookValueCents);
  for (const e of Object.values(s.finance.ledger)) {if(e.direction==='IN') income=add(income,e.amountCents);else if(e.direction==='OUT')expense=add(expense,e.amountCents);}
  return {cash:s.user.cashCents,assets,total:add(s.user.cashCents,assets),income,expense};
}
export function assertState(s) {
  assertEconomy(s);
  for(const c of Object.values(s.characters)){if(c.profileFixed)profile(c.profileFixed);basicProfile(c);}
  return true;
}
export function assertEconomy(s) {
  requireRule(s?.schemaVersion === 3 && s.meta.initialized,'INVALID_STATE');
  integer(s.user.cashCents);integer(s.user.beautyScore,1,100);integer(s.meta.revision);
  const t=totals(s);requireRule(s.user.cashCents === add(s.user.initialCashCents,add(t.income,-t.expense)),'LEDGER_MISMATCH');
  for (const c of Object.values(s.characters)) {
    integer(c.affection,0,100);if(c.beautyScore!==null)integer(c.beautyScore,1,100);
    const p=poolParts(s,c.id);integer(p.total);integer(p.spend);integer(p.crit);
  }
  for(const r of Object.values(s.rewardEvents)){active(s,r.characterId);integer(r.cashbackCents);integer(r.refundedCents,0,r.cashbackCents);integer(r.claimedCents,0,r.cashbackCents);if(r.withdrawalId)requireRule(s.withdrawals[r.withdrawalId]?.allocations[r.eventId]===r.claimedCents,'REWARD_CLAIM_MISMATCH');else requireRule(r.claimedCents===0,'REWARD_CLAIM_MISMATCH');}
  for(const w of Object.values(s.withdrawals)){
    let total=0;for(const [rid,amount] of Object.entries(w.allocations)){integer(amount,1);const r=s.rewardEvents[rid];requireRule(r?.characterId===w.characterId&&r.withdrawalId===w.withdrawalId&&r.claimedCents===amount,'REWARD_CLAIM_MISMATCH');total=add(total,amount);}
    requireRule(total===w.basePoolCents&&add(w.spendCents,w.criticalCents)===total&&w.multiplier===wealthTier(w.preCashCents).multiplier&&multiply(total,w.multiplier)===w.grossCents&&add(w.paidCents,w.recoveryCents)===w.grossCents,'WITHDRAWAL_MISMATCH');
    requireRule(s.finance.ledger[w.withdrawalId]?.amountCents===w.paidCents,'WITHDRAWAL_LEDGER_MISMATCH');
    requireRule(Object.values(w.recoveryAllocations).reduce((a,b)=>add(a,integer(b)),0)===w.recoveryCents,'RECOVERY_MISMATCH');
  }
  for(const r of Object.values(s.recoveries)){const w=s.withdrawals[r.withdrawalId];integer(r.settledCents,0,r.amountCents);requireRule(w?.characterId===r.characterId&&multiply(r.refundedBaseCents,w.multiplier)===r.amountCents,'RECOVERY_MISMATCH');const settled=Object.values(s.withdrawals).reduce((n,w)=>add(n,w.recoveryAllocations[r.recoveryId]||0),0);requireRule(settled===r.settledCents,'RECOVERY_MISMATCH');}
  return true;
}
function markFact(s,e,anchor) {
  const fid=id(e.factId); if (Object.hasOwn(s.facts,fid)) return false;
  s.facts[fid] = {type:e.type,sourceAnchor:clone(anchor),sourceKey:e.sourceKey}; return true;
}
function applyEvent(s,e,eventKey,anchor) {
  const requirePerson = () => active(s,e.personRef);
  switch(e.type) {
    case 'CHARACTER_PROFILE_PROPOSED': {
      const cid=id(e.character?.id); const old=s.characters[cid];
      if(old) return;
      const tempId=e.tempId ? id(e.tempId) : null;
      if(tempId && (s.hiddenTemporary[tempId] || s.identityMap[tempId])) return;
      requireRule(e.contacted === true,'CONTACT_NOT_CONFIRMED');
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
      s.scene.temporaryActors=(e.temporaryActors || []).map(t=>({tempId:id(t.tempId),name:text(t.name,50),description:text(t.description,400)}))
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
      const delta=Math.max(-12,Math.min(12,e.delta)),prior=c.affection;
      const round=Object.values(s.facts).filter(f=>f.type==='AFFECTION_CHANGE'&&f.personRef===c.id&&key(f.sourceAnchor)===key(anchor));
      const spent=round.reduce((n,f)=>n+Math.abs(f.finalDelta),0),limit=12;
      const adjusted=delta>0?Math.max(0,delta+(prior<70?beautyTier(s.user.beautyScore).modifier:0)):delta;
      const finalDelta=Math.sign(adjusted)*Math.min(Math.abs(adjusted),Math.max(0,limit-spent));
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');c.affection=Math.max(0,Math.min(100,prior+finalDelta));
      Object.assign(s.facts[e.factId],{personRef:c.id,baseDelta:delta,finalDelta:c.affection-prior,priorAffection:prior});return;
    }
    case 'RELATIONSHIP_CHANGE': {
      const c=requirePerson();if(!tracked(c))return;
      c.relationshipLabel=text(e.label,12);
      c.relationshipNotes=text(e.notes || '',300,true);return;
    }
    case 'CASH_TRANSACTION': {
      requireRule(e.completed===true,'NOT_COMPLETED');requireRule(!/(?:打算|将要|准备|计划|承诺|还没|尚未|未付款|未支付)/.test(e.evidence)||/(?:已经|支付成功|付款成功|付清|退款到账|实际支付)/.test(e.evidence),'PAYMENT_NOT_PROVEN');integer(e.amountCents,1);requireRule(['IN','OUT'].includes(e.direction),'INVALID_DIRECTION');
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
          acquisitionEventId:e.factId,acquisitionIsInitial:false,description:assetDescription({...a,bookValueCents:a.bookValueCents??e.amountCents}),locationNote:text(a.locationNote ?? '',300,true),ownershipNote:'本人全额所有，无债务'};
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
      addLedger(s,eventKey,{...e,kind:'ASSET_TRANSFER',direction:'NONE',amountCents:0,itemName:a.name,allocations:[{personRef:e.personRef,amountCents:basis}]},anchor);
      credit(s,e.personRef,basis,eventKey,anchor,'SPEND_CREDIT',{relatedLedgerId:eventKey,relatedAssetId:a.assetId,originalCents:basis});return;
    }
    case 'TRANSACTION_REFUND': {
      integer(e.amountCents,1);requireRule(e.completed===true,'NOT_COMPLETED');
      const original=Object.values(s.finance.ledger).find(l=>l.eventId===e.refundOf&&l.direction==='OUT');requireRule(original,'REFUND_SOURCE_MISSING');
      const returned=Object.values(s.finance.ledger).filter(l=>l.refundOf===e.refundOf).reduce((v,l)=>add(v,l.amountCents),0);
      requireRule(add(returned,e.amountCents)<=original.amountCents,'REFUND_EXCEEDS_PAYMENT');
      const priorRefunds=Object.values(s.finance.ledger).filter(l=>l.refundOf===e.refundOf);
      const priorAmount=cid=>priorRefunds.reduce((n,l)=>add(n,l.allocations.find(a=>a.personRef===cid)?.amountCents||0),0);
      const remaining=original.amountCents-returned;
      let allocations;
      if(e.refundAllocations!==undefined){
        requireRule(Array.isArray(e.refundAllocations),'INVALID_ALLOCATION');const seen=new Set();let total=0;
        allocations=e.refundAllocations.map(a=>{requireRule(!seen.has(a.personRef),'DUPLICATE_ALLOCATION');seen.add(a.personRef);const old=original.allocations.find(x=>x.personRef===a.personRef);requireRule(old,'INVALID_ALLOCATION');integer(a.amountCents,0,old.amountCents-priorAmount(a.personRef));total=add(total,a.amountCents);return clone(a);});
        requireRule(total<=e.amountCents,'ALLOCATION_EXCEEDS_COST');
        const remainingAllocated=original.allocations.reduce((n,a)=>add(n,a.amountCents-priorAmount(a.personRef)),0);
        requireRule(e.amountCents-total<=remaining-remainingAllocated,'REFUND_ALLOCATION_REQUIRED');
      }else allocations=original.allocations.map(a=>{const prior=priorAmount(a.personRef);const amount=priorRefunds.some(l=>l.targetedRefund)?Number(BigInt(a.amountCents-prior)*BigInt(e.amountCents)/BigInt(remaining)):Number(BigInt(a.amountCents)*BigInt(returned+e.amountCents)/BigInt(original.amountCents))-prior;return {personRef:a.personRef,amountCents:amount};});
      let transfer=null;
      if(original.assetId){const a=s.finance.assets[original.assetId];requireRule(a&&['OWNED','TRANSFERRED'].includes(a.status),'ASSET_RETURN_NOT_OWNED');
        if(a.status==='TRANSFERRED')requireRule(e.receivedBack===true,'ASSET_RETURN_NOT_OWNED');
        if(returned+e.amountCents===original.amountCents){requireRule(e.returnedAsset===true,'ASSET_RETURN_CONFIRMATION_REQUIRED');a.status='RETURNED';a.ownerId='EXTERNAL';}
        a.basisCents=original.amountCents-returned-e.amountCents;a.bookValueCents=Math.min(a.bookValueCents,a.basisCents);
        transfer=Object.values(s.finance.ledger).find(l=>l.kind==='ASSET_TRANSFER'&&l.assetId===original.assetId);
      }
      const rewards=Object.values(s.rewardEvents).filter(r=>r.relatedLedgerId===original.entryId||transfer&&r.relatedLedgerId===transfer.entryId);
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');
      for(const r of rewards){const reduction=r.relatedLedgerId===transfer?.entryId?e.amountCents:(allocations.find(a=>a.personRef===r.characterId)?.amountCents||0);integer(reduction,0,r.cashbackCents-r.refundedCents);r.refundedCents=add(r.refundedCents,reduction);
        if(r.withdrawalId&&reduction){const w=s.withdrawals[r.withdrawalId],rid=key(eventKey,r.eventId);s.recoveries[rid]={recoveryId:rid,characterId:r.characterId,rewardEventId:r.eventId,withdrawalId:w.withdrawalId,refundLedgerId:eventKey,refundedBaseCents:reduction,amountCents:multiply(reduction,w.multiplier),settledCents:0,sourceAnchor:clone(anchor)};}
      }
      s.user.cashCents=add(s.user.cashCents,e.amountCents);addLedger(s,eventKey,{...e,allocations,direction:'IN',kind:'REFUND',payer:'EXTERNAL',assetId:original.assetId},anchor);s.finance.ledger[eventKey].targetedRefund=e.refundAllocations!==undefined||priorRefunds.some(l=>l.targetedRefund);return;
    }
    case 'SIGNIFICANT_BEHAVIOR_SCORE': {
      const c=requirePerson();if(!tracked(c))return;
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
  const result=processEvents(state,envelope.events,anchor,sourceText,false);assertState(result.state);return result.state;
}
// Native proposals are one batch. A rejected event rolls back only its own writes.
export function settleEvents(state,events,anchor,sourceText,affectionEvents=[]){return processEvents(state,events,anchor,sourceText,true,affectionEvents);}
function processEvents(state,events,anchor,sourceText,partial,affectionEvents=[]){
  requireRule(Array.isArray(events)&&events.length<=40,'INVALID_ENVELOPE');
  requireRule(anchor?.branchKey===state.meta.branchKey&&typeof anchor.fingerprint==='string','STALE_SOURCE');
  assertEconomy(state);
  let s=clone(state);const diagnostics=[],ordinals=new Set(),scored=new Set();let scoreCount=0;
  const proposals=[...events,...affectionEvents];
  for(let i=0;i<proposals.length;i++){
    const raw=proposals[i];
    try{
    requireRule(raw&&typeof raw==='object'&&!Array.isArray(raw),'INVALID_EVENT');
    // Only settlement-created changes are trusted; a model-supplied auto flag grants nothing.
    if(raw.type==='AFFECTION_CHANGE'&&i<events.length)continue;
    if(partial)requireRule(['CASH_TRANSACTION','ASSET_TRANSFER','TRANSACTION_REFUND','BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE','AFFECTION_CHANGE'].includes(raw.type),'UNKNOWN_EVENT');
    const e=normalizeEvent(partial?{...raw,ordinal:i}:raw,anchor);
    const ordinal=integer(e.ordinal,0,100);requireRule(!ordinals.has(ordinal),'DUPLICATE_ORDINAL');ordinals.add(ordinal);
    if(e.type==='AFFECTION_CHANGE'&&Object.values(s.facts).some(f=>f.type===e.type&&f.personRef===e.personRef&&key(f.sourceAnchor)===key(anchor)))continue;
    if(e.type==='SIGNIFICANT_BEHAVIOR_SCORE'){
      if(!s.characters[e.personRef]||s.characters[e.personRef].trackingState!=='RECORDED'||scoreCount>=3||scored.has(e.personRef))continue;
      scored.add(e.personRef);scoreCount++;
      if(Object.values(s.facts).some(f=>f.type===e.type&&f.personRef===e.personRef&&key(f.sourceAnchor)===key(anchor)))continue;
    }
    if(['CASH_TRANSACTION','TRANSACTION_REFUND','ASSET_TRANSFER'].includes(e.type)){
      const evidence=text(e.evidence,360,false,'evidence');requireRule(hasEvidence(sourceText,evidence),'EVIDENCE_NOT_IN_SOURCE');
    }
    const eventKey=key(anchor.branchKey,anchor.messageId,anchor.swipeId,anchor.fingerprint,ordinal,e.type,e.personRef || '');
    if(s.operationHistory[eventKey])continue;
    if(e.factId && Object.hasOwn(s.facts,id(e.factId)))continue;
    if(Object.values(s.facts).some(f=>f.sourceKey===e.sourceKey))continue;
    const next=clone(s);applyEvent(next,e,eventKey,anchor);assertEconomy(next);
    next.operationHistory[eventKey]={type:e.type,status:'COMMITTED',revision:state.meta.revision+1};s=next;
    }catch(error){
      if(!partial)throw error;
      diagnostics.push({factId:raw?.factId,eventType:raw?.type,person:raw?.personRef,ordinal:i,code:error.message,...(error.field?{field:error.field}:{})});
    }
  }
  s.meta.revision=state.meta.revision+1;s.meta.sourceAnchor=clone(anchor);return {state:s,diagnostics};
}
export function normalizeEvent(value,anchor){
  requireRule(value&&typeof value==='object','INVALID_EVENT');const e=clone(value);
  if(e.type==='BEHAVIOR')e.type='SIGNIFICANT_BEHAVIOR_SCORE';
  if(e.type==='SIGNIFICANT_BEHAVIOR_SCORE'){
    const score=typeof e.score==='number'||typeof e.score==='string'?Number(e.score):NaN;
    e.score=Number.isFinite(score)?Math.max(0,Math.min(100,Math.round(score))):0;
    e.action=typeof e.action==='string'?e.action.trim().slice(0,80):'人物互动';
    e.reason=typeof e.reason==='string'?e.reason.trim().slice(0,300):'';
    if(typeof e.milestone!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(e.milestone)||['__proto__','prototype','constructor'].includes(e.milestone))delete e.milestone;
    e.sourceKey=key(anchor.branchKey,anchor.messageId,anchor.swipeId,anchor.fingerprint,e.type,e.personRef||'');
    e.factId=e.factId||sourceId(e.sourceKey);return e;
  }
  const amount=(obj,field='amount')=>{if(obj[field+'Yuan']!==undefined){const n=cents(obj[field+'Yuan']);requireRule(obj[field+'Cents']===undefined||obj[field+'Cents']===n,'AMBIGUOUS_MONEY');obj[field+'Cents']=n;}};
  amount(e);for(const a of e.allocations||[])amount(a);for(const a of e.refundAllocations||[])amount(a);if(e.asset)amount(e.asset,'bookValue');
  e.sourceKey=key(anchor.branchKey,anchor.messageId,anchor.swipeId,anchor.fingerprint,e.type,e.personRef||'',e.evidence,e.amountCents??e.delta??e.assetId??'');
  e.factId=e.factId||sourceId(e.sourceKey);return e;
}
export function hasEvidence(source,evidence) {
  if(typeof source!=='string'||typeof evidence!=='string'||!evidence.trim())return false;
  if(source.includes(evidence))return true;
  // Ignore layout whitespace only; omitted passages require explicit ellipses and retain order.
  const normalized=source.replace(/\s+/g,''),quote=evidence.replace(/\s+/g,'');
  if(quote.length>=6&&normalized.includes(quote))return true;
  const excerpts=quote.split(/…+|\.{3,}/);
  if(excerpts.length>1&&excerpts.length<=8){let cursor=0;return excerpts.every(p=>{if(p.length<6)return false;const at=normalized.indexOf(p,cursor);if(at<0)return false;cursor=at+p.length;return true;});}
  // A quote may join several verbatim sentences from one scene. Each fragment must
  // still occur in source order; no fuzzy matching or invented replacement text.
  const parts=evidence.match(/[^。！？!?]+[。！？!?]?/g)||[];
  if(parts.length<2||parts.length>8)return false;
  let from=0;
  for(const part of parts){const p=part.trim();if(p.length<6)return false;const at=source.indexOf(p,from);if(at<0)return false;from=at+p.length;}
  return true;
}
export function canWithdraw(s,cid) { const c=s.characters[cid];return !!(c&&tracked(c)&&c.affection>=90&&poolParts(s,cid).total>0); }
export function applyOperation(state,op,anchor) {
  id(op.operationId);requireRule(anchor.branchKey===state.meta.branchKey,'STALE_SOURCE');
  if(state.operationHistory[op.operationId])return clone(state);
  requireRule(op.expectedRevision===state.meta.revision,'STALE_REVISION');
  const s=clone(state);let result={};
  if(op.type==='PLAYER_HIDE_TEMP') {
    id(op.tempId);const temp=s.scene.temporaryActors.find(t=>t.tempId===op.tempId);requireRule(temp,'UNKNOWN_PERSON');s.hiddenTemporary[op.tempId]=clone(temp);s.scene.temporaryActors=s.scene.temporaryActors.filter(t=>t.tempId!==op.tempId);
  } else if(op.type==='PLAYER_RESTORE_TEMP') {
    id(op.tempId);requireRule(s.hiddenTemporary[op.tempId],'UNKNOWN_PERSON');delete s.hiddenTemporary[op.tempId];
  } else {
    const c=active(s,op.personRef);
    if(op.type==='PLAYER_WITHDRAW') {
      requireRule(canWithdraw(s,c.id),'WITHDRAWAL_LOCKED');const q=withdrawalQuote(s,c.id),allocations={},recoveryAllocations={};
      for(const r of Object.values(s.rewardEvents))if(r.characterId===c.id&&r.valid&&!r.withdrawalId&&r.cashbackCents>r.refundedCents){r.withdrawalId=op.operationId;r.claimedCents=r.cashbackCents-r.refundedCents;allocations[r.eventId]=r.claimedCents;}
      let recovery=q.recoveryCents;for(const r of Object.values(s.recoveries))if(r.characterId===c.id&&recovery){const amount=Math.min(recovery,r.amountCents-r.settledCents);if(amount){recoveryAllocations[r.recoveryId]=amount;r.settledCents=add(r.settledCents,amount);recovery-=amount;}}
      const w={withdrawalId:op.operationId,characterId:c.id,status:'COMMITTED',basePoolCents:q.total,spendCents:q.spend,criticalCents:q.crit,preCashCents:s.user.cashCents,tierId:q.tier.id,tierLabel:q.tier.label,multiplier:q.tier.multiplier,grossCents:q.gross,paidCents:q.paidCents,recoveryCents:q.recoveryCents,allocations,recoveryAllocations,sourceAnchor:clone(anchor),recordedAtScene:s.scene.timeHint};
      s.withdrawals[op.operationId]=w;s.user.cashCents=add(s.user.cashCents,w.paidCents);
      addLedger(s,op.operationId,{factId:op.operationId,kind:'WITHDRAWAL_REWARD',direction:'IN',amountCents:w.paidCents,payer:'TERMINAL',personRef:c.id,memo:c.name+' · '+w.tierLabel+'提现'},anchor);
      result={amountCents:w.paidCents,personRef:c.id,withdrawalId:op.operationId};
    } else if(op.type==='PLAYER_BUILD_PROFILE') {
      requireRule(tracked(c)&&!c.profileFixed,'PROFILE_ALREADY_BUILT');c.profileFixed=profile(op.profileFixed);c.profileLocked=false;
    } else if(op.type==='PLAYER_LOCK_PROFILE') {
      requireRule(tracked(c)&&c.profileFixed,'PROFILE_INCOMPLETE');requireRule(typeof op.locked==='boolean','INVALID_DRAFT');c.profileLocked=op.locked;
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
  const ledgerByFact=new Map(Object.values(s.finance.ledger).map(l=>[l.eventId,l]));
  const pendingBasicProfiles=Object.values(s.characters).filter(c=>tracked(c)).map(c=>{
    const missing=['beautyScore','personalityTags','appearance','body','heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu'].filter(k=>c[k]==null||c[k]===''||Array.isArray(c[k])&&!c[k].length);
    return {id:c.id,name:c.name,age:c.age,occupation:c.occupation,knownFacts:c.knownFacts,...basicProfile(c),beautyScore:c.beautyScore,missing};
  }).filter(c=>c.missing.length);
  // Match persisted character paths so models can copy a stable ID and field name.
  const characters=Object.fromEntries(Object.values(s.characters).map(c=>[c.id,{id:c.id,name:c.name,aliases:c.aliases,trackingState:c.trackingState,
    ...(tracked(c)&&s.scene.presentCharacterIds.includes(c.id)?{age:c.age,beautyScore:c.beautyScore,occupation:c.occupation,...basicProfile(c),affection:c.affection,relationshipLabel:c.relationshipLabel,relationshipNotes:c.relationshipNotes,knownFacts:c.knownFacts,currentClothes:c.currentClothes,currentPose:c.currentPose,currentAction:c.currentAction,currentExpression:c.currentExpression,currentMood:c.currentMood,currentCondition:c.currentCondition,currentItems:c.currentItems,...(c.profileFixed&&!c.profileLocked?{profileFixed:c.profileFixed}:{})}: {})}]));
  return {schemaVersion:3,revision:s.meta.revision,user:{...s.user,wealthTier:wealthTier(s.user.cashCents)},scene:s.scene,characters,pendingBasicProfiles,
    assets:Object.values(s.finance.assets).filter(a=>a.ownerId==='USER'&&a.status==='OWNED').map(a=>({assetId:a.assetId,name:a.name,kind:a.kind,description:a.description,locationNote:a.locationNote,ownershipNote:a.ownershipNote,bookValueCents:a.bookValueCents})),
    recentFacts:Object.entries(s.facts).slice(-60).map(([factId,f])=>{const l=ledgerByFact.get(factId);return {factId,type:f.type,...(l?{kind:l.kind,itemName:l.itemName,amountCents:l.amountCents,assetId:l.assetId,refundOf:l.refundOf}:{})};}),rule:'只提出新事实，不直接写现金、奖池或提现。已列factId不得再次入账；退款的refundOf按交易名称、金额与资产匹配原付款factId，不猜ID。'};
}
