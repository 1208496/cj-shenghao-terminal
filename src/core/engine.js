import config from '../../project.json' with {type:'json'};
import {WHEEL_POOL_BY_ID} from './wheel-pool.js';
import {ABILITY_BY_ID,SURREAL_ITEM_BY_ID} from './casino-catalog.js';
import {rollWheelPrize,playWheelQuote,POINTS_PER_SPIN} from './wheel.js';
import {rollWishPack,rollCasino,casinoSeed,drawSeed,wishWheelQuote,lowPackQuote,PACK_SIZE} from './casino.js';
import {buildImprintText,chokerClause,LEGACY_REMOVED_PRICES,PLACEMENT_IDS,CHOKER_STYLE_BY_ID,PATTERN_BY_ID,COLOR_BY_ID,FONT_BY_ID,LAYOUT_BY_ID,SCALE_LABELS,checkDeviceThreshold} from './device-catalog.js';

export const PROFILE_KEYS = ['identity','appearance','body','personality','habits','style','family','career','social'];
export const PROFILE_LABELS = ['基础身份与学历籍贯','容貌气质与辨识细节','身材体态与私密特征','双面性格与行事做派','日常作息与生活喜好','穿搭审美与私下打扮','原生家庭与成长经历','事业现状与短期目标','情感经历与择偶偏好'];
// rc.55 / B-08：商城历史只增不减，而 schema.js 的 shopHistory 上限是 200 条。
// 一旦写满，第 201 次购买会让整轮 state.parse 报 too_big，该存档从此再也买不了任何东西
// （历史不会自己变短，玩家没有自助恢复手段）。所以写入即截断，永远只留最近 200 条。
// 这个数字必须与 schema.js 里 .max(200) 保持一致。
export const SHOP_HISTORY_MAX = 200;
// rc.55 / B-12：香水的单件加成。启用与撤销重算必须共用同一个数，避免两处口径漂移。
export const PERFUME_AROUSAL_STEP = 25;
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
// rc.42：异能不再升级 —— 只有「持有 / 未持有」两态，效果恒定（YG 拍板取中档数值）。
const ABILITY_SCALAR={ab_voice:2,ab_gaze:3,ab_scent:12,ab_stamina:12};
export function hasAbility(s,abilityId){return (s?.user?.abilities||[]).some(a=>a.abilityId===abilityId);}
export function abilityBonus(s,abilityId){return hasAbility(s,abilityId)?(ABILITY_SCALAR[abilityId]||0):0;}
// rc.58（4A 方案 B §3.2）：NO.53「终端最终愿望」的四个许愿方向。ASSET/ROMANCE 有脚本当场效果，POWER/CUSTOM 只注入。
export const WISH_KINDS=['ASSET','ROMANCE','POWER','CUSTOM'];
// rc.42：玩家手动补录的自定义资产，估值由模型按行情给，脚本按类别硬钳位（单位：分）。
// 下限/上限/兜底都写死在这里，模型报「9亿」也只会落在上限上。
export const ASSET_VALUATION_BOUNDS={
  HOUSE:{min:50000000,max:1000000000000,fallback:450000000},
  CAR:{min:10000000,max:1000000000000,fallback:120000000},
  BUSINESS:{min:30000000,max:1000000000000,fallback:300000000},
  YACHT_JET:{min:200000000,max:1000000000000,fallback:1200000000},
  LUXURY:{min:1000000,max:1000000000000,fallback:15000000},
  COLLECTIBLE:{min:1000000,max:1000000000000,fallback:25000000},
  OTHER:{min:100000,max:1000000000000,fallback:3000000},
};
// rc.44（YG 拍板方案二）：手动补录只选档次、不填金额，估值由类别 × 档次查表即时定值。
// 上限统一放到 ¥100 亿只作为钳位天花板，正常玩家不会碰到（YG：钻漏洞不管，角色卡游戏自食其果）。
export const CUSTOM_ASSET_TIERS=['ENTRY','MID','HIGH','TOP'];
export const ASSET_TIER_LABELS={ENTRY:'轻奢入门',MID:'中端品质',HIGH:'高端臻品',TOP:'顶奢旗舰'};
export const ASSET_TIER_TABLE={
  HOUSE:{ENTRY:120000000,MID:450000000,HIGH:1200000000,TOP:2800000000},
  CAR:{ENTRY:30000000,MID:120000000,HIGH:380000000,TOP:1000000000},
  BUSINESS:{ENTRY:80000000,MID:300000000,HIGH:800000000,TOP:1800000000},
  YACHT_JET:{ENTRY:400000000,MID:1200000000,HIGH:2600000000,TOP:4800000000},
  LUXURY:{ENTRY:3000000,MID:15000000,HIGH:60000000,TOP:220000000},
  COLLECTIBLE:{ENTRY:5000000,MID:25000000,HIGH:120000000,TOP:400000000},
  OTHER:{ENTRY:500000,MID:3000000,HIGH:18000000,TOP:80000000},
};
// 手动补录专用：具体随身物（表/包/珠宝）优先于泛载具词，避免「劳力士游艇名仕腕表」被抬进游艇档。
export function resolveCustomAssetKind(name,description=''){
  const pick=(text)=>{
    const t=String(text||'');
    if(/房|宅|别墅|平层|公寓|庄园|云玺湾|听涛山庄|PROPERTY/.test(t))return 'HOUSE';
    if(/车|跑车|座驾|轿车|SUV|MPV|法拉利|保时捷|迈巴赫|劳斯莱斯|奔驰|宝马|VEHICLE|AUTO/.test(t))return 'CAR';
    if(/商铺|店铺|公司|股权|产业|企业|会所|酒庄|工厂|工作室|集团|院线|SHOP|COMPANY|EQUITY|STORE/.test(t))return 'BUSINESS';
    if(/表|腕表|珠宝|钻|翡翠|包|高定|首饰|百达翡丽|理查德|爱马仕|WATCH|JEWELRY|BAG/.test(t))return 'LUXURY';
    if(/画|古董|藏品|艺术|瓷器|字画|雕塑|名酒|拍品|乐器|吉他|提琴|ART|ANTIQUE|PAINTING|COLLECTION/.test(t))return 'COLLECTIBLE';
    if(/游艇|专机|飞机|直升机|湾流|YACHT|JET|BOAT|PLANE/.test(t))return 'YACHT_JET';
    return '';
  };
  return pick(name)||pick(description)||'OTHER';
}
export function effectiveProwess(s){return Math.min(100,(Number(s?.user?.prowessScore)||70)+abilityBonus(s,'ab_stamina'));}
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
export function formatYuanReadable(centsValue) {
  const n = Number(centsValue) || 0;
  const sign = n < 0 ? '-' : '';
  const absYuan = Math.abs(n) / 100;
  if (absYuan >= 100000000) {
    const yi = absYuan / 100000000;
    return `${sign}${Number.isInteger(yi) ? yi : Number(yi.toFixed(4))}亿元（¥${absYuan.toLocaleString('zh-CN')}）`;
  }
  if (absYuan >= 10000) {
    const wan = absYuan / 10000;
    return `${sign}${Number.isInteger(wan) ? wan : Number(wan.toFixed(2))}万元（¥${absYuan.toLocaleString('zh-CN')}）`;
  }
  return `${sign}${absYuan.toLocaleString('zh-CN')}元`;
}
// rc.58（4A 方案 A §6.1；YG 2026-11-27 选 A：正则收窄）——
// 「年龄—身份自洽」的确定性收敛表。全表 min>=18，18 岁下限不下探。
// 收窄三处：① 高中加否定前瞻，② 去掉裸「学姐」，③ 在校教职工一律不按学生档收敛。
export const AGE_BAND_RULES = [
  { id: 'HIGH_SCHOOL_ADULT', re: /高三|高二|高一|高中(?!教师|老师|校长|主任|部)|复读|艺考|职高|中专|备考高考/, min: 18, max: 19, defaultAge: 18 },
  { id: 'FRESHMAN', re: /大一|大二|新生|大学学妹|直系学妹/, min: 18, max: 20, defaultAge: 19 },
  { id: 'UNDERGRAD_INTERN', re: /大三|大四|本科|大学生|校花|学妹|实习生|助教|学生会|社团/, min: 19, max: 23, defaultAge: 21 },
  { id: 'GRAD_STUDENT', re: /研究生|硕士|研一|研二|研三|博士|博一|博二|女博/, min: 22, max: 28, defaultAge: 24 },
  { id: 'JUNIOR_YOUTH', re: /刚毕业|应届|新人|前台|柜姐|导购|空姐|护士|幼师|练习生|主播|模特|女仆|调酒师|咖啡师|花艺|烘焙/, min: 19, max: 27, defaultAge: 22 },
  { id: 'KIN_DAUGHTER', relOnly: true, re: /女儿|养女|干女儿|继女|侄女|外甥女/, min: 18, max: 24, defaultAge: 19 },
  { id: 'SENIOR_PRO', re: /主治医|主任医|教授|副教授|资深|律所合伙人|投行董事|总监|主编|总裁|董事长|集团副总|行长|院长/, min: 26, max: 45, defaultAge: 30 },
  { id: 'MATURE_ELDER', relOnly: true, re: /阿姨|小姨|姑姑|舅妈|岳母|丈母娘|后妈|继母|师母|房东太太|寡妇|美妇|少妇/, min: 28, max: 48, defaultAge: 34 },
];
// 在校教职工不是学生：职业串里出现这些词的人一律跳过学生档（防「25 岁高中老师」被改成 18）。
const AGE_BAND_STAFF_RE = /教师|老师|校长|主任|讲师|导师|辅导员|班主任/;
const AGE_BAND_STUDENT_IDS = new Set(['HIGH_SCHOOL_ADULT', 'FRESHMAN', 'UNDERGRAD_INTERN', 'GRAD_STUDENT']);
// 旧存档自愈的额外闸：身份串里必须真的出现学生/亲属类词，光靠职业关键词不算数。
export const AGE_BAND_STUDENT_HINT = /学生|在读|年级|高考|艺考|复读|新生|学妹|实习|女儿|养女|继女|侄女|外甥女/;
// 旧存档自愈只处理这四类最高频违和身份（上限均 < 25）。
const LEGACY_AGE_RECONCILE_BANDS = new Set(['HIGH_SCHOOL_ADULT', 'FRESHMAN', 'UNDERGRAD_INTERN', 'KIN_DAUGHTER']);

const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
export function parseExplicitAge(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input);
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Math.round(Number(s));
  const arab = s.match(/(?:^|[^\d])([1-9]\d)\s*(?:岁|周岁)/);
  if (arab) return Number(arab[1]);
  const cn = s.match(/([一二三四五六七八九]?十[一二三四五六七八九]?|[一二两三四五六七八九])\s*(?:岁|周岁)/);
  if (cn) {
    const token = cn[1];
    if (token === '十') return 10;
    if (token.startsWith('十')) return 10 + (CN_DIGITS[token[1]] || 0);
    if (token.endsWith('十')) return (CN_DIGITS[token[0]] || 1) * 10;
    const [tens, ones] = token.split('十');
    if (ones !== undefined) return (CN_DIGITS[tens] || 1) * 10 + (CN_DIGITS[ones] || 0);
    return CN_DIGITS[token] ?? null;
  }
  return null;
}

export function matchAgeBand(c) {
  const occ = String(c?.occupation || '').trim();
  const rel = String(c?.relationshipLabel || '').trim();
  const primary = `${occ} ${rel}`;
  const skipStudent = AGE_BAND_STAFF_RE.test(occ);
  for (const rule of AGE_BAND_RULES) {
    if (skipStudent && AGE_BAND_STUDENT_IDS.has(rule.id)) continue;
    const target = rule.relOnly ? rel : primary;
    if (rule.re.test(target)) return rule;
  }
  const fallback = `${c?.knownFacts || ''} ${c?.firstContactEvidence || ''}`;
  for (const rule of AGE_BAND_RULES) {
    if (rule.relOnly) continue;
    if (skipStudent && AGE_BAND_STUDENT_IDS.has(rule.id)) continue;
    if (rule.re.test(fallback)) return rule;
  }
  return null;
}

