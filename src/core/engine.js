import config from '../../project.json' with {type:'json'};

export const PROFILE_KEYS = ['identity','appearance','body','personality','habits','style','family','career','social'];
export const PROFILE_LABELS = ['基础身份与学历籍贯','容貌气质与辨识细节','身材体态与私密特征','双面性格与行事做派','日常作息与生活喜好','穿搭审美与私下打扮','原生家庭与成长经历','事业现状与短期目标','情感经历与择偶偏好'];
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
export function wealthTier(cash){
  integer(cash);
  return cash<1000000000?{id:'trainee',label:'新晋神豪·十倍',multiplier:10}
    :cash<10000000000?{id:'junior',label:'豪门新贵·八倍',multiplier:8}
    :cash<100000000000?{id:'middle',label:'资本巨鳄·五倍',multiplier:5}
    :cash<1000000000000?{id:'senior',label:'云澜大亨·三倍',multiplier:3}
    :{id:'max',label:'财阀霸主·二倍',multiplier:2};
}
export function beautyTier(score){integer(score,1,100);return score<20?{label:'丑陋无比',modifier:-2}:score<50?{label:'有点难看的路人',modifier:-1}:score<70?{label:'平平无奇的普通人，还算看得过去',modifier:0}:score<90?{label:'颜值出众，更容易获得好感',modifier:1}:{label:'倾国倾城，万中无一',modifier:2};}
// Symmetric counterpart to beauty: his prowess moves her corruption once the
// body has actually been experienced, never on looks alone.
export function prowessTier(score){integer(score,1,100);
  return score<25?{label:'力不从心，难以为继',modifier:-1}:score<50?{label:'表现平平，尚待磨练',modifier:0}:score<75?{label:'精力充沛，颇具章法',modifier:1}:score<90?{label:'器大活好，蚀骨销魂',modifier:2}:{label:'极乐神躯，人间打桩机',modifier:3};}
