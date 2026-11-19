// rc.35 星愿积分 · 星愿卡 · 暗夜赌场 · 商城：纯计算层。
// 与 wheel.js 同一套确定性口径；不含状态变更，便于单测。

import { fnv1a64, isoWeekKey } from './wheel.js';
import { ABILITIES, ABILITY_BY_ID, SURREAL_ITEMS, SURREAL_ITEM_BY_ID, CARD_POINTS } from './casino-catalog.js';

export const CARD_RARITIES = ['gray', 'red', 'gold', 'rainbow'];
// rc.37：一包 3 张，前 2 张走「常规位」权重，第 3 张走「压轴位」权重（两表各自合计 1000）。
export const CARD_WEIGHT = { gray: 740, red: 210, gold: 45, rainbow: 5 };
export const CARD_ANCHOR_WEIGHT = { gray: 620, red: 240, gold: 120, rainbow: 20 };
export const LOW_CARD_WEIGHT = { gray: 850, red: 150 };
export const LOW_CARD_ANCHOR_WEIGHT = { gray: 750, red: 250 };
export const CARD_PITY_RED = 4; // 连续 3 包未出红+，第 4 包压轴位必出红+
export const CARD_PITY_GOLD = 10; // 连续 9 包未出金+，第 10 包压轴位必出金+
export const PACK_SIZE = 3;
// rc.37 低阶星尘卡包：开局即开、便宜、赌场硬封顶。
export const LOW_PACK_PITY_RED = 5; // 每 5 包压轴位必出红阶
export const LOW_PACK_DAILY_PAID_LIMIT = 2; // 免费之外每天还能买 2 包
export const LOW_PACK_CASH_PRICES_CENTS = [200000, 500000]; // ¥2,000 / ¥5,000
export const LOW_CARD_POINTS = { gray: 10, red: 30 };
export const LOW_CARD_CASINO_CAP = 240; // 低阶卡单卡赢分硬封顶

// rc.36 星愿圣盘：限制多、要贵。承接原 2/4/8/12/18% 重资产阶梯。
export const WISH_UNLOCK_BASIS_CENTS = 100000000; // 计级身家满 100 万解锁
export const WISH_DAILY_LIMIT = 2; // 每日 2 包（含每周免费那包）
export const WISH_WEEKLY_PAID_LIMIT = 5; // 每周现金付费 5 包
export const WISH_CASH_RATES = [0.02, 0.04, 0.08, 0.12, 0.18];
export const WISH_CASH_MIN_CENTS = 20000000; // 底价 20 万

export const CASINO_SLOTS = 37;
export const CASINO_MULT = { red: 2, black: 2, green: 36 };
export const CASINO_COLOR_OF_SLOT = (slot) => {
  const s = Number(slot) % CASINO_SLOTS;
  if (s === 0) return 'green';
  return s % 2 === 1 ? 'red' : 'black';
};

// 抽一个卡位：tier 决定档位与分值表，anchor 位用压轴权重，保底在压轴位强制提档。
function rollCardSlot({ seed, tier, anchor, pityRed = 0, pityGold = 0 }) {
  const low = tier === 'low';
  const weights = low
    ? (anchor ? LOW_CARD_ANCHOR_WEIGHT : LOW_CARD_WEIGHT)
    : (anchor ? CARD_ANCHOR_WEIGHT : CARD_WEIGHT);
  const points = low ? LOW_CARD_POINTS : CARD_POINTS;
  let pools = Object.keys(weights);
  if (anchor && !low && pityGold >= CARD_PITY_GOLD - 1) pools = ['gold', 'rainbow'];
  else if (anchor && !low && pityRed >= CARD_PITY_RED - 1) pools = ['red', 'gold', 'rainbow'];
  else if (anchor && low && pityRed >= LOW_PACK_PITY_RED - 1) pools = ['red'];
  const total = pools.reduce((n, r) => n + weights[r], 0);
  let ticket = Number(fnv1a64(seed) % BigInt(total));
  let rarity = pools[pools.length - 1];
  for (const r of pools) {
    if (ticket < weights[r]) { rarity = r; break; }
    ticket -= weights[r];
  }
  const codeIndex = Number(fnv1a64(`${seed}|code`) % 3n) + 1;
  return { rarity, cardCode: `${rarity}_${codeIndex}`, points: points[rarity] };
}

// 抽一整包：slot 0/1 常规位，slot 2 压轴保底位。
export function rollWishPack({ seed, poolTier = 'high', pityRed = 0, pityGold = 0 }) {
  const tier = poolTier === 'low' ? 'low' : 'high';
  const cards = [0, 1, 2].map((slot) =>
    rollCardSlot({ seed: `${seed}|s${slot}`, tier, anchor: slot === PACK_SIZE - 1, pityRed, pityGold })
  );
  const hasRedPlus = cards.some((c) => c.rarity !== 'gray');
  const hasGoldPlus = cards.some((c) => c.rarity === 'gold' || c.rarity === 'rainbow');
  return {
    cards,
    nextPity: tier === 'low'
      ? { lowRed: hasRedPlus ? 0 : Math.min(pityRed + 1, LOW_PACK_PITY_RED - 1) }
      : {
        red: hasRedPlus ? 0 : Math.min(pityRed + 1, CARD_PITY_RED - 1),
        gold: hasGoldPlus ? 0 : Math.min(pityGold + 1, CARD_PITY_GOLD - 1),
      },
  };
}

