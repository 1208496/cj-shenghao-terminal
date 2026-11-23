// rc.51：TOY·LINK 物理引擎（纯 ESM，零 DOM，可单测）。
// rc.50 部分：九模式包络、阶段累积、叠加档位与文案拼接（逐字逐值取自 RC50 方案 §2.1）。
// rc.51 增补：九模差异化物理、寸止锁/破顶、夹腿忍耐/瞬时强刺、处境与失态暴露、手法轨迹。
//   规则逐条取自 RC51 方案 §2.1 / §3.1–§3.5 / §5.3 / §6.2；文案取自 §5.2 定稿块（wheel-ui-copy.js）。
import {WHEEL_COPY, fill} from './wheel-ui-copy.js';

export const TOY_MAX_PEAK = 9;
export const TOY_STAGE_AT = [0, 22, 48, 74, 93];
export const TOY_STAGE_CN = ['适应', '升温', '攀升', '濒临', '临界'];
export const TOY_TIER_NAMES = ['初潮', '一重叠加', '二重叠加', '过载叠加'];

// 方案 §6.2：`last.sceneId` 缺失时按 here 自动赋予默认处境（本卡未发行，不做旧字段迁移）。
// rc.52（方案 §3.1）：现场不再有处境；别处处境默认落「严肃会议」。
export const TOY_AWAY_SCENE_DEFAULT = 'away_meeting';
// 现场中性暴露倍率（原三个 with_* 处境 0.7/1.0/1.35 的均值 1.02，取 1.0；pow90 时 4.5%/秒 ≈ 22 秒一次失态）
export const TOY_WITH_EXP_RATE = 1.0;

// 体感材料：9 模式短评见 TOY_MODES[i].feel；5 阶段与 4 档强度见下表。
// 来源：4N 第 1 轮方案 §7.1 定稿（第 2 轮只改了 rush 的短评）。
export const TOY_STAGE_BODY = [
  '',
  '呼吸微乱，偶有走神，双腿下意识并拢，尚能勉强维持正常交谈。',
  '耳根与颈侧泛红，语速不稳，指尖攥紧身边物件，句尾带着轻微颤意。',
  '话语断续，腰肢发软需要倚靠支撑，压低的轻喘开始从唇缝溢出。',
  '眼神迷离失焦，眼角泛起水光，注意力完全被节奏牵走，难以组织完整句子。',
  '防线彻底失守，身躯轻颤绷紧，只剩破碎气音与本能反应。'
];
export const TOY_TIER_BODY = [
  [35, '轻', '深处传来细密酥麻，小腹微酸，她会悄悄调整坐姿掩饰异样。'],
  [65, '中', '热意自小腹向上蔓延，腿心发软，开口应答慢半拍，脚趾不自觉蜷起。'],
  [85, '重', '双腿微颤难以并稳，小腹阵阵收紧，额角浮起细汗，只能勉强吐出短词。'],
  [100, '极限', '感官被强烈震颤彻底占满，肌肉不受控地绷直抽紧，指节发白。']
];

export function toyClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function toyNoise(t) { const x = Math.sin(t * 127.1) * 43758.5453; return x - Math.floor(x); }
export function toyHz(f) { return Math.round(0.6 * Math.pow(33.3, (f - 1) / 99) * 10) / 10; }
export function toyStageOf(aro) {
  let s = 1;
  for (let i = 0; i < TOY_STAGE_AT.length; i++) if (aro >= TOY_STAGE_AT[i]) s = i + 1;
  return s;
}

// 叠加档位：0 初潮（粉）/ 1 一重（紫）/ 2 二重（红）/ 3 过载（深红脉冲）
export function toyStackOf(peak) {
  const p = toyClamp(Math.floor(Number(peak) || 0), 0, TOY_MAX_PEAK);
  const tier = p >= 3 ? 3 : p;
  return {
    peak: p,
    tier,
    tierLabel: TOY_TIER_NAMES[tier],
    rateMult: Math.min(2.2, Number((1 + p * 0.22).toFixed(2))),
    envMult: Math.min(1.25, Number((1 + p * 0.06).toFixed(2))),
    capped: p >= TOY_MAX_PEAK
  };
}