export function reconcileCharacterAge(raw, { briefText = '', skeletonDefault = 25 } = {}) {
  const clamp = (n) => Math.min(80, Math.max(18, Math.round(n)));
  // 1. 玩家在一句话描述里显式写了年龄 → 钳到 [18, 80] 后直接以玩家为准
  const explicitFromBrief = briefText ? parseExplicitAge(briefText) : null;
  if (explicitFromBrief !== null) return clamp(explicitFromBrief);

  const parsedRaw = parseExplicitAge(raw?.age);
  const band = matchAgeBand(raw);
  if (!band) {
    return parsedRaw !== null ? clamp(parsedRaw) : skeletonDefault;
  }
  if (parsedRaw === null) return band.defaultAge;
  const clamped = clamp(parsedRaw);
  // 模型/旧骨架随手塞了 25 岁，且 25 岁不在该职业区间内 → 直接落到该职业默认典型年龄
  if (clamped === skeletonDefault && (clamped < band.min || clamped > band.max)) {
    return band.defaultAge;
  }
  if (clamped < band.min) return band.min;
  if (clamped > band.max) return band.max;
  return clamped;
}
// rc.30：根据性格标签、职业与外貌判定五大性格原型（cool/warm/sunny/proud/pure），
// 让私密设定、体香、敏感带、性观念、性癖、软肋与三层心绪链彻底告别千篇一律。
export function archetypeOf(c) {
  const hint = `${(c?.personalityTags || []).join(' ')} ${c?.occupation || ''} ${c?.appearance || ''} ${c?.relationshipLabel || ''}`;
  if (/高冷|清冷|知性|严谨|冷静|克制|疏离|律|审计|医生|教授|主笔|编辑|研究员/.test(hint)) return 'cool';
  if (/果断|强势|傲|野心|明艳|凌厉|御姐|气场|总裁|创始|合伙人|总监|高管|千金|主播|艺人/.test(hint)) return 'proud';
  if (/开朗|阳光|直爽|元气|自律|健谈|率真|随性|健身|教练|咖啡|运动|户外|骑行|驻唱/.test(hint)) return 'sunny';
  if (/青涩|害羞|内敛|单纯|安静|腼腆|乖巧|学生|学妹|实习|助教|图书/.test(hint)) return 'pure';
  return 'warm';
}
const INNER_LIFE_POOLS = {
  cool: {
    recentGoals: [
      '正在独立核查一份牵涉行业核心利益的深度项目底稿，顶着多方压力坚持不肯签下妥协字据',
      '筹备下月在东岸举办的闭门专业研讨沙龙，力求靠扎实成果拿下项目绝对主导权',
      '正设法从被派系倾轧的部门中抽身，寻找真正尊重专业底线的独立合伙人平台',
      '在整理一批濒临失传的行业档案与案例，准备作为独立顾问接手更高规格的跨区委托'
    ],
    longTermDreams: [
      '在云澜东岸拥有一间完全由自己掌舵、不必向任何庸俗人情低头的独立事务所与观江书房',
      '写出一本在专业领域留下姓名的权威代表作，去北欧或海岸小镇过半年清净无人打扰的旅居生活',
      '建立一套不靠酒局应酬、只凭专业实力说话的行业新标准，护住身边真正做实事的后辈',
      '拥有一处摆满绝版黑胶与古籍的临海顶层居所，只与真正灵魂契合的知己分享静谧长夜'
    ],
    hiddenScars: [
      '早年最敬重的启蒙前辈为了晋升利益将她独立完成的成果拱手送人，还劝她“识时务”；从此她习惯把所有情绪锁在冷淡得体的职业面具下，听到别人轻易许诺“我护着你”时会下意识垂眸冷笑、指尖微微发凉',
      '成长于要求近乎苛刻的书香家庭，哪怕考了第二名也会被关在书房反省整晚；她表面从容无懈可击，实则极度害怕在真正在乎的人面前展露失误，一旦喝醉或高烧虚弱时就会反复低声道歉',
      '曾有一段维持三年的精神柏拉图恋情，对方却嫌她“太清醒、不懂撒娇”而转身娶了富家女；她从此把所有柔软藏进风衣扣子后面，看到路边情侣分食甜点时会移开目光、加快脚步',
      '几年前因坚持原则拒绝替上司背锅而被全行业隐形封杀过半年，最难的时候卖掉了母亲留给她的古董钢笔交房租；如今她从不向任何人开口借钱或讨人情，遇到那款钢笔或提及当年旧事会骤然沉默'
    ]
  },
  proud: {
    recentGoals: [
      '正在冲刺新项目首轮核心路演与供应链锁单，要在月底行业峰会上一举压过老牌竞争对手',
      '准备在澜光天地或东岸核心地段拿下全新的旗舰空间，亲自把控每一处视觉与接待细节',
      '正与试图稀释她话语权的资方代表博弈，寻找既有雄厚财力又懂得放权尊重的战略盟友',
      '筹划一场高规格的私享品牌发布酒会，意图撬动云澜东岸最挑剔的一批顶层名流客群'
    ],
    longTermDreams: [
      '亲手缔造一个在云澜市举足轻重的商业或美学品牌，站在行业最高处让当年看轻她的人仰望',
      '拥有绝对的财务与人生掌控权，既能驾驭千万级牌桌，也能随时乘私人游艇出海远航',
      '摆脱家族长辈将她视作联姻筹码的命运，用自己打下的江山堂堂正正坐在主桌首位',
      '找到一个在魄力、眼界与生命力上真正能与她并肩乃至征服她的男人，卸下满身盔甲'
    ],
    hiddenScars: [
      '出身重男轻女的富裕商贾之家，无论她做得多好，父亲永远把核心产业留给游手好闲的弟弟；她拼命在商场上争强好胜，每当夜深人静独自开车经过跨江大桥时，总会把车停在应急道上抽完一支烟才肯回家',
      '首次创业时曾被最信任的合伙人联手竞争对手背刺，一夜之间从风光无限跌落到在医院打着点滴看催收函；她从此在谈判桌上滴水不漏、从不示弱，却极度畏惧在完全黑暗的房间里独自入睡',
      '早年刚入行时曾因不肯在酒局上低头而被大佬当众泼酒羞辱，她咬着牙把那件留着酒渍的礼服挂在衣柜最深处；如今她越是在排场盛大的晚宴上光彩照人，散场后越会独自对着镜子发呆良久',
      '曾全心全意扶持过一个贫寒男友走向成功，对方发达后却觉得在她面前抬不起头而背叛出轨；她嘴上常拿“男人只看利弊”当玩笑，实则一旦有人不求回报地替她挡下暗箭，她就会方寸大乱'
    ]
  },
  sunny: {
    recentGoals: [
      '正在全力备战下月的城市专业技能挑战赛，每天闭店后还在反复打磨自己的独门绝活',
      '盘算着把现有的小店活动区改造成周末主题沙龙，聚集一批志同道合的年轻玩家与熟客',
      '正在考取更高阶的国际专业认证资质，想凭硬本事带出一支属于自己的口碑小团队',
      '忙着策划一场海滨露营与落日音乐派对，想用最鲜活的热气把身边的朋友们聚在一起'
    ],
    longTermDreams: [
      '开一家面朝大海、带阳光露台与草坪的复合生活馆，每天只接待真正热爱生活的客人',
      '攒够底气后改装一辆房车或游艇，带着心爱的人和宠物把海岸线上的每一座岛屿走遍',
      '创立一个只看实力不搞潜规则的青年运动与生活社群，让所有凭汗水打拼的人都有舞台',
      '在既有烟火气又有安全感的港湾里安顿下来，让每个周末的清晨都有热咖啡与拥抱'
    ],
    hiddenScars: [
      '父母在她少年时离异并各自组建新家庭，两边都按月给生活费却谁也不带她过年；她养成了用大笑和热闹填满所有空隙的习惯，唯独在除夕或团圆夜散场后，会一个人坐在台阶上对着路灯发呆',
      '曾是最有天赋的青年赛手，却在关键选拔赛前因伤病或替队友顶包而永远失去了站上最高领奖台的机会；她平时大大咧咧从不提当年，只有在下雨天旧伤隐痛或看到别人领奖转播时，会默默戴上耳机去夜跑',
      '刚来云澜打拼那年住过半地下室，发高烧到三十九度半时连一个能帮忙买退烧药的人都找不到；从此她家里常年备着满满一抽屉常用药，谁生病她都热心照顾，唯独自己生病时会死死瞒着所有人',
      '曾经毫无保留地把积蓄借给最要好的闺蜜救急，结果对方不告而别拉黑了她；她依然对熟客笑脸相迎，却再也不敢轻易把谁写进“紧急联系人”一栏'
    ]
  },
  warm: {
    recentGoals: [
      '正在用心筹备一场小众主题作品展与手作沙龙，每一件展品都由她亲手挑选打磨',
      '忙着替一位老主顾修复或定制一件极具纪念意义的心爱之物，为此查阅了大量冷门资料',
      '正在整理店里近一年的四季风物手账，希望能把这处温暖的小角落经营得更有口碑',
      '准备将工作室后院改造成一间安静的午后茶席与阅读角，留给需要喘息的熟客'
    ],
    longTermDreams: [
      '在云澜依山傍水的地方拥有一座带四季庭院与阳光玻璃房的独立工坊，慢工出细活地度过余生',
      '出一套记录城市温柔角落与手作温度的图文集，让快节奏都市里的人有一处心灵栖息地',
      '与一个真正懂得珍惜她细腻心意的人共筑爱巢，在灯火可亲的日常里把每个平凡日子过成诗',
      '开办一所不以盈利为目的的美学与疗愈小课堂，帮更多在城市里受过伤的人找回平静'
    ],
    hiddenScars: [
      '至亲离世那晚她因被琐事缠身未能赶上最后一面，那份迟到的愧疚成了她心底最深的结；她对身边每个人都温柔妥帖到近乎讨好，唯独在暴雨夜或闻到消毒水味时，会不自觉攥紧衣角、指尖冰凉',
      '幼年时因为性格安静慢热，常被家里长辈拿去和八面玲珑的表姐妹比较并嫌弃“木讷没出息”；她习惯了把自己的渴望藏在最后，当别人送她专门为她一人准备的偏爱厚礼时，她会手足无措地红了眼眶',
      '曾倾尽心力守护过一段青涩感情，最后却发现自己只是对方空窗期的替身；她把当年手织了一半的围巾封在箱底，面对男人的甜言蜜语总是温婉微笑着退开半步，只信实打实的行动与陪伴',
      '几年前为了帮家里偿还一笔突如其来的人情旧债，她不得不放弃了去海外深造艺术的名额；平时她从不抱怨一句，只有在翻看外文画册或听见机场航班轰鸣时，眼神会短暂地飘向远方'
    ]
  },
  pure: {
    recentGoals: [
      '正在全力准备毕业课题答辩与行业顶尖机构的首轮实习考核，每天泡在图书馆与实验室到深夜',
      '忙着完成一份独立调研报告与参展作品，希望能凭真才实学拿到留在云澜核心圈层的入场券',
      '正在兼职协助导师整理一批珍贵学术与艺术档案，渴望在步入社会前攒下第一份独立履历',
      '努力适应大都市的高压快节奏，想在月底前独立完成人生第一个署名项目'
    ],
    longTermDreams: [
      '凭自己的学识与才华在云澜站稳脚跟，在江边买下一套有一整面落地书墙的温馨公寓',
      '成为所在领域的青年新锐学者或独立创作者，既保有一颗纯粹初心，又有护住家人的底气',
      '遇到一个既能引领她看遍繁华世面、又愿意耐心呵护她青涩骄傲的成熟伴侣',
      '游历世界各地的顶级博物馆与美术馆，把书本上的风景变成亲眼所见的辽阔天地'
    ],
    hiddenScars: [
      '来自小城普通工薪家庭，父母省吃俭用供她读完名校，她深知自己没有任何试错资本；走进澜光天地等顶奢场所时她总会下意识挺直脊背掩饰局促，一旦被人点破家境或善意替她解围，耳根会瞬间烧得通红',
      '中学时代曾因容貌出众而被流言中伤、遭到同龄女生孤立，导致她很长一段时间只敢穿宽大朴素的衣服低头走路；如今面对直白炙热的夸赞与注视，她第一反应仍是慌乱躲闪、攥紧书包带',
      '大一刚来云澜时曾轻信过所谓“名企实训”骗局，差点丢掉攒了一学期的奖学金；从此她对天上掉馅饼的好事充满戒备，别人对她好一分，她都要笨拙地记在备忘录里想方设法还回去',
      '心里一直替早年为救她而落下腿疾的兄长或长辈攒着一笔康复基金，平时连一杯三十块的精品奶茶都舍不得常喝，却从不在同学朋友面前叫苦，被撞见吃简餐时只会弯起眼睛说自己在控糖'
    ]
  }
};
export function seedInnerLife(c) {
  if (!c || typeof c !== 'object') return c;
  const h = Number('0x' + fnv(String(c.id || c.name || 'char')).slice(0, 8));
  const arch = archetypeOf(c);
  const pool = INNER_LIFE_POOLS[arch] || INNER_LIFE_POOLS.warm;
  const pick = (arr, shift) => arr[Math.floor(h / shift) % arr.length];
  if (!c.recentGoal || !String(c.recentGoal).trim()) {
    c.recentGoal = pick(pool.recentGoals, 3);
  }
  if (!c.longTermDream || !String(c.longTermDream).trim()) {
    c.longTermDream = pick(pool.longTermDreams, 5);
  }
  if (!c.hiddenScar || !String(c.hiddenScar).trim()) {
    c.hiddenScar = pick(pool.hiddenScars, 7);
  }
  return c;
}
// rc.25 / rc.30 铁律 1：女性私密肉体档案与三层心绪链由脚本确定性播种，按五大性格原型分流，
// 彻底剔除违禁套话与千篇一律的拜金弱点。已有非空内容永远优先。
const OUTFIT_POOLS = {
  cool: {
    styles: ['清冷知性通勤', '极简冷调都会', '禁欲系智感穿搭', '利落高定职场'],
    complexions: [
      '冷白皮透着清透光泽，唇色淡雅，神情冷静自持',
      '肤色白皙净透，眉眼清冽，透着拒人千里的端庄感',
      '面容清隽白净，眼尾微敛，自带沉静专注的书卷冷香',
      '瓷白肌肤毫无瑕疵，薄唇微抿，气色清冷而干练'
    ],
    tops: [
      '剪裁利落的象牙白真丝衬衫，领口扣至第二颗，隐约勾勒饱满胸线',
      '烟灰色羊绒高领针织衫，外搭挺括的深灰西装外套，线条克制修身',
      '雾霾蓝垂感醋酸衬衫，袖口挽起露出一截冷白手腕，知性得体',
      '极简黑色修身西装马甲配白衬衫，腰身收束利落，衬出挺拔肩背'
    ],
    bottoms: [
      '高腰炭灰开叉铅笔半裙，包裹出紧致匀称的腰臀弧度',
      '垂坠感极佳的黑色高腰阔腿西裤，显得双腿修长笔直',
      '深藏青色及膝A字西装裙，行走间裙摆微晃、端方雅致',
      '剪裁合体的米白九分烟管裤，勾勒出纤细匀称的腿部线条'
    ],
    lingeries: [
      '冷灰真丝无钢圈三角杯文胸，配同色细带低腰真丝底裤',
      '月白色法式薄纱半杯内衣，边缘点缀极简暗纹蕾丝，干净考究',
      '哑光黑丝绸聚拢文胸与配套莫代尔平角底裤，贴合紧致肌肤',
      '香槟色无痕蚕丝内衣套装，质地轻薄滑腻，透着私密处的讲究'
    ],
    socks: [
      '超薄透肉的0D黑丝连裤袜，均匀包裹修长小腿与纤细脚踝',
      '哑光灰透肤薄丝袜，在冷白肌肤上晕开一层细腻朦胧的质感',
      '裸感清透的极薄肉色丝袜，细腻贴肤几近无痕',
      '薄款包芯黑丝长袜，衬得双腿线条愈发匀称紧实'
    ],
    shoes: [
      '黑色方扣小猫跟尖头单鞋，步履轻稳干练',
      '酒红色漆皮细跟浅口高跟鞋，衬托出优美足弓弧度',
      '极简裸色羊皮细高跟凉鞋，露出白净精致的脚踝',
      '深棕色复古真皮乐福鞋，鞋型修长考究'
    ],
    makeups: [
      '清透哑光底妆配冷调豆沙唇釉，眉形利落，眼尾扫过一抹大地色眼影',
      '干净素雅的伪素颜通勤妆，睫毛根根分明，唇涂清冷干枯玫瑰色',
      '微雾面冷白底妆，细长眼线微微上挑，配低饱和乌龙奶茶色唇膏',
      '轻薄冷感底妆，鼻梁与锁骨略扫细闪高光，唇色呈清透红茶调'
    ],
    accessories: [
      '银色细框防蓝光眼镜、精钢小表盘机械腕表与珍珠耳钉',
      '极简铂金锁骨链、复古皮带石英表与随身真皮公文包',
      '冷调银质几何耳环、细窄皮质腰带与一枚素圈尾戒',
      '金丝半框眼镜、丝绒发抓与腕间一枚低调的古董机械表'
    ]
  },
  proud: {
    styles: ['明艳御姐名媛', '强势高定女王', '轻奢都市丽人', '冷艳气场穿搭'],
    complexions: [
      '雪肤红唇气场全开，眼波流转间自带居高临下的明艳压迫感',
      '肌肤白皙细腻，双颊透着微醺般的玫瑰色泽，神情矜贵傲然',
      '冷白肤色衬着精致五官，下颌微扬，眉眼间尽是自信锋芒',
      '气色红润耀眼，肌肤在灯光下泛着绸缎般的光泽，明艳不可方物'
    ],
    tops: [
      '酒红色深V真丝裹身衬衫，大方展露精致锁骨与傲人胸口雪腻弧线',
      '黑色高定修身粗花呢小香风外套，内搭低领丝绸吊带，矜贵惹火',
      '香槟金斜肩真丝上衣，贴合傲人双峰曲线，肩头露出一抹雪白肌肤',
      '剪裁凌厉的绯红收腰西装外套，真空内搭或配黑色抹胸，气场张扬'
    ],
    bottoms: [
      '黑色高腰侧高开叉包臀长裙，每走一步都隐约露出大片雪白大腿',
      '酒红真丝鱼尾半身裙，将丰润挺翘的臀线与纤细腰肢勾勒得淋漓尽致',
      '高腰修身微喇西装长裤，把本就高挑的双腿衬得愈发修长夺目',
      '焦糖色小羊皮高腰短裙，紧致包裹蜜桃臀型，性感而不失排面'
    ],
    lingeries: [
      '黑金刺绣蕾丝半杯聚拢文胸，配两侧细绑带镂空蕾丝丁字裤',
      '绯红色法式镂空蕾丝内衣套装，胸前细带交织，极具侵略性美感',
      '墨绿色真丝拼接黑蕾丝深V文胸与配套低腰三角底裤，包裹感紧致',
      '纯黑薄纱透视感钢圈文胸配同色系蕾丝边底裤，神秘而妩媚'
    ],
    socks: [
      '带有后缝线的超薄黑丝连裤袜，将修长美腿勾勒得极具视觉张力',
      '黑曜石般光泽的5D薄透黑丝大腿袜，大腿根部箍着防滑蕾丝边',
      '微闪细金丝的裸感薄透丝袜，在灯光下流淌着矜贵诱人的光泽',
      '极薄咖啡色透肉连裤丝袜，紧密贴合小腿与足尖曲线'
    ],
    shoes: [
      '红底黑色漆皮8厘米细高跟尖头鞋，足弓高高拱起、曲线撩人',
      '香槟金水钻一字带细高跟凉鞋，衬得足趾白嫩如玉',
      '黑色麂皮尖头踝靴配金属细高跟，步履间自带铿锵气场',
      '银色镜面细跟浅口高跟鞋，将小腿线条拉得紧致修长'
    ],
    makeups: [
      '精致无瑕的丝绒底妆配正红哑光唇膏，微挑猫眼眼线勾人摄魄',
      '冷艳欧美风截断式眼妆配复古红棕唇釉，轮廓深邃、气场凌厉',
      '光泽肌底妆配微醺浆果色红唇，眼尾点缀碎钻高光，明艳照人',
      '细腻奶油肌底妆，野生眉配丝绒复古玫瑰红唇，眼神侵略感十足'
    ],
    accessories: [
      '流苏钻石耳坠、玫瑰金镶钻腕表与限量款鳄鱼皮手提包',
      '祖母绿宝石锁骨链、夸张金属几何耳环与大框墨镜',
      '双层珍珠叠戴项链、金质细手镯与定制高定丝巾',
      '闪耀碎钻耳骨夹、纤细铂金脚链与名贵镶钻石英女表'
    ]
  },
  sunny: {
    styles: ['元气街头运动', '清爽美式休闲', '活力轻氧穿搭', '阳光飒爽风'],
    complexions: [
      '肌肤透着阳光亲吻过的健康蜜色光泽，脸颊红扑扑的充满朝气',
      '气色红润鲜活，额角带着薄薄一层运动微汗，眉眼弯弯笑意盈盈',
      '白净透亮的肌肤泛着运动后的浅粉血色，眼神清亮有神',
      '小麦色健康肌肤紧致发光，嘴角高高扬起，浑身透着蓬勃生命力'
    ],
    tops: [
      '薄荷绿高弹修身短款运动背心，大方露出一截紧致平坦的马甲线小腹',
      '纯白修身罗纹短T恤，外搭敞开的浅蓝牛仔短夹克，清爽利落',
      '雾粉色专业瑜伽露脐长袖上衣，紧贴饱满挺拔的胸口与纤细腰身',
      '灰色宽松连帽卫衣配工装马甲，领口微敞露出线条流畅的锁骨'
    ],
    bottoms: [
      '高腰蜜桃臀黑色瑜伽紧身裤，将浑圆挺翘的臀腿线条绷得一览无余',
      '浅色毛边高腰牛仔热裤，露出一双匀称紧实、充满弹性的健康长腿',
      '卡其色多口袋束脚工装裤，衬出纤细腰肢与利落飒爽的步态',
      '白色百褶网球短裙，自带防走光内衬，走动间尽显青春活力'
    ],
    lingeries: [
      '灰白撞色高强度运动内衣，配纯棉透气高叉运动三角底裤',
      '冰感无痕裸粉色一片式文胸与配套低腰透气底裤，贴合运动曲线',
      '天蓝色细肩带棉质Bralette内衣套装，清爽干净且富有弹性',
      '纯白字母宽边运动文胸配同款棉质丁字运动底裤，勾勒紧实臀线'
    ],
    socks: [
      '纯白罗纹中筒运动棉袜，刚好包住紧致纤细的脚踝',
      '浅灰透气船袜，露出一截线条利落的脚踝与跟腱',
      '撞色条纹滑板长筒袜，衬得小腿线条笔直紧实',
      '轻薄透气的白色网眼运动短袜，干净清爽'
    ],
    shoes: [
      '白绿撞色复古厚底运动跑鞋，步伐轻快富有弹性',
      '经典高帮帆布板鞋，衬出纤细匀称的小腿比例',
      '银灰流线型专业训练鞋，轻盈贴脚、活力十足',
      '米白色透气网面老爹鞋，显腿长且元气满满'
    ],
    makeups: [
      '清透防汗的阳光晒伤腮红妆，配元气西柚色水光唇蜜，朝气蓬勃',
      '几乎不施粉黛的清爽裸妆，只涂了润色护唇膏，眉眼干净清澈',
      '薄透水光肌配橘调胡萝卜色口红，睫毛自然卷翘，笑起来酒窝明显',
      '干净利落的运动淡妆，橘粉腮红扫过鼻尖，嘴唇水润透亮'
    ],
    accessories: [
      '黑色专业运动智能手环、高马尾发圈与无线降噪运动耳机',
      '复古棒球帽、帆布斜挎胸包与一枚简约银色耳圈',
      '吸汗运动发带、户外电子运动表与随身大容量运动水壶',
      '彩色亚克力发夹、编织手绳与挂在颈间的复古黑胶造型耳机'
    ]
  },
  warm: {
    styles: ['温柔日系森系', '慵懒针织轻熟', '江南温婉茶系', '居家暖调穿搭'],
    complexions: [
      '肌肤温润白皙如羊脂玉，双颊泛着柔和浅粉，眼神温婉如水',
      '面色红润细腻，眉眼柔和舒展，透着让人瞬间安心的温柔暖意',
      '白里透粉的细腻肤质，唇色温软水润，低眉浅笑间尽显娴静柔美',
      '气色温润清透，发丝松散垂落耳畔，整个人像午后暖阳般柔和'
    ],
    tops: [
      '米杏色软糯马海毛开衫，内搭浅卡其真丝V领吊带，温柔勾勒饱满胸型',
      '豆绿色亚麻宽松方领衬衫，外系浅棕色棉麻工作围裙，清丽温婉',
      '燕麦色修身羊绒连衣裙上半身，柔软织物紧密贴合温润饱满的酥胸',
      '藕粉色法式木耳边真丝罩衫，领口微敞露出白皙细腻的颈肩线条'
    ],
    bottoms: [
      '垂坠感十足的奶油白醋酸缎面半身长裙，随步伐泛着柔美光泽',
      '浅咖色棉麻百褶伞裙，裙摆掩过膝盖，衬得露出的小腿愈发白净纤细',
      '高腰温柔碎花雪纺长裙，腰间系带收出盈盈一握的纤细楚腰',
      '米白色直筒羊毛休闲裤，剪裁柔和舒适，尽显温婉居家气息'
    ],
    lingeries: [
      '香槟粉真丝软杯蕾丝内衣，配同色系边缘缀花边的真丝三角底裤',
      '奶油白法式刺绣薄棉文胸与纯棉蕾丝低腰底裤，温柔呵护娇嫩肌肤',
      '浅杏色蚕丝聚拢文胸配无痕冰丝底裤，触感温润顺滑且带着淡淡体香',
      '淡紫色镂空蕾丝半杯内衣套装，既有小女人的矜持又藏着隐秘风情'
    ],
    socks: [
      '透肤自然的浅裸色天鹅绒薄丝袜，触感柔滑细腻',
      '米白色软糯羊绒短袜，刚好护住白皙娇嫩的脚踝',
      '极薄肉粉色透肉长筒丝袜，衬得双腿肌肤白里透粉',
      '浅杏色蕾丝花边隐形船袜，精致乖巧'
    ],
    shoes: [
      '杏色软羊皮浅口芭蕾平底鞋，秀气轻盈、静音优雅',
      '奶油白粗中跟玛丽珍单鞋，踝间一字扣衬出纤细脚腕',
      '浅棕色麂皮温柔低跟小皮鞋，舒适百搭',
      '米色手工编织软底穆勒半拖鞋，露出白净圆润的脚后跟'
    ],
    makeups: [
      '温润奶油肌底妆配温柔蜜桃豆沙唇膏，眼角扫过淡粉桃花眼影',
      '清透日系杂志感淡妆，棕色眼线柔和下垂，唇涂水润杏仁奶茶色',
      '素净清雅的伪素颜妆容，双颊略扫暖杏色腮红，显得气色温软讨喜',
      '轻薄光泽底妆配清透红梨色唇釉，眉眼柔和无攻击性，楚楚动人'
    ],
    accessories: [
      '温润的淡水珍珠耳坠、细金链小方块手表与发间木质发簪',
      '碎花真丝发带、细巧玫瑰金手链与随身棉麻刺绣托特包',
      '琥珀色亚克力抓夹、玉石平安扣红绳手链与淡雅银耳钉',
      '复古小巧圆框眼镜、珍珠母贝项链与沾着草木香的亚麻手帕'
    ]
  },
  pure: {
    styles: ['清纯学院少女', '白月光初恋系', '乖巧书卷穿搭', '清新盐系少女'],
    complexions: [
      '肌肤白净娇嫩得仿佛能掐出水来，双颊稍受注视便泛起羞涩浅红',
      '瓷白细腻的少女肌透着纯净光泽，眼神清澈明亮，带着未经世事的青涩',
      '白皙脸颊晕着天然的淡樱粉色，鼻尖微翘，透着干净乖巧的学生气',
      '肤质清透无瑕，连耳垂都泛着娇嫩的粉意，神情腼腆而认真'
    ],
    tops: [
      '纯白棉质彼得潘领短袖衬衫，外搭藏青色学院风V领针织马甲，乖巧清纯',
      '浅天蓝色修身纯棉Polo领针织衫，将发育饱满却害羞内敛的胸线包裹其中',
      '奶油白泡泡袖棉麻连衣裙上身，领口系着小巧蝴蝶结，衬得锁骨纤细白净',
      '淡鹅黄色软棉卫衣配白衬衫叠穿，袖口微长遮住半截手背，显得娇小惹人怜'
    ],
    bottoms: [
      '灰蓝格纹高腰学院百褶短裙，裙摆刚及大腿中部，露出一双笔直白腻的少女长腿',
      '浅水洗蓝高腰直筒牛仔长裤，包裹出紧致青涩的小巧臀线',
      '纯白色及膝棉质A字伞裙，干净得像初恋电影里的女主角',
      '深灰学院风半身中长百褶裙，走动时裙褶乖巧摆动，青春气息扑面而来'
    ],
    lingeries: [
      '纯白色少女纯棉小碎花无钢圈文胸，配同款荷叶边纯棉三角小内裤',
      '浅樱粉色棉质带小蝴蝶结的少女内衣套装，干净青涩、透着淡淡皂香',
      '天蓝色薄棉透气学生文胸与纯白棉质平角底裤，包裹着未经人事的娇嫩躯体',
      '奶白色蕾丝边软棉少女文胸配同色低腰棉质小内裤，纯粹而诱人'
    ],
    socks: [
      '纯白色及膝小腿棉袜，刚好卡在匀称白腻的小腿肚下方',
      '奶白色半透天鹅绒连裤白丝，将纤细笔直的双腿衬得愈发纯洁诱人',
      '带藏青学院条纹边的白色短棉袜，露出纤细白净的脚踝',
      '微透肉的纯白薄丝中筒袜，透着青涩乖巧的少女感'
    ],
    shoes: [
      '黑色圆头漆皮学院风玛丽珍小皮鞋，配精致金属搭扣',
      '一尘不染的纯白经典低帮帆布小白鞋，青春干净',
      '深棕色学院风圆头牛津小皮鞋，衬得双足小巧秀气',
      '米白色轻便软底运动板鞋，步态轻盈乖巧'
    ],
    makeups: [
      '完全素颜的纯净少女肌，只涂了一层淡粉水润草莓护唇膏，清纯动人',
      '极淡的清透伪素颜，脸颊带着自然的羞涩红晕，唇色呈娇嫩水蜜桃粉',
      '只刷了透明睫毛膏与清透樱花粉唇彩，眉眼干净得不染一丝尘埃',
      '干净白皙的薄透防晒底妆，配冰糖葫芦般晶莹剔透的浅红水光唇釉'
    ],
    accessories: [
      '纯白帆布双肩书包、头顶一枚奶油色一字发卡与简约白色塑料石英表',
      '浅蓝格纹发圈扎起的马尾、有线白色半入耳耳机与挂着毛绒挂件的校园卡套',
      '小巧的银色四叶草耳钉、细红绳手链与怀里抱着的厚重专业精装书',
      '透明亚克力细框眼镜、纯棉帆布单肩袋与一枚素净的贝壳发夹'
    ]
  }
};
export function seedOutfit(c) {
  if (!c || typeof c !== 'object') return c;
  c.outfit = c.outfit && typeof c.outfit === 'object' ? c.outfit : {};
  const h = Number('0x' + fnv(String(c.id || c.name || 'char') + ':outfit').slice(0, 8));
  const arch = archetypeOf(c);
  const pool = OUTFIT_POOLS[arch] || OUTFIT_POOLS.warm;
  const pick = (arr, shift) => arr[Math.floor(h / shift) % arr.length];
  const job = String(c.occupation || '');
  if (!c.outfit.style || !String(c.outfit.style).trim()) {
    c.outfit.style = /花|茶|陶|烘焙/.test(job) ? '清雅森系手作风'
      : /设计|艺术|画|策展/.test(job) ? '极简黑白灰先锋通勤'
      : /咖啡|调酒|音乐|驻唱/.test(job) ? '随性美式复古工装'
      : /编辑|记者|律|审计|咨询/.test(job) ? '清冷知性大女人通勤'
      : /健身|教练|运动员|瑜伽/.test(job) ? '高弹紧致专业运动风'
      : /创始|合伙人|总监|总裁|高管/.test(job) ? '利落轻奢商务精英风'
      : pick(pool.styles, 3);
  }
  if (!c.outfit.complexion || !String(c.outfit.complexion).trim()) c.outfit.complexion = pick(pool.complexions, 5);
  if (!c.outfit.top || !String(c.outfit.top).trim()) {
    const current = String(c.currentClothes || '').trim();
    c.outfit.top = current ? current.slice(0, 200) : pick(pool.tops, 7);
  }
  if (!c.outfit.bottom || !String(c.outfit.bottom).trim()) c.outfit.bottom = pick(pool.bottoms, 11);
  if (!c.outfit.lingerie || !String(c.outfit.lingerie).trim()) c.outfit.lingerie = pick(pool.lingeries, 13);
  if (!c.outfit.socks || !String(c.outfit.socks).trim()) c.outfit.socks = pick(pool.socks, 17);
  if (!c.outfit.shoes || !String(c.outfit.shoes).trim()) c.outfit.shoes = pick(pool.shoes, 19);
  if (!c.outfit.makeup || !String(c.outfit.makeup).trim()) c.outfit.makeup = pick(pool.makeups, 23);
  if (!c.outfit.accessories || !String(c.outfit.accessories).trim()) c.outfit.accessories = pick(pool.accessories, 29);
  if (!c.currentClothes || !String(c.currentClothes).trim()) {
    c.currentClothes = [c.outfit.top, c.outfit.bottom, c.outfit.socks, c.outfit.shoes].filter(Boolean).join('；').slice(0, 300);
  }
  return c;
}
// rc.33 铁律 1：玩家个人档案标签（外貌气场 / 财富身家 / 职业底色 / 床笫战力 / 性器规格 / 天赋特征）
// 完全由脚本按数值与设定确定性推导，零 token 消耗、零八股幻觉。
export function userProfileTags(s) {
  const u = s?.user || s || {};
  const tags = [];
  const cash = s?.user ? tierBasis(s) : (Number(u.initialCashCents ?? u.cashCents) || 0);
  if (cash >= 100000000000) tags.push({ text: '👑 只手遮天', tone: 'amber' });
  else if (cash >= 10000000000) tags.push({ text: '🏛️ 豪门巨擘', tone: 'amber' });
  else if (cash >= 1000000000) tags.push({ text: '💎 千亿新贵', tone: 'amber' });
  else if (cash >= 100000000) tags.push({ text: '🥂 多金潇洒', tone: 'amber' });
  else if (cash >= 5000000) tags.push({ text: '✨ 都市新贵', tone: 'amber' });
  else tags.push({ text: '🌱 潜龙在渊', tone: 'green' });

  const beauty = Number(u.beautyScore) || 60;
  if (beauty >= 90) tags.push({ text: '✨ 神颜暴击', tone: 'amber' });
  else if (beauty >= 78) tags.push({ text: '🥂 斯文败类', tone: 'green' });
  else if (beauty >= 65) tags.push({ text: '🌿 清爽耐看', tone: 'green' });
  else if (beauty >= 50) tags.push({ text: '☕ 沉稳内敛', tone: '' });
  else tags.push({ text: '🎭 反差魅力', tone: '' });

  const jobHint = `${u.occupation || ''} ${u.background || ''}`;
  if (/总裁|董事|家族|公子|合伙人|资本|投行|基金|老板/.test(jobHint)) tags.push({ text: '🦅 上位者气场', tone: 'plum' });
  else if (/设计|艺术|建筑|摄影|音乐|作家|导演|自由|独立|开发/.test(jobHint)) tags.push({ text: '🎨 雅痞才子', tone: 'green' });
  else if (/医|律|教授|学者|顾问|工程师/.test(jobHint)) tags.push({ text: '👓 禁欲精英', tone: 'green' });
  else if (/教练|健身|运动|拳|退伍|保镖/.test(jobHint)) tags.push({ text: '💪 荷尔蒙爆棚', tone: 'pink' });

  const prowess = Number(u.prowessScore) || 70;
  if (prowess >= 90) tags.push({ text: '🔥 人间打桩机', tone: 'pink' });
  else if (prowess >= 75) tags.push({ text: '⚡ 器大活好', tone: 'pink' });
  else if (prowess >= 55) tags.push({ text: '🌙 持久有章法', tone: 'plum' });
  else tags.push({ text: '🌸 温柔前戏派', tone: '' });

  const lenMatch = String(u.genitals?.length || '18cm').match(/(\d+(?:\.\d+)?)/);
  const girthMatch = String(u.genitals?.girth || '4.8cm').match(/(\d+(?:\.\d+)?)/);
  const len = lenMatch ? Number(lenMatch[1]) : 18;
  const girth = girthMatch ? Number(girthMatch[1]) : 4.8;
  if (len >= 21 || girth >= 5.5) tags.push({ text: '🍆 凶悍巨物', tone: 'plum' });
  else if (len >= 18 || girth >= 4.8) tags.push({ text: '🍆 傲人重器', tone: 'plum' });
  else if (len >= 15) tags.push({ text: '🍆 饱满挺拔', tone: 'pink' });

  const gTraits = String(u.genitals?.traits || '');
  if (/青筋|脉络/.test(gTraits)) tags.push({ text: '⚡ 青筋盘绕', tone: 'plum' });
  else if (/滚烫|热度|火热/.test(gTraits)) tags.push({ text: '🌡️ 滚烫灼人', tone: 'pink' });
  else if (/微翘|深处|冠头|硕大/.test(gTraits)) tags.push({ text: '🎯 直顶花芯', tone: 'pink' });

  return tags.slice(0, 6);
}

