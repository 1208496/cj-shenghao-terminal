import test from 'node:test';
import assert from 'node:assert/strict';
import { fnv1a64, rollWheelPrize, playWheelQuote, isoWeekKey, WHEEL_POOL, WHEEL_POOL_BY_RARITY, PITY, PLAY_DAILY_CASH_LIMIT } from '../src/core/wheel.js';
import {
  rollWishPack, lowPackQuote, LOW_CARD_POINTS, rollCasino, casinoSeed, drawSeed, CASINO_SLOTS, CASINO_COLOR_OF_SLOT,
  CARD_POINTS, CARD_WEIGHT, CARD_ANCHOR_WEIGHT, LOW_CARD_WEIGHT, upgradeCost, abilityById, itemById, ABILITIES, SURREAL_ITEMS,
  wishWheelQuote, WISH_CASH_MIN_CENTS, WISH_UNLOCK_BASIS_CENTS,
} from '../src/core/casino.js';

test('rc.34 奖池 53 条：稀有度分布 30/16/6/1 且 id 连续', () => {
  assert.equal(WHEEL_POOL.length, 53);
  assert.deepEqual(
    { gray: WHEEL_POOL_BY_RARITY.gray.length, red: WHEEL_POOL_BY_RARITY.red.length, gold: WHEEL_POOL_BY_RARITY.gold.length, rainbow: WHEEL_POOL_BY_RARITY.rainbow.length },
    { gray: 30, red: 16, gold: 6, rainbow: 1 }
  );
  assert.equal(WHEEL_POOL[0].prizeId, 'w01');
  assert.equal(WHEEL_POOL[52].prizeId, 'w53');
  assert.equal(WHEEL_POOL[52].rarity, 'rainbow');
  assert(WHEEL_POOL.every((p) => p.name && p.summary && p.hint));
});

test('rc.34 玩法轮盘：同一种子必然同结果（防随机漂移）', () => {
  const a = rollWheelPrize({ seed: 'branch|2026-11-19|d1|t0', wheel: {}, toyLinkUnlocked: false });
  const b = rollWheelPrize({ seed: 'branch|2026-11-19|d1|t0', wheel: {}, toyLinkUnlocked: false });
  assert.equal(a.prize.prizeId, b.prize.prizeId);
  assert.equal(a.rarity, b.rarity);
});

test('rc.34 玩法轮盘：10/30/60 抽保底会收窄池子', () => {
  const red = rollWheelPrize({ seed: 's', wheel: { pityRed: PITY.red - 1 }, toyLinkUnlocked: false });
  assert.notEqual(red.rarity, 'gray');
  const gold = rollWheelPrize({ seed: 's', wheel: { pityGold: PITY.gold - 1 }, toyLinkUnlocked: false });
  assert(['gold', 'rainbow'].includes(gold.rarity));
  const rainbow = rollWheelPrize({ seed: 's', wheel: { pityRainbow: PITY.rainbow - 1 }, toyLinkUnlocked: false });
  assert.equal(rainbow.rarity, 'rainbow');
  assert.equal(rainbow.prize.prizeId, 'w53');
  assert.equal(rainbow.unlockedToyLink, true);
});

test('rc.36 命运轮盘：每日免费 + 轻阶梯 0.1%–1.5%，¥500 起、¥5 万封顶、每日 8 次现金', () => {
  const free = playWheelQuote({ lastFreeDate: null, todayPaidDate: null, todayPaidSpins: 0 }, '2026-11-19', 50000000);
  assert.equal(free.defaultMode, 'free');
  assert.equal(free.freeAvailable, true);
  const paid1 = playWheelQuote({ lastFreeDate: '2026-11-19', todayPaidDate: '2026-11-19', todayPaidSpins: 0 }, '2026-11-19', 50000000);
  assert.equal(paid1.defaultMode, 'cash');
  assert.equal(paid1.costCents, 50000); // 0.1% = ¥500
  const last = playWheelQuote({ lastFreeDate: '2026-11-19', todayPaidDate: '2026-11-19', todayPaidSpins: 7 }, '2026-11-19', 50000000);
  assert.equal(last.costCents, 750000); // 1.5% = ¥7,500
  const poor = playWheelQuote({ lastFreeDate: '2026-11-19', todayPaidDate: '2026-11-19', todayPaidSpins: 0 }, '2026-11-19', 1000);
  assert.equal(poor.costCents, 50000); // ¥500 底价
  const rich = playWheelQuote({ lastFreeDate: '2026-11-19', todayPaidDate: '2026-11-19', todayPaidSpins: 7 }, '2026-11-19', 100000000000);
  assert.equal(rich.costCents, 5000000); // ¥5 万硬封顶
  const full = playWheelQuote({ lastFreeDate: '2026-11-19', todayPaidDate: '2026-11-19', todayPaidSpins: PLAY_DAILY_CASH_LIMIT }, '2026-11-19', 50000000);
  assert.equal(full.cashAvailable, false);
  assert.equal(full.defaultMode, 'points');
  assert.equal(full.costPoints, 120);
});

