// 想法池 07：开局表单必填校验规则（纯函数，便于单测）。
// rc.56-formA：按 4N 方案《开局表单：限制可见、越界输入与预设补齐》重建为本文件。
// 规则口径唯一真相仍是 engine.js 的 validateDraft / basicProfile / cents；本文件只负责「把口径翻译成逐字段可判定的规则 + 玩家看得懂的文案键」。
// 所有玩家可见文案从 ./opening-copy.generated.js 引入（该文件由 scripts/extract-opening-copy.mjs 从方案代码块逐字抠取，禁止手改）。
import {cents} from '../core/engine.js';
import {SETUP_FIELD_HINTS,SETUP_FIELD_ERRORS} from './opening-copy.generated.js';

export {SETUP_FIELD_HINTS,SETUP_FIELD_ERRORS};

// ---- 必填列表（沿用 rc.33 口径，单测依赖） ----
export const STEP_REQUIRED={0:['name','gender','occupation','appearance','body','background'],1:['currentLocation','startDate','startTime']};
export function missingInStep(draft,step){
  const missing=(STEP_REQUIRED[step]||[]).filter(k=>!String(draft?.[k]??'').trim());
  if(step===0&&!(Number.isInteger(Number(draft?.age))&&Number(draft.age)>=1))missing.unshift('age');
  return missing;
}

// rc.56 修复（保留）：这四个整数项越界会让整份草稿校验抛 INVALID_INTEGER，而提示不点名。
export const SETUP_INTEGER_RANGES={age:[18,80],heightCm:[140,230],weightKg:[35,200],shoeSizeEu:[34,52]};
export function blameIntegerField(draft){
  for(const [key,[min,max]] of Object.entries(SETUP_INTEGER_RANGES)){
    const raw=draft?.[key];
    if(raw===null||raw===undefined||raw==='')continue;
    const value=Number(raw);
    if(key==='age'&&!Number.isSafeInteger(value))return key;
    if(!(Number.isFinite(value)&&value>=min&&value<=max))return key;
  }
  return '';
}

// ---- 字段规则表（数值/长度均取自 4N 方案 §1，与 engine.js 对齐） ----
// kind: int 有界整数 | decimal 可留空小数 | text 文本 | date | time | money | tags
export const SETUP_FIELD_RULES={
  name:{kind:'text',required:true,max:50},
  age:{kind:'int',required:true,min:18,max:80},
  gender:{kind:'text',required:true,max:40},
  occupation:{kind:'text',required:true,max:100},
  heightCm:{kind:'decimal',min:140,max:230,metersBelow:3,errorKey:'heightCm'},
  weightKg:{kind:'decimal',min:35,max:200,errorKey:'weightKg'},
  shoeSizeEu:{kind:'decimal',min:34,max:52,errorKey:'shoeSizeEu'},
  beautyScore:{kind:'int',min:1,max:100},
  prowessScore:{kind:'int',min:1,max:100},
  _gen_length:{kind:'text',max:40},
  _gen_girth:{kind:'text',max:40},
  _gen_traits:{kind:'text',max:300},
  appearance:{kind:'text',required:true,max:500},
  body:{kind:'text',required:true,max:500},
  background:{kind:'text',required:true,max:1200},
  currentLocation:{kind:'text',required:true,max:150},
  workLifeDescription:{kind:'text',max:600},
  startDate:{kind:'date',required:true},
  startTime:{kind:'time',required:true},
  weather:{kind:'text',max:150},
  a_name:{kind:'text',required:true,max:120},
  a_value:{kind:'money'},
  a_note:{kind:'text',max:300},
  a_description:{kind:'text',max:50},
  a_owner:{kind:'text',max:300},
  c_brief:{kind:'text',max:400},
  c_name:{kind:'text',required:true,max:50},
  c_age:{kind:'int',required:true,min:18,max:80},
  c_relation:{kind:'text',max:12},
  c_aff:{kind:'int',min:0,max:100},
  c_corruption:{kind:'int',min:0,max:100},
  c_beauty:{kind:'int',min:1,max:100},
  c_job:{kind:'text',max:100},
  c_cupSize:{kind:'text',max:8},
  c_addressing:{kind:'text',max:20},
  c_personalityTags:{kind:'tags',maxCount:6,maxLength:12},
  c_appearance:{kind:'text',max:500},
  c_body:{kind:'text',max:500},
  c_heightCm:{kind:'decimal',min:100,max:230,metersBelow:3,errorKey:'c_heightCm'},
  c_weightKg:{kind:'decimal',min:25,max:250,errorKey:'c_weightKg'},
  c_bustCm:{kind:'decimal',min:40,max:200,errorKey:'c_bustCm'},
  c_waistCm:{kind:'decimal',min:30,max:200,errorKey:'c_waistCm'},
  c_hipCm:{kind:'decimal',min:40,max:200,errorKey:'c_hipCm'},
  c_shoeSizeEu:{kind:'decimal',min:25,max:55,errorKey:'c_shoeSizeEu'},
  c_recentGoal:{kind:'text',max:200},
  c_longTermDream:{kind:'text',max:200},
  c_notes:{kind:'text',max:1200},
  c_chestDetail:{kind:'text',max:200},
  c_vaginaLook:{kind:'text',max:200},
  c_pubicHair:{kind:'text',max:120},
  c_bodyScent:{kind:'text',max:120},
  c_traits:{kind:'text',max:400},
};

