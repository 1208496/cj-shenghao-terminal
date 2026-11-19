// rc.34 · rc.36 命运轮盘（玩法轮盘）纯计算层：随机、保底、报价。不含状态变更，便于单测。
// 确定性铁律：一切随机都由 FNV-1a 64 位哈希生成，绝不使用 Math.random()。

import { WHEEL_POOL, WHEEL_POOL_BY_RARITY } from './wheel-pool.js';

export function fnv1a64(input) {
  let h = 14695981039346656037n;
  for (const ch of String(input ?? '')) {
    h ^= BigInt(ch.codePointAt(0));
    h = BigInt.asUintN(64, h * 1099511628211n);
  }
  return h;
}

// 稀有度权重（总和 20000）：灰 14400 / 红 4400 / 金 1100 / 虹 100
export const WHEEL_WEIGHT = { gray: 14400, red: 4400, gold: 1100, rainbow: 100 };
export const WHEEL_WEIGHT_TOTAL = 20000;

export const PITY = { red: 10, gold: 30, rainbow: 60 };
export const POINTS_PER_SPIN = 120;

// rc.36：玩法轮盘改走轻阶梯（0.1%–1.5%，¥500 起，¥50,000 封顶），每日现金 8 次。
export const PLAY_DAILY_CASH_LIMIT = 8;
export const PLAY_CASH_RATES = [0.001, 0.002, 0.003, 0.005, 0.008, 0.01, 0.012, 0.015];
export const PLAY_CASH_MIN_CENTS = 50000; // ¥500
export const PLAY_CASH_CAP_CENTS = 5000000; // ¥50,000

// 保底：达到阈值时收窄池子（与方案一致）
export function wheelPools(st, toyLinkUnlocked = false) {
  const pityRed = Number(st.pityRed) || 0;
  const pityGold = Number(st.pityGold) || 0;
  const pityRainbow = Number(st.pityRainbow) || 0;
  if (!toyLinkUnlocked && pityRainbow >= PITY.rainbow - 1) return ['rainbow'];
  if (pityGold >= PITY.gold - 1) return ['gold', 'rainbow'];
  if (pityRed >= PITY.red - 1) return ['red', 'gold', 'rainbow'];
  return ['gray', 'red', 'gold', 'rainbow'];
}

// 抽一次：返回中奖条目与下一轮保底计数
export function rollWheelPrize({ seed, wheel, toyLinkUnlocked = false }) {
  const pools = wheelPools(wheel || {}, toyLinkUnlocked);
  const total = pools.reduce((n, r) => n + WHEEL_WEIGHT[r], 0);
  const h = fnv1a64(seed);
  let ticket = Number(h % BigInt(total));
  let rarity = pools[pools.length - 1];
  for (const r of pools) {
    if (ticket < WHEEL_WEIGHT[r]) { rarity = r; break; }
    ticket -= WHEEL_WEIGHT[r];
  }
  const bucket = WHEEL_POOL_BY_RARITY[rarity];
  // 同稀有度内再用哈希低位挑一格，保证同样种子总落同一格
  const pick = bucket[Number((h >> 17n) % BigInt(bucket.length))];
  const isRainbow = rarity === 'rainbow';
  return {
    prize: pick,
    rarity,
    nextPity: {
      red: rarity === 'gray' ? Math.min((wheel?.pityRed || 0) + 1, PITY.red - 1) : 0,
      gold: rarity === 'gray' || rarity === 'red' ? Math.min((wheel?.pityGold || 0) + 1, PITY.gold - 1) : 0,
      rainbow: isRainbow ? 0 : Math.min((wheel?.pityRainbow || 0) + 1, PITY.rainbow - 1),
    },
    unlockedToyLink: isRainbow || !!toyLinkUnlocked,
  };
}

// 统计到整元，避免出现分币
const wholeYuan = (cents) => Math.round(Number(cents || 0) / 100) * 100;

// 玩法轮盘实时报价：free（每日一次）/ cash（轻阶梯）/ points（120 积分）
export function playWheelQuote(wheel, worldDate, tierBasisCents) {
  const w = wheel || {};
  const free = w.lastFreeDate !== worldDate;
  const paidToday = w.todayPaidDate === worldDate ? Number(w.todayPaidSpins) || 0 : 0;
  const cashAvailable = paidToday < PLAY_DAILY_CASH_LIMIT;
  const rate = PLAY_CASH_RATES[Math.min(paidToday, PLAY_CASH_RATES.length - 1)];
  const costCents = Math.min(PLAY_CASH_CAP_CENTS, Math.max(PLAY_CASH_MIN_CENTS, wholeYuan((Number(tierBasisCents) || 0) * rate)));
  return {
    freeAvailable: free,
    cashAvailable,
    defaultMode: free ? 'free' : cashAvailable ? 'cash' : 'points',
    costCents,
    rate,
    costPoints: POINTS_PER_SPIN,
    paidToday,
    paidLimit: PLAY_DAILY_CASH_LIMIT,
  };
}

// ISO 周键（YYYY-Www），由世界日期确定性推算；跨周重置星愿圣盘的免费与付费计数。
export function isoWeekKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '1970-W01';
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function wheelPrizeById(prizeId) {
  return WHEEL_POOL.find((p) => p.prizeId === prizeId) || null;
}

export { WHEEL_POOL, WHEEL_POOL_BY_RARITY };