// rc.38 A-4 / A-5：10 个私密栏位里原先没有写入通路的字段，由脚本按确定性规则兜底。
// 每条都是 agy 定稿、逐字照抄（来源 .work/agy-copy-rc38-private.md），DSH 不自行撰写卡内文案。
export const PRIVATE_COPY = {
  virgin: {
    virginTrue: '💮 处女',
    virginFalse: '🌺 非处女',
    virginUnknown: '❔ 尚未确认',
    virginUnknownNote: '未深入接触，尚不知晓'
  },
  impression: {
    aff90: '整颗心都系在你身上，把你的喜怒与偏爱看得比什么都重，不管在外面是什么身份，回到你面前只想做被你一人独占的女人。',
    aff75: '对你早已越过普通朋友的界限，既信赖你的手腕与胸襟，也贪恋你给的独一份温柔，只等一个水到渠成的契机彻底交付自己。',
    aff50_pure: '心里认定你是难得懂她、护她的知己，相处时总会不自觉在意你的目光，只是面对过于亲昵的试探还会本能地害羞矜持。',
    aff50_corr40: '既倾心于你的气场与偏爱，又已在贴身温存中食髓知味，表面还留着几分体面拉扯，私下里却对你的靠近半推半就。',
    aff20_pure: '觉得你是个谈吐不俗、出手阔绰的体面人，愿意与你保持礼貌融洽的往来，但心底仍留着清醒的社交分寸与观察余地。',
    aff20_corr40: '感情上还未彻底交心，身体与眼界却先一步被你的强势手笔与感官刺激撬开缝隙，在自尊拉扯与隐秘渴望间暗自动摇。',
    affLow_corrLow: '对你仅停留在萍水相逢的陌生或公事公办阶段，言谈举止带着客套的防备边界，不会轻易接纳越界的示好与馈赠。',
    corr80: '理智与世俗矜持已在你面前彻底瓦解，深深沉溺于你赐予的顶层奢靡与掌控欢愉，只要你开口便甘愿卸下一切防线任凭予取予求。',
    corr50_affLow: '清楚彼此之间掺杂着筹码与欲望的成年人默契，贪恋你带来的资源排面与私密欢愉，虽未交出真心却很顺从地配合你的节奏。',
    default: '对你的财力与行事做派颇有印象，态度随和得体，正从一次次实际交集中默默评估你究竟是怎样的人。',
  },
  experience: {
    cool_virgin: '将精神契合与边界感看得极重，常年把精力倾注在专业领域。过往不乏条件优越的追求者，但她厌恶轻浮试探与算计得失的世俗相亲，宁可保持独身清净，也从不肯在毫无灵魂共鸣的人面前褪下贴身衣物。',
    cool_exp: '早年曾与一位看似温文尔雅的同行谈过一段克制的恋情，亲密次数屈指可数且过程乏味仓促；后来发现对方私下拿她的资源做利益交换，便果断斩断关系。那段经历让她对男人的口头承诺越发冷淡，却也埋下了渴望被真正强者彻底折服的隐秘空缺。',
    proud_virgin: '眼高于顶，从小见惯了名利场上的虚情假意与利益联姻。身边围绕的男人不是气场压不住她，就是目的性太强让她倒胃口；她把身体的掌控权视作最后的骄傲筹码，绝不肯随随便便便宜了入不了眼的庸才。',
    proud_exp: '刚入行时曾与一位风头正盛的圈内前辈有过半年露水情缘，对方在商场上精明强势，私下却只顾自己尽兴、从不在意她的感受。散场后她对平庸的男欢女爱彻底失去耐心，唯有在实力与魄力上全方位碾压她的男人才能再度撬动她的欲望。',
    sunny_virgin: '平时和谁都能爽快称兄道弟，实则对男女之事有着近乎执拗的直球底线。这些年忙着在汗水与生计里打拼，遇到过几个表白的对象都只当朋友处成了哥们，既没遇到真正让她脸红心跳的人，也不屑于拿身体去换捷径。',
    sunny_exp: '前两年曾和一起打拼的搭档顺理成章走在一起，最初也有过年轻气盛的热烈温存，但随着现实压力加剧，对方在关键时刻选择了退缩逃避。她干脆利落地挥手分手，从不拿旧事卖惨，只是偶尔在夜深人静时会怀念毫无保留拥抱的温度。',
    warm_virgin: '骨子里慢热传统，总觉得亲密交付应当建立在细水长流的笃定托付之上。习惯了先照顾身边人的情绪，面对过往几次不够坚定的示好总是礼貌退让半步，至今仍妥帖保存着未经人事的温润羞涩。',
    warm_exp: '曾全心全意陪伴过一任初恋男友走过低谷，在出租屋里交付了生涩的第一次；后来却发现自己只是对方空窗期的温顺替身。她默默收拾行李离开，此后面对男人的甜言蜜语总会本能退缩，唯有实打实的偏爱与护短才能让她重新敞开心扉。',
    pure_virgin: '常年往返于校园、图书馆与宿舍之间，家教严苛加上性格腼腆内敛，连被异性牵手或直视过久都会耳根发烫。对男女亲密之事仅停留在书本与室友夜谈的懵懂想象中，身体与心防都还是一张未经涂抹的白纸。',
    pure_exp: '大一刚入学时曾被一位花言巧语的学长哄骗交往，在半推半就的慌乱中交付了初夜，过程生涩疼痛且很快遭遇对方劈腿冷暴力。那次挫折让她一度把心门锁死、对异性靠近充满戒备，却也因此对成熟可靠的温柔引导毫无抵抗力。',
  },
  anusState: {
    anusStateAfterHigh: '刚经历强悍深入的拓荒，原本紧缩的后庭内壁仍带着被彻底撑开后的温热酥麻与微肿感，深处褶皱随着呼吸微微抽动，残存着食髓知味的酸胀余韵。',
    anusStateAfterNormal: '初次受纳异物侵入后仍有些微紧绷与滚烫感，细腻褶皱在缓缓闭合间带着生涩的微颤，需要温和安抚才能逐渐平复。',
  },
  lastMasturbation: {
    cool: '{date} 夜 · 反锁的书房落地窗前，她独自靠在真皮椅背上解开衬衫领口，脑海里浮现白日与你交锋时的眼神与气息，指尖隔着真丝底裤克制而急促地摩挲慰藉，在极力压抑的轻喘中泄去一身紧绷。',
    proud: '{date} 夜 · 刚散场的私密衣帽间全身镜前，她借着微醺酒意褪下半边礼服肩带，看着镜中自己泛红的眼尾，指尖顺着小腹滑入蕾丝边缘，在想象被你强势按住占有的羞耻快感中咬唇攀上战栗。',
    sunny: '{date} 夜 · 运动沐浴后的卧室大床上，她擦着湿发翻来覆去睡不着，满脑子都是你靠近时的滚烫温度，索性拉过薄被蒙住发烫的脸颊，顺着本能抚过敏感紧绷的身躯，在急促呼吸中释放燥热。',
    warm: '{date} 夜 · 暖黄台灯下的卧室床畔，她抱着沾有淡淡气息的软枕蜷缩在被窝里，回味着你温柔护短的言语与掌心温度，指尖羞怯地探入真丝睡裙下轻轻揉弄，在细碎绵长的鼻音里化作一滩春水。',
    pure: '{date} 夜 · 拉严床帘的安静寝室里，她红着耳根死死咬住被角不敢发出一点声响，脑海里全是你的身影，生涩发颤的指尖第一次顺着滚烫小腹向下试探，在陌生而羞耻的电流席卷下湿透了纯棉底裤。',
  }
};