// 每一步要校验的字段（方案 §5 validateStep）
export const STEP_FIELDS={
  0:['name','age','gender','occupation','heightCm','weightKg','shoeSizeEu','beautyScore','prowessScore','_gen_length','_gen_girth','_gen_traits','appearance','body','background'],
  1:['currentLocation','workLifeDescription','startDate','startTime','weather'],
};
const ASSET_FIELDS=['a_name','a_value','a_note','a_description','a_owner'];
const CONTACT_FIELDS=['c_brief','c_name','c_age','c_relation','c_aff','c_corruption','c_beauty','c_job','c_cupSize','c_addressing','c_personalityTags','c_appearance','c_body','c_heightCm','c_weightKg','c_bustCm','c_waistCm','c_hipCm','c_shoeSizeEu','c_recentGoal','c_longTermDream','c_notes','c_chestDetail','c_vaginaLook','c_pubicHair','c_bodyScent','c_traits'];

// ---- 输入清洗（方案 §2.5：IME 后统一清洗；粘贴 178cm / 72.5 kg / 42码 也能救回来） ----
const FULL_DIGIT=/[０-９]/g;
export function toHalfWidth(raw){
  return String(raw??'')
    .replace(FULL_DIGIT,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/[．。｡]/g,'.')
    .replace(/：/g,':')
    .replace(/[－—–−]/g,'-');
}
// allowDecimal=false → 只留整数位；true → 只留数字与「至多一个」小数点
export function normalizeNumericInput(raw,{allowDecimal=false}={}){
  const half=toHalfWidth(raw);
  if(!allowDecimal)return half.replace(/[^0-9]/g,'');
  const kept=half.replace(/[^0-9.]/g,'');
  const [head,...rest]=kept.split('.');
  return rest.length?head+'.'+rest.join(''):head;
}
// 文本类（日期/时间）只做全角转半角，不删字符
export const normalizeTextInput=toHalfWidth;

export function clampInteger(raw,min,max){
  const digits=normalizeNumericInput(raw);
  if(!digits)return null;
  const n=Number(digits);
  if(!Number.isFinite(n))return null;
  return Math.min(max,Math.max(min,Math.round(n)));
}
// 小数：合法则按 engine 口径（一位小数）返回数字；非法原样返回 null 由调用方保留原值标错
export function parseDecimal(raw,min,max){
  const s=normalizeNumericInput(raw,{allowDecimal:true});
  if(!s||s==='.')return null;
  const n=Number(s);
  if(!Number.isFinite(n))return null;
  if(n<min||n>max)return null;
  return Math.round(n*10)/10;
}
const isRealDate=s=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const [y,m,d]=s.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
};
const isTime=s=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
const splitTags=s=>String(s??'').split(/[、,，]/).map(x=>x.trim()).filter(Boolean);

// ---- 单字段校验：返回错误文案键（'' 表示合法） ----
// 空值/非法共用的错误键（方案的错误文案表里，日期与时间只有 invalid 一条，没有 required）
const REQUIRED_ALIAS={startDate:'startDate_invalid',startTime:'startTime_invalid'};
export function validateField(key,raw){
  const rule=SETUP_FIELD_RULES[key];
  if(!rule)return '';
  const empty=raw===null||raw===undefined||String(raw).trim()==='';
  if(rule.required&&empty)return REQUIRED_ALIAS[key]||`${key}_required`;
  if(empty)return '';
  if(rule.kind==='text'){
    const len=String(raw).trim().length;
    if(rule.max&&len>rule.max)return `${key}_tooLong`;
    return '';
  }
  if(rule.kind==='int'){
    const digits=normalizeNumericInput(raw);
    if(!digits)return `${key}_required`;
    const n=Number(digits);
    if(!Number.isSafeInteger(n)||n<rule.min||n>rule.max)return `${key}_range`;
    return '';
  }
  if(rule.kind==='decimal'){
    const s=normalizeNumericInput(raw,{allowDecimal:true});
    const n=Number(s);
    if(!s||s==='.'||!Number.isFinite(n))return `${rule.errorKey}_range`;
    if(rule.metersBelow&&n>0&&n<rule.metersBelow)return `${rule.errorKey}_meters`;
    if(n<rule.min||n>rule.max)return `${rule.errorKey}_range`;
    return '';
  }
  if(rule.kind==='date')return isRealDate(toHalfWidth(String(raw)).trim())?'':'startDate_invalid';
  if(rule.kind==='time')return isTime(toHalfWidth(String(raw)).trim())?'':'startTime_invalid';
  if(rule.kind==='money'){
    try{cents(String(raw));return '';}
    catch(e){return e?.message==='MONEY_OVERFLOW'?'a_value_overflow':'a_value_invalid';}
  }
  if(rule.kind==='tags'){
    const tags=splitTags(raw);
    if(tags.length>rule.maxCount)return 'c_personalityTags_count';
    if(tags.some(t=>t.length>rule.maxLength))return 'c_personalityTags_len';
    return '';
  }
  return '';
}
export const errorTextFor=code=>SETUP_FIELD_ERRORS[code]||'';