test('rc.36 星愿圣盘：百万身家或首笔提现解锁，2%/4%/8%/12%/18%、底价 20 万、日限 2、周付费 5', () => {
  const locked = wishWheelQuote({}, '2026-11-19', 10000000, false);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.reason, 'WISH_LOCKED');
  assert.equal(wishWheelQuote({}, '2026-11-19', 10000000, true).unlocked, true, '提现过一次就解锁');
  const free = wishWheelQuote({}, '2026-11-19', WISH_UNLOCK_BASIS_CENTS, false);
  assert.equal(free.mode, 'free');
  assert.equal(free.weekKey, isoWeekKey('2026-11-19'));
  const paid = wishWheelQuote({ wishWeekKey: isoWeekKey('2026-11-19'), wishWeekFreeUsed: true, wishWeekPaidSpins: 0 }, '2026-11-19', 5000000000, false);
  assert.equal(paid.mode, 'cash');
  assert.equal(paid.costCents, 100000000); // ¥50,000,000 的 2% = ¥1,000,000
  const floored = wishWheelQuote({ wishWeekKey: isoWeekKey('2026-11-19'), wishWeekFreeUsed: true, wishWeekPaidSpins: 0 }, '2026-11-19', 100000000, false);
  assert.equal(floored.costCents, WISH_CASH_MIN_CENTS); // 底价 20 万
  const week = wishWheelQuote({ wishWeekKey: isoWeekKey('2026-11-19'), wishWeekFreeUsed: true, wishWeekPaidSpins: 5 }, '2026-11-19', 5000000000, false);
  assert.equal(week.reason, 'WISH_WEEKLY_LIMIT');
  const today = wishWheelQuote({ wishWeekKey: isoWeekKey('2026-11-19'), wishTodayDate: '2026-11-19', wishTodaySpins: 2 }, '2026-11-19', 5000000000, false);
  assert.equal(today.reason, 'WISH_DAILY_LIMIT');
  assert.equal(isoWeekKey('2026-01-05'), '2026-W02', 'ISO 周键跨年正确');
});

test('rc.37 星愿卡包：一包 3 张、权重各表 1000、压轴位保底提档', () => {
  assert.deepEqual(CARD_POINTS, { gray: 20, red: 60, gold: 200, rainbow: 800 });
  assert.equal(Object.values(CARD_WEIGHT).reduce((a, b) => a + b, 0), 1000, '常规位权重合计 1000');
  assert.equal(Object.values(CARD_ANCHOR_WEIGHT).reduce((a, b) => a + b, 0), 1000, '压轴位权重合计 1000');
  assert.equal(Object.values(LOW_CARD_WEIGHT).reduce((a, b) => a + b, 0), 1000, '低阶常规位权重合计 1000');
  assert.deepEqual(LOW_CARD_POINTS, { gray: 10, red: 30 });

  const pack = rollWishPack({ seed: 's', poolTier: 'high' });
  assert.equal(pack.cards.length, 3, '一包固定 3 张');
  for (const c of pack.cards) assert(pack.cards.length && c.cardCode.startsWith(c.rarity + '_'));

  const forcedRed = rollWishPack({ seed: 's', poolTier: 'high', pityRed: 3 });
  assert.notEqual(forcedRed.cards[2].rarity, 'gray', '第 4 包压轴位必出红+');
  const forcedGold = rollWishPack({ seed: 's', poolTier: 'high', pityGold: 9 });
  assert(['gold', 'rainbow'].includes(forcedGold.cards[2].rarity), '第 10 包压轴位必出金+');
  const lowForced = rollWishPack({ seed: 's', poolTier: 'low', pityRed: 4 });
  assert.equal(lowForced.cards[2].rarity, 'red', '低阶第 5 包压轴位必出红');
  assert.equal(rollWishPack({ seed: 'x', poolTier: 'low' }).cards[0].rarity, rollWishPack({ seed: 'x', poolTier: 'low' }).cards[0].rarity, '同种子同结果');
  for (const c of rollWishPack({ seed: 'y', poolTier: 'low' }).cards) assert(['gray', 'red'].includes(c.rarity), '低阶只出灰/红');
});