// 潮汐包络在一个周期内的均值。方案 §2.1 要求 wave 的 deltaAro「与正弦包络 env 直接成正比」，
// 用均值归一化后既保持比例关系，也不会把原本的时长节奏整体拉慢。
export const TOY_WAVE_ENV_MEAN = (() => {
  let sum = 0;
  const N = 720;
  for (let i = 0; i < N; i++) {
    const s = 0.5 + 0.5 * Math.sin((i / N) * Math.PI * 2);
    sum += 0.25 + 0.75 * Math.pow(s, 1.4);
  }
  return sum / N;
})();

export const TOY_MODES = [
  { id: 'pulse', name: '脉冲', gain: 1.0, feel: '一记一记短促轻叩，每拍之间留出半息空档，刚松懈的神经会被下一拍重新拽紧。', icon: '<path d="M4 20h3v-9H4zM10.5 20h3V5h-3zM17 20h3v-6h-3z"/>',
    period: function (p) { return 1 / p.hz; },
    env: function (t, p) { const T = this.period(p), x = (t % T) / T; return toyClamp(p.pow * (x < 0.22 ? 1 : 0.10), 0, 1); } },
  { id: 'wave', name: '潮汐', gain: 1.05, feel: '温热震感如潮水层层漫涌再缓缓退去，退潮时的空落会逼着她不自觉绷紧追寻。', icon: '<path d="M2 15c3-6 6 6 9 0s6 6 9 0v4c-3 6-6-6-9 0s-6-6-9 0z"/>',
    period: function (p) { return 1 / Math.max(p.hz, 0.4); },
    env: function (t, p) { const T = this.period(p), s = 0.5 + 0.5 * Math.sin((t / T) * Math.PI * 2); return toyClamp(p.pow * (0.25 + 0.75 * Math.pow(s, 1.4)), 0, 1); } },
  { id: 'heart', name: '心跳', gain: 1.15, feel: '一轻一重双连搏动，节拍贴着脉搏走，很快会把她的呼吸频率彻底带乱。', icon: '<path d="M12 21s-8-5.2-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 15.8 12 21 12 21z"/>',
    period: function (p) { return 1 / p.hz; },
    env: function (t, p) { const T = this.period(p), x = (t % T) / T, a = x < 0.10 ? 1 : 0, b = (x > 0.20 && x < 0.29) ? 0.72 : 0; return toyClamp(p.pow * Math.max(a, b, 0.06), 0, 1); } },
  { id: 'ramp', name: '渐强', gain: 1.35, feel: '震幅从低处一路攀升到高点再骤然跌落，每一轮重来都更磨人。', icon: '<path d="M3 18 10 6l3 7 3-4 5 9z"/>',
    period: function (p) { return 1 / Math.max(p.hz * 0.35, 0.25); },
    env: function (t, p) { const T = this.period(p), x = (t % T) / T, v = x < 0.78 ? Math.min(1, x / 0.78) : Math.max(0, 1 - (x - 0.78) / 0.22); return toyClamp(p.pow * (0.08 + 0.92 * v), 0, 1); } },
  { id: 'chaos', name: '乱流', gain: 1.2, feel: '轻重与间隔毫无规律，猜不到下一瞬的落点，等待本身比震动更让人紧绷。', icon: '<path d="M3 8h6l3 8h3l3-8h3v3h-2l-3 8h-5l-3-8H3z"/>',
    period: function () { return 0; },
    env: function (t, p) { const r = toyNoise(Math.floor(t * p.hz) + p.phase), micro = 0.5 + 0.5 * Math.sin(t * p.hz * Math.PI * 2); return toyClamp(p.pow * (0.25 + 0.75 * r) * (0.55 + 0.45 * micro), 0, 1); } },
  { id: 'tease', name: '撩拨', gain: 0.88, feel: '长段静默间偶有轻触即离，累积缓慢却最勾人，容易把她吊得心浮气躁。', icon: '<path d="M12 3c2 5 6 6 6 10a6 6 0 0 1-12 0c0-4 4-5 6-10z"/>',
    period: function (p) { return 1 / Math.max(p.hz * 0.30, 0.22); },
    env: function (t, p) { const T = this.period(p), x = (t % T) / T; return toyClamp(p.pow * (x < 0.14 ? 0.62 : 0.03), 0, 1); } },
  { id: 'storm', name: '暴雨', gain: 1.45, feel: '密集连绵的高频冲击几乎不留喘息空隙，思绪很快被震散。', icon: '<path d="M6 14h12l-2 7h-8zM9 3h6l-1 9H10z"/>',
    period: function (p) { return 1 / p.hz; },
    env: function (t, p) { const T = this.period(p), x = (t % T) / T, base = 0.62 + 0.30 * Math.sin((t / T) * Math.PI * 2), spike = toyNoise(Math.floor(t * p.hz * 1.7)) > 0.86 ? 0.38 : 0; return toyClamp(p.pow * (x < 0.62 ? base + spike : 0.30), 0, 1); } },
  { id: 'edge', name: '临界', gain: 1.6, feel: '持续顶在高位悬停，随后突然抽空回落，恰在濒临失守的一刻把她拉住。', icon: '<path d="M12 2 4 14h7l-1 8 9-13h-7z"/>',
    period: function (p) { return 1 / Math.max(p.hz * 0.18, 0.16); },
    env: function (t, p) { const T = this.period(p), x = (t % T) / T; if (x < 0.70) return toyClamp(p.pow * (0.80 + 0.20 * Math.sin(t * 5)), 0, 1); return toyClamp(p.pow * (x < 0.76 ? 0.04 : 0.25), 0, 1); } },
  { id: 'rush', name: '冲刺', gain: 4.8, feel: '毫无铺垫直接满幅拉升，一路高速压向绝顶，绝顶后仍持续狂震叠浪不停。', icon: '<path d="M13 2 4 14h6l-1 8 11-15h-7zM11 4l-5 8h4l-1 6"/>',
    period: function () { return 0; },
    env: function (t, p) { return toyClamp(p.pow * (0.86 + 0.14 * Math.sin(t * 7.3)), 0, 1); } }
];