// 低阶星尘卡包报价：开局即开，免费 1 包 + 现金 2 包，每天 3 包封顶。
export function lowPackQuote(wheel, worldDate) {
  const w = wheel || {};
  const sameDay = w.lowPackTodayDate === worldDate;
  const freeUsed = sameDay ? !!w.lowPackTodayFreeUsed : false;
  const paidToday = sameDay ? Number(w.lowPackTodayPaid) || 0 : 0;
  const todayPacks = (freeUsed ? 1 : 0) + paidToday;
  const base = { poolTier: 'low', unlocked: true, todayPacks, dailyLimit: 3, paidToday, paidLimit: LOW_PACK_DAILY_PAID_LIMIT };
  if (!freeUsed) return { ...base, canSpin: true, mode: 'free', costCents: 0 };
  if (paidToday >= LOW_PACK_DAILY_PAID_LIMIT) return { ...base, canSpin: false, reason: 'LOW_PACK_DAILY_LIMIT' };
  return { ...base, canSpin: true, mode: 'cash', costCents: LOW_PACK_CASH_PRICES_CENTS[paidToday] };
}

// 星愿圣盘解锁与报价：全部由脚本按世界日期与身家推算，模型不参与。
export function wishWheelQuote(wheel, worldDate, tierBasisCents, hasWithdrawal) {
  const w = wheel || {};
  const unlocked = (Number(tierBasisCents) || 0) >= WISH_UNLOCK_BASIS_CENTS || !!hasWithdrawal;
  const weekKey = isoWeekKey(worldDate);
  const sameWeek = w.wishWeekKey === weekKey;
  const weekFreeUsed = sameWeek ? !!w.wishWeekFreeUsed : false;
  const weekPaid = sameWeek ? Number(w.wishWeekPaidSpins) || 0 : 0;
  const todaySpins = w.wishTodayDate === worldDate ? Number(w.wishTodaySpins) || 0 : 0;
  const base = { weekKey, todaySpins, weekPaid, weekFreeUsed, dailyLimit: WISH_DAILY_LIMIT, weeklyLimit: WISH_WEEKLY_PAID_LIMIT };
  if (!unlocked) return { ...base, unlocked: false, canSpin: false, reason: 'WISH_LOCKED' };
  if (todaySpins >= WISH_DAILY_LIMIT) return { ...base, unlocked: true, canSpin: false, reason: 'WISH_DAILY_LIMIT' };
  if (!weekFreeUsed) return { ...base, unlocked: true, canSpin: true, mode: 'free', costCents: 0, rate: 0 };
  if (weekPaid >= WISH_WEEKLY_PAID_LIMIT) return { ...base, unlocked: true, canSpin: false, reason: 'WISH_WEEKLY_LIMIT' };
  const rate = WISH_CASH_RATES[weekPaid];
  const raw = Math.round(((Number(tierBasisCents) || 0) * rate) / 100) * 100;
  return { ...base, unlocked: true, canSpin: true, mode: 'cash', costCents: Math.max(WISH_CASH_MIN_CENTS, raw), rate };
}

// 赌场一局：种子必须含押注颜色，否则删楼改押就能稳赢。
export function rollCasino({ seed, cardPoints, betColor }) {
  const hitIndex = Number(fnv1a64(seed) % BigInt(CASINO_SLOTS));
  const landedColor = CASINO_COLOR_OF_SLOT(hitIndex);
  const win = landedColor === betColor;
  const mult = win ? CASINO_MULT[betColor] : 0;
  const nextPoints = win ? Number(cardPoints) * mult : 0;
  return { hitIndex, landedColor, win, mult, nextPoints };
}

export function casinoSeed({ branchKey, date, round, cardId, betColor }) {
  return `${branchKey}|${date}|c${round}|${cardId}|bet:${betColor}`;
}

export function drawSeed({ branchKey, date, index, total }) {
  return `${branchKey}|${date}|card${index}|t${total}`;
}

export function wheelPointsSeed({ branchKey, date, index, total }) {
  return `${branchKey}|${date}|pts${index}|t${total}`;
}

// ---- 商城 ----
export function abilityById(id) { return ABILITY_BY_ID[id] || null; }
export function itemById(id) { return SURREAL_ITEM_BY_ID[id] || null; }

// 升级价：Lv1→2 = 原价×0.8，Lv2→3 = 原价×1.4（取整至十位）
export function upgradeCost(ability, fromLevel) {
  const raw = ability.price * (fromLevel === 1 ? 0.8 : 1.4);
  return Math.round(raw / 10) * 10;
}

export function shopOffers() {
  return [
    ...ABILITIES.map((a) => ({ kind: 'ABILITY', id: a.abilityId, name: a.name, tag: a.tag, price: a.price, rarity: a.rarity, upgradable: a.upgradable })),
    ...SURREAL_ITEMS.map((i) => ({ kind: 'ITEM', id: i.itemId, name: i.name, tag: i.tag, price: i.price, rarity: i.rarity, consumable: i.consumable })),
  ];
}

export { ABILITIES, SURREAL_ITEMS, CARD_POINTS };
