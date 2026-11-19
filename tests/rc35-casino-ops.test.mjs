import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation, projection, tierBasis} from '../src/core/engine.js';
import {fresh,anchor} from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => schemas.state.parse(completeInitialState(fresh(), { startDate: '2026-01-05', startTime: '09:00' }));
// 星愿圣盘要百万身家：用合法的开局现金抬身家，避免直接改 cashCents 破坏账本校验。
const initialRich = () => schemas.state.parse(completeInitialState(fresh({ initialCashCents: 600000000 }), { startDate: '2026-01-05', startTime: '09:00' }));
const run = (s, type, extra = {}) =>
  applyOperation(s, { type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra }, anchor());

// 造一张星愿卡（直接写状态，模拟抽卡结果），用于赌场/兑换用例
function withCard(s, rarity = 'gray', points = 20, cardId = 'card_test') {
  s.inventory = { ...s.inventory, [cardId]: { itemId: cardId, source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_' + rarity, rarity, obtainedDate: s.world.date, status: 'READY', currentPoints: points, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null } };
  return s;
}

test('rc.34 玩法轮盘：每日免费一次，进背包、记保底、不碰现金', () => {
  const s0 = initial();
  const cash = s0.user.cashCents;
  const s = run(s0, 'PLAYER_WHEEL_SPIN', { mode: 'free' });
  assert.equal(s.wheel.lastFreeDate, s.world.date);
  assert.equal(s.wheel.totalSpins, 1);
  assert.equal(s.user.cashCents, cash, '免费抽不应扣钱');
  const items = Object.values(s.inventory).filter((i) => i.category === 'WHEEL_PRIZE');
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'READY');
  assert.equal(s.wheel.discoveredPrizeIds.length, 1);
  assert.throws(() => run(s, 'PLAYER_WHEEL_SPIN', { mode: 'free' }), /WHEEL_FREE_USED/);
});

test('rc.34 玩法轮盘：现金再抽按阶梯扣钱并写流水，钱不够就拒绝', () => {
  let s = run(initial(), 'PLAYER_WHEEL_SPIN', { mode: 'free' });
  const before = s.user.cashCents;
  s = run(s, 'PLAYER_WHEEL_SPIN', { mode: 'cash' });
  assert(s.user.cashCents < before, '现金抽必须实扣');
  assert.equal(s.wheel.todayPaidSpins, 1);
  assert.equal(s.wheel.todayPaidDate, s.world.date);
  const ledger = Object.values(s.finance.ledger).filter((l) => l.kind === 'WHEEL_SPIN');
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].direction, 'OUT');
  const broke = { ...s, user: { ...s.user, cashCents: 0 } };
  broke.finance = s.finance;
  assert.throws(() => run(broke, 'PLAYER_WHEEL_SPIN', { mode: 'cash' }), /INSUFFICIENT_CASH/);
});

test('rc.36 星愿圣盘：未解锁不可抽；解锁后本周首抽免费并计入今日次数', () => {
  const locked = initial();
  assert.throws(() => run(locked, 'PLAYER_CARD_DRAW'), /WISH_LOCKED/);
  const s0 = initialRich();
  const s1 = run(s0, 'PLAYER_CARD_DRAW');
  const card = Object.values(s1.inventory).find((i) => i.category === 'WISH_CARD');
  assert(card, '应当抽到一张星愿卡');
  assert.equal(card.status, 'READY');
  assert.equal(card.currentPoints, { gray: 20, red: 60, gold: 200, rainbow: 800 }[card.rarity]);
  assert.equal(s1.wheel.wishWeekFreeUsed, true);
  assert.equal(s1.wheel.wishTodaySpins, 1);
  assert.equal(s1.user.cashCents, s0.user.cashCents, '本周免费抽不扣钱');
  // 第二抽走现金阶梯（底价 20 万），当天第 3 抽撞日限
  const s2 = run(s1, 'PLAYER_CARD_DRAW');
  assert(s2.user.cashCents < s1.user.cashCents, '第二次必须实扣现金');
  assert.equal(s2.wheel.wishTodaySpins, 2);
  assert.throws(() => run(s2, 'PLAYER_CARD_DRAW'), /WISH_DAILY_LIMIT/);
});

test('rc.36 星愿圣盘：本周付费 5 次用尽后拒绝', () => {
  const s0 = initialRich();
  s0.wheel.wishWeekKey = '2026-W02';
  s0.wheel.wishWeekFreeUsed = true;
  s0.wheel.wishWeekPaidSpins = 5;
  s0.wheel.wishTodayDate = '2026-01-04';
  s0.wheel.wishTodaySpins = 0;
  const s1 = { ...s0, world: { ...s0.world, date: '2026-01-05' } };
  assert.throws(() => run(s1, 'PLAYER_CARD_DRAW'), /WISH_WEEKLY_LIMIT/);
});