export function toyMode(id) {
  for (let i = 0; i < TOY_MODES.length; i++) if (TOY_MODES[i].id === id) return TOY_MODES[i];
  return TOY_MODES[1];
}

// ---------- 处境与战术摘要 ----------
export function toySceneOf(id) {
  const scenes = WHEEL_COPY.workshop.toylink.scenes || {};
  return scenes[id] || null;
}

export function toySceneId(run) {
  // rc.52（方案 §3.1）：现场没有处境，返回 null；别处必须是有效处境，否则回落默认。
  if (!run || run.here !== 'away') return null;
  const id = run.sceneId;
  if (id && toySceneOf(id)) return id;
  return TOY_AWAY_SCENE_DEFAULT;
}

// 破顶倍率：方案 §3.1「每寸止 1 次叠加 +0.35×（最高 5 次 = +1.75×）」。
export function toyBurstMult(edgeCount) {
  const n = Math.min(5, Math.max(0, Math.floor(Number(edgeCount) || 0)));
  return Number((1 + n * 0.35).toFixed(2));
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function intIn(v, a, b) { return Math.round(toyClamp(num(v), a, b)); }

// 方案 §6.2：老调用只传原有 7 字段时，全部扩展字段在此兜底。
export function toyRunState(run) {
  const st = {...(run || {})};
  st.edgeLocked = !!st.edgeLocked;
  st.edgeCount = intIn(st.edgeCount, 0, 99);
  st.crave = toyClamp(num(st.crave), 0, 100);
  st.craveBurst = !!st.craveBurst;
  st.resisting = !!st.resisting;
  st.resistLeft = Math.max(0, num(st.resistLeft));
  st.resistCd = Math.max(0, num(st.resistCd));
  st.breakCount = intIn(st.breakCount, 0, 99);
  st.endureCount = intIn(st.endureCount, 0, 99);
  st.shockCd = toyClamp(num(st.shockCd), 0, 4);
  st.exposure = toyClamp(num(st.exposure), 0, 100);
  st.exposedCount = intIn(st.exposedCount, 0, 99);
  st.trace = Array.isArray(st.trace) ? st.trace.slice(-5) : [];
  st.feedKey = typeof st.feedKey === 'string' ? st.feedKey : 'idle';
  st.feedSubKey = typeof st.feedSubKey === 'string' ? st.feedSubKey : '';
  st.sync = intIn(st.sync, 0, 5);
  st.heartSec = Math.max(0, num(st.heartSec));
  st.rushBreak = !!st.rushBreak;
  st.burst = !!st.burst;
  return st;
}

function wrapClock(t, T) { const m = ((t % T) + T) % T; return m; }
function cycleOf(mode, p, clock) {
  const T = mode.period ? mode.period(p) : 0;
  if (!T || !Number.isFinite(T) || T <= 0) return null;
  return {x: wrapClock(clock, T) / T, T};
}

// 一步 100ms 物理。绝顶永不停机：满圈即 peak+1 且以溢出余量续填。
// rc.51：模式规则改写累积量；寸止锁 / 忍耐 / 暴露 / 轨迹全部在本函数内闭环。
export function stepToyTick(run, dt, clock) {
  const st = toyRunState(run);
  const stack = toyStackOf(st.peak);
  const mode = toyMode(st.mode);
  const p = {pow: st.pow / 100, hz: toyHz(st.freq), phase: clock * 0.37};
  let env = toyClamp(mode.env(clock, p) * stack.envMult, 0, 1);
  const cycle = cycleOf(mode, p, clock);
  const prevX = cycle ? wrapClock(clock - dt, cycle.T) / cycle.T : 0;

  const base = (0.075 * st.pow / 100 + 0.055 * Math.pow(st.freq / 100, 0.8)) * mode.gain * stack.rateMult * dt * 6.2;

  // 心跳：每满 5 秒强制累加 1 层「羞耻同频」，每层使后续全模式累积速率 +10%（最高 5 层）
  let sync = st.sync, heartSec = st.heartSec, synced = false;
  if (mode.id === 'heart') {
    heartSec += dt;
    while (heartSec >= 5 && sync < 5) { heartSec -= 5; sync += 1; synced = true; }
  }

  let delta = base * (1 + sync * 0.10);

  const edgeLock = st.edgeLocked || mode.id === 'edge';
  const cap = mode.id === 'tease' ? 85 : (edgeLock ? 96 : 100);

  // 命中阈值锁后的回落：edge 模式每个周期 70% 处把 aro 从 96 拉回 88，记一次寸止
  let aroStart = st.aro;
  let edgeCount = st.edgeCount;
  let edgeHit = false;
  if (edgeLock && cycle && prevX < 0.70 && cycle.x >= 0.70 && aroStart >= 96) {
    aroStart = 88;
    edgeCount += 1;
    edgeHit = true;
  }

  let crave = st.crave;
  let crit = false;

  if (mode.id === 'tease') {
    // 硬卡 85：到顶不再上升，改为每秒叠加 +12% 饥渴值
    if (aroStart >= 85) { delta = 0; crave = Math.min(100, crave + 12 * dt); }
  } else if (mode.id === 'wave') {
    delta = delta * env / TOY_WAVE_ENV_MEAN;
  } else if (mode.id === 'pulse') {
    if (cycle && cycle.x < 0.22) delta *= 1.8; else delta -= 0.3 * dt;
  } else if (mode.id === 'heart') {
    if (cycle && cycle.x > 0.20 && cycle.x < 0.29) delta *= 1.6;
  } else if (mode.id === 'ramp' && cycle) {
    if (cycle.x < 0.78) delta *= 0.75;
    if (prevX < 0.78 && cycle.x >= 0.78) delta += 4.5;
  } else if (mode.id === 'chaos') {
    const sec = Math.floor(clock);
    if (sec !== Math.floor(clock - dt) && toyNoise(sec) < 0.28) { crit = true; env = 1; delta += 3.2; }
  } else if (mode.id === 'storm') {
    if (aroStart >= 48) delta *= 1.45;
  }

  // 机制二：夹腿忍耐（4.5s，累积 ×0.30；pulse 破盾 ×2.5 → 0.75；chaos 完全穿透）
  let resisting = st.resisting;
  let resistLeft = st.resistLeft;
  let resistCd = st.resistCd;
  let resistPassed = false;
  if (mode.id === 'chaos') {
    resisting = false;
  } else if (resisting) {
    delta *= (mode.id === 'pulse' ? 0.75 : 0.30);
    resistLeft -= dt;
    if (resistLeft <= 0) {
      resisting = false;
      resistPassed = true;
      resistCd = 8 + toyNoise(clock) * 4;
      delta -= 10;
    }
  } else {
    resistCd = Math.max(0, resistCd - dt);
    if (aroStart + delta >= 48 && resistCd <= 0) { resisting = true; resistLeft = 4.5; }
  }
  const resistJustStarted = resisting && !st.resisting;

  const shockCd = Math.max(0, st.shockCd - dt);

  const forcedBreak = st.burst || (mode.id === 'rush' && st.rushBreak);
  let nextAro = aroStart + delta;
  if (forcedBreak) nextAro = 100;
  else if (nextAro > cap) nextAro = Math.max(cap, aroStart);
  if (nextAro < 0) nextAro = 0;

  let peak = st.peak;
  let peaked = false;
  let craveBurst = st.craveBurst;
  if (nextAro >= 100) {
    if (peak < TOY_MAX_PEAK) {
      // 溃堤双绝顶：crave 势能 或 破顶时已寸止 ≥3 次 → 单次冲顶连跳 2 层
      const doubleBy = st.burst ? edgeCount >= 3 : (st.craveBurst || (st.crave >= 60 && mode.id !== 'tease'));
      peak = Math.min(TOY_MAX_PEAK, peak + (doubleBy ? 2 : 1));
      let over = nextAro - 100;
      if (mode.id === 'wave') over = Math.max(18, over);
      if (mode.id === 'rush') over = 35 + over;
      nextAro = over;
      peaked = true;
      if (doubleBy) { crave = 0; craveBurst = false; }
    } else {
      peak = TOY_MAX_PEAK;
      nextAro = 100;
    }
  }

  // 机制四：失态暴露值（方案 §6.2 的 (pow-45)*expRate*dt；整体 ÷10 经 YG 2026-11-23 批准，
  // 让 pow90+桌下从 31.5%/秒降到 3.15%/秒，一次当众失态约 30–40 秒）
  const sceneKey = toySceneId(st);
  const scene = sceneKey ? toySceneOf(sceneKey) : null;
  const expRate = scene ? (Number(scene.expRate) || 0) : TOY_WITH_EXP_RATE;
  const effPow = (st.pow >= 70 || mode.id === 'storm' || mode.id === 'rush') ? Math.max(st.pow, 70) : st.pow;
  let expDelta = (effPow - 45) * expRate * dt / 10;
  if (mode.id === 'heart' && expDelta > 0) expDelta *= 0.5;
  let exposure = toyClamp(st.exposure + expDelta, 0, 100);
  let exposedCount = st.exposedCount;
  let exposedHit = false;
  if (peaked && mode.id === 'storm') exposure = 100;
  if (exposure >= 100) { exposedCount += 1; exposure = 65; exposedHit = true; }

  const stage = toyStageOf(nextAro);
  const stageChanged = stage !== st.stage;

  let feed = st.feedKey;
  if (peaked) feed = peak === 1 ? 'peak_1' : (peak === 2 ? 'peak_2' : 'peak_3');
  else if (edgeHit) feed = edgeCount === 1 ? 'edge_hit_1' : (edgeCount === 2 ? 'edge_hit_2' : 'edge_hit_3');
  else if (resistJustStarted) feed = 'resist_start';
  else if (resistPassed) feed = 'resist_pass';
  else if (exposedHit) feed = 'exposed_hit';
  else if (mode.id === 'tease' && crave >= 60) feed = 'crave_high';
  else if (resisting) feed = 'resist_hold';
  else if (stageChanged) feed = 'stage_' + stage;
  else if (Math.floor(clock / 4) !== Math.floor((clock - dt) / 4)) feed = 'stage_' + stage;

  const nextRun = {
    ...st,
    aro: nextAro,
    stage,
    peak,
    env,
    edgeCount,
    edgeLocked: st.edgeLocked,
    crave,
    craveBurst,
    resisting,
    resistLeft: resisting ? Math.max(0, resistLeft) : 0,
    resistCd,
    shockCd,
    exposure,
    exposedCount,
    sync,
    heartSec,
    burst: false,
    rushBreak: false,
    feedKey: feed,
    feedSubKey: st.feedKey
  };

  return {
    nextRun,
    env,
    stack: toyStackOf(peak),
    stageChanged,
    peaked,
    peakGain: peak - st.peak,
    edgeHit,
    resistStarted: resistJustStarted,
    resistPassed,
    resistBroken: false,
    exposedHit,
    crit,
    synced
  };
}

function tierBodyOf(pow) {
  for (let i = 0; i < TOY_TIER_BODY.length; i++) if (pow <= TOY_TIER_BODY[i][0]) return TOY_TIER_BODY[i][2];
  return TOY_TIER_BODY[TOY_TIER_BODY.length - 1][2];
}

function tierBodyLabelOf(pow) {
  for (let i = 0; i < TOY_TIER_BODY.length; i++) if (pow <= TOY_TIER_BODY[i][0]) return TOY_TIER_BODY[i][1] + '档';
  return TOY_TIER_BODY[TOY_TIER_BODY.length - 1][1] + '档';
}

// 监控窗短句：feedKey → 定稿文案，变量按 §5.2 的 {count}/{crave}/{peak} 填。
export function toyFeedText(run) {
  const T = WHEEL_COPY.workshop.toylink;
  const feeds = T.feeds || {};
  const key = run && typeof run.feedKey === 'string' && feeds[run.feedKey] !== undefined ? run.feedKey : 'idle';
  return fill(feeds[key], {
    count: Number(run?.edgeCount) || 0,
    crave: Math.round(Number(run?.crave) || 0),
    peak: Number(run?.peak) || 0
  });
}

// 方案 §5.3：确定性拼接，玩家没有额外操作时返回空串（不出现空括号）。
export function tacticSummaryOf(run) {
  const st = toyRunState(run);
  let s = '';
  if (st.trace.length > 1) s += '｜手法轨迹：' + st.trace.join('→');
  if (st.edgeCount > 0) s += '｜已连续寸止折磨' + st.edgeCount + '次';
  if (st.breakCount > 0) s += '｜趁她夹腿强忍时瞬时强刺破防' + st.breakCount + '次';
  if (st.exposedCount > 0) s += '｜已逼至当众失态破防（失态风险' + Math.round(st.exposure) + '%）';
  if (st.exposure >= 75 && !st.exposedCount) s += '｜当前失态风险高达' + Math.round(st.exposure) + '%（濒临当众漏音失控）';
  return s;
}

// 注入提示词块（方案 §5.4：现场 / 别处分离）
export function buildToyPromptBlock(run, targetName) {
  const T = WHEEL_COPY.workshop.toylink;
  const st = toyRunState(run);
  const mode = toyMode(st.mode);
  const stack = toyStackOf(st.peak);
  const stage = toyStageOf(st.aro);
  const sceneKey = toySceneId(st);
  const scene = sceneKey ? toySceneOf(sceneKey) : null;
  const away = !!scene;
  return fill(away ? T.promptBlockAway : T.promptBlockWith, {
    name: String(targetName || ''),
    hereLabel: away ? T.hereAway : T.hereWith,
    sceneLabel: scene ? scene.label : '',
    sceneDesc: scene ? scene.desc : '',
    sceneDirective: scene ? (scene.directive || '') : '',
    modeName: mode.name,
    pow: Math.round(st.pow),
    tierBodyLabel: tierBodyLabelOf(st.pow),
    freq: Math.round(st.freq),
    hz: toyHz(st.freq),
    stage,
    stageName: TOY_STAGE_CN[stage - 1],
    aro: Math.round(st.aro),
    peak: stack.peak,
    tierLabel: stack.tierLabel,
    rateMult: stack.rateMult.toFixed(2),
    tacticPromptLine: tacticSummaryOf(st),
    modeFeel: mode.feel,
    modeClause: (T.modeClauses && T.modeClauses[mode.id]) || '',
    stageBody: TOY_STAGE_BODY[stage] || TOY_STAGE_BODY[1],
    tierBody: tierBodyOf(st.pow)
  });
}

// 佩戴引导词（方案 §5.2）：写进酒馆输入框，由玩家手动发送
export function buildToyWearInputLine(targetName, here, sceneId) {
  const T = WHEEL_COPY.workshop.toylink;
  const away = (here === 'away');
  const scene = away ? (toySceneOf(sceneId) || toySceneOf(TOY_AWAY_SCENE_DEFAULT)) : null;
  return fill(away ? T.wearInputAway : T.wearInputWith, {
    name: String(targetName || ''),
    sceneLabel: scene ? scene.label : '',
    sceneDesc: scene ? scene.desc : ''
  });
}

// 一次性佩戴注入块（方案 §5.3）：当轮挂上、生成结束即撤
export function buildToyWearPromptBlock(targetName, here, sceneId) {
  const T = WHEEL_COPY.workshop.toylink;
  const away = (here === 'away');
  const scene = away ? (toySceneOf(sceneId) || toySceneOf(TOY_AWAY_SCENE_DEFAULT)) : null;
  return fill(away ? T.wearPromptAway : T.wearPromptWith, {
    name: String(targetName || ''),
    sceneLabel: scene ? scene.label : '',
    sceneDesc: scene ? scene.desc : '',
    sceneDirective: scene ? (scene.directive || '') : ''
  });
}

// 输入框引导词（两种口径）
export function buildToyInputLine(run, targetName, here) {
  const T = WHEEL_COPY.workshop.toylink;
  const st = toyRunState(run);
  const mode = toyMode(st.mode);
  const stack = toyStackOf(st.peak);
  const stage = toyStageOf(st.aro);
  const awayHere = (here || st.here) === 'away';
  const scene = awayHere ? toySceneOf(toySceneId({...st, here: 'away'})) : null;
  const key = awayHere ? 'inputLineAway' : 'inputLineWith';
  return fill(T[key], {
    name: String(targetName || ''),
    sceneLabel: scene ? scene.label : '',
    sceneDesc: scene ? scene.desc : '',
    modeName: mode.name,
    pow: Math.round(st.pow),
    freq: Math.round(st.freq),
    hz: toyHz(st.freq),
    stage,
    stageName: TOY_STAGE_CN[stage - 1],
    peak: stack.peak,
    tierLabel: stack.tierLabel,
    rateMult: stack.rateMult.toFixed(2),
    tacticSummary: tacticSummaryOf(st),
    modeClause: (T.modeClauses && T.modeClauses[mode.id]) || ''
  });
}

// ===== rc.53 极简版（三档固定强度，不引入第二套强度体系） =====
// 方案 02 §3.1：档位直接落在现有 pow 语义上；03 §6.2 给出三档体感口径。
export const TOY_LITE_GEARS = [30, 60, 90];
export const TOY_LITE_GEAR_NAMES = ['1 档 · 轻柔', '2 档 · 中等', '3 档 · 强烈'];

export const TOY_LITE_GEAR_DESC = {
  1: '1档（轻柔）：深处传来细密酥麻的低频轻震，她尚能勉强维持正常交谈，但会悄悄并拢双腿、呼吸微乱、偶有走神。',
  2: '2档（中等）：持续而清晰的温热震颤自小腹蔓延，她耳根与颈侧泛红、语速不稳、腿心发软，指尖下意识攥紧身边物件以掩饰异样。',
  3: '3档（强烈）：强烈的高频震颤迅速占满感官，她话语断续、腰肢发软、额角渗汗，强忍着才不让破碎轻喘从唇缝溢出，极易在动作间露馅。'
};

export function toyLiteGearOf(pow) {
  const n = Number(pow) || 0;
  if (n <= 45) return 1;
  if (n <= 75) return 2;
  return 3;
}

// 极简版注入块：事件态优先（刚戴上 / 刚开启 / 刚切档 / 刚关闭），否则持续态。
// 方案 02 §6.3 模板 A–F；03 §6.1 防重复与写「变化」还是「现状」的口径。
export function buildToyLitePromptBlock(ctx = {}) {
  const L = WHEEL_COPY.workshop.toylinkLite || {};
  const P = L.prompts || {};
  const ev = ctx.event || null;
  const gearNum = (v, fallback) => (v == null || v === '' || isNaN(Number(v)) ? fallback : Math.max(1, Math.min(3, Math.round(Number(v)))));
  // ctx.gear / ev.gear / ev.prevGear 都是「档位序号 1–3」；ctx.pow 才是强度值（5–100）
  const gear = gearNum(ev && ev.gear != null ? ev.gear : ctx.gear, toyLiteGearOf(ctx.pow));
  const prevGear = gearNum(ev && ev.prevGear != null ? ev.prevGear : null, gear);
  let key;
  if (ev && ev.type === 'worn') key = 'worn';
  else if (ev && ev.type === 'started') key = 'started';
  else if (ev && ev.type === 'gear_changed') key = 'gearChanged';
  else if (ev && ev.type === 'stopped') key = 'stopped';
  else key = ctx.running ? 'running' : 'idle';
  const other = String(ctx.otherWornNames || '');
  const body = fill(P[key] || '', {
    name: String(ctx.name || ''),
    names: String(ctx.names || ctx.name || ''),
    gearShort: (L.gears && L.gears[gear - 1] && L.gears[gear - 1].short) || '',
    gearLabel: TOY_LITE_GEAR_NAMES[gear - 1] || '',
    prevGearLabel: TOY_LITE_GEAR_NAMES[prevGear - 1] || '',
    direction: gear > prevGear ? '调强' : '调弱',
    gearDesc: TOY_LITE_GEAR_DESC[gear] || ''
  });
  const note = other ? fill(L.otherWornNote || '', {names: other}) : '';
  return {key, content: note ? body + '\n' + note : body};
}