test('rc.37 低阶星尘卡包报价：开局即开、1 免费 + 2 现金、日满 3 包', () => {
  const free = lowPackQuote({}, '2026-01-05');
  assert.equal(free.unlocked, true);
  assert.equal(free.mode, 'free');
  const paid1 = lowPackQuote({ lowPackTodayDate: '2026-01-05', lowPackTodayFreeUsed: true, lowPackTodayPaid: 0 }, '2026-01-05');
  assert.equal(paid1.mode, 'cash');
  assert.equal(paid1.costCents, 200000);
  const paid2 = lowPackQuote({ lowPackTodayDate: '2026-01-05', lowPackTodayFreeUsed: true, lowPackTodayPaid: 1 }, '2026-01-05');
  assert.equal(paid2.costCents, 500000);
  const full = lowPackQuote({ lowPackTodayDate: '2026-01-05', lowPackTodayFreeUsed: true, lowPackTodayPaid: 2 }, '2026-01-05');
  assert.equal(full.canSpin, false);
  assert.equal(full.reason, 'LOW_PACK_DAILY_LIMIT');
});

test('rc.35 赌场：37 格红黑各 18 + 绿 1，押中翻倍押错归零', () => {
  const colors = Array.from({ length: CASINO_SLOTS }, (_, i) => CASINO_COLOR_OF_SLOT(i));
  assert.equal(colors.filter((c) => c === 'green').length, 1);
  assert.equal(colors.filter((c) => c === 'red').length, 18);
  assert.equal(colors.filter((c) => c === 'black').length, 18);

  // 找到每个颜色的一个可达种子，验证结算
  let hitRed = null, hitGreen = null, missRed = null;
  for (let i = 0; i < 500 && (!hitRed || !hitGreen || !missRed); i++) {
    const seed = casinoSeed({ branchKey: 'b', date: '2026-11-19', round: i, cardId: 'card_1', betColor: 'red' });
    const r = rollCasino({ seed, cardPoints: 100, betColor: 'red' });
    if (r.win && !hitRed) hitRed = r;
    if (!r.win && !missRed) missRed = r;
    const g = rollCasino({ seed: casinoSeed({ branchKey: 'b', date: '2026-11-19', round: i, cardId: 'card_1', betColor: 'green' }), cardPoints: 100, betColor: 'green' });
    if (g.win && !hitGreen) hitGreen = g;
  }
  assert.equal(hitRed.mult, 2);
  assert.equal(hitRed.nextPoints, 200);
  assert.equal(missRed.win, false);
  assert.equal(missRed.nextPoints, 0);
  assert.equal(hitGreen.mult, 36);
  assert.equal(hitGreen.nextPoints, 3600);
});

test('rc.35 赌场：换押注颜色会得到不同落点（防删楼改押稳赢）', () => {
  const base = { branchKey: 'b', date: '2026-11-19', round: 7, cardId: 'card_9' };
  const red = rollCasino({ seed: casinoSeed({ ...base, betColor: 'red' }), cardPoints: 60, betColor: 'red' });
  const green = rollCasino({ seed: casinoSeed({ ...base, betColor: 'green' }), cardPoints: 60, betColor: 'green' });
  const black = rollCasino({ seed: casinoSeed({ ...base, betColor: 'black' }), cardPoints: 60, betColor: 'black' });
  assert(new Set([red.hitIndex, green.hitIndex, black.hitIndex]).size > 1);
});

test('rc.35 商城：14 异能 / 16 奇物，升级价与直兑价符合方案', () => {
  assert.equal(ABILITIES.length, 14);
  assert.equal(SURREAL_ITEMS.length, 16);
  const micro = abilityById('ab_micro');
  assert.equal(micro.price, 350);
  assert.equal(upgradeCost(micro, 1), 280); // 350*0.8
  assert.equal(upgradeCost(micro, 2), 490); // 350*1.4
  assert.equal(itemById('it_toylink').price, 3600);
  assert.equal(abilityById('ab_stop').price, 4500);
  assert.equal(ABILITIES.filter((a) => a.upgradable).length, 9);
});

test('rc.34/35：抽卡与轮盘种子互不相同', () => {
  const a = drawSeed({ branchKey: 'b', date: 'd', index: 1, total: 0 });
  const b = drawSeed({ branchKey: 'b', date: 'd', index: 2, total: 0 });
  assert.notEqual(a, b);
  assert(fnv1a64(a) !== fnv1a64(b));
  assert.notEqual(a, casinoSeed({ branchKey: 'b', date: 'd', round: 1, cardId: 'c', betColor: 'red' }));
});