// ---- 整步校验：返回首个问题 {key,code,message}，全合法返回 null ----
export function validateStep(draft,step){
  for(const key of STEP_FIELDS[step]||[]){
    const code=validateField(key,draft?.[key]);
    if(code)return {key,code,message:errorTextFor(code)};
  }
  return null;
}
// 弹窗校验：只查本次表单 + 数量上限，不再跑整份 validateDraft（方案 §2.4）
export function validateAssetDraft(item,existingCount=0,isEdit=false){
  if(!isEdit&&existingCount>=100)return {key:'a_name',code:'a_limit',message:errorTextFor('a_limit')};
  for(const key of ASSET_FIELDS){
    const code=validateField(key,item?.[key]);
    if(code)return {key,code,message:errorTextFor(code)};
  }
  return null;
}
export function validateContactDraft(contact,existingCount=0,isEdit=false){
  if(!isEdit&&existingCount>=20)return {key:'c_name',code:'c_limit',message:errorTextFor('c_limit')};
  for(const key of CONTACT_FIELDS){
    const code=validateField(key,contact?.[key]);
    if(code)return {key,code,message:errorTextFor(code)};
  }
  return null;
}
// 旧草稿扫的是「已落库形状」（asset.bookValueCents / contact.name…），与弹窗表单的 c_*/a_* 原始字符串不同，这里做一次映射。
export function validateDraftAsset(a){
  if(!String(a?.name??'').trim())return {key:'a_name',code:'a_name_required',message:errorTextFor('a_name_required')};
  const centsValue=a?.bookValueCents;
  if(!Number.isSafeInteger(centsValue)||centsValue<0)return {key:'a_value',code:'a_value_invalid',message:errorTextFor('a_value_invalid')};
  return null;
}
export function validateDraftContact(c){
  const view={
    c_name:c?.name,c_age:c?.age,c_relation:c?.relationshipLabel,c_aff:c?.affection,c_corruption:c?.corruption??0,
    c_beauty:c?.beautyScore,c_job:c?.occupation,c_cupSize:c?.cupSize,c_addressing:c?.addressing,
    c_personalityTags:Array.isArray(c?.personalityTags)?c.personalityTags.join('、'):c?.personalityTags,
    c_appearance:c?.appearance,c_body:c?.body,c_heightCm:c?.heightCm,c_weightKg:c?.weightKg,c_bustCm:c?.bustCm,
    c_waistCm:c?.waistCm,c_hipCm:c?.hipCm,c_shoeSizeEu:c?.shoeSizeEu,c_recentGoal:c?.recentGoal,
    c_longTermDream:c?.longTermDream,c_notes:c?.notes,
    c_chestDetail:c?.physiology?.chestDetail,c_vaginaLook:c?.physiology?.vaginaLook,c_pubicHair:c?.physiology?.pubicHair,
    c_bodyScent:c?.physiology?.bodyScent,c_traits:c?.physiology?.traits,
  };
  return validateContactDraft(view,0,true);
}
// 旧草稿扫描：跨步找第一个问题，供顶部横幅与「去修改」使用（方案 §6）
export function findFirstDraftIssue(draft){
  for(const step of [0,1]){
    const hit=validateStep(draft,step);
    if(hit)return {...hit,step,scope:'field'};
  }
  for(const a of draft?.initialAssets||[]){
    const hit=validateDraftAsset(a);
    if(hit)return {...hit,step:1,scope:'asset',name:a?.name||''};
  }
  for(const c of draft?.contacts||[]){
    const hit=validateDraftContact(c);
    if(hit)return {...hit,step:2,scope:'contact',name:c?.name||''};
  }
  return null;
}
// 旧草稿加载：只对颜值/性能力静默钳位（滑块展示不了越界值，其余字段保留原值让玩家改），方案 §6 第一条
export function sanitizeLoadedDraft(draft){
  if(!draft||typeof draft!=='object')return draft;
  const clamp=(v,min,max,fallback)=>{
    const n=Number(v);
    if(!Number.isFinite(n))return fallback;
    return Math.min(max,Math.max(min,Math.round(n)));
  };
  draft.beautyScore=clamp(draft.beautyScore,1,100,60);
  draft.prowessScore=clamp(draft.prowessScore,1,100,70);
  return draft;
}