export function sourceId(value){let h=14695981039346656037n;for(const c of value){h^=BigInt(c.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return 'fact_'+h.toString(16);}
export function id(value) { requireRule(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !['__proto__','prototype','constructor'].includes(value), 'INVALID_ID'); return value; }
export const key = (...args) => JSON.stringify(args);
// Same event, same money. With a seed the tier pays a whole-yuan amount inside
// [minCents, maxCents] derived from a stable hash, so replays stay identical.
export function reward(score, seed = '', mode = '') {
  integer(score, 0, 100);
  const tiers = config.rewardTiers;
  let idx = tiers.length - 1;
  while (idx > 0 && score < tiers[idx].minScore) idx--;
  const tier = tiers[idx];
  if (!tier.amountCents) return { ...tier, amountCents: 0, label: mode === 'INTIMATE' ? (tier.intimateLabel || tier.label) : tier.label };
  const min = tier.minCents ?? tier.amountCents;
  const max = tier.maxCents ?? tier.amountCents;
  let amountCents = tier.amountCents;
  if (seed && max > min) {
    let h = 2166136261 >>> 0;
    const str = String(seed) + ':' + String(score);
    for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    // Higher scores inside a tier lean towards the top of that tier's range;
    // the hash supplies the rest, always in whole yuan.
    const nextMin = tiers[idx + 1]?.minScore ?? 101;
    const ratio = Math.max(0, Math.min(1, (score - tier.minScore) / Math.max(1, nextMin - 1 - tier.minScore)));
    const spanYuan = Math.floor((max - min) / 100);
    const baseYuan = Math.floor(spanYuan * ratio * 0.45);
    const randYuan = h % Math.max(1, spanYuan - baseYuan + 1);
    amountCents = min + (baseYuan + randYuan) * 100;
  }
  const isIntimate = mode === 'INTIMATE' || /湿吻|热吻|丝袜|制服|口交|口侍|乳交|足交|玉足|内射|中出|无套|交欢|插入|破处|初夜|高潮|痉挛|潮吹|求饶|侍奉|爱抚|揉捏|掀裙|承欢|云雨/.test(String(seed));
  const label = isIntimate ? (tier.intimateLabel || tier.label) : tier.label;
  return { ...tier, amountCents, label, mode: isIntimate ? 'INTIMATE' : 'BREAKTHROUGH' };
}
export function stage(n) {
  integer(n,0,100); return n === 100 ? '极致倾心' : n >= 95 ? '极深羁绊' : n >= 90 ? '高度投入' : n >= 80 ? '深厚情感' : n >= 70 ? '恋爱发展' : n >= 60 ? '亲近与好感' : n >= 40 ? '朋友与信任' : n >= 20 ? '初步熟悉' : '陌生与戒备';
}
// Second axis: how far her self-restraint and private boundaries have given way.
export function corruptionStage(n) {
  integer(n,0,100); return n >= 90 ? '彻底沉沦' : n >= 75 ? '予取予求' : n >= 60 ? '底线失守' : n >= 40 ? '半推半就' : n >= 20 ? '芳心暗摇' : '矜持自守';
}
// Deterministic 28-day cycle from story date + stable id hash. The model never
// has to count days; an explicitly written non-empty cycle still wins that round.
export function computeCycle(cid,dateStr,pregnancy='未孕'){
  if(pregnancy&&pregnancy!=='未孕')return '妊娠期';
  const ms=Date.parse((dateStr||'2026-01-05')+'T00:00:00Z');
  const dayIndex=Number.isFinite(ms)?Math.floor(ms/86400000):0;
  let hash=0;for(const ch of String(cid||''))hash=(hash*31+ch.codePointAt(0))>>>0;
  const day=((dayIndex+(hash%28))%28+28)%28+1;
  if(day<=5)return `月经期·第${day}天`;
  if(day<=11)return '安全期';
  if(day<=16)return day===14?'排卵日·极易孕':'排卵期·易孕';
  if(day<=24)return '安全期';
  return '经前期·敏感';
}
// Stable 64-bit FNV-1a hash: the same person always seeds the same body record,
// so a replay of the opening never reshuffles her chest, shape or scent.
function fnv(value){let h=14695981039346656037n;for(const ch of String(value??'')){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16);}
// rc.28：三层罩杯推算——①文字关键词（巨乳/贫乳/X罩杯）优先；②双向身高骨架修正
// （150cm 娇小细腰天然加成大罩杯，160cm+ 预设熟人保持 B/B/C/C/D/E）；③无三围时按哈希分布。
export function inferCupSize(bust,waist,height=165,textHint='',seedHash=0){
  const hint=String(textHint||'');
  const explicit=hint.match(/([A-G])\s*(?:罩杯|杯)/i);
  if(explicit)return explicit[1].toUpperCase();
  if(/巨乳|爆乳|波涛汹涌|傲人双峰|呼之欲出|极度丰满|豪乳|酥胸硕大|童颜巨乳/.test(hint))return (Number(seedHash)||0)%2===0?'E':'F';
  if(/平胸|贫乳|飞机场|青涩微隆|一马平川/.test(hint))return 'A';
  const b=Number(bust)||0,w=Number(waist)||0,h=Number(height)||165;
  if(!(b>0&&w>0&&b>w)){
    const pool=['B','C','C','D','D','E','F'];
    return pool[(Number(seedHash)||0)%pool.length];
  }
  const underbust=w+8.5+(h-160)*0.22;
  const diff=b-underbust;
  return diff>=21?'F':diff>=18.5?'E':diff>=16?'D':diff>=13.5?'C':diff>=11?'B':'A';
}
// rc.25 铁律 1：女性私密肉体档案由脚本确定性播种，绝不留给模型从空白开始填。
// Every field is filled only when blank, so plot-driven rewrites always win.
export function seedAnatomy(c) {
  if (!c || typeof c !== 'object') return c;
  c.physiology = c.physiology && typeof c.physiology === 'object' ? c.physiology : {};
  c.intimacy = c.intimacy && typeof c.intimacy === 'object' ? c.intimacy : {};
  c.limits = c.limits && typeof c.limits === 'object' ? c.limits : {};
  const h = Number('0x' + fnv(String(c.id || c.name || 'char')).slice(0, 8));
  const pick = arr => arr[h % arr.length];
  const pick2 = (arr, shift) => arr[Math.floor(h / shift) % arr.length];
  const isVirgin = c.physiology.virgin !== false && (c.intimacy.withUserCount || 0) === 0 && (c.intimacy.sexPartnerCount || 0) === 0;
  if (c.physiology.virgin === null || c.physiology.virgin === undefined) c.physiology.virgin = isVirgin;
  const hint = `${c.body || ''} ${c.appearance || ''}`;
  const cup = c.cupSize || inferCupSize(c.bustCm, c.waistCm, c.heightCm, hint, h);
  // rc.26：反推出来的罩杯回填进 cupSize，界面才能在三围后面显示「（D 罩杯）」。
  if (!c.cupSize) c.cupSize = cup;
  if (!c.physiology.chestDetail) {
    const shapes = ['饱满水滴型', '挺拔半球型', '丰盈圆润型', '娇俏铃兰型'];
    const areolas = isVirgin ? ['浅粉娇嫩乳晕，乳首小巧挺立', '淡樱粉色乳晕，轻触即敏锐充血', '白里透粉乳晕，颗粒细腻敏感'] : ['蜜桃绯红乳晕，乳首饱满易立', '柔嫩粉润乳晕，握感绵密充盈'];
    c.physiology.chestDetail = `${cup}罩杯${pick(shapes)}，${pick2(areolas, 3)}，肌肤细腻柔腻，掌心包裹感极佳`;
  }
  if (!c.physiology.vaginaLook) {
    const types = [
      '饱满馒头穴，外唇丰润紧拢，呈一线微闭合拢',
      '一线天玉缝，小阴唇纤薄内敛被饱满外唇完全包裹',
      '粉嫩水滴形秘处，唇瓣精致对称、边缘紧致闭合',
      '小巧柳叶唇，花唇薄如蝉翼，阴蒂隐藏于微拢花冠下',
      '微绽蝴蝶唇，花瓣柔嫩饱满、层次精致分明'
    ];
    const tones = isVirgin
      ? ['色泽白皙浅粉、娇嫩欲滴', '呈晶莹淡樱粉色、水润无瑕', '呈初绽蜜桃般的浅绯粉泽']
      : ['呈蜜桃熟润粉泽、色泽诱人', '外沿白皙、内侧泛着娇艳绯红'];
    c.physiology.vaginaLook = `${pick(types)}；${pick2(tones, 5)}`;
  }
  if (!c.physiology.vaginaState) {
    c.physiology.vaginaState = isVirgin
      ? '处子般极度紧窄，内壁嫩肉层叠吸附，常态温热微润'
      : '名器级层叠褶皱，内壁温热紧箍、弹性十足，动情时极易泌水';
  }
  if (!c.physiology.pubicHair) {
    const hairs = [
      '天生白虎，耻骨光洁无毛，饱满户型一览无余',
      '修剪整齐的浅色倒三角，毛质细软柔顺',
      '稀疏细软的浅褐绒毛，隐约衬托粉嫩玉缝',
      '柳叶形精致修整，干净利落且极具情趣',
      '自然柔顺的浅密软毛，触感丝滑不扎手'
    ];
    c.physiology.pubicHair = pick2(hairs, 7);
  }
  if (!c.physiology.anusLook) c.physiology.anusLook = '浅粉菊蕾紧缩，周围肌肤白净，褶皱细密洁净';
  if (!c.physiology.anusState) c.physiology.anusState = '未经开发，紧致闭合，触碰时猛烈收缩';
  if (!c.physiology.hymenNote) {
    c.physiology.hymenNote = isVirgin ? '处女膜完好无损，未经人事' : ((c.intimacy.withUserCount || 0) > 0 ? '已与你发生亲密关系' : '已有过往经历');
  }
  if (!c.physiology.bodyScent) {
    const scents = ['自带清冽白茶与少女体香', '幽淡冷香混着沐浴后的奶润气息', '温润清甜的栀子花与肌肤暖香', '清雅雪松尾调与发间淡香'];
    c.physiology.bodyScent = pick2(scents, 11);
  }
  if (!c.physiology.traits) {
    const traits = [
      '耳垂与后颈极度敏感，轻咬耳廓便浑身酥软，腰窝一触即颤',
      '锁骨与酥胸乳首敏锐异常，被掌心拢住揉捻时呼吸急促、双腿发软',
      '大腿内侧与阴蒂极其娇嫩，隔着衣料摩挲便会不自觉夹紧双腿',
      '后腰与足弓敏感度极高，深入顶弄时小腹与内壁会剧烈痉挛吸吮'
    ];
    c.physiology.traits = pick2(traits, 13);
  }
  if (!c.intimacy.attitude) {
    const attitudes = ['外冷内热，表面矜持端庄，一旦防线失守则极度顺从缠人', '传统保守但对强者与安全感毫无抵抗力，羞于启齿却身体诚实', '慢热闷骚，清醒时克制体面，动情后抗拒不了强势主导与深入占有'];
    c.intimacy.attitude = pick2(attitudes, 17);
  }
  if (!c.intimacy.firstTime) {
    c.intimacy.firstTime = isVirgin ? '尚无性经验（初夜完好）' : '过往曾有短暂恋情经历';
  }
  if (!c.intimacy.fetishes) {
    const fetishes = ['对被强势抵在落地窗/镜前耳语、穿薄透丝袜高跟被把玩毫无抵抗力', '暗中迷恋被上位者用重金与强悍肉体双重征服、十指相扣深顶的失控感', '被抚摸后颈与腰窝、带着半羞耻感被哄着侍奉时会迅速溃不成军'];
    c.intimacy.fetishes = pick2(fetishes, 19);
  }
  if (!c.limits.weakness) {
    c.limits.weakness = c.currentGoal ? `眼下最受制于「${String(c.currentGoal).slice(0, 28)}」，面对真金白银的破局撑腰与强势耳语极易心软退让` : '吃软不吃硬，面对强势护短与真金白银的偏爱极易防线松动';
  }
  if (!c.limits.worry) {
    c.limits.worry = '害怕私密失态被熟人撞破，又担心眼下的现实困局无法体面收场';
  }
  return c;
}
export function basicProfile(c) {
  requireRule(Array.isArray(c.personalityTags??[])&&(c.personalityTags??[]).length<=6,'INVALID_BASIC_PROFILE');
  const result={personalityTags:(c.personalityTags??[]).map(v=>text(v,12)),appearance:text(c.appearance ?? '',500,true),body:text(c.body ?? '',500,true),cupSize:text(c.cupSize ?? '',8,true)};
  for(const [k,min,max] of [['heightCm',100,230],['weightKg',25,250],['bustCm',40,200],['waistCm',30,200],['hipCm',40,200],['shoeSizeEu',25,55]]) {const v=c[k]??null;requireRule(v===null||typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'INVALID_BASIC_PROFILE');result[k]=v;}
  return result;
}
export function completeBasicProfile(c){const b=basicProfile(c);requireRule(b.appearance&&b.body&&b.personalityTags.length>0&&['heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu'].every(k=>b[k]!==null),'PROFILE_INCOMPLETE');return b;}
// rc.25: descriptions are a 50-character highlight line, never an ad-copy wall.
// Older saves may hold longer text; it is truncated for display and storage.
export function assetDescription(a,kind=a?.kind,amountCents=a?.bookValueCents ?? 0){
  const clip=v=>{const s=String(v??'').trim();return s.length>50?s.slice(0,50):s;};
  const clean=typeof a?.description==='string'?a.description.trim():'';
  if(clean)return clip(clean);
  const name=String(a?.name||'资产').trim().slice(0,40),loc=String(a?.locationNote||'云澜市').trim().slice(0,24);
  const yuan=Math.max(0,Math.round((Number(amountCents)||0)/100)).toLocaleString('zh-CN');
  return clip(
    kind==='HOUSE'?`${loc}精品住宅「${name}」，估值约¥${yuan}，产权清晰，拎包入住。`
    :kind==='CAR'?`${name}豪华座驾，估值约¥${yuan}，动力充沛，内饰考究，停放于${loc||'专属车库'}。`
    :kind==='BUSINESS'?`${loc}核心商业产业「${name}」，估值约¥${yuan}，经营稳定，权益清晰。`
    :kind==='YACHT_JET'?`私人顶配出行载具「${name}」，估值约¥${yuan}，专属停泊维护，随时待命。`
    :kind==='LUXURY'?`顶奢臻品「${name}」，估值约¥${yuan}，做工精湛，日常佩戴或礼赠皆宜。`
    :kind==='COLLECTIBLE'?`珍稀艺术藏品「${name}」，估值约¥${yuan}，流传有序，极具收藏价值。`
    :`${name}（${loc||'个人持有'}），估值约¥${yuan}，状态完好，由本人持有并妥善保管。`
  );
}
export function profile(p) {
  requireRule(p && !Array.isArray(p) && typeof p === 'object', 'PROFILE_INCOMPLETE');
  const result = {}; for (const k of PROFILE_KEYS) result[k] = text(p[k],750); return result;
}
// Dossier build may seed the empty private records from the generated archive.
// Existing content always wins; only blanks are filled.
function seedRecord(record,seed){if(!record||!seed||typeof seed!=='object')return;
  for(const [k,v] of Object.entries(seed)){if(typeof v!=='string'||!v.trim())continue;const current=record[k];if(current===undefined||current===null||current==='')record[k]=v.trim().slice(0,400);}}
function seedLimits(record,seed){if(!record||!seed||typeof seed!=='object')return;
  // Seeding only raises a limit; a known higher value always wins.
  for(const [k,v] of Object.entries(seed)){if(typeof v!=='number'||!Number.isFinite(v))continue;
    const max=k==='scaleLevel'?6:3,next=Math.max(0,Math.min(max,Math.round(v))),current=typeof record[k]==='number'?record[k]:0;
    record[k]=Math.max(current,next);}}
// One shape for the four private panels, shared by new records and dossiers.
function privateDefaults(){return {
  physiology:{cycle:'',pregnancy:'未孕',virgin:null,hymenNote:'',chestDetail:'',vaginaLook:'',vaginaState:'',pubicHair:'',anusLook:'',anusState:'',bodyScent:'',tattooScar:'',traits:''},
  outfit:{style:'',complexion:'',top:'',bottom:'',lingerie:'',socks:'',shoes:'',makeup:'',accessories:''},
  intimacy:{attitude:'',abilityComment:'',partnersCount:0,sexPartnerCount:0,firstTime:'',experience:'',fetishes:'',unlockedTags:[],withUserCount:0,lastIntimate:'',lastMasturbation:''},
  limits:{scaleLevel:0,weakness:'',worry:'',exposure:0,foreplay:0,intercourse:0,cosplay:0,creampie:0,anal:0,publicPlay:0,multi:0}};}
function character(c) {
  const name = text(c.name,50), age = integer(c.age,1,120);
  const priv=privateDefaults();priv.physiology.traits=text(c.physiology?.traits ?? '',400,true);
  return seedAnatomy({id:id(c.id), aliases:(c.aliases || []).map(x => text(x,50)).slice(0,20), name, age,
    occupation:text(c.occupation ?? '',100,true), affection:integer(c.affection ?? 20,0,100),corruption:integer(c.corruption ?? 0,0,100),
    relationshipLabel:text(c.relationshipLabel || '熟人',12), relationshipNotes:text(c.relationshipNotes ?? '',300,true),
    ...basicProfile(c),beautyScore:c.beautyScore==null?null:integer(c.beautyScore,1,100),knownFacts:text(c.knownFacts ?? c.notes ?? '',1200,true),profileFixed:null,profileLocked:false, trackingState:'RECORDED',
    addressing:text(c.addressing ?? '',20,true),impression:'',starred:false,currentThought:'',arousal:0,offscreen:'',currentGoal:text(c.currentGoal ?? '',200,true),
    ...priv,
    currentClothes:'',currentPose:'',currentAction:'',currentExpression:'',currentMood:'',currentCondition:'',currentItems:'', avatarRef:null,portraitRef:null});
}
export function validateDraft(d) {
  requireRule(d && typeof d === 'object', 'INVALID_DRAFT');
  const user = {id:'USER', name:text(d.name,50),age:integer(d.age,1,120),beautyScore:integer(d.beautyScore,1,100),gender:text(d.gender ?? '',40,true),
    appearance:text(d.appearance ?? '',500,true),body:text(d.body ?? '',500,true),occupation:text(d.occupation ?? '',100,true),background:text(d.background ?? '',1200,true),
    city:'云澜市',location:text(d.currentLocation,150),housingMode:text(d.housingMode,30),residenceDescription:text(d.residenceDescription ?? '',600,true),
    workLifeDescription:text(d.workLifeDescription ?? '',600,true),cashCents:integer(d.initialCashCents),initialCashCents:d.initialCashCents,
    currentClothes:'',currentPose:'',currentAction:''};
  // Prowess is the second axis of the player: it only moves her corruption.
  const prowessScore = integer(d.prowessScore ?? 70, 1, 100);
  user.prowessScore = prowessScore;
  user.sexualAbility = {
    stamina: integer(d.sexualAbility?.stamina ?? prowessScore, 1, 100),
    hardness: integer(d.sexualAbility?.hardness ?? prowessScore, 1, 100),
    technique: integer(d.sexualAbility?.technique ?? prowessScore, 1, 100),
    volume: integer(d.sexualAbility?.volume ?? prowessScore, 1, 100)
  };
  user.genitals = {
    length: text(d.genitals?.length || '18cm', 40, true),
    girth: text(d.genitals?.girth || '4.8cm', 40, true),
    traits: text(d.genitals?.traits || '形态饱满挺拔，青筋分明，热度惊人', 300, true)
  };
  requireRule(Array.isArray(d.initialAssets) && d.initialAssets.length <= 100 && Array.isArray(d.contacts) && d.contacts.length <= 20, 'DRAFT_LIMIT');
  const assets = d.initialAssets.map(a => ({assetId:id(a.assetId),kind:assetKind(a.kind,a.name),name:text(a.name,120),ownerId:'USER',
    bookValueCents:integer(a.bookValueCents),basisCents:null,status:'OWNED',acquisitionEventId:'INITIAL',acquisitionIsInitial:true,
    description:assetDescription(a,assetKind(a.kind,a.name),a.bookValueCents),locationNote:text(a.locationNote ?? '',300,true),ownershipNote:text(a.ownershipNote ?? '本人全额所有，无债务',300)}));
  const contacts = d.contacts.map(c => ({...c,...basicProfile(c),id:id(c.id),name:text(c.name,50),age:integer(c.age,1,120),
    beautyScore:c.beautyScore===undefined?undefined:integer(c.beautyScore,1,100),affection:integer(c.affection,0,100),corruption:integer(c.corruption ?? 0,0,100),occupation:text(c.occupation ?? '',100,true),relationshipLabel:text(c.relationshipLabel || '熟人',12),
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
// rc.25: seven asset classes. Chinese wording and old aliases map onto the enum
// instead of throwing, so nothing the model writes can drop a purchase.
function assetKind(kind,name=''){
  const raw=String(kind||'').trim().toUpperCase();
  if(['HOUSE','CAR','BUSINESS','YACHT_JET','LUXURY','COLLECTIBLE','OTHER'].includes(raw))return raw;
  const hint=`${raw} ${String(name||'')}`;
  if(/房|宅|别墅|平层|公寓|庄园|云玺湾|听涛山庄|PROPERTY/.test(hint))return 'HOUSE';
  if(/车|跑车|座驾|轿车|SUV|MPV|法拉利|保时捷|迈巴赫|劳斯莱斯|奔驰|宝马|VEHICLE|AUTO/.test(hint))return 'CAR';
  if(/商铺|店铺|公司|股权|产业|企业|会所|酒庄|工厂|工作室|集团|院线|SHOP|COMPANY|EQUITY|STORE/.test(hint))return 'BUSINESS';
  if(/游艇|专机|飞机|直升机|湾流|YACHT|JET|BOAT|PLANE/.test(hint))return 'YACHT_JET';
  if(/表|腕表|珠宝|钻|翡翠|包|高定|首饰|百达翡丽|理查德|爱马仕|WATCH|JEWELRY|BAG/.test(hint))return 'LUXURY';
  if(/画|古董|藏品|艺术|瓷器|字画|雕塑|名酒|拍品|ART|ANTIQUE|PAINTING|COLLECTION/.test(hint))return 'COLLECTIBLE';
  return 'OTHER';
}
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
// Effective wealth = cash plus what the player already paid in-game for assets
// still held. Spending cash on a property must not drop the withdraw multiplier.
export function tierBasis(s){
  let v=s.user.cashCents;
  for(const a of Object.values(s.finance?.assets||{}))if(!a.acquisitionIsInitial&&a.ownerId==='USER'&&a.status==='OWNED')v=add(v,a.basisCents??a.bookValueCents??0);
  return v;
}
export function withdrawalQuote(s,cid){const p=poolParts(s,cid),tier=wealthTier(tierBasis(s)),gross=multiply(p.total,tier.multiplier),debt=recoveryDue(s,cid);return {...p,tier,gross,recoveryCents:Math.min(gross,debt),paidCents:Math.max(0,gross-debt),debt};}
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
    integer(c.affection,0,100);integer(c.corruption ?? 0,0,100);if(c.beautyScore!==null)integer(c.beautyScore,1,100);
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
    case 'CORRUPTION_CHANGE': {
      const c=requirePerson();if(!tracked(c))return;
      // No beauty modifier on this axis: the body answers to prowess instead,
      // and only in rounds settlement has flagged as physical.
      const delta=Math.max(-12,Math.min(12,e.delta)),prior=c.corruption??0;
      const bonus=delta>0&&prior<85&&e.prowessBonus===true?prowessTier(s.user.prowessScore??70).modifier:0;
      const adjusted=delta>0?Math.max(0,delta+bonus):delta;
      const round=Object.values(s.facts).filter(f=>f.type==='CORRUPTION_CHANGE'&&f.personRef===c.id&&key(f.sourceAnchor)===key(anchor));
      const spent=round.reduce((n,f)=>n+Math.abs(f.finalDelta),0),limit=12;
      const finalDelta=Math.sign(adjusted)*Math.min(Math.abs(adjusted),Math.max(0,limit-spent));
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');c.corruption=Math.max(0,Math.min(100,prior+finalDelta));
      Object.assign(s.facts[e.factId],{personRef:c.id,baseDelta:delta,prowessBonus:bonus,finalDelta:c.corruption-prior,priorCorruption:prior});return;
    }
    case 'RELATIONSHIP_CHANGE': {
      const c=requirePerson();if(!tracked(c))return;
      c.relationshipLabel=text(e.label,12);
      c.relationshipNotes=text(e.notes || '',300,true);return;
    }
    case 'CASH_TRANSACTION': {
      requireRule(e.completed===true,'NOT_COMPLETED');requireRule(!/(?:尚未付款|尚未支付|未付款|未支付|还没付|没付钱|打算买|准备买|计划买)/.test(e.evidence)||/(?:已经|已付|刷卡|付了|支付成功|付款成功|付清|结清|买下|全款|转账|到账|实际支付)/.test(e.evidence),'PAYMENT_NOT_PROVEN');integer(e.amountCents,1);requireRule(['IN','OUT'].includes(e.direction),'INVALID_DIRECTION');
      const out=['SHOPPING','DINING','TRAVEL','GIFT','TRANSFER_OUT','PROPERTY_PURCHASE','VEHICLE_PURCHASE'];
      const incoming=['SALARY','BUSINESS_INCOME','OTHER_INCOME','TRANSFER_IN','ASSET_SALE'];
      requireRule((e.direction==='OUT'?out:incoming).includes(e.kind),'INVALID_TRANSACTION_KIND');
      // rc.29：任何 OUT 支出一律视为玩家本人动用 user.cashCents。模型把 payer
      // 写成公司/家族/财务走账也照样实扣，超额走下面的 INSUFFICIENT_CASH。
      if(e.direction==='OUT')e.payer='USER';
      requireRule(!['REFUND','WITHDRAWAL_REWARD'].includes(e.kind),'FORBIDDEN_CASH_WRITE');
      const allocations=e.allocations || [];
      requireRule(Array.isArray(allocations)&&allocations.length<=100,'INVALID_ALLOCATION');
      let allocated=0;const seen=new Set();
      for(const a of allocations){active(s,a.personRef);requireRule(!seen.has(a.personRef),'DUPLICATE_ALLOCATION');seen.add(a.personRef);allocated=add(allocated,integer(a.amountCents,0));}
      requireRule(allocated<=e.amountCents && (e.direction==='OUT'||allocated===0),'ALLOCATION_EXCEEDS_COST');
      if(e.direction==='OUT')requireRule(s.user.cashCents>=e.amountCents,'INSUFFICIENT_CASH');
      if(e.asset){
        requireRule(e.direction==='OUT','INVALID_ASSET_TRANSACTION');const a=e.asset;
        // rc.25: any OUT payment that names an asset is registered, even when the
        // model forgets assetId (shopping for a watch, a yacht, shop equity...).
        if(!a.assetId)a.assetId='asset_'+fnv(String(a.name||e.itemName||'asset')+':'+e.factId);
        id(a.assetId);
        requireRule(!s.finance.assets[a.assetId],'DUPLICATE_ASSET');
        const owner=a.ownerId || 'USER';if(owner!=='USER')active(s,owner);
        requireRule(owner!=='USER'||allocated===0,'SELF_PURCHASE_NOT_GIFT');
        requireRule(owner==='USER'||allocations.every(x=>x.personRef===owner),'ASSET_BENEFICIARY_MISMATCH');
        const kind=assetKind(a.kind,a.name);
        s.finance.assets[a.assetId]={assetId:a.assetId,kind,name:text(a.name,120),ownerId:owner,
          bookValueCents:integer(a.bookValueCents ?? e.amountCents),basisCents:e.amountCents,status:owner==='USER'?'OWNED':'TRANSFERRED',
          acquisitionEventId:e.factId,acquisitionIsInitial:false,description:assetDescription({...a,bookValueCents:a.bookValueCents??e.amountCents},kind,a.bookValueCents??e.amountCents),locationNote:text(a.locationNote ?? '',300,true),ownershipNote:'本人全额所有，无债务'};
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
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');
      // Her own arousal turns a scoring event into the intimate track even when
      // the model forgets to send mode.
      const mode = e.mode === 'INTIMATE' || (c.arousal ?? 0) >= 50 ? 'INTIMATE' : (e.mode || '');
      const tier=reward(e.score, `${eventKey}:${e.action}`, mode);if(!tier.amountCents)return;
      credit(s,c.id,tier.amountCents,eventKey,anchor,'CRITICAL',{score:e.score,title:e.action,label:tier.label,mode:tier.mode,milestone:e.milestone || null});
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
    if((raw.type==='AFFECTION_CHANGE'||raw.type==='CORRUPTION_CHANGE')&&i<events.length)continue;
    // Normalize first: rc.25 folds model shortcuts (ASSET / PURCHASE / asset sale
    // without a held asset) into legal events before the whitelist looks at them.
    const e=normalizeEvent(partial?{...raw,ordinal:i}:raw,anchor,s,sourceText);
    if(partial)requireRule(['CASH_TRANSACTION','ASSET_TRANSFER','TRANSACTION_REFUND','BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE','AFFECTION_CHANGE','CORRUPTION_CHANGE'].includes(e.type),'UNKNOWN_EVENT');
    const ordinal=integer(e.ordinal,0,100);requireRule(!ordinals.has(ordinal),'DUPLICATE_ORDINAL');ordinals.add(ordinal);
    if((e.type==='AFFECTION_CHANGE'||e.type==='CORRUPTION_CHANGE')&&Object.values(s.facts).some(f=>f.type===e.type&&f.personRef===e.personRef&&key(f.sourceAnchor)===key(anchor)))continue;
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
export function normalizeEvent(value,anchor,state,sourceText=''){
  requireRule(value&&typeof value==='object','INVALID_EVENT');const e=clone(value);
  if(e.type==='BEHAVIOR')e.type='SIGNIFICANT_BEHAVIOR_SCORE';
  if(e.type==='SIGNIFICANT_BEHAVIOR_SCORE'){
    const score=typeof e.score==='number'||typeof e.score==='string'?Number(e.score):NaN;
    e.score=Number.isFinite(score)?Math.max(0,Math.min(100,Math.round(score))):0;
    e.action=typeof e.action==='string'?e.action.trim().slice(0,80):'人物互动';
    e.mode=e.mode==='INTIMATE'?'INTIMATE':(e.mode==='BREAKTHROUGH'?'BREAKTHROUGH':undefined);
    e.reason=typeof e.reason==='string'?e.reason.trim().slice(0,300):'';
    if(typeof e.milestone!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(e.milestone)||['__proto__','prototype','constructor'].includes(e.milestone))delete e.milestone;
    e.sourceKey=key(anchor.branchKey,anchor.messageId,anchor.swipeId,anchor.fingerprint,e.type,e.personRef||'');
    e.factId=e.factId||sourceId(e.sourceKey);return e;
  }
  // rc.25 Bug #1：模型常把买入写成 type:"ASSET" / "PURCHASE"。一律折成合法的
  // CASH_TRANSACTION + asset，这样现金、账本、资产三处同时落地，绝不静默丢单。
  if(['ASSET','PURCHASE','ASSET_PURCHASE','PROPERTY_PURCHASE','VEHICLE_PURCHASE'].includes(e.type)){
    const inferredKind=assetKind(e.kind||e.asset?.kind,e.name||e.itemName||e.asset?.name);
    const amtYuan=e.amountYuan??e.bookValueYuan??e.priceYuan??e.asset?.bookValueYuan;
    const amtCents=e.amountCents??e.bookValueCents??e.asset?.bookValueCents;
    e.asset=e.asset&&typeof e.asset==='object'?e.asset:{
      assetId:e.assetId||('asset_'+fnv(String(e.name||e.itemName||'asset'))),
      kind:inferredKind,
      name:e.name||e.itemName||'新购资产',
      ownerId:e.ownerId||'USER',
      locationNote:e.locationNote||'',
      description:e.description||''
    };
    e.type='CASH_TRANSACTION';
    e.direction=e.direction||'OUT';
    e.payer=e.payer||'USER';
    e.completed=e.completed??true;
    e.kind=inferredKind==='HOUSE'?'PROPERTY_PURCHASE':inferredKind==='CAR'?'VEHICLE_PURCHASE':'SHOPPING';
    if(amtYuan!==undefined&&e.amountYuan===undefined)e.amountYuan=amtYuan;
    if(amtCents!==undefined&&e.amountCents===undefined)e.amountCents=amtCents;
    if(!e.itemName)e.itemName=e.asset.name;
    if(!e.memo)e.memo=`购入${e.asset.name}`;
  }
  // rc.25 Bug #2：转手卖掉一件从未建档的东西（如当场卖画获利）不可能是
  // ASSET_SALE——它没有已持有资产可核销。直接改判其他收入，钱才不会丢。
  if(e.type==='CASH_TRANSACTION'&&e.kind==='ASSET_SALE'){
    const owned=e.assetId&&state?.finance?.assets?.[e.assetId]&&state.finance.assets[e.assetId].status==='OWNED';
    if(!owned){e.kind='OTHER_INCOME';delete e.assetId;}
  }
  // rc.25 Bug #1 续：模型的 evidence 常被概括改写，逐字校验会整单丢弃。只跳过
  // 单测哨兵词与未付款否定句，其余用本轮正文首句有效叙事兜底，保证零漏单。
  if(['CASH_TRANSACTION','ASSET_TRANSFER','TRANSACTION_REFUND'].includes(e.type)&&typeof sourceText==='string'&&sourceText.trim()){
    const ev=typeof e.evidence==='string'?e.evidence.trim():'';
    const rescue=typeof e.evidence==='string'||e.evidence===undefined;
    const isTestSentinel=/^(没有发生|正文没有这句话)$/.test(ev);
    const hasNegation=/(?:准备|打算|将要|计划|尚未|还未|下次|改天|未付|没付|未买|没买|口头|承诺|先看)(?![^。！？!?；;\n]{0,18}(?:付款|付清|买单|结账|刷卡|转账|到账|成交|买下|签下|过户|收下|交接|提车))/.test(ev);
    if(rescue&&!isTestSentinel&&!hasNegation&&!hasEvidence(sourceText,ev)){
      const cleanBody=String(sourceText).replace(/<(?:UpdateVariable|SH_EVENTS)[\s\S]*$/i,'').trim();
      const fallback=cleanBody.split(/[。！？!?\n]/).map(x=>x.trim()).find(x=>x.length>=4&&!/(?:准备|打算|将要|计划|尚未|还未|下次|改天|未付|没付|未买|没买|口头|承诺|先看)/.test(x));
      if(fallback)e.evidence=fallback.slice(0,360);
    }
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
export function canWithdraw(s,cid) { const c=s.characters[cid];return !!(c&&tracked(c)&&(c.affection>=70||(c.corruption??0)>=60)&&poolParts(s,cid).total>0); }
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
      const w={withdrawalId:op.operationId,characterId:c.id,status:'COMMITTED',basePoolCents:q.total,spendCents:q.spend,criticalCents:q.crit,preCashCents:tierBasis(s),tierId:q.tier.id,tierLabel:q.tier.label,multiplier:q.tier.multiplier,grossCents:q.gross,paidCents:q.paidCents,recoveryCents:q.recoveryCents,allocations,recoveryAllocations,sourceAnchor:clone(anchor),recordedAtScene:s.scene.timeHint};
      s.withdrawals[op.operationId]=w;s.user.cashCents=add(s.user.cashCents,w.paidCents);
      addLedger(s,op.operationId,{factId:op.operationId,kind:'WITHDRAWAL_REWARD',direction:'IN',amountCents:w.paidCents,payer:'TERMINAL',personRef:c.id,memo:c.name+' · '+w.tierLabel+'提现'},anchor);
      result={amountCents:w.paidCents,personRef:c.id,withdrawalId:op.operationId};
    } else if(op.type==='PLAYER_BUILD_PROFILE') {
      requireRule(tracked(c)&&!c.profileFixed,'PROFILE_ALREADY_BUILT');c.profileFixed=profile(op.profileFixed);c.profileLocked=false;
      const priv=privateDefaults();for(const k of ['physiology','outfit','intimacy','limits'])c[k]??=priv[k];
      seedRecord(c.physiology,op.physiology);seedRecord(c.intimacy,op.intimacy);seedRecord(c.outfit,op.outfit);seedRecord(c.limits,op.limits);seedLimits(c.limits,op.limits);
    } else if(op.type==='PLAYER_LOCK_PROFILE') {
      requireRule(tracked(c)&&c.profileFixed,'PROFILE_INCOMPLETE');requireRule(typeof op.locked==='boolean','INVALID_DRAFT');c.profileLocked=op.locked;
    } else if(op.type==='PLAYER_HIDE') {
      c.trackingState='HIDDEN';s.scene.presentCharacterIds=s.scene.presentCharacterIds.filter(x=>x!==c.id);
    } else if(op.type==='PLAYER_RESTORE') {
      c.trackingState='RECORDED';
      if(op.restorePresent===true&&!s.scene.presentCharacterIds.includes(c.id))s.scene.presentCharacterIds.push(c.id);
    } else if(op.type==='PLAYER_STAR') {
      // Player-owned switch: starred women keep a one-line off-stage update.
      c.starred=!c.starred;result={personRef:c.id,starred:c.starred};
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
  // Present women carry full basics, private records and the current thought.
  // Absent but starred women carry one off-stage line the model may refresh.
  // Every other absent woman stays a bare identity index.
  const view=c=>{
    const base={id:c.id,name:c.name,aliases:c.aliases,trackingState:c.trackingState};
    if(!tracked(c))return base;
    if(s.scene.presentCharacterIds.includes(c.id))return {...base,age:c.age,beautyScore:c.beautyScore,occupation:c.occupation,...basicProfile(c),affection:c.affection,corruption:c.corruption??0,relationshipLabel:c.relationshipLabel,relationshipNotes:c.relationshipNotes,knownFacts:c.knownFacts,addressing:c.addressing,impression:c.impression,currentClothes:c.currentClothes,currentPose:c.currentPose,currentAction:c.currentAction,currentExpression:c.currentExpression,currentMood:c.currentMood,currentCondition:c.currentCondition,currentItems:c.currentItems,currentThought:c.currentThought,arousal:c.arousal,currentGoal:c.currentGoal??'',...(c.physiology?{physiology:clone(c.physiology)}:{}),...(c.outfit?{outfit:clone(c.outfit)}:{}),...(c.intimacy?{intimacy:clone(c.intimacy)}:{}),...(c.limits?{limits:clone(c.limits)}:{}),...(c.profileFixed&&!c.profileLocked?{profileFixed:c.profileFixed}:{})};
    return c.starred?{...base,relationshipLabel:c.relationshipLabel,affection:c.affection,corruption:c.corruption??0,currentGoal:c.currentGoal??'',starred:true,offscreen:c.offscreen}:base;
  };
  const characters=Object.fromEntries(Object.values(s.characters).map(c=>[c.id,view(c)]));
  // Top-level to-do list so the model cannot miss off-stage starred women.
  const starredOffscreenIds=Object.values(s.characters).filter(c=>tracked(c)&&c.starred&&!s.scene.presentCharacterIds.includes(c.id)).map(c=>c.id);
  return {schemaVersion:3,revision:s.meta.revision,starredOffscreenIds,user:{...s.user,wealthTier:wealthTier(tierBasis(s))},scene:s.scene,characters,pendingBasicProfiles,
    assets:Object.values(s.finance.assets).filter(a=>a.ownerId==='USER'&&a.status==='OWNED').map(a=>({assetId:a.assetId,name:a.name,kind:a.kind,description:a.description,locationNote:a.locationNote,ownershipNote:a.ownershipNote,bookValueCents:a.bookValueCents})),
    recentFacts:Object.entries(s.facts).slice(-60).map(([factId,f])=>{const l=ledgerByFact.get(factId);return {factId,type:f.type,...(l?{kind:l.kind,itemName:l.itemName,amountCents:l.amountCents,assetId:l.assetId,refundOf:l.refundOf}:{})};}),rule:'只提出新事实，不直接写现金、奖池或提现。已列factId不得再次入账；退款的refundOf按交易名称、金额与资产匹配原付款factId，不猜ID。'};
}