test('rc.35 赌场：押错卡销毁、押中翻倍、连赌累加', () => {
  let s = withCard(initial(), 'gold', 200, 'card_g');
  // 押绿几乎必输，先验证销毁
  const bets = ['red', 'black', 'green'];
  let destroyed = null, won = null;
  for (const betColor of bets) {
    const snapshot = JSON.parse(JSON.stringify(s));
    try {
      const out = run(snapshot, 'PLAYER_CASINO_BET', { cardId: 'card_g', betColor });
      if (!out.inventory['card_g']) { destroyed = out; break; }
      if (out.inventory['card_g'].currentPoints > 200) { won = out; break; }
    } catch (e) { throw e; }
  }
  assert(destroyed || won, '至少应出现一次销毁或翻倍');
  if (destroyed) assert.equal(destroyed.inventory['card_g'], undefined, '押错必须整张销毁');
  if (won) {
    assert(won.inventory['card_g'].currentPoints > 200);
    assert.equal(won.inventory['card_g'].winStreak, 1);
  }
});

test('rc.35 赌场：同一局换押注颜色会改变结果（防删楼改押）', () => {
  const s = withCard(initial(), 'gray', 20, 'card_x');
  const results = ['red', 'black', 'green'].map((betColor) =>
    run(JSON.parse(JSON.stringify(s)), 'PLAYER_CASINO_BET', { cardId: 'card_x', betColor })
  );
  const signature = results.map((r) => r.operationHistory[Object.keys(r.operationHistory).pop()].result);
  assert(new Set(signature.map((x) => (x.win ? 'W' : 'L') + x.points)).size > 1);
});

test('rc.35 兑换：星愿卡按当前价值换积分，卡消失', () => {
  let s = withCard(initial(), 'red', 60, 'card_r');
  s = run(s, 'PLAYER_CASINO_BET', { cardId: 'card_r', betColor: 'green' });
  const had = s.inventory['card_r']?.currentPoints ?? 0;
  if (!s.inventory['card_r']) {
    // 押错就没了，换一张重来验证兑换路径
    s = withCard(initial(), 'red', 60, 'card_r2');
    const before = s.wheel.starPoints || 0;
    s = run(s, 'PLAYER_CARD_REDEEM', { cardId: 'card_r2' });
    assert.equal(s.wheel.starPoints, before + 60);
    assert.equal(s.inventory['card_r2'], undefined);
  } else {
    const before = s.wheel.starPoints || 0;
    s = run(s, 'PLAYER_CARD_REDEEM', { cardId: 'card_r' });
    assert.equal(s.wheel.starPoints, before + had);
    assert.equal(s.inventory['card_r'], undefined);
  }
});

test('rc.35 商城：买异能扣分并升级，余额不足拒绝，超现实奇物不进资产账本', () => {
  let s = initial();
  s.wheel.starPoints = 1000;
  const tierBefore = tierBasis(s);
  const assetsBefore = Object.keys(s.finance.assets).length;

  s = run(s, 'PLAYER_SHOP_BUY', { catalogId: 'ab_micro' });
  assert.equal(s.wheel.starPoints, 650);
  assert.deepEqual(s.user.abilities.map((a) => [a.abilityId, a.level]), [['ab_micro', 1]]);

  s = run(s, 'PLAYER_SHOP_BUY', { catalogId: 'ab_micro' });
  assert.equal(s.user.abilities[0].level, 2);
  assert.equal(s.wheel.starPoints, 650 - 280);

  s = run(s, 'PLAYER_SHOP_BUY', { catalogId: 'it_whisky' });
  const surreal = Object.values(s.inventory).filter((i) => i.category === 'SURREAL_ITEM');
  assert.equal(surreal.length, 1);
  assert.equal(surreal[0].source, 'SHOP');
  assert.equal(Object.keys(s.finance.assets).length, assetsBefore, '奇物不得进资产账本');
  assert.equal(tierBasis(s), tierBefore, '奇物不得改变身家');

  const poor = JSON.parse(JSON.stringify(s));
  poor.wheel.starPoints = 10;
  assert.throws(() => run(poor, 'PLAYER_SHOP_BUY', { catalogId: 'ab_stop' }), /INSUFFICIENT_POINTS/);
});

test('rc.35 商城：3600 分直兑 TOY·LINK 解锁位，且不能重复买', () => {
  let s = initial();
  s.wheel.starPoints = 4000;
  s = run(s, 'PLAYER_SHOP_BUY', { catalogId: 'it_toylink' });
  assert.equal(s.wheel.toyLinkUnlocked, true);
  assert.equal(s.wheel.starPoints, 400);
  assert.throws(() => run(s, 'PLAYER_SHOP_BUY', { catalogId: 'it_toylink' }), /INSUFFICIENT_POINTS|SHOP_ALREADY_OWNED/);
});

test('rc.35 投影：异能、奇物、今日日程字段按需出现', () => {
  let s = initial();
  s.wheel.starPoints = 2000;
  s = run(s, 'PLAYER_SHOP_BUY', { catalogId: 'ab_sober' });
  const p = projection(s);
  assert.equal(p.userAbilities.length, 1);
  assert.equal(p.userAbilities[0].tag, '千杯不醉');
  assert.equal(p.schemaVersion, 3);
});