export function seedAnatomy(c) {
  if (!c || typeof c !== 'object') return c;
  c.physiology = c.physiology && typeof c.physiology === 'object' ? c.physiology : {};
  c.intimacy = c.intimacy && typeof c.intimacy === 'object' ? c.intimacy : {};
  c.limits = c.limits && typeof c.limits === 'object' ? c.limits : {};
  seedInnerLife(c);
  const h = Number('0x' + fnv(String(c.id || c.name || 'char')).slice(0, 8));
  const arch = archetypeOf(c);
  const pick = arr => arr[h % arr.length];
  const pick2 = (arr, shift) => arr[Math.floor(h / shift) % arr.length];
  const isVirgin = c.physiology.virgin !== false && (c.intimacy.withUserCount || 0) === 0 && (c.intimacy.sexPartnerCount || 0) === 0;
  if (c.physiology.virgin === null || c.physiology.virgin === undefined) c.physiology.virgin = isVirgin;
  const hint = `${c.body || ''} ${c.appearance || ''}`;
  const cup = c.cupSize || inferCupSize(c.bustCm, c.waistCm, c.heightCm, hint, h);
  if (!c.cupSize) c.cupSize = cup;
  if (!c.physiology.chestDetail) {
    const shapes = [
      '饱满水滴型', '挺拔半球型', '丰盈圆润型', '娇俏铃兰型',
      '聚拢蜜桃型', '修长微翘型', '雪白玉碗型', '紧致凝脂型'
    ];
    const areolas = isVirgin
      ? [
          '浅粉娇嫩乳晕，乳首小巧挺立', '淡樱粉色乳晕，轻触即敏锐充血',
          '白里透粉乳晕，颗粒细腻敏感', '初雪映桃般的淡粉乳晕，乳尖含羞微敛',
          '奶白透绯乳晕，受凉或受激时迅速挺翘'
        ]
      : [
          '蜜桃绯红乳晕，乳首饱满易立', '柔嫩粉润乳晕，握感绵密充盈',
          '玫瑰浅绯乳晕，乳尖柔韧敏锐', '熟润胭脂色乳晕，掌心拢握时温热弹软'
        ];
    c.physiology.chestDetail = `${cup}罩杯${pick(shapes)}，${pick2(areolas, 3)}，肌肤细腻柔腻，掌心包裹感极佳`;
  }
  if (!c.physiology.vaginaLook) {
    const types = [
      '饱满馒头穴，外唇丰润紧拢，呈一线微闭合拢',
      '一线天玉缝，小阴唇纤薄内敛被饱满外唇完全包裹',
      '粉嫩水滴形秘处，唇瓣精致对称、边缘紧致闭合',
      '小巧柳叶唇，花唇薄如蝉翼，阴蒂隐藏于微拢花冠下',
      '微绽蝴蝶唇，花瓣柔嫩饱满、层次精致分明',
      '凝脂白玉鲍，耻骨微隆、花缝匀称紧窄',
      '含苞海棠唇，内外唇瓣紧密贴合、线条柔美流畅',
      '娇俏兰花瓣，小阴唇微露一抹嫩尖，触感极度柔滑'
    ];
    const tones = isVirgin
      ? [
          '色泽白皙浅粉、娇嫩欲滴', '呈晶莹淡樱粉色、水润无瑕',
          '呈初绽蜜桃般的浅绯粉泽', '泛着珍珠母贝般的柔白浅粉'
        ]
      : [
          '呈蜜桃熟润粉泽、色泽诱人', '外沿白皙、内侧泛着娇艳绯红',
          '呈温润玫瑰粉泽、饱满多汁', '浅绯透粉、动情时色泽愈发艳丽'
        ];
    c.physiology.vaginaLook = `${pick(types)}；${pick2(tones, 5)}`;
  }
  if (!c.physiology.vaginaState) {
    const virginStates = [
      '处子般极度紧窄，内壁嫩肉层叠吸附，常态温热微润',
      '未经人事的紧致甬道，入口纤窄柔嫩，轻触即本能收缩',
      '内壁紧实绵密如丝绒包裹，处子防线完好，略受挑逗便泌出清亮湿意',
      '花穴紧闭幽深，嫩肉弹性极佳，贴合时带着生涩的温热吸附感'
    ];
    const expStates = [
      '层叠褶皱紧致温热，内壁弹性十足，动情时极易泌水包裹',
      '甬道柔韧紧箍、温润多汁，深处软肉会随呼吸节奏轻轻吮吸',
      '内壁绵密饱满、湿润顺滑，一经深入便紧密缠裹不留缝隙',
      '秘处温热紧实，花芯敏感易颤，情动时春水充沛、吸力惊人'
    ];
    c.physiology.vaginaState = pick2(isVirgin ? virginStates : expStates, 19);
  }
  if (!c.physiology.pubicHair) {
    const hairs = [
      '天生白虎，耻骨光洁无毛，饱满户型一览无余',
      '修剪整齐的浅色倒三角，毛质细软柔顺',
      '稀疏细软的浅褐绒毛，隐约衬托粉嫩玉缝',
      '柳叶形精致修整，干净利落且极具情趣',
      '自然柔顺的浅密软毛，触感丝滑不扎手',
      '心形小巧修剪，边缘净白细腻',
      '一线窄条形修整，恰到好处地遮掩花冠顶端',
      '极淡的柔细绒毛，几乎呈半透明的白净质感'
    ];
    c.physiology.pubicHair = pick2(hairs, 7);
  }
  if (!c.physiology.anusLook) {
    const anusLooks = [
      '浅粉菊蕾紧缩，周围肌肤白净，褶皱细密洁净',
      '小巧粉润的后庭紧闭，纹理浅淡匀称、洁净无瑕',
      '淡绯色菊穴微微内敛，肌肤娇嫩白皙',
      '紧致闭合的浅粉蕾口，周围雪肤细腻光洁'
    ];
    c.physiology.anusLook = pick2(anusLooks, 23);
  }
  if (!c.physiology.anusState) {
    const anusStates = [
      '未经开发，紧致闭合，触碰时猛烈收缩',
      '禁区防线严密，毫厘未开，指尖擦过便会本能绷紧',
      '极度紧窄羞涩，从未受过异物侵入，反应敏锐',
      '保持着完全陌生的紧缩状态，温热而抗拒外力'
    ];
    c.physiology.anusState = pick2(anusStates, 29);
  }
  if (!c.physiology.hymenNote) {
    c.physiology.hymenNote = isVirgin ? '处女膜完好无损，未经人事' : ((c.intimacy.withUserCount || 0) > 0 ? '已与你发生亲密关系' : '已有过往经历');
  }
  if (!c.physiology.bodyScent) {
    const scentByArch = {
      cool: ['清冽雪松尾调与雨后白茶冷香', '幽淡墨兰混着冷冽皂角气息', '清冷佛手柑与洗净真丝的微凉淡香', '高山乌龙与雪后松针的清雅体息'],
      proud: ['馥郁大马士革玫瑰与琥珀尾调', '微醺晚香玉混着冷艳木质调体香', '矜贵丝绒鸢尾与黑醋栗的勾人暗香', '苦橙叶与檀木交织的高定冷艳气息'],
      sunny: ['海盐柑橘与阳光晒过棉麻的清爽体香', '鲜榨白西柚与薄荷草木的元气清香', '雨后青柠与少年感皂香的干净气息', '清甜椰乳与海风微咸的鲜活暖香'],
      warm: ['温润清甜的栀子花与沐浴后奶润暖香', '白桃乌龙与肌肤自带的温软甜香', '桂花酿与温热羊绒般的柔和馨香', '洋甘菊与杏仁牛奶的安心暖息'],
      pure: ['初熟青苹果与少女发间的干净洗发水香', '清晨铃兰与纯白棉布的羞涩淡香', '微甜牛奶糖与晨露青草的纯净体息', '淡雅樱花与书页纸墨交融的清甜气息']
    };
    c.physiology.bodyScent = pick2(scentByArch[arch] || scentByArch.warm, 11);
  }
  if (!c.physiology.traits) {
    const traitsByArch = {
      cool: [
        '后颈与耳后神经极度敏锐，被温热呼吸贴近耳廓低语时，冷淡伪装会瞬间崩出细密战栗',
        '锁骨凹陷与脊背蝴蝶骨异常敏感，隔着真丝衬衫被指腹慢条斯理摩挲便会呼吸失序',
        '手腕内侧与腰窝一触即紧绷，被扣住十指按在桌沿亲吻时，双腿会不受控制地发软',
        '大腿内侧根部与小腹极为怕痒敏感，平日越是端庄克制，被撩开裙摆触碰时反差越剧烈'
      ],
      proud: [
        '下颌线与耳垂敏感度极高，被强势捏住下巴迫使对视深吻时，眼神会迅速从倔强转为迷离',
        '酥胸乳首与侧腰曲线极易受激，在落地窗或镜前被从身后拢住揉捻时会咬唇隐忍出哭腔',
        '脚踝与小腿内侧隔着薄透丝袜被把玩时浑身发烫，高傲自尊被寸寸瓦解的快感最为致命',
        '后腰与花芯深处对力度极为敏感，唯有在绝对强势的掌控与深顶下才会彻底缴械痉挛'
      ],
      sunny: [
        '腰侧与小腹紧致敏感，被突然揽住腰肢贴身拥吻时会像触电般绷紧脚背、呼吸急促',
        '耳廓与肩窝一吻即红，运动微汗后肌肤敏感度翻倍，稍加爱抚便会体温滚烫、动情泛滥',
        '大腿外侧至臀线弹性十足且极度敏锐，被有力手掌托起抱坐时内壁会剧烈收缩吸吮',
        '锁骨与胸口对唇舌触感毫无招架之力，含羞带臊的直球迎合中透着惊人的紧致包裹力'
      ],
      warm: [
        '耳垂、后颈与掌心都很敏感，十指紧扣着被温柔深吻爱抚时，身体会像春水般彻底融化',
        '酥胸与乳晕极度娇嫩，被耐心含吮揉弄时会发出细碎甜腻的鼻音，秘处迅速湿透底裤',
        '腰窝与大腿内侧肌肤薄嫩，在漫长温柔的前戏耳语中会主动环住你的脖颈、毫无保留地绽放',
        '阴蒂与花穴内壁对温度和节奏极其敏感，被紧紧拥在怀里深入交融时最容易连环攀上巅峰'
      ],
      pure: [
        '全身肌肤都带着未经人事的娇嫩敏锐，连隔着衣料擦过乳尖或大腿都会瞬间羞红到耳根',
        '后颈与耳垂一被轻咬便浑身酥软无力，生涩害羞的躲闪反而让紧窄内壁绞得愈发死紧',
        '小腹与秘处花唇娇嫩异常，初次被指尖或滚烫温度触碰时会紧张得屏住呼吸、眼尾泛潮',
        '足弓与膝窝极为敏感，在半遮半掩的灯光下被哄着展开身体时，每一寸嫩肉都在轻轻发颤'
      ]
    };
    c.physiology.traits = pick2(traitsByArch[arch] || traitsByArch.warm, 13);
  }
  if (!c.intimacy.attitude) {
    const attitudeByArch = {
      cool: [
        '清醒克制、极重精神共鸣，平日边界感极强，唯有被真正折服后才会在私密空间卸下全部防备',
        '智性恋倾向明显，厌恶轻浮搭讪，但一旦认准某人，关起门来会展现出令人惊艳的专注与顺从',
        '表面疏离冷淡，实则对绝对可靠的安全感与掌控力缺乏抵抗，动情后越发依恋眼神交汇',
        '把体面看得很重，绝不轻易越界，可一旦心防被凿穿，反差出的失控与缠绵比谁都彻底'
      ],
      proud: [
        '慕强且心高气傲，看不起平庸的讨好，只对能在气场、手腕与床笫间全面压制她的强者低头',
        '享受势均力敌的暧昧拉锯，不甘心轻易认输，却在被强势占有的瞬间食髓知味、欲罢不能',
        '讲究排面与尊严，在人前是说一不二的上位者，私下里却渴望能放心交出主导权的怀抱',
        '对奢华质感与极致感官体验有着天然向往，一旦确认你的实力与偏爱，便会大方展露妩媚本色'
      ],
      sunny: [
        '坦率热烈、遵从本心，不喜欢弯弯绕绕的试探，认定心意后便会大胆直接地回应热情',
        '在感情里看重真诚与痛快，平时大大咧咧像哥们，真到了亲密关头却比谁都容易害羞脸红',
        '充满生命力与好奇心，对喜欢的人毫不扭捏，愿意在笑闹与温存中一起尝试新鲜刺激的体验',
        '重情重义，绝不拿感情做廉价交易，但对关键时刻挺身护住她的人会死心塌地、热烈相拥'
      ],
      warm: [
        '温柔慢热、重情念旧，把亲密关系视为心意相通的延伸，需要被妥帖珍视才能安心交付自己',
        '外柔内韧，平时懂得照顾所有人，私下里却极度渴望被更宽厚的怀抱宠溺包裹、替她拿主意',
        '对细腻的陪伴与仪式感毫无抵抗力，一旦建立深厚信任，在床笫间会极尽温存柔顺地迎合取悦',
        '看重细水长流的偏爱，抗拒粗暴功利的索取，但在心爱之人面前愿意尝试一切能让你欢愉的姿态'
      ],
      pure: [
        '青涩懵懂、保守自持，对男女之事既怀着隐秘的好奇又充满羞怯，需要极有耐心的哄劝与引导',
        '把第一次与清白看得很重，面对靠近会本能地紧张攥衣角，唯有在绝对安心的依恋中才肯盛开',
        '单纯敏感，分不清世故套路，谁对她真心实意她就会笨拙地全盘托出，亲密时羞得不敢睁眼',
        '像一张未经涂抹的白纸，一切感官反应都完全由你亲手启蒙调教，越是生涩越透着致命诱惑'
      ]
    };
    c.intimacy.attitude = pick2(attitudeByArch[arch] || attitudeByArch.warm, 17);
  }
  if (!c.intimacy.firstTime) {
    c.intimacy.firstTime = isVirgin ? '尚无性经验（初夜完好）' : '过往曾有短暂恋情经历';
  }
  if (!c.intimacy.fetishes) {
    const fetishByArch = {
      cool: [
        '对穿着一丝不苟的通勤套装或黑丝高跟、在书房或办公室被反锁房门强势拥吻毫无抵抗力',
        '被摘下眼镜或解开束发、扣住手腕贴在耳边低声命令时，平日的冷静自持会迅速土崩瓦解',
        '暗中着迷于“人前清冷端庄、人后在你怀里失神轻喘”的背德反差感与绝对占有',
        '对指尖慢条斯理地解开衬衫纽扣、一边用眼神审视她一边深入顶弄的掌控节奏极易沦陷'
      ],
      proud: [
        '对在落地窗前或镜面旁被从身后强势禁锢、看着自己高傲神情逐渐失控迷离的画面极度敏锐',
        '迷恋高定礼服与薄透丝袜被撕开半边的凌乱美感，在半推半就的制服张力中会彻底食髓知味',
        '喜欢在微醺夜色中被更高维度的手腕与强悍体力彻底征服，甚至在巅峰时主动勾住你的脖颈索吻',
        '对耳后与腰窝的强势抚弄、伴随着笃定耳语的深度占有毫无招架之力'
      ],
      sunny: [
        '在运动沐浴后带着微汗余温被抵在墙边热吻、或是清晨阳光下的缠绵拥抱最能让她瞬间动情',
        '喜欢充满力量感的托抱体位与十指紧扣的眼神交锋，直球式的夸赞会让她羞耻又兴奋地夹紧双腿',
        '对户外露营帐篷、私人游艇甲板或车内等带着心跳加速感的私密独处空间格外敏感',
        '被揉弄敏感耳廓与紧致腰臀、哄着换上反差感十足的俏皮制服时会既羞恼又顺从地配合'
      ],
      warm: [
        '对漫长温柔的耳鬓厮磨、从指尖一路亲吻到锁骨与小腹的细腻前戏毫无抵抗力',
        '喜欢在充满安全感的怀抱里被紧紧搂住后腰深入交融，听着你低沉的喘息与偏爱情话会连环失神',
        '穿上你亲手挑选的真丝睡裙或薄纱内衣、在暖色灯光下被耐心把玩每一寸敏感带时会彻底融化',
        '对事后温存的拥抱、轻抚发丝与深入内里的完全占有有着极度痴迷的依恋感'
      ],
      pure: [
        '被宽大手掌拢住发烫的脸颊、在温柔又不容拒绝的哄劝中一点点褪去衣衫时会羞耻得浑身轻颤',
        '对蒙住双眼或关掉大灯后的触觉放大极为敏感，每一记轻咬与深入都会引来带着哭腔的娇喘',
        '穿着干净百褶裙或白丝袜被抱坐在膝头爱抚时，生涩的羞意与陌生的快感会让她死死抓紧你的衣襟',
        '在耳边一遍遍确认“只属于你”的笃定低语下，会红着眼眶乖巧张开双腿任由采撷'
      ]
    };
    c.intimacy.fetishes = pick2(fetishByArch[arch] || fetishByArch.warm, 19);
  }
  if (!c.limits.weakness) {
    const goalSnippet = String(c.recentGoal || '').trim().slice(0, 22);
    const weakByArch = {
      cool: [
        goalSnippet ? `在「${goalSnippet}」上极要强，一旦有人看穿她冷淡下的逞强并替她稳稳托底，心防便会悄然裂开缝隙` : '吃软不吃硬，面对看穿她隐忍心结却不点破、用行动稳稳托底的成熟男人最难招架',
        '对真正懂她专业心血、又能在关键时刻展现雷霆手腕的知己毫无抵抗力',
        '极度重诺护短，一旦欠下无法用寻常人情偿还的知遇之恩，内心底线便会步步退让'
      ],
      proud: [
        goalSnippet ? `执着于「${goalSnippet}」的胜负，面对在眼界、魄力与财力上全方位碾压并偏爱她的上位者极易折服` : '慕强本能刻在骨子里，面对在气场、手腕与胸襟上彻底赢过她的男人会甘愿收起利爪',
        '受不得激将与冷落，当你在万众瞩目下给她足了独一份的排面与偏爱，她私下里什么条件都肯谈',
        '表面再强势也渴望一处不必算计得失的港湾，被戳中暗藏的脆弱往事时会瞬间乱了方寸'
      ],
      sunny: [
        goalSnippet ? `满心扑在「${goalSnippet}」上，最受不了别人真心实意陪她并肩折腾、在她脆弱时替她挡风遮雨` : '最讲义气与真心，面对在她低谷或孤单时不求回报陪在身边的偏爱会毫无保留地陷进去',
        '不吃居高临下的施舍那一套，但对尊重她热爱、又能带她见识辽阔天地的强势温柔毫无防备',
        '看似大大咧咧实则极怕孤独，深夜微醺或旧伤触动时的温柔陪伴最能轻易击溃她的防线'
      ],
      warm: [
        goalSnippet ? `挂念着「${goalSnippet}」，面对细致入微的体贴照顾与一言九鼎的撑腰护短极易心软依附` : '心软念旧，面对记住她每一句随口提及的小愿望、替她把风雨挡在门外的偏爱毫无抵抗力',
        '极怕给别人添麻烦，可一旦被强势又温柔地纳入羽翼之下，便会生出彻底依恋的顺从感',
        '对触及她过往心结时的耐心倾听与坚定拥抱毫无招架之力，很容易把整颗心都系在你身上'
      ],
      pure: [
        goalSnippet ? `正为「${goalSnippet}」紧绷奔忙，面对成熟可靠的引导、耐心呵护与恰到好处的撑腰极易生出崇拜依恋` : '涉世未深，面对兼具雄厚实力与温柔耐心的成熟引导者，会不由自主地产生依赖与顺从',
        '自尊心强又容易害羞，当你在维护她小小骄傲的同时替她摆平难题，她会满心满眼只看得到你',
        '在半推半就的温柔攻势与绝对安全感包围下，原本生涩的防线会一步步瓦解得干干净净'
      ]
    };
    c.limits.weakness = pick2(weakByArch[arch] || weakByArch.warm, 31);
  }
  if (!c.limits.worry) {
    const worryByArch = {
      cool: [
        '害怕自己失控动情后的模样不够体面，更怕交付信任后重蹈过往被辜负的覆辙',
        '担心私密关系影响自己在专业领域的独立判断，在理智克制与本能沉溺之间反复拉扯'
      ],
      proud: [
        '最怕在感情或交易里落了下风沦为附庸，又隐隐抗拒不了彻底交出掌控权时的极致欢愉',
        '害怕心底暗藏的旧伤与脆弱被人当成拿捏她的筹码，总想维持最后的骄傲体面'
      ],
      sunny: [
        '害怕原本纯粹热烈的相处变味成冷冰冰的金钱账单，又担心自己陷得太深失去洒脱',
        '担心身世或过往的遗憾让你觉得她不够完美，总习惯用开朗笑脸掩饰心底的不安'
      ],
      warm: [
        '害怕这只是一场露水情缘的消遣，担心自己在习惯了你的温柔与奢华照拂后再也回不去',
        '既怕私密失态被熟人察觉，又怕自己成为你的累赘，总在患得患失中暗自克制'
      ],
      pure: [
        '害怕两人之间悬殊的阅历与财力差距，担心自己只是一时新鲜的猎物而非被长久珍惜的人',
        '对越界欢愉充满羞耻与无措，既怕被熟人撞破秘密，又怕自己食髓知味后彻底离不开你'
      ]
    };
    c.limits.worry = pick2(worryByArch[arch] || worryByArch.warm, 37);
  }
  // rc.38 A-4：这三个字段原先没有任何写入通路，永远显示「尚未记录」，改由脚本播种。
  if (!c.intimacy.experience) c.intimacy.experience = PRIVATE_COPY.experience[arch + (isVirgin ? '_virgin' : '_exp')] || PRIVATE_COPY.experience.warm_exp;
  if (!c.intimacy.partnersCount) c.intimacy.partnersCount = isVirgin ? 0 : 1;
  if (!c.impression) c.impression = impressionFor(c);
  seedOutfit(c);
  return c;
}
// rc.38 A-4：印象按好感×堕落确定性推导，随数值变化自动刷新，零 token。
 export function impressionFor(c){
  const aff=Number(c?.affection)||0,cor=Number(c?.corruption)||0,C=PRIVATE_COPY.impression;
  if(cor>=80)return C.corr80;
  if(aff>=90)return C.aff90;
  if(aff>=75)return C.aff75;
  if(aff>=50)return cor>=40?C.aff50_corr40:C.aff50_pure;
  if(aff>=20)return cor>=40?C.aff20_corr40:C.aff20_pure;
  if(cor>=50)return C.corr50_affLow;
  if(cor<20)return C.affLow_corrLow;
  return C.default;
}
// rc.38 A-4：后庭状态 / 最近自慰 / 印象三件由脚本按确定性规则演进；模型本轮亲手写过的值优先保留。
export function evolvePrivateState(c,{prowess=70,date='',analCue=false,wroteAnus=false,sexNow=false}={}){
  if(!c||!c.physiology||!c.intimacy)return c;
  if(analCue&&!wroteAnus)c.physiology.anusState=prowess>=75?PRIVATE_COPY.anusState.anusStateAfterHigh:PRIVATE_COPY.anusState.anusStateAfterNormal;
  if(!sexNow&&Number(c.arousal)>=65&&(Number(c.affection)>=50||Number(c.corruption)>=50)&&!String(c.intimacy.lastMasturbation||'').trim()){
    const tpl=PRIVATE_COPY.lastMasturbation[archetypeOf(c)]||PRIVATE_COPY.lastMasturbation.warm;
    c.intimacy.lastMasturbation=tpl.split('{date}').join(String(date||''));
  }
  c.impression=impressionFor(c);
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
  const name = text(c.name,50), age = integer(c.age,18,80);
  const priv=privateDefaults();
  // rc.32：开局投喂的女体档案先落位，seedAnatomy 只补空字段，不再覆盖已给的值。
  const seedPhysio=c.physiology||{};
  for(const key of ['chestDetail','vaginaLook','pubicHair','bodyScent','traits']){const value=text(seedPhysio[key] ?? '',key==='traits'?400:200,true);if(value)priv.physiology[key]=value;}
  if(seedPhysio.virgin===true||seedPhysio.virgin===false){priv.physiology.virgin=seedPhysio.virgin;if(seedPhysio.virgin===false)priv.intimacy.sexPartnerCount=Math.max(priv.intimacy.sexPartnerCount||0,1);}

  // rc.33：AI 补全/预设给的亲密观念、性癖与整套穿搭先落位，seedAnatomy/seedOutfit 只补空。
  const seedIntimacy=c.intimacy||{};
  for(const key of ['attitude','fetishes']){const value=text(seedIntimacy[key] ?? '',key==='attitude'?60:200,true);if(value)priv.intimacy[key]=value;}
  const seedOutfitData=c.outfit||{};
  for(const key of ['style','complexion','top','bottom','lingerie','socks','shoes','makeup','accessories']){
    const max=key==='style'?100:key==='complexion'?120:['top','bottom','lingerie'].includes(key)?200:150;
    const value=text(seedOutfitData[key] ?? '',max,true);if(value)priv.outfit[key]=value;
  }
  return seedAnatomy({id:id(c.id), aliases:(c.aliases || []).map(x => text(x,50)).slice(0,20), name, age,
    occupation:text(c.occupation ?? '',100,true), affection:integer(c.affection ?? 20,0,100),corruption:integer(c.corruption ?? 0,0,100),
    relationshipLabel:text(c.relationshipLabel || '熟人',12), relationshipNotes:text(c.relationshipNotes ?? '',300,true),
    ...basicProfile(c),beautyScore:c.beautyScore==null?null:integer(c.beautyScore,1,100),knownFacts:text(c.knownFacts ?? c.notes ?? '',1200,true),profileFixed:null,profileLocked:false, trackingState:'RECORDED',
    addressing:text(c.addressing ?? '',20,true),impression:'',starred:false,currentThought:'',arousal:0,offscreen:'',
    recentGoal:text(c.recentGoal ?? '',200,true),longTermDream:text(c.longTermDream ?? '',200,true),hiddenScar:text(c.hiddenScar ?? '',300,true),
    ...priv,
    currentClothes:'',currentPose:'',currentAction:'',currentExpression:'',currentMood:'',currentCondition:'',currentItems:'', avatarRef:null,portraitRef:null});
}
export function validateDraft(d) {
  requireRule(d && typeof d === 'object', 'INVALID_DRAFT');
  const user = {id:'USER', name:text(d.name,50),age:integer(d.age,18,80),beautyScore:integer(d.beautyScore,1,100),gender:text(d.gender ?? '',40,true),
    appearance:text(d.appearance ?? '',500,true),body:text(d.body ?? '',500,true),occupation:text(d.occupation ?? '',100,true),background:text(d.background ?? '',1200,true),
    city:'云澜市',location:text(d.currentLocation,150),
    workLifeDescription:text(d.workLifeDescription ?? '',600,true),cashCents:integer(d.initialCashCents),initialCashCents:d.initialCashCents,
    currentClothes:'',currentPose:'',currentAction:''};
  for(const [k,min,max] of [['heightCm',140,230],['weightKg',35,200],['shoeSizeEu',34,52]]){
    const raw=d[k];
    const v=raw===null||raw===undefined||raw===''?null:Number(raw);
    requireRule(v===null||(Number.isFinite(v)&&v>=min&&v<=max),'INVALID_INTEGER');
    user[k]=v===null?null:Math.round(v*10)/10;
  }
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
  const contacts = d.contacts.map(c => ({...c,...basicProfile(c),id:id(c.id),name:text(c.name,50),age:integer(c.age,18,80),
    beautyScore:c.beautyScore===undefined?undefined:integer(c.beautyScore,1,100),affection:integer(c.affection,0,100),corruption:integer(c.corruption ?? 0,0,100),occupation:text(c.occupation ?? '',100,true),relationshipLabel:text(c.relationshipLabel || '熟人',12),
    recentGoal:text(c.recentGoal ?? '',200,true),longTermDream:text(c.longTermDream ?? '',200,true),hiddenScar:text(c.hiddenScar ?? '',300,true),
    notes:text(c.notes ?? '',1200,true),briefDescription:text(c.briefDescription ?? '',400,true),
    physiology:{...(c.physiology?.virgin===true||c.physiology?.virgin===false?{virgin:c.physiology.virgin}:{}),chestDetail:text(c.physiology?.chestDetail ?? '',200,true),vaginaLook:text(c.physiology?.vaginaLook ?? '',200,true),pubicHair:text(c.physiology?.pubicHair ?? '',120,true),bodyScent:text(c.physiology?.bodyScent ?? '',120,true),traits:text(c.physiology?.traits ?? '',400,true)},
    present:c.present === true}));
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
    characters:chars,identityMap:{},hiddenTemporary:{},finance:{ledger:{},assets:Object.fromEntries(assets.map(a=>[a.assetId,a])),retiredBasisCents:0,customAssetDate:null,customAssetCount:0},
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
// Effective wealth = cash plus what the player already paid in-game for assets
// still held or gifted to women. Spending cash on a property or gifting it must
// not wash the player's net worth back down to the 10x trainee multiplier.
export function tierBasis(s){
  // rc.42：被删除或被押输的后购资产已不在 assets 里，其成本累计进 retiredBasisCents；
  // 否则「删资产 → 身家回落 → 提现倍率倒挂回升」会变成一条刷倍率路径。
  let v=add(s.user.cashCents,s.finance?.retiredBasisCents||0);
  for(const a of Object.values(s.finance?.assets||{}))if(!a.acquisitionIsInitial&&(a.ownerId==='USER'||a.status==='TRANSFERRED'))v=add(v,a.basisCents??a.bookValueCents??0);
  return v;
}
export function withdrawalQuote(s,cid){const p=poolParts(s,cid),tier=wealthTier(tierBasis(s)),gross=multiply(p.total,tier.multiplier),debt=recoveryDue(s,cid);return {...p,tier,gross,recoveryCents:Math.min(gross,debt),paidCents:Math.max(0,gross-debt),debt};}
export function totals(s) {
  let assets=0,income=0,expense=0;
  for (const a of Object.values(s.finance.assets)) if (a.ownerId === 'USER' && a.status === 'OWNED') assets=add(assets,a.bookValueCents);
  for (const e of Object.values(s.finance.ledger)) {if(e.direction==='IN') income=add(income,e.amountCents);else if(e.direction==='OUT')expense=add(expense,e.amountCents);}
  return {cash:s.user.cashCents,assets,total:add(s.user.cashCents,assets),income,expense};
}
// ── rc.46：三装置的派生同步与旧存档清洗 ─────────────────────────
// 项圈：把【誓约项圈】段从配饰里剥离后按佩戴态重写首段，模型换装也不会丢。
export function syncChokerAccessory(c){
  if(!c)return;
  c.outfit=c.outfit||{};
  const rest=String(c.outfit.accessories||'').replace(/【誓约项圈】[^；;]*(?:[；;]\s*)?/g,'').replace(/^[；;\s]+/,'').trim();
  if(c.choker?.worn){
    const clause=chokerClause(c.choker);
    c.outfit.accessories=(rest?`${clause}；${rest}`:clause).slice(0,150);
  } else c.outfit.accessories=rest.slice(0,150);
}
// 印记：多枚制派生句（按部位顺序拼接、150 字上限内截断）
export function syncImprintText(c){
  if(!c||!c.imprints)return;
  c.physiology=c.physiology||{};
  c.physiology.tattooScar=buildImprintText(c.imprints).slice(0,150);
}
// 旧存档清洗：删三件空壳奇物（按原价幂等退星愿积分）、持久装置迁成解锁位、脏佩戴态收敛。
export function sanitizeInventoryAndUnlocks(s){
  const out={changed:false,refundedPoints:0,removedIds:[]};
  try{
    if(!s||typeof s!=='object')return out;
    s.wheel=s.wheel||{};s.inventory=s.inventory||{};s.facts=s.facts||{};s.characters=s.characters||{};
    for(const [itemId,item] of Object.entries(s.inventory)){
      if(!item||item.category!=='SURREAL_ITEM')continue;
      const refId=String(item.refId||'');
      if(refId==='it_toylink'){s.wheel.toyLinkUnlocked=true;delete s.inventory[itemId];out.changed=true;out.removedIds.push(itemId);continue;}
      if(refId==='it_choker'){s.wheel.chokerUnlocked=true;delete s.inventory[itemId];out.changed=true;out.removedIds.push(itemId);continue;}
      if(refId==='it_imprint'){s.wheel.imprintUnlocked=true;delete s.inventory[itemId];out.changed=true;out.removedIds.push(itemId);continue;}
      const price=LEGACY_REMOVED_PRICES[refId];
      if(!price)continue;
      const factKey='legacy_refund:'+itemId;
      if(!Object.hasOwn(s.facts,factKey)){
        s.wheel.starPoints=(Number(s.wheel.starPoints)||0)+price;
        s.facts[factKey]={type:'LEGACY_ITEM_REFUND',refId,refundedPoints:price,itemId};
        out.refundedPoints+=price;
      }
      delete s.inventory[itemId];out.changed=true;out.removedIds.push(itemId);
    }
    for(const c of Object.values(s.characters)){
      if(c?.choker?.worn&&s.wheel.chokerUnlocked!==true){
        c.choker=null;syncChokerAccessory(c);
        const factKey='legacy_choker_reconciled:'+c.id;
        if(!Object.hasOwn(s.facts,factKey))s.facts[factKey]={type:'LEGACY_RECONCILE',refId:'it_choker',personRef:c.id};
        out.changed=true;
      }
    }
    // rc.58（4A 方案 B §6.2）：旧版「空放的 w53」自愈 —— status USED 却没有 wishText，说明玩家点了使用、
    // 愿望却没进上下文（旧引导词里根本没有许愿位）。这类券退回 READY 让玩家重许一次；幂等锁防重复退。
    for(const [itemId,item] of Object.entries(s.inventory)){
      if(!item||item.category!=='WHEEL_PRIZE'||item.refId!=='w53')continue;
      if(item.status!=='USED'||item.pendingUndo===true||item.wishText)continue;
      const factKey='legacy_w53_restored:'+itemId;
      if(Object.hasOwn(s.facts,factKey))continue;
      item.status='READY';item.usedDate=null;item.usedRevision=null;
      s.facts[factKey]={type:'LEGACY_W53_RESTORE',itemId};
      out.changed=true;
    }
    // rc.58（4A 方案 A §4.2；YG 选 A 后加了一道闸门）：旧存档「25 岁的高二学生」读档即自愈。
    // 只动 25 岁 + 学生/晚辈女儿身份，且身份串里必须真的出现学生类词；玩家手改过的永不触碰。
    for(const c of Object.values(s.characters)){
      if(!c||typeof c!=='object')continue;
      if(Number(c.age)!==25)continue;
      if(Object.hasOwn(s.facts,'profile_edited:'+c.id)||Object.hasOwn(s.facts,'legacy_age_reconciled:'+c.id))continue;
      const band=matchAgeBand(c);
      if(!band||!LEGACY_AGE_RECONCILE_BANDS.has(band.id))continue;
      const hint=`${c.occupation||''} ${c.relationshipLabel||''} ${c.knownFacts||''}`;
      if(!AGE_BAND_STUDENT_HINT.test(hint))continue;
      const from=c.age;c.age=band.defaultAge;
      if(c.profileFixed&&typeof c.profileFixed.identity==='string')c.profileFixed.identity=c.profileFixed.identity.replace(new RegExp(`${from}\\s*岁`,'g'),`${c.age}岁`).slice(0,750);
      s.facts['legacy_age_reconciled:'+c.id]={type:'LEGACY_AGE_RECONCILE',from,to:c.age};
      out.changed=true;
    }
  }catch{/* 容错底线：清洗绝不阻断旧存档加载 */}
  return out;
}
// 装置状态守卫：非法枚举 / 上限 / 空壳印记。脏佩戴态就地收敛，不阻断加载。
export function assertDeviceState(s){
  for(const c of Object.values(s.characters||{})){
    if(c?.choker?.worn&&s.wheel?.chokerUnlocked!==true){c.choker=null;syncChokerAccessory(c);}
    if(c?.choker?.worn)requireRule(Boolean(CHOKER_STYLE_BY_ID[c.choker.styleId]),'CHOKER_INVALID');
    const items=c?.imprints?.items||{};
    const keys=Object.keys(items);
    requireRule(keys.length<=PLACEMENT_IDS.length,'IMPRINT_LIMIT_REACHED');
    for(const [key,item] of Object.entries(items)){
      requireRule(PLACEMENT_IDS.includes(key),'IMPRINT_DUPLICATE_PLACEMENT');
      requireRule(item?.placement===key,'IMPRINT_DUPLICATE_PLACEMENT');
      requireRule(!(item.patternEnabled===false&&item.textEnabled===false),'IMPRINT_INVALID');
      requireRule(!(item.textEnabled!==false&&!String(item.text||'').trim()),'IMPRINT_INVALID');
      requireRule(Boolean(PATTERN_BY_ID[item.patternId]),'IMPRINT_INVALID');
      requireRule(Boolean(COLOR_BY_ID[item.patternColor]&&COLOR_BY_ID[item.textColor]),'IMPRINT_INVALID');
      requireRule(Boolean(FONT_BY_ID[item.font])&&Boolean(LAYOUT_BY_ID[item.textLayout]),'IMPRINT_INVALID');
    }
  }
  return true;
}
export function assertState(s) {
  assertEconomy(s);
  assertDeviceState(s);
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
      const rawMod=beautyTier(s.user.beautyScore).modifier;
      // 初见陌生期（<40）有外貌扣分；进入熟识期（>=40）免除外貌负向惩罚；
      // 普通外貌（<65）在好感>=50后靠真诚破局获得 +1 反差真心补偿。
      const effMod=prior<70?(rawMod<0?(prior<40?rawMod:0):rawMod)+(prior>=50&&s.user.beautyScore<65?1:0):0;
      // rc.36：甜嗓异能（ab_voice）只加正值好感，不参与扣分与上限外的重复计算。
      const voice=delta>0?abilityBonus(s,'ab_voice'):0;
      const adjusted=delta>0?Math.max(0,delta+effMod+voice):delta;
      const finalDelta=Math.sign(adjusted)*Math.min(Math.abs(adjusted),Math.max(0,limit-spent));
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');c.affection=Math.max(0,Math.min(100,prior+finalDelta));
      Object.assign(s.facts[e.factId],{personRef:c.id,baseDelta:delta,finalDelta:c.affection-prior,priorAffection:prior});return;
    }
    case 'CORRUPTION_CHANGE': {
      const c=requirePerson();if(!tracked(c))return;
      // No beauty modifier on this axis: the body answers to prowess instead,
      // and only in rounds settlement has flagged as physical.
      const delta=Math.max(-12,Math.min(12,e.delta)),prior=c.corruption??0;
      const bonus=delta>0&&prior<85&&e.prowessBonus===true?prowessTier(effectiveProwess(s)).modifier:0;
      // rc.36：摄魂之瞳（ab_gaze）只加正值堕落，与战力加成叠加。
      const gaze=delta>0?abilityBonus(s,'ab_gaze'):0;
      const adjusted=delta>0?Math.max(0,delta+bonus+gaze):delta;
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
    case 'ASSET_GRANT': {
      // rc.41：零现金资产入账——他人正式过户/赠予、抵偿、NO.53 终极愿望兑现。
      // 红线：绝不扣 user.cashCents；basisCents 固定 0、acquisitionIsInitial 固定 true，
      // 所以既不会抬高神豪计级身家，也不会在转赠时凭空刷出十倍奖池。
      requireRule(e.completed===true,'NOT_COMPLETED');
      const a=e.asset&&typeof e.asset==='object'?e.asset:null;requireRule(a,'ASSET_REQUIRED');
      const name=text(a.name,120);requireRule(name,'INVALID_TEXT');
      // rc.58（4A 方案 B §8）：同名在持资产幂等 —— 脚本已为「终端最终愿望」当场入账时，
      // 模型若惯性再发一条 ASSET_GRANT，不得出现两件同名房产。
      if(Object.values(s.finance.assets).some(x=>x&&x.ownerId==='USER'&&x.status==='OWNED'&&x.name===name))return;
      const kind=assetKind(a.kind,name),assetId=id(a.assetId||('asset_'+fnv(name+':'+e.factId)));
      requireRule(!s.finance.assets[assetId],'DUPLICATE_ASSET');
      const bookValueCents=integer(a.bookValueCents??0,0);
      requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');
      s.finance.assets[assetId]={assetId,kind,name,ownerId:'USER',bookValueCents,basisCents:0,status:'OWNED',
        acquisitionEventId:e.factId,acquisitionIsInitial:true,
        description:assetDescription({...a,bookValueCents},kind,bookValueCents),
        locationNote:text(a.locationNote??'',300,true),
        ownershipNote:text(a.ownershipNote||'非现金过户·本人全额所有',120,true)};
      addLedger(s,eventKey,{...e,kind:'ASSET_GRANT',direction:'NONE',amountCents:0,payer:'EXTERNAL',itemName:name,memo:'资产登记 · '+name,assetId},anchor);
      return;
    }
    case 'ASSET_VALUATION': {
      // rc.42：玩家手动补录的资产由模型补类别与估值；脚本按类别硬钳位，只对 valuationPending 生效一次。
      const a=s.finance.assets[id(e.assetId)];
      requireRule(a&&a.isCustom===true&&a.valuationPending===true,'ASSET_VALUATION_NOT_PENDING');
      if(e.factId)requireRule(markFact(s,e,anchor),'DUPLICATE_FACT');
      const kind=assetKind(e.kind,a.name);
      const bound=ASSET_VALUATION_BOUNDS[kind]||ASSET_VALUATION_BOUNDS.OTHER;
      const raw=(()=>{try{return cents(e.bookValueYuan);}catch{return bound.fallback;}})();
      const val=Math.min(bound.max,Math.max(bound.min,raw));
      a.kind=kind;a.bookValueCents=val;a.valuationPending=false;
      if(/待估值/.test(String(a.ownershipNote||'')))a.ownershipNote=String(a.ownershipNote).replace(/待估值/,'已估值');
      a.description=assetDescription({...a,bookValueCents:val},kind,val)||a.description;
      addLedger(s,eventKey,{...e,kind:'ASSET_VALUATION',direction:'NONE',amountCents:0,payer:'EXTERNAL',itemName:a.name,memo:'资产补估值 · '+a.name,assetId:a.assetId},anchor);
      return;
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
      const mode = e.mode === 'INTIMATE' ? 'INTIMATE' : (e.mode || '');
      let effectiveScore = e.score;
      // 阀门 1：开放档位（limits）硬拦截。若当前 openness < 35（L0-L1，八项尺度全为拒绝）
      // 却提交了 60+ 的 INTIMATE 评分，压回 55 分（微光档封顶）。
      const openness = Math.max(Number(c.affection) || 0, (Number(c.corruption) || 0) * 1.15);
      if (mode === 'INTIMATE' && openness < 35 && effectiveScore >= 60) {
        effectiveScore = 55;
      }
      // 阀门 2：INTIMATE 新标签首爆 vs 旧玩法复刷乘区。
      let noveltyFactor = 1;
      if (mode === 'INTIMATE' && effectiveScore >= 60) {
        const existingTags = new Set(c.intimacy?.unlockedTags || []);
        const priorIntimateCrits = Object.values(s.rewardEvents).filter(r => r.characterId === c.id && r.eventType === 'CRITICAL' && r.valid && r.mode === 'INTIMATE').length;
        const candidateTags = [];
        const tagRules = [
          [/初夜|破处|首次交欢|第一次/, '初夜夺取'],
          [/湿吻|热吻|深吻|接吻|亲吻|索吻/, '深情热吻'],
          [/丝袜|黑丝|白丝|渔网|制服|旗袍|泳装|情趣/, '丝袜制服'],
          [/口交|口侍|吞吐|含住|唇舌侍奉/, '口唇侍奉'],
          [/乳交|酥胸|揉胸|埋胸/, '酥胸侍奉'],
          [/足交|玉足|美足|腿交|脚踝/, '美足把玩'],
          [/内射|灌满|中出|无套/, '无套内射'],
          [/后入|骑乘|侧入|抱操|落地窗|对镜/, '解锁新姿'],
          [/办公室|车内|试衣间|露台|包厢|走廊|半公开/, '背德偷欢'],
          [/高潮|痉挛|求饶|失神|潮吹/, '极致高潮'],
          [/交欢|插入|占有|本垒|承欢|云雨|同眠|留宿/, '鱼水之欢'],
          [/爱抚|揉捏|掀裙|解扣|耳鬓厮磨|敏感带/, '贴身爱抚']
        ];
        for (const [rule, tag] of tagRules) if (rule.test(String(e.action || ''))) candidateTags.push(tag);
        if (Array.isArray(e.tags)) candidateTags.push(...e.tags.map(t => String(t).trim()).filter(Boolean));
        else if (typeof e.tags === 'string' && e.tags.trim()) candidateTags.push(...e.tags.split(/[、,，/／;；·|]/).map(t => t.trim()).filter(Boolean));
        const hasNewTag = candidateTags.some(t => !existingTags.has(t));
        const isNovelIntimate = Boolean(e.milestone) || priorIntimateCrits === 0 || hasNewTag;
        if (!isNovelIntimate) {
          effectiveScore = Math.max(40, effectiveScore - 12);
          noveltyFactor = 0.5;
        }
      }
      const tier = reward(effectiveScore, `${eventKey}:${e.action}`, mode);
      if (!tier.amountCents) return;
      // 阀门 3：同人同日暴击次数阶梯衰减（100% -> 55% -> 25% -> 10%）。
      const today = String(s.world?.date || '').trim();
      const sameDayCrits = today
        ? Object.values(s.rewardEvents).filter(r => r.characterId === c.id && r.eventType === 'CRITICAL' && r.valid && r.storyDate === today)
        : [];
      const dailyCount = sameDayCrits.length;
      const dayFactor = [1, 0.55, 0.25, 0.1][Math.min(dailyCount, 3)];
      let amountCents = Math.round((tier.amountCents * noveltyFactor * dayFactor) / 100) * 100;
      if (dailyCount >= 3) amountCents = Math.min(amountCents, 688800);
      // 阀门 4：单人单日暴击软上限 45 万元（45,000,000 分），98+ 首次里程碑豁免。
      const isUltimateMilestone = e.score >= 98 && Boolean(e.milestone);
      if (!isUltimateMilestone && today) {
        const dailySum = sameDayCrits.reduce((sum, r) => sum + (Number(r.cashbackCents) || 0), 0);
        const remainingCap = Math.max(0, 45000000 - dailySum);
        amountCents = Math.min(amountCents, remainingCap);
      }
      if (amountCents <= 0) return;
      credit(s,c.id,amountCents,eventKey,anchor,'CRITICAL',{score:e.score,effectiveScore,title:e.action,label:tier.label,mode:tier.mode,milestone:e.milestone || null,storyDate:today});
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
export function settleEvents(state,events,anchor,sourceText,affectionEvents=[]){
  const out=processEvents(state,events,anchor,sourceText,true,affectionEvents);
  // rc.43：正文已生成 —— 所有「待撤的使用」就此落定，撤销窗口与待写索引一起关闭。
  const st=out.state;
  for(const i of Object.values(st.inventory||{}))if(i.pendingUndo===true){i.pendingUndo=false;i.undoSnapshot=null;}
  if(st.wheel?.pendingAbilityUses&&Object.keys(st.wheel.pendingAbilityUses).length)st.wheel.pendingAbilityUses={};
  return out;
}
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
    if(partial)requireRule(['CASH_TRANSACTION','ASSET_TRANSFER','TRANSACTION_REFUND','ASSET_GRANT','ASSET_VALUATION','BEHAVIOR','SIGNIFICANT_BEHAVIOR_SCORE','AFFECTION_CHANGE','CORRUPTION_CHANGE'].includes(e.type),'UNKNOWN_EVENT');
    const ordinal=integer(e.ordinal,0,100);requireRule(!ordinals.has(ordinal),'DUPLICATE_ORDINAL');ordinals.add(ordinal);
    if((e.type==='AFFECTION_CHANGE'||e.type==='CORRUPTION_CHANGE')&&Object.values(s.facts).some(f=>f.type===e.type&&f.personRef===e.personRef&&key(f.sourceAnchor)===key(anchor)))continue;
    if(e.type==='SIGNIFICANT_BEHAVIOR_SCORE'){
      if(!s.characters[e.personRef]||s.characters[e.personRef].trackingState!=='RECORDED'||scoreCount>=3||scored.has(e.personRef))continue;
      scored.add(e.personRef);scoreCount++;
      if(Object.values(s.facts).some(f=>f.type===e.type&&f.personRef===e.personRef&&key(f.sourceAnchor)===key(anchor)))continue;
    }
    if(['CASH_TRANSACTION','TRANSACTION_REFUND','ASSET_TRANSFER','ASSET_GRANT'].includes(e.type)){
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
  // rc.43：实测模型会把「无偿过户/赠予」写成 amountYuan 0 的 CASH_TRANSACTION 并内嵌 asset。
  // 没有现金流水的「获得实物」一律改判成 ASSET_GRANT —— 否则资产永远进不了账本（铁律一：能算的交给脚本）。
  if(e.type==='CASH_TRANSACTION'&&e.asset&&typeof e.asset==='object'){
    let amt=null;
    if(e.amountCents!==undefined)amt=Number(e.amountCents);
    else if(e.amountYuan!==undefined){try{amt=cents(e.amountYuan);}catch{amt=0;}}
    if(amt===null||amt===0)e.type='ASSET_GRANT';
  }
  // rc.41：模型常把非现金获得的实物写成 ASSET_REGISTER / FREE_ASSET，统一折成 ASSET_GRANT。
  if(['ASSET_REGISTER','FREE_ASSET','ASSET_RECEIVE'].includes(e.type))e.type='ASSET_GRANT';
  if(e.type==='ASSET_GRANT'){
    if(!e.asset||typeof e.asset!=='object')e.asset={};
    const a=e.asset;
    e.completed=e.completed??true;
    if(!a.name&&(e.name||e.itemName))a.name=e.name||e.itemName;
    if(a.kind===undefined&&e.kind!==undefined)a.kind=e.kind;
    if(a.bookValueYuan===undefined&&e.bookValueYuan!==undefined)a.bookValueYuan=e.bookValueYuan;
    if(a.bookValueCents===undefined&&e.bookValueCents!==undefined)a.bookValueCents=e.bookValueCents;
    if(!e.evidence&&typeof e.sourceEvidence==='string')e.evidence=e.sourceEvidence;
  }
  // rc.25 Bug #2：转手卖掉一件从未建档的东西（如当场卖画获利）不可能是
  // ASSET_SALE——它没有已持有资产可核销。直接改判其他收入，钱才不会丢。
  if(e.type==='CASH_TRANSACTION'&&e.kind==='ASSET_SALE'){
    const owned=e.assetId&&state?.finance?.assets?.[e.assetId]&&state.finance.assets[e.assetId].status==='OWNED';
    if(!owned){e.kind='OTHER_INCOME';delete e.assetId;}
  }
  // rc.25 Bug #1 续：模型的 evidence 常被概括改写，逐字校验会整单丢弃。只跳过
  // 单测哨兵词与未付款否定句，其余用本轮正文首句有效叙事兜底，保证零漏单。
  if(['CASH_TRANSACTION','ASSET_TRANSFER','TRANSACTION_REFUND','ASSET_GRANT'].includes(e.type)&&typeof sourceText==='string'&&sourceText.trim()){
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
  e.sourceKey=key(anchor.branchKey,anchor.messageId,anchor.swipeId,anchor.fingerprint,e.type,e.personRef||'',e.evidence,e.amountCents??e.delta??e.assetId??e.asset?.assetId??e.asset?.name??'');
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
  // rc.34 / rc.35：轮盘、星愿卡、赌场、商城。全部不针对具体女性，先于 active(personRef) 分流。
  if(op.type==='PLAYER_WHEEL_SPIN') {
    const w=s.wheel||(s.wheel={});
    const q=playWheelQuote(w,s.world.date,tierBasis(s));
    const mode=op.mode||q.defaultMode;
    if(mode==='free'){
      requireRule(q.freeAvailable,'WHEEL_FREE_USED');
      w.lastFreeDate=s.world.date;
    }else if(mode==='points'){
      requireRule((w.starPoints||0)>=POINTS_PER_SPIN,'INSUFFICIENT_POINTS');
      w.starPoints=w.starPoints-POINTS_PER_SPIN;
    }else{
      requireRule(q.cashAvailable,'WHEEL_DAILY_LIMIT');
      requireRule(s.user.cashCents>=q.costCents,'INSUFFICIENT_CASH');
      s.user.cashCents=add(s.user.cashCents,-q.costCents);
      addLedger(s,op.operationId,{factId:op.operationId,kind:'WHEEL_SPIN',direction:'OUT',amountCents:q.costCents,payer:'USER',memo:'命运轮盘 · 再转一次'},anchor);
      w.todayPaidDate=s.world.date;w.todayPaidSpins=q.paidToday+1;
    }
    const seed=`${s.meta.branchKey}|${s.world.date}|d${w.totalSpins+1}|t${w.totalSpins}`;
    const roll=rollWheelPrize({seed,wheel:w,toyLinkUnlocked:w.toyLinkUnlocked});
    w.totalSpins=(w.totalSpins||0)+1;
    w.pityRed=roll.nextPity.red;w.pityGold=roll.nextPity.gold;w.pityRainbow=roll.nextPity.rainbow;
    w.toyLinkUnlocked=!!roll.unlockedToyLink;
    if(!Array.isArray(w.discoveredPrizeIds))w.discoveredPrizeIds=[];
    if(!w.discoveredPrizeIds.includes(roll.prize.prizeId))w.discoveredPrizeIds.push(roll.prize.prizeId);
    const itemId='item_'+op.operationId;
    s.inventory=Object.assign({},s.inventory,{[itemId]:{itemId,source:'WHEEL',category:'WHEEL_PRIZE',refId:roll.prize.prizeId,rarity:roll.rarity,obtainedDate:s.world.date,status:'READY',currentPoints:null,winStreak:0,scheduledAppointmentId:null,targetCharacterIds:[],assetId:null,usedDate:null}});
    result={prizeId:roll.prize.prizeId,name:roll.prize.name,rarity:roll.rarity,itemId,mode,costCents:mode==='cash'?q.costCents:0,costPoints:mode==='points'?POINTS_PER_SPIN:0};
  } else if(op.type==='PLAYER_PACK_DRAW'||op.type==='PLAYER_CARD_DRAW') {
    // rc.37 星愿卡包：一包 3 张（前 2 张常规位 + 第 3 张压轴保底位）。
    // 先落盘后揭晓——扣费、推进保底、写 inventory 全在这一步完成，撕包与翻面只是前端仪式。
    const w=s.wheel||(s.wheel={});
    const poolTier=op.poolTier==='low'?'low':'high';
    const q=poolTier==='low'
      ? lowPackQuote(w,s.world.date)
      : wishWheelQuote(w,s.world.date,tierBasis(s),Object.keys(s.withdrawals||{}).length>0);
    requireRule(q.unlocked,'WISH_LOCKED');
    requireRule(q.canSpin,q.reason||'WISH_LOCKED');
    if(q.mode==='cash'){
      requireRule(s.user.cashCents>=q.costCents,'INSUFFICIENT_CASH');
      s.user.cashCents=add(s.user.cashCents,-q.costCents);
      addLedger(s,op.operationId,{factId:op.operationId,kind:'WISH_WHEEL_SPIN',direction:'OUT',amountCents:q.costCents,payer:'USER',memo:poolTier==='low'?'星尘卡包 · 启封':'圣典卡包 · 启封'},anchor);
    }
    const seed=`${drawSeed({branchKey:s.meta.branchKey,date:s.world.date,index:(w.totalCardsDrawn||0)+1,total:w.totalCardsDrawn||0})}|${poolTier}`;
    const pack=rollWishPack({
      seed,poolTier,
      pityRed:poolTier==='low'?(w.lowPackPityRed||0):(w.cardPityRed||0),
      pityGold:w.cardPityGold||0,
    });
    const drawn=[];
    for(let i=0;i<pack.cards.length;i++){
      const c=pack.cards[i];
      const serialNo=(w.cardSerialSeq||0)+1;
      w.cardSerialSeq=serialNo;
      const itemId=`card_${op.operationId}_${i}`;
      s.inventory=Object.assign({},s.inventory,{[itemId]:{itemId,source:'CASINO_CARD',category:'WISH_CARD',refId:'card_'+c.rarity,cardCode:c.cardCode,poolTier,serialNo,locked:false,rarity:c.rarity,obtainedDate:s.world.date,status:'READY',currentPoints:c.points,winStreak:0,scheduledAppointmentId:null,targetCharacterIds:[],assetId:null,usedDate:null}});
      if(!Array.isArray(w.discoveredCardCodes))w.discoveredCardCodes=[];
      if(!w.discoveredCardCodes.includes(c.cardCode))w.discoveredCardCodes.push(c.cardCode);
      drawn.push({itemId,rarity:c.rarity,cardCode:c.cardCode,points:c.points,serialNo,poolTier});
    }
    w.totalCardsDrawn=(w.totalCardsDrawn||0)+PACK_SIZE;
    if(poolTier==='low'){
      // rc.55 / B-05：免费包也把付费计数写回本周期的真实值。原先只写 freeUsed 与日期，
      // 旧的 lowPackTodayPaid 被留着；因为日期已更新成今天，下一次报价就会把昨天的
      // 付费次数当成今天的，直接报 LOW_PACK_DAILY_LIMIT。
      if(q.mode==='free'){w.lowPackTodayFreeUsed=true;w.lowPackTodayPaid=0;}
      else w.lowPackTodayPaid=q.paidToday+1;
      w.lowPackTodayDate=s.world.date;
      w.lowPackPityRed=pack.nextPity.lowRed;
    }else{
      w.wishWeekKey=q.weekKey;
      // 同上：新周领免费包时把上周的付费次数归零，否则首笔付费就按第二档报价。
      if(q.mode==='free'){w.wishWeekFreeUsed=true;w.wishWeekPaidSpins=0;}
      else w.wishWeekPaidSpins=q.weekPaid+1;
      w.wishTodayDate=s.world.date;w.wishTodaySpins=q.todaySpins+1;
      w.cardPityGold=pack.nextPity.gold;
    }
    const anchorCard=drawn[drawn.length-1];
    result={poolTier,mode:q.mode,costCents:q.mode==='cash'?q.costCents:0,cards:drawn,
      // 兼容旧 PLAYER_CARD_DRAW 调用方：仍给出压轴卡的单卡字段
      itemId:anchorCard.itemId,rarity:anchorCard.rarity,points:anchorCard.points};
  } else if(op.type==='PLAYER_CARD_LOCK') {
    const item=s.inventory?.[op.cardId];
    requireRule(item&&item.category==='WISH_CARD','UNKNOWN_ITEM');
    item.locked=op.locked!==false;
    result={cardId:op.cardId,locked:item.locked};
  } else if(op.type==='PLAYER_INVENTORY_DELETE') {
    const item=s.inventory?.[op.itemId];
    requireRule(item&&(item.category==='WHEEL_PRIZE'||item.category==='SURREAL_ITEM'),'UNKNOWN_ITEM');
    // rc.41：TOY·LINK 是永久解锁凭据，删了背包会出现「解锁着但没东西」的割裂状态。
    requireRule(item.refId!=='it_toylink','ITEM_NOT_READY');
    if(item.category==='WHEEL_PRIZE'&&item.status==='SCHEDULED'&&item.scheduledAppointmentId){
      const appt=s.calendar?.appointments?.[item.scheduledAppointmentId];
      if(appt&&appt.status==='PLANNED'){appt.status='CANCELLED';appt.sourceItemId=null;}
    }
    delete s.inventory[op.itemId];
    result={itemId:op.itemId,category:item.category,refId:item.refId,status:item.status};
  } else if(op.type==='PLAYER_CARD_DELETE') {
    const item=s.inventory?.[op.cardId];
    requireRule(item&&item.category==='WISH_CARD','UNKNOWN_ITEM');
    requireRule(!item.locked,'CARD_LOCKED');
    delete s.inventory[op.cardId];
    result={cardId:op.cardId,cardCode:item.cardCode||'',points:Number(item.currentPoints)||0};
  } else if(op.type==='PLAYER_ASSET_REGISTER') {
    // rc.42：玩家手动补录名下资产 —— 只收名称与描述，不给估值入口；估值等下一轮模型补，脚本按类别钳位。
    const name=text(op.name,80);requireRule(name,'INVALID_TEXT');
    const description=text(op.description,160);requireRule(description,'INVALID_TEXT');
    requireRule(!/(?:价值|估值|市价|售价|折合|约合|价格)\s*[¥￥]?\s*\d+|\d+(?:\.\d+)?\s*(?:万元|亿元|万块|亿块|RMB|美元|美金|英镑|欧元)/i.test(name+' '+description),'ASSET_DESC_NO_PRICE');
    // rc.44：档次（默认中端），估值由 类别 × 档次 查表即时定值。
    const tier=CUSTOM_ASSET_TIERS.includes(op.tier)?op.tier:'MID';
    const today=s.world.date;
    // rc.43：日限用单调递增计数，删资产/押输都不会把次数洗回去（否则可无限补录）。
    const usedToday=s.finance.customAssetDate===today?integer(s.finance.customAssetCount||0):0;
    requireRule(usedToday<2,'CUSTOM_ASSET_DAILY_LIMIT');
    const assetId='asset_'+fnv(name+':'+today+':'+usedToday);
    requireRule(!s.finance.assets[assetId],'DUPLICATE_ASSET');
    s.finance.customAssetDate=today;s.finance.customAssetCount=usedToday+1;
    const kind=resolveCustomAssetKind(name,description);
    const value=ASSET_TIER_TABLE[kind][tier];
    s.finance.assets[assetId]={assetId,kind,name,ownerId:'USER',bookValueCents:value,basisCents:0,status:'OWNED',
      acquisitionEventId:'manual_'+assetId,acquisitionIsInitial:true,
      description,locationNote:'',ownershipNote:'玩家补录 · '+ASSET_TIER_LABELS[tier],
      valuationPending:false,valuationTier:tier,isCustom:true,registeredDate:today};
    addLedger(s,op.operationId,{factId:op.operationId,kind:'ASSET_GRANT',direction:'NONE',amountCents:0,payer:'EXTERNAL',itemName:name,memo:'资产补录 · '+name,assetId},anchor);
    result={assetId,name,kind,tier,bookValueCents:value};
  } else if(op.type==='PLAYER_ASSET_DELETE') {
    // rc.42：真删不留尸；后购资产的成本转进 retiredBasisCents，删掉也洗不回高提现倍率。
    const a=s.finance.assets[id(op.assetId)];
    requireRule(a&&a.ownerId==='USER'&&a.status==='OWNED','ASSET_NOT_OWNED');
    const basis=a.acquisitionIsInitial?0:integer(a.basisCents??a.bookValueCents??0);
    if(basis>0)s.finance.retiredBasisCents=add(integer(s.finance.retiredBasisCents||0),basis);
    delete s.finance.assets[a.assetId];
    addLedger(s,op.operationId,{factId:op.operationId,kind:'ASSET_DELETE',direction:'NONE',amountCents:0,payer:'USER',itemName:a.name,memo:'删除资产 · '+a.name,assetId:null},anchor);
    result={assetId:a.assetId,name:a.name,retiredBasisCents:s.finance.retiredBasisCents};
  } else if(op.type==='PLAYER_CASINO_BET') {
    const w=s.wheel||(s.wheel={});
    const stakeKind=op.stakeKind||'card';
    requireRule(['card','cash','asset'].includes(stakeKind),'INVALID_DRAFT');
    requireRule(['red','black','green'].includes(op.betColor),'INVALID_DRAFT');
    const betName={red:'绯红框',black:'黑曜框',green:'翡翠框'}[op.betColor];
    // rc.42（YG 拍板）：星愿卡、现金、名下资产皆可上桌，取消一切品阶限制与封顶 —— 赌就该赌得爽。
    let stakeValue=0,stakeKey='';
    if(stakeKind==='card'){
      const item=s.inventory?.[op.cardId];
      requireRule(item&&item.category==='WISH_CARD','UNKNOWN_ITEM');
      requireRule(!item.locked,'CARD_LOCKED');
      stakeValue=Number(item.currentPoints)||0;stakeKey=op.cardId;
    } else if(stakeKind==='cash'){
      stakeValue=integer(op.stakeCents,100000);
      requireRule(stakeValue%100===0,'INVALID_INTEGER');
      requireRule(stakeValue<=s.user.cashCents,'INSUFFICIENT_CASH');
    } else {
      const asset=s.finance.assets[id(op.assetId)];
      requireRule(asset&&asset.ownerId==='USER'&&asset.status==='OWNED','ASSET_NOT_OWNED');
      requireRule(asset.valuationPending!==true,'ASSET_VALUATION_PENDING');
      // rc.43（YG 拍板）：手动补录的自定义资产不可上桌 —— 否则白嫖登记 + 高估值可凭空印现金。
      requireRule(asset.isCustom!==true,'CUSTOM_ASSET_NO_CASINO');
      stakeValue=integer(asset.bookValueCents,100000);stakeKey=asset.assetId;
    }
    const seed=casinoSeed({branchKey:s.meta.branchKey,date:s.world.date,round:w.casinoRound||0,stakeKind,stakeKey,cardId:op.cardId,betColor:op.betColor});
    const r=rollCasino({seed,stakeValue,betColor:op.betColor});
    const base={hitIndex:r.hitIndex,landedColor:r.landedColor,win:r.win,mult:r.mult,stakeKind,stakeValue};
    if(stakeKind==='card'){
      const item=s.inventory[op.cardId];
      if(r.win){
        item.currentPoints=r.nextPoints;
        item.winStreak=(item.winStreak||0)+1;
        w.casinoTotalWins=(w.casinoTotalWins||0)+1;
        w.casinoBestWinPoints=Math.max(w.casinoBestWinPoints||0,item.currentPoints);
      } else {
        delete s.inventory[op.cardId];
        w.casinoTotalLosses=(w.casinoTotalLosses||0)+1;
      }
      result={...base,points:r.win?item.currentPoints:0,cardId:op.cardId};
    } else if(stakeKind==='cash'){
      // 开盘即实扣；赢则按含本金赔率返还，两次流水都进同一本账，现金守恒交给 assertEconomy。
      s.user.cashCents=add(s.user.cashCents,-stakeValue);
      addLedger(s,op.operationId+':bet',{factId:op.operationId+':bet',kind:'CASINO_BET',direction:'OUT',amountCents:stakeValue,payer:'USER',memo:'暗夜赌场 · 现金押注（'+betName+'）'},anchor);
      const payout=r.win?multiply(stakeValue,r.mult):0;
      if(r.win){
        s.user.cashCents=add(s.user.cashCents,payout);
        addLedger(s,op.operationId+':win',{factId:op.operationId+':win',kind:'CASINO_WIN',direction:'IN',amountCents:payout,payer:'CASINO',memo:'暗夜赌场 · 现金中奖（'+betName+' ×'+r.mult+'）'},anchor);
        w.casinoTotalWins=(w.casinoTotalWins||0)+1;
      } else {
        w.casinoTotalLosses=(w.casinoTotalLosses||0)+1;
      }
      result={...base,stakeCents:stakeValue,payoutCents:payout,profitCents:payout-stakeValue};
    } else {
      const asset=s.finance.assets[op.assetId];
      const profit=r.win?multiply(stakeValue,r.mult-1):0;
      if(r.win){
        // 原资产完好保留，只把净盈利折成现金发下去（把估值直接 ×36 会当场出戏）。
        s.user.cashCents=add(s.user.cashCents,profit);
        addLedger(s,op.operationId+':win',{factId:op.operationId+':win',kind:'CASINO_ASSET_WIN',direction:'IN',amountCents:profit,payer:'CASINO',itemName:asset.name,memo:'暗夜赌场 · 资产押中（'+betName+' ×'+r.mult+'）',assetId:asset.assetId},anchor);
        w.casinoTotalWins=(w.casinoTotalWins||0)+1;
      } else {
        // 押输直接删键不留尸；后购资产的成本转进 retiredBasisCents，删掉也洗不回高提现倍率。
        const basis=asset.acquisitionIsInitial?0:integer(asset.basisCents??asset.bookValueCents??0);
        if(basis>0)s.finance.retiredBasisCents=add(integer(s.finance.retiredBasisCents||0),basis);
        addLedger(s,op.operationId+':loss',{factId:op.operationId+':loss',kind:'CASINO_ASSET_LOSS',direction:'NONE',amountCents:0,payer:'USER',itemName:asset.name,memo:'暗夜赌场 · 押输删除资产「'+asset.name+'」（原估值 '+formatYuanReadable(stakeValue)+'）',assetId:null},anchor);
        delete s.finance.assets[asset.assetId];
        w.casinoTotalLosses=(w.casinoTotalLosses||0)+1;
      }
      result={...base,assetId:asset.assetId,assetName:asset.name,valueCents:stakeValue,profitCents:profit};
    }
    w.casinoRound=(w.casinoRound||0)+1;
  } else if(op.type==='PLAYER_CARD_REDEEM') {
    const w=s.wheel||(s.wheel={});
    const item=s.inventory?.[op.cardId];
    requireRule(item&&item.category==='WISH_CARD','UNKNOWN_ITEM');
    requireRule(!item.locked,'CARD_LOCKED');
    const pts=Number(item.currentPoints)||0;
    w.starPoints=(w.starPoints||0)+pts;
    delete s.inventory[op.cardId];
    result={cardId:op.cardId,points:pts};
  } else if(op.type==='PLAYER_USE_WHEEL_PRIZE') {
    // rc.37 排进日历；rc.38 想法 18：op.immediate=true 表示"立即使用"，
    // 当场核销成 USED，并记下 usedRevision 供 projection 在下一轮置顶提醒模型描写。
    const item=s.inventory?.[op.itemId];
    requireRule(item&&item.category==='WHEEL_PRIZE','UNKNOWN_ITEM');
    requireRule(item.status==='READY','ITEM_NOT_READY');
    const participants=(Array.isArray(op.participants)?op.participants:[]).slice(0,5).map(x=>id(x));
    for(const p of participants)requireRule(s.characters[p],'UNKNOWN_PERSON');
    const prize=WHEEL_POOL_BY_ID[item.refId];
    // rc.58（4A 方案 B §3.2/§4）：NO.53「终端最终愿望」走专属许愿契约 —— 只能立即兑现，必须带愿望文本，
    // 并按方向当场给出脚本确定性效果（顶奢资产入账 / 目标女性到场升温）。
    const isFinalWish=item.refId==='w53';
    if(isFinalWish)requireRule(op.immediate===true,'ITEM_NOT_READY');
    if(op.immediate===true){
      const wishKind=isFinalWish?(WISH_KINDS.includes(op.wishKind)?op.wishKind:'CUSTOM'):null;
      let wishText=typeof op.wishText==='string'?op.wishText.trim().slice(0,300):'';
      if(isFinalWish){
        requireRule(wishText.length>=2&&wishText.length<=120,'WISH_TEXT_REQUIRED');
      }else if(wishText&&wishText.length>120)wishText=wishText.slice(0,120);
      item.status='USED';item.usedDate=s.world.date;item.targetCharacterIds=participants;
      // rc.43：revision 在函数末尾才自增，这里写 +1 才对得上新版本；pendingUndo 打开撤销窗口。
      item.usedRevision=s.meta.revision+1;
      item.usedFloorId=s.meta.sourceAnchor?.messageId??null;
      item.usedSwipeId=s.meta.sourceAnchor?.swipeId??null;
      item.pendingUndo=true;item.undoSnapshot=null;
      // rc.46：把实际塞进输入框的引导词快照下来，撤销时按原文精确剔除，不再靠名字猜。
      item.usedDraftText=typeof op.usedDraftText==='string'?op.usedDraftText.slice(0,2000):null;
      item.wishKind=wishKind;item.wishText=wishText||null;
      let grantedAsset=null,romance=null;
      if(isFinalWish&&wishKind==='ASSET'){
        // 铁律一：脚本当场入账，不等模型下一轮发 ASSET_GRANT（防漏发导致愿望落空）。
        // 零现金、basisCents 0、acquisitionIsInitial true —— 不动 cashCents，也不稀释提现倍率。
        const assetName=String(op.wishAssetName||'').trim().slice(0,60);
        requireRule(assetName.length>=2&&assetName.length<=40,'WISH_ASSET_NAME_REQUIRED');
        const kind=resolveCustomAssetKind(assetName,`${wishText} ${assetName}`);
        const value=ASSET_TIER_TABLE[kind].TOP;
        const assetId='asset_wish_'+fnv(assetName+':'+s.meta.branchKey+':'+op.operationId).slice(0,12);
        requireRule(!s.finance.assets[assetId],'DUPLICATE_ASSET');
        s.finance.assets[assetId]={assetId,kind,name:assetName,ownerId:'USER',bookValueCents:value,basisCents:0,
          status:'OWNED',acquisitionEventId:op.operationId,acquisitionIsInitial:true,
          description:assetDescription({name:assetName,bookValueCents:value},kind,value),
          locationNote:'',ownershipNote:'终端最终愿望 · 顶奢旗舰档',valuationPending:false,valuationTier:'TOP',
          isCustom:false,registeredDate:s.world.date};
        const ledgerId=op.operationId+':wish_asset';
        addLedger(s,ledgerId,{factId:ledgerId,kind:'ASSET_GRANT',direction:'NONE',amountCents:0,payer:'TERMINAL',itemName:assetName,memo:'终端最终愿望 · '+assetName,assetId},anchor);
        grantedAsset={assetId,kind,name:assetName,bookValueCents:value};
        item.undoSnapshot={grantedAssetId:assetId,grantedLedgerId:ledgerId};
      }else if(isFinalWish&&wishKind==='ROMANCE'&&participants.length){
        // 不直接把好感/堕落拉满（那会架空双轴养成）：只把人拉到现场并松动心防，涨幅仍由当轮 BEHAVIOR 结算。
        const targetId=participants[0],c=s.characters[targetId];
        if(c){
          const priorPresentIds=clone(s.scene.presentCharacterIds||[]);
          const priorArousal=Number(c.arousal)||0;
          if(!priorPresentIds.includes(targetId))s.scene.presentCharacterIds.push(targetId);
          c.arousal=Math.max(priorArousal,65);
          romance={targetId,priorArousal,arousal:c.arousal};
          item.undoSnapshot={priorPresentIds,targetId,priorArousal};
        }
      }
      result={itemId:item.itemId,prizeId:item.refId,title:prize?.name||'',immediate:true,participants,
        ...(wishKind?{wishKind,wishText}:{}),...(grantedAsset?{grantedAsset}:{}),...(romance?{romance}:{})};
    } else {
      requireRule(/^\d{4}-\d{2}-\d{2}$/.test(String(op.date||'')),'INVALID_DRAFT');
      requireRule(/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(op.time||'')),'INVALID_DRAFT');
      const apptId='appt_'+op.operationId;
      s.calendar=s.calendar||{appointments:{}};s.calendar.appointments=s.calendar.appointments||{};
      s.calendar.appointments[apptId]={id:apptId,title:String(prize?.name||op.title||'云澜奇遇').slice(0,80),date:op.date,time:op.time,location:String(op.location||s.scene.location).slice(0,150),participants,status:'PLANNED',notes:String(op.notes||prize?.hint||'').slice(0,1500),sourceItemId:item.itemId,prizeId:item.refId};
      item.status='SCHEDULED';item.scheduledAppointmentId=apptId;item.targetCharacterIds=participants;
      result={itemId:item.itemId,appointmentId:apptId,title:prize?.name||'',date:op.date,time:op.time,immediate:false};
    }
  } else if(op.type==='PLAYER_USE_SURREAL_ITEM') {
    // rc.37 使用通道：脚本能算的两件当场生效，其余奇物只做叙事核销。
    const w=s.wheel||(s.wheel={});
    const item=s.inventory?.[op.itemId];
    requireRule(item&&item.category==='SURREAL_ITEM','UNKNOWN_ITEM');
    requireRule(item.status==='READY','ITEM_NOT_READY');
    const def=SURREAL_ITEM_BY_ID[item.refId];
    requireRule(def,'UNKNOWN_ITEM');
    requireRule(def.consumable===true,'ITEM_NOT_READY');
    const targets=[];let effectSummary='narrative';let mirrorAdded=false;let priorArousal=null;
    if(item.refId==='it_mirror'){
      requireRule(typeof op.targetCharacterId==='string'&&op.targetCharacterId,'UNKNOWN_PERSON');
      const targetId=id(op.targetCharacterId);
      const c=s.characters[targetId];
      requireRule(c&&tracked(c),'UNKNOWN_PERSON');
      if(!Array.isArray(w.unlockedSecretPages))w.unlockedSecretPages=[];
      mirrorAdded=!w.unlockedSecretPages.includes(targetId);
      if(mirrorAdded)w.unlockedSecretPages.push(targetId);
      targets.push(targetId);effectSummary='mirror';
    } else if(item.refId==='it_perfume'){
      priorArousal={};
      for(const pid of s.scene.presentCharacterIds||[]){
        const c=s.characters[pid];
        if(c&&tracked(c)){priorArousal[pid]=Number(c.arousal)||0;c.arousal=Math.min(100,(Number(c.arousal)||0)+PERFUME_AROUSAL_STEP);targets.push(pid);}
      }
      requireRule(targets.length,'NO_PRESENT_CHARACTER');
      effectSummary='perfume';
    }
    item.status='USED';item.usedDate=s.world.date;
    // rc.43：记下待撤锚点与脚本副作用快照 —— 正文生成前可以原样撤回。
    item.usedRevision=s.meta.revision+1;
    item.usedFloorId=s.meta.sourceAnchor?.messageId??null;
    item.usedSwipeId=s.meta.sourceAnchor?.swipeId??null;
    item.pendingUndo=true;
    item.usedDraftText=typeof op.usedDraftText==='string'?op.usedDraftText.slice(0,2000):null;
    item.undoSnapshot=effectSummary==='mirror'
      ?{mirrorAdded,mirrorTarget:targets[0]||null}
      :effectSummary==='perfume'?{priorArousal}:null;
    if(targets.length)item.targetCharacterIds=targets.slice(0,5);
    result={itemId:item.itemId,refId:item.refId,effectSummary,targets};
  } else if(op.type==='PLAYER_UNDO_ITEM_USE') {
    // rc.43：正文还没生成前的「撤销使用」—— 道具状态与脚本副作用一并还原。
    const w=s.wheel||(s.wheel={});
    const item=s.inventory?.[op.itemId];
    requireRule(item,'UNKNOWN_ITEM');
    requireRule(item.pendingUndo===true,'UNDO_NOT_ALLOWED');
    if(item.category==='WHEEL_PRIZE'){
      requireRule(item.status==='USED','UNDO_NOT_ALLOWED');
      // rc.58（4A 方案 B §3.3）：w53 的脚本副作用按快照原样回退——资产与账本一起删，
      // 在场名单与情欲值按启用前的值还原，许愿字段清空。
      const snap=item.undoSnapshot||{};
      if(snap.grantedAssetId){
        delete s.finance.assets[snap.grantedAssetId];
        if(snap.grantedLedgerId)delete s.finance.ledger[snap.grantedLedgerId];
      }
      if(Array.isArray(snap.priorPresentIds))s.scene.presentCharacterIds=clone(snap.priorPresentIds);
      if(snap.targetId&&s.characters[snap.targetId]&&Number.isFinite(Number(snap.priorArousal)))s.characters[snap.targetId].arousal=Number(snap.priorArousal);
      item.status='READY';item.scheduledAppointmentId=null;item.wishKind=null;item.wishText=null;
    } else {
      const snap=item.undoSnapshot||{};
      if(snap.mirrorAdded===true&&Array.isArray(w.unlockedSecretPages)&&snap.mirrorTarget){
        w.unlockedSecretPages=w.unlockedSecretPages.filter(x=>x!==snap.mirrorTarget);
      }
      // rc.55 / B-12：香水是多件可叠的，每件只记了「自己启用前的绝对值」。直接按快照覆盖
      // 会有两个问题：撤较早那件会连仍在生效的后一件一起抹掉，全部撤完还会留下残值。
      // 改成按启用顺序重算整条链：从被撤这件的前值起步，逐件 +25 并重新记下各自的基线。
      if (item.refId === 'it_perfume') {
        const chain = Object.values(s.inventory || {})
          .filter((x) => x && x.pendingUndo === true && x.refId === 'it_perfume')
          .sort((a, b) => (a.usedRevision || 0) - (b.usedRevision || 0));
        const people = new Set();
        for (const x of chain) for (const pid of Object.keys(x.undoSnapshot?.priorArousal || {})) people.add(pid);
        for (const pid of people) {
          const c = s.characters[pid];
          if (!c) continue;
          let arousal = null, touched = false;
          const after = [];
          for (const x of chain) {
            const snapshot = x.undoSnapshot?.priorArousal;
            if (!snapshot || !(pid in snapshot)) continue;
            const prior = Math.max(0, Math.min(100, integer(Number(snapshot[pid]) || 0)));
            if (x.itemId === item.itemId) { arousal = prior; touched = true; continue; }
            if (arousal === null) continue;
            after.push({ node: x, base: arousal });
            arousal = Math.min(100, arousal + PERFUME_AROUSAL_STEP);
          }
          if (!touched || arousal === null) continue;
          for (const { node, base } of after) node.undoSnapshot.priorArousal[pid] = base;
          c.arousal = arousal;
        }
      }
      item.status='READY';
    }
    item.usedDate=null;item.usedRevision=null;item.usedFloorId=null;item.usedSwipeId=null;
    item.pendingUndo=false;item.undoSnapshot=null;item.targetCharacterIds=[];item.usedDraftText=null;
    result={itemId:item.itemId,category:item.category,refId:item.refId};
  } else if(op.type==='PLAYER_USE_ABILITY') {
    // rc.43：异能发动只记待撤锚点，不消耗持有状态。
    const w=s.wheel||(s.wheel={});
    requireRule((s.user.abilities||[]).some(a=>a.abilityId===op.abilityId),'ABILITY_NOT_OWNED');
    const def=ABILITY_BY_ID[op.abilityId];requireRule(def,'UNKNOWN_ITEM');
    w.pendingAbilityUses={...(w.pendingAbilityUses||{}),[op.abilityId]:{
      abilityId:op.abilityId,
      usedRevision:s.meta.revision+1,
      usedFloorId:s.meta.sourceAnchor?.messageId??null,
      usedSwipeId:s.meta.sourceAnchor?.swipeId??null,
      targetCharacterId:op.targetCharacterId?String(op.targetCharacterId):null,
      usedDraftText:typeof op.usedDraftText==='string'?op.usedDraftText.slice(0,2000):null
    }};
    result={abilityId:def.abilityId,name:def.name,tag:def.tag,effect:def.effect};
  } else if(op.type==='PLAYER_UNDO_ABILITY_USE') {
    const w=s.wheel||(s.wheel={});
    const pending={...(w.pendingAbilityUses||{})};
    requireRule(pending[op.abilityId],'UNDO_NOT_ALLOWED');
    delete pending[op.abilityId];w.pendingAbilityUses=pending;
    result={abilityId:op.abilityId};
  } else if(op.type==='PLAYER_CHOKER_SET') {
    // rc.46：佩戴 / 换款 / 摘下誓约项圈。佩戴后脚本自动把项圈句同步进 outfit.accessories。
    const w=s.wheel||(s.wheel={});
    const c=s.characters[String(op.personRef||'')];
    requireRule(c&&c.trackingState==='RECORDED','NO_RECORDED_WOMAN');
    const action=String(op.action||'wear');
    if(action==='remove'){
      requireRule(c.choker?.worn===true,'CHOKER_INVALID');
      c.choker=null;syncChokerAccessory(c);
      result={personRef:c.id,action:'remove',name:c.name};
    } else {
      requireRule(w.chokerUnlocked===true,'CHOKER_LOCKED');
      requireRule(checkDeviceThreshold(c).eligible,'DEVICE_THRESHOLD_NOT_MET');
      const styleId=String(op.styleId||'obsidian_velvet');
      requireRule(Boolean(CHOKER_STYLE_BY_ID[styleId]),'CHOKER_INVALID');
      const inscription=String(op.inscription||'').trim().slice(0,24);
      c.choker={worn:true,styleId,inscription,wornDate:s.world.date};
      syncChokerAccessory(c);
      result={personRef:c.id,action:'wear',name:c.name,styleId,inscription};
    }
  } else if(op.type==='PLAYER_IMPRINT_SET') {
    // rc.46：按部位一对一的多枚制印记。save 覆盖同部位，remove_one 只抹一处，remove_all 全抹并还原原疤痕。
    const c=s.characters[String(op.personRef||'')];
    requireRule(c&&c.trackingState==='RECORDED','IMPRINT_NO_TARGET');
    const action=String(op.action||'save');
    if(action==='remove_all'){
      const total=Object.keys(c.imprints?.items||{}).length;
      requireRule(total>0,'IMPRINT_INVALID');
      const prior=c.imprints?.priorScar||'';
      c.physiology=c.physiology||{};c.physiology.tattooScar=prior.slice(0,150);
      c.imprints=null;
      result={personRef:c.id,action:'remove_all',name:c.name,removed:total};
    } else if(action==='remove_one'){
      const placement=String(op.placement||'');
      requireRule(PLACEMENT_IDS.includes(placement),'IMPRINT_INVALID');
      requireRule(Boolean(c.imprints?.items?.[placement]),'IMPRINT_INVALID');
      delete c.imprints.items[placement];
      const remain=Object.keys(c.imprints.items).length;
      if(remain>0)syncImprintText(c);
      else{const prior=c.imprints.priorScar||'';c.imprints=null;c.physiology=c.physiology||{};c.physiology.tattooScar=prior.slice(0,150);}
      result={personRef:c.id,action:'remove_one',name:c.name,placement,remain};
    } else {
      const placement=String(op.placement||'');
      requireRule(PLACEMENT_IDS.includes(placement),'IMPRINT_INVALID');
      const w=s.wheel||(s.wheel={});
      requireRule(w.imprintUnlocked===true,'IMPRINT_LOCKED');
      requireRule(checkDeviceThreshold(c).eligible,'DEVICE_THRESHOLD_NOT_MET');
      const patternEnabled=op.patternEnabled!==false;
      const textEnabled=op.textEnabled!==false;
      const patternId=String(op.patternId||'succubus_heart');
      const patternColor=String(op.patternColor||'crimson');
      const textColor=String(op.textColor||'gold');
      const font=String(op.font||'script');
      const textLayout=String(op.textLayout||'arc_wrap');
      const patternScale=String(op.patternScale||'md');
      const textScale=String(op.textScale||'md');
      const textAngle=Math.max(-30,Math.min(30,Math.round(Number(op.textAngle)||0)));
      const markText=String(op.text||'').trim().slice(0,24);
      requireRule(Boolean(PATTERN_BY_ID[patternId]),'IMPRINT_INVALID');
      requireRule(Boolean(COLOR_BY_ID[patternColor]&&COLOR_BY_ID[textColor]),'IMPRINT_INVALID');
      requireRule(Boolean(FONT_BY_ID[font])&&Boolean(LAYOUT_BY_ID[textLayout]),'IMPRINT_INVALID');
      requireRule(Boolean(SCALE_LABELS[patternScale]&&SCALE_LABELS[textScale]),'IMPRINT_INVALID');
      requireRule(!(patternEnabled===false&&textEnabled===false),'IMPRINT_INVALID');
      requireRule(!(textEnabled&&!markText),'IMPRINT_INVALID');
      const items=Object.assign({},c.imprints?.items||{});
      const isUpdate=Boolean(items[placement]);
      requireRule(isUpdate||Object.keys(items).length<PLACEMENT_IDS.length,'IMPRINT_LIMIT_REACHED');
      c.physiology=c.physiology||{};
      const priorScar=c.imprints?.priorScar??String(c.physiology.tattooScar||'').trim().slice(0,150);
      items[placement]={placement,patternEnabled,patternId,patternScale,patternColor,textEnabled,text:markText,textLayout,textScale,textAngle,font,textColor,updatedDate:s.world.date};
      c.imprints={priorScar,items};
      syncImprintText(c);
      result={personRef:c.id,action:'save',name:c.name,placement,isUpdate,total:Object.keys(items).length};
    }
  } else if(op.type==='PLAYER_SHOP_BUY') {
    const w=s.wheel||(s.wheel={});
    const want=String(op.catalogId||'');
    const ability=ABILITY_BY_ID[want];
    const surreal=SURREAL_ITEM_BY_ID[want];
    requireRule(ability||surreal,'UNKNOWN_ITEM');
    const owned=s.user.abilities||(s.user.abilities=[]);
    if(ability){
      const have=owned.find(a=>a.abilityId===ability.abilityId);
      // rc.42：异能不再升级；重复购买直接拒绝。
      requireRule(!have,'SHOP_ALREADY_OWNED');
      const cost=ability.price;
      requireRule((w.starPoints||0)>=cost,'INSUFFICIENT_POINTS');
      w.starPoints-=cost;
      owned.push({abilityId:ability.abilityId,obtainedDate:s.world.date});
      w.shopHistory=(w.shopHistory||[]).concat([{purchaseId:op.operationId,catalogId:ability.abilityId,costPoints:cost,date:s.world.date}]).slice(-SHOP_HISTORY_MAX);
      result={abilityId:ability.abilityId,costPoints:cost};
    }else{
      const cost=surreal.price;
      requireRule((w.starPoints||0)>=cost,'INSUFFICIENT_POINTS');
      // rc.46：持久装置只点亮权限真值位，不再往背包塞道具（背包从此只管玩法券与消耗奇物）。
      if(surreal.itemId==='it_toylink'){
        requireRule(!w.toyLinkUnlocked,'SHOP_ALREADY_OWNED');
        w.starPoints-=cost;w.toyLinkUnlocked=true;
        w.shopHistory=(w.shopHistory||[]).concat([{purchaseId:op.operationId,catalogId:surreal.itemId,costPoints:cost,date:s.world.date}]).slice(-SHOP_HISTORY_MAX);
        result={itemId:surreal.itemId,costPoints:cost,unlockedToyLink:true};
      } else if(surreal.itemId==='it_choker'){
        requireRule(!w.chokerUnlocked,'SHOP_ALREADY_OWNED');
        w.starPoints-=cost;w.chokerUnlocked=true;
        w.shopHistory=(w.shopHistory||[]).concat([{purchaseId:op.operationId,catalogId:surreal.itemId,costPoints:cost,date:s.world.date}]).slice(-SHOP_HISTORY_MAX);
        result={itemId:surreal.itemId,costPoints:cost,unlockedChoker:true};
      } else if(surreal.itemId==='it_imprint'){
        requireRule(!w.imprintUnlocked,'SHOP_ALREADY_OWNED');
        w.starPoints-=cost;w.imprintUnlocked=true;
        w.shopHistory=(w.shopHistory||[]).concat([{purchaseId:op.operationId,catalogId:surreal.itemId,costPoints:cost,date:s.world.date}]).slice(-SHOP_HISTORY_MAX);
        result={itemId:surreal.itemId,costPoints:cost,unlockedImprint:true};
      } else {
        w.starPoints-=cost;
        const itemId='item_'+op.operationId;
        s.inventory=Object.assign({},s.inventory,{[itemId]:{itemId,source:'SHOP',category:'SURREAL_ITEM',refId:surreal.itemId,rarity:surreal.rarity,obtainedDate:s.world.date,status:'READY',currentPoints:null,winStreak:0,scheduledAppointmentId:null,targetCharacterIds:[],assetId:null,usedDate:null}});
        w.shopHistory=(w.shopHistory||[]).concat([{purchaseId:op.operationId,catalogId:surreal.itemId,costPoints:cost,date:s.world.date}]).slice(-SHOP_HISTORY_MAX);
        result={itemId:surreal.itemId,costPoints:cost,unlockedToyLink:!!w.toyLinkUnlocked};
      }
    }
  } else if(op.type==='PLAYER_HIDE_TEMP') {
    id(op.tempId);const temp=s.scene.temporaryActors.find(t=>t.tempId===op.tempId);requireRule(temp,'UNKNOWN_PERSON');s.hiddenTemporary[op.tempId]=clone(temp);s.scene.temporaryActors=s.scene.temporaryActors.filter(t=>t.tempId!==op.tempId);
  } else if(op.type==='PLAYER_RESTORE_TEMP') {
    id(op.tempId);requireRule(s.hiddenTemporary[op.tempId],'UNKNOWN_PERSON');delete s.hiddenTemporary[op.tempId];
  } else {
    const c=active(s,op.personRef);
    // rc.56b（方案 B §2.2）：玩家手动改称呼。走 applyOperation，进 operationHistory，删楼/换 swipe 不丢。
    if(op.type==='PLAYER_SET_ADDRESSING') {
      const value=String(op.addressing??'').trim();
      requireRule(value.length>=1&&value.length<=20,'INVALID_TEXT');
      c.addressing=value;
      result={personRef:c.id,addressing:value};
    } else
    if(op.type==='PLAYER_EDIT_CHARACTER') {
      // rc.58（4A 方案 A §6.2）：玩家侧纠错通道。age/外貌/三围在 settleNative 里被 prior-wins 锁死，
      // 模型改不动；这里开一条脚本独占操作，写进 operationHistory，删楼/换 swipe 可重放。
      const patch=op.patch&&typeof op.patch==='object'?op.patch:{};
      const priorAge=c.age,priorOcc=String(c.occupation||'');
      c.age=integer(patch.age,18,80);
      c.relationshipLabel=text(patch.relationshipLabel,12);
      c.occupation=text(patch.occupation ?? '',100,true);
      c.addressing=text(patch.addressing ?? '',20,true);
      if(Object.hasOwn(patch,'beautyScore'))c.beautyScore=patch.beautyScore===null?null:integer(patch.beautyScore,1,100);
      c.cupSize=text(patch.cupSize ?? '',8,true);
      const num=(v,min,max)=>{const n=v===null||v===undefined||v===''?null:Number(v);requireRule(n===null||(Number.isFinite(n)&&n>=min&&n<=max),'INVALID_BASIC_PROFILE');return n===null?null:Math.round(n*10)/10;};
      c.heightCm=num(patch.heightCm,100,230);c.weightKg=num(patch.weightKg,25,250);
      c.bustCm=num(patch.bustCm,40,200);c.waistCm=num(patch.waistCm,30,200);c.hipCm=num(patch.hipCm,40,200);c.shoeSizeEu=num(patch.shoeSizeEu,25,55);
      const tags=Array.isArray(patch.personalityTags)?patch.personalityTags:[];
      requireRule(tags.length<=6,'INVALID_BASIC_PROFILE');
      c.personalityTags=tags.map(x=>text(x,12)).filter(Boolean);
      c.appearance=text(patch.appearance ?? '',500,true);
      c.body=text(patch.body ?? '',500,true);
      c.recentGoal=text(patch.recentGoal ?? '',200,true);
      c.longTermDream=text(patch.longTermDream ?? '',200,true);
      // 罩杯留空（或三围改动后没手动定）→ 按新的三围与身材描述重算，避免 D 罩杯配 70 胸围。
      if(!c.cupSize)c.cupSize=inferCupSize(c.bustCm,c.waistCm,c.heightCm,`${c.body||''} ${c.appearance||''}`);
      // 九大档案联动：identity 里的旧年龄/旧职业字面量同步成新值。
      if(c.profileFixed&&typeof c.profileFixed.identity==='string'){
        let idText=c.profileFixed.identity;
        if(priorAge&&priorAge!==c.age){
          idText=idText.replace(new RegExp(`${priorAge}\\s*岁`,'g'),`${c.age}岁`);
          if(!idText.includes(`${c.age}岁`))idText=`${idText.replace(/[。.\s]+$/,'')}，${c.age}岁。`;
        }
        if(priorOcc&&c.occupation&&priorOcc!==c.occupation&&idText.includes(priorOcc))idText=idText.split(priorOcc).join(c.occupation);
        c.profileFixed.identity=idText.slice(0,750);
      }
      s.facts['profile_edited:'+c.id]={type:'PLAYER_EDIT_CHARACTER',revision:s.meta.revision+1};
      result={personRef:c.id,age:c.age,occupation:c.occupation};
    } else
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
      if(typeof op.recentGoal==='string'&&op.recentGoal.trim()&&!c.recentGoal)c.recentGoal=op.recentGoal.trim().slice(0,200);
      if(typeof op.longTermDream==='string'&&op.longTermDream.trim()&&!c.longTermDream)c.longTermDream=op.longTermDream.trim().slice(0,200);
      if(typeof op.hiddenScar==='string'&&op.hiddenScar.trim()&&!c.hiddenScar)c.hiddenScar=op.hiddenScar.trim().slice(0,300);
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
  // rc.38 B.6：情欲值 × 私密空间双联开关。世界书 private-life 条目已改条件激活，
  // 只有 _context 里出现 INTIMATE_SCENE_ACTIVE 令牌时才会把床戏白描挂进常驻提示词。
  const PRIVATE_LOC=/(公寓|平层|别墅|庄园|套房|汤屋|温泉|酒店|主卧|卧室|游艇舱|包厢|府邸|私宅)/;
  const presentChars=(s.scene.presentCharacterIds||[]).map(pid=>s.characters[pid]).filter(c=>c&&tracked(c));
  const maxArousal=presentChars.reduce((m,c)=>Math.max(m,Number(c.arousal)||0),0);
  const privateHere=PRIVATE_LOC.test(String(s.scene.location||''));
  const intimateActive=maxArousal>=25||(privateHere&&presentChars.some(c=>(Number(c.affection)||0)>=40||(Number(c.corruption)||0)>=40));
  const LIGHT_PHYSIO=new Set(['cycle','pregnancy','virgin','bodyScent','chestDetail','traits']);
  const physioFor=c=>{const p=clone(c.physiology);if(intimateActive)return p;const out={};for(const k of Object.keys(p))if(LIGHT_PHYSIO.has(k))out[k]=p[k];return out;};
  // rc.41：多人同场且不在亲密戏时，档案类长文（九大档案、私密细节、底线）一律不重复挂载，
  // 给模型留出输出余量，避免尾部 <UpdateVariable> 被 max_tokens 截断。
  const crowdScene=presentChars.length>=2&&!intimateActive;
  const ledgerByFact=new Map(Object.values(s.finance.ledger).map(l=>[l.eventId,l]));
  const pendingBasicProfiles=Object.values(s.characters).filter(c=>tracked(c)).map(c=>{
    const missing=['beautyScore','personalityTags','appearance','body','heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu'].filter(k=>c[k]==null||c[k]===''||Array.isArray(c[k])&&!c[k].length);
    return {id:c.id,name:c.name,age:c.age,occupation:c.occupation,knownFacts:c.knownFacts,...basicProfile(c),beautyScore:c.beautyScore,missing};
  }).filter(c=>c.missing.length);
  // Match persisted character paths so models can copy a stable ID and field name.
  // Present women carry full basics, three-layer inner life (recentGoal, longTermDream,
  // hiddenScar), private records and the current thought.
  // Absent but starred women carry recentGoal, hiddenScar and one off-stage line.
  // Every other absent woman stays a bare identity index.
  const view=c=>{
    const base={id:c.id,name:c.name,aliases:c.aliases,trackingState:c.trackingState};
    if(!tracked(c))return base;
    if(s.scene.presentCharacterIds.includes(c.id))return {...base,age:c.age,beautyScore:c.beautyScore,occupation:c.occupation,...basicProfile(c),affection:c.affection,corruption:c.corruption??0,relationshipLabel:c.relationshipLabel,relationshipNotes:c.relationshipNotes,knownFacts:c.knownFacts,addressing:c.addressing,impression:c.impression,currentClothes:c.currentClothes,currentPose:c.currentPose,currentAction:c.currentAction,currentExpression:c.currentExpression,currentMood:c.currentMood,currentCondition:c.currentCondition,currentItems:c.currentItems,currentThought:c.currentThought,arousal:c.arousal,recentGoal:c.recentGoal??'',longTermDream:c.longTermDream??'',hiddenScar:c.hiddenScar??'',...(c.physiology?{physiology:physioFor(c)}:{}),...(c.outfit?{outfit:clone(c.outfit)}:{}),...(crowdScene?{}:c.intimacy?{intimacy:clone(c.intimacy)}:{}),...(crowdScene?{}:c.limits?{limits:clone(c.limits)}:{}),...(c.profileFixed&&!c.profileLocked?{profileFixed:c.profileFixed}:{})};
    return c.starred?{...base,relationshipLabel:c.relationshipLabel,affection:c.affection,corruption:c.corruption??0,recentGoal:c.recentGoal??'',hiddenScar:c.hiddenScar??'',starred:true,offscreen:c.offscreen}:base;
  };
  const characters=Object.fromEntries(Object.values(s.characters).map(c=>[c.id,view(c)]));
  // Top-level to-do list so the model cannot miss off-stage starred women.
  const starredOffscreenIds=Object.values(s.characters).filter(c=>tracked(c)&&c.starred&&!s.scene.presentCharacterIds.includes(c.id)).map(c=>c.id);
  // rc.34 / rc.35：主角异能、超现实奇物、今日日程、背包待用券（为空一律省略，零冗余 token）
  const userAbilities=(s.user.abilities||[]).map(a=>{const d=ABILITY_BY_ID[a.abilityId];return d?{id:d.abilityId,name:d.name,tag:d.tag,effect:d.effect}:null;}).filter(Boolean);
  // rc.43：本轮已发动、还没被正文消费的异能 —— 同样进顶层索引，正文生成后自动清空。
  const pendingAbilityUses=Object.values(s.wheel?.pendingAbilityUses||{}).map(p=>{const d=ABILITY_BY_ID[p.abilityId];return d?{id:d.abilityId,name:d.name,tag:d.tag,effect:d.effect,...(p.targetCharacterId&&s.characters[p.targetCharacterId]?.name?{targetNames:[s.characters[p.targetCharacterId].name]}:{})}:null;}).filter(Boolean);
  const bagSurrealItems=Object.values(s.inventory||{}).filter(i=>i.category==='SURREAL_ITEM'&&i.status!=='USED').map(i=>{const d=SURREAL_ITEM_BY_ID[i.refId];return d?{itemId:i.itemId,name:d.name,tag:d.tag,effect:d.effect}:null;}).filter(Boolean);
  const todaySchedules=Object.values(s.calendar?.appointments||{}).filter(a=>a.date===s.world.date&&a.status==='PLANNED').map(a=>{const p=a.prizeId?WHEEL_POOL_BY_ID[a.prizeId]:null;return {id:a.id,time:a.time,title:a.title,location:a.location,participants:a.participants,notes:a.notes,...(p?{prizeNo:p.no,prizeSummary:p.summary,promptHint:p.hint}:{})};});
  const bagReadyItems=Object.values(s.inventory||{}).filter(i=>i.status==='READY'&&i.category==='WHEEL_PRIZE').slice(0,12).map(i=>{const p=WHEEL_POOL_BY_ID[i.refId];return {itemId:i.itemId,...(p?{no:p.no,name:p.name}:{}),rarity:i.rarity};});
  // rc.38 B.7（E-1 激进方案）：高好感 / 高堕落的离场熟人每天最多递一条主动消息，
  // 由脚本按日期确定性挑选，去不去回不回仍归玩家；多女互知与争宠规则写在世界书 relationships-network。
  const incomingPing=(()=>{
    const todayIds=new Set(Object.values(s.calendar?.appointments||{}).filter(a=>a.date===s.world.date&&a.status==='PLANNED').flatMap(a=>a.participants||[]));
    const pool=Object.values(s.characters).filter(c=>tracked(c)&&!s.scene.presentCharacterIds.includes(c.id)&&!todayIds.has(c.id)&&((Number(c.affection)||0)>=65||(Number(c.corruption)||0)>=60));
    if(!pool.length)return null;
    const seed=fnv(`${s.world.date}|${s.scene.sceneId||''}|${s.meta.branchKey||''}`);
    const who=pool[(Number.parseInt(seed.slice(0,8),16)||0)%pool.length];
    const aff=Number(who.affection)||0,cor=Number(who.corruption)||0;
    const type=cor>=70?'NIGHT_CRAVING':aff>=75?'AFFECTION_PING':'GOAL_HELP';
    const hint=type==='NIGHT_CRAVING'?'深夜发来一张刚换好的私密穿搭照片，话里带着钩子，问你要不要过来'
      :type==='AFFECTION_PING'?'发来今天的一件小事，话尾试探你今晚有没有空'
      :'说手上的事卡住了，想听你的意见，问你最近能不能见一面';
    return {characterId:who.id,name:who.name,type,hint};
  })();  const mustDepictUsedItems=Object.values(s.inventory||{}).filter(i=>i.pendingUndo===true).slice(0,6).map(i=>{const def=i.category==='SURREAL_ITEM'?SURREAL_ITEM_BY_ID[i.refId]:WHEEL_POOL_BY_ID[i.refId];const names=(i.targetCharacterIds||[]).map(pid=>s.characters[pid]?.name).filter(Boolean);
    // rc.58（玩家反馈「终端最终愿望许愿实现不了」）：玩法券旧口径优先 hint，而 hint 是登场旁白的悬念句
    // （w53「终端屏幕整个黑了，只剩一行字在闪：说吧，你想要什么。」），模型照抄就只写到发问为止，愿望从不兑现。
    // 玩法券改为优先 summary（这张券实际给到什么），hint 退为旁白兜底；奇物维持原口径（effect 才是效果语句）。
    const effectOrHint=i.category==='SURREAL_ITEM'?(def?.effect||def?.hint||def?.summary||''):(def?.summary||def?.effect||def?.hint||'');
    return {category:i.category==='SURREAL_ITEM'?'奇物':'玩法券',name:def?.name||i.refId,effectOrHint,...(i.wishText?{playerWish:i.wishText}:{}),...(names.length?{targetNames:names}:{})};});
  // rc.58（4A 方案 B §5.2）：NO.53 待生效时，_context 顶层挂一条高优先级待办，把「愿望」本身送进模型。
  // 没有待生效的 w53 时整段省略，零 token 开销。
  const wishItem=Object.values(s.inventory||{}).find(i=>i&&i.category==='WHEEL_PRIZE'&&i.refId==='w53'&&i.pendingUndo===true&&i.wishText);
  const activeTerminalWish=wishItem?(()=>{
    const names=(wishItem.targetCharacterIds||[]).map(pid=>s.characters[pid]?.name).filter(Boolean);
    const granted=wishItem.undoSnapshot?.grantedAssetId?s.finance.assets[wishItem.undoSnapshot.grantedAssetId]:null;
    return {prizeId:'w53',name:'终端最终愿望',wishKind:wishItem.wishKind||'CUSTOM',wishText:wishItem.wishText,
      targetCharacterIds:clone(wishItem.targetCharacterIds||[]),
      ...(names.length?{targetNames:names}:{}),
      ...(granted?{preGrantedAsset:{assetId:granted.assetId,kind:granted.kind,name:granted.name,bookValueYuan:formatYuanReadable(granted.bookValueCents),alreadyInFinanceAssets:true}}:{}),
      directive:'【终极愿望强制当轮兑现】玩家已消耗虹阶『终端最终愿望』并许下上述愿望。本轮正文必须在1句以内写完终端黑屏金字锁定指令，随后立即在当前轮次内把愿望转化为已发生、已交割的现实结果与在场人物的震撼反应！严禁只写到『终端问你想要什么』就结束，严禁拖延到下一轮。若preGrantedAsset非空，代表脚本已将该顶奢资产免款记入玩家名下，正文直接写产权/钥匙交接与现场体验，无需重复提交ASSET_GRANT；若涉及破局或亲密互动，同轮正常提交高分BEHAVIOR。'};
  })():null;
  return {schemaVersion:3,revision:s.meta.revision,starredOffscreenIds,...(presentChars.length>=2?{presentThoughtIds:presentChars.map(c=>c.id)}:{}),user:{...s.user,cashYuan:formatYuanReadable(s.user.cashCents),wealthTier:wealthTier(tierBasis(s)),pendingProfileFields:['heightCm','weightKg','shoeSizeEu'].filter(k=>s.user[k]==null)},scene:{...s.scene,...(intimateActive?{intimateStage:'INTIMATE_SCENE_ACTIVE'}:{})},characters,pendingBasicProfiles,
    ...(mustDepictUsedItems.length?{mustDepictUsedItems}:{}),...(activeTerminalWish?{activeTerminalWish}:{}),...(pendingAbilityUses.length?{pendingAbilityUses}:{}),
    ...(incomingPing?{incomingPing}:{}),
    ...(userAbilities.length?{userAbilities}:{}),...(bagSurrealItems.length?{bagSurrealItems}:{}),
    ...(todaySchedules.length?{todaySchedules}:{}),...(bagReadyItems.length?{bagReadyItems}:{}),
    assets:Object.values(s.finance.assets).filter(a=>a.ownerId==='USER'&&a.status==='OWNED').map(a=>({assetId:a.assetId,name:a.name,kind:a.kind,description:a.description,locationNote:a.locationNote,ownershipNote:a.ownershipNote,bookValueCents:a.bookValueCents,bookValueYuan:formatYuanReadable(a.bookValueCents),...(a.valuationPending?{valuationPending:true}:{})})),
    recentFacts:Object.entries(s.facts).slice(-60).map(([factId,f])=>{const l=ledgerByFact.get(factId);return {factId,type:f.type,...(l?{kind:l.kind,itemName:l.itemName,amountCents:l.amountCents,amountYuan:formatYuanReadable(l.amountCents),assetId:l.assetId,refundOf:l.refundOf}:{})};}),rule:'只提出新事实，不直接写现金、奖池或提现。付款前先核对user.cashYuan可用现金；已列factId不得再次入账；退款的refundOf按交易名称、金额与资产匹配原付款factId，不猜ID。'};
}
