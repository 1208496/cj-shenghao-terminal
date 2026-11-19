import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { z } from 'zod';
import { createSchema } from '../src/runtime/schema.js';
import { completeInitialState, replayPlayerCommand } from '../src/runtime/settlement.js';
import { applyOperation } from '../src/core/engine.js';
import { fresh, anchor } from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => schemas.state.parse(completeInitialState(fresh(), { startDate: '2026-01-05', startTime: '09:00' }));
const rich = () => schemas.state.parse(completeInitialState(fresh({ initialCashCents: 600000000 }), { startDate: '2026-01-05', startTime: '09:00' }));
const run = (s, type, extra = {}) => applyOperation(s, { type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra }, anchor());
const withCard = (s, { rarity = 'gray', points = 20, cardId = 'card_t', poolTier = 'low', ...rest } = {}) => {
  s.inventory = { ...s.inventory, [cardId]: { itemId: cardId, source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_' + rarity, cardCode: `${rarity}_1`, poolTier, serialNo: 7, locked: false, rarity, obtainedDate: s.world.date, status: 'READY', currentPoints: points, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null, ...rest } };
  return s;
};
const withPrize = (s, { itemId = 'item_t', status = 'READY' } = {}) => {
  s.inventory = { ...s.inventory, [itemId]: { itemId, source: 'WHEEL', category: 'WHEEL_PRIZE', refId: 'w01', rarity: 'gray', obtainedDate: s.world.date, status, currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null } };
  return s;
};

// ---------- 卡包抽卡 ----------
test('rc.37 低阶星尘卡包：开局零门槛，一包 3 张，只出灰/红，记编号与图鉴', () => {
  const s0 = initial();
  const s1 = run(s0, 'PLAYER_PACK_DRAW', { poolTier: 'low' });
  const cards = Object.values(s1.inventory).filter((i) => i.category === 'WISH_CARD');
  assert.equal(cards.length, 3, '一包固定 3 张');
  for (const c of cards) {
    assert(['gray', 'red'].includes(c.rarity));
    assert.equal(c.poolTier, 'low');
    assert(c.currentPoints === 10 || c.currentPoints === 30);
    assert(c.serialNo >= 1, '每张卡都有铸造编号');
    assert(/^(gray|red)_[123]$/.test(c.cardCode));
  }
  assert.equal(s1.wheel.lowPackTodayFreeUsed, true);
  assert.equal(s1.user.cashCents, s0.user.cashCents, '免费包不扣钱');
  assert.equal(s1.wheel.cardSerialSeq, 3);
  assert.equal(s1.wheel.discoveredCardCodes.length, new Set(cards.map((c) => c.cardCode)).size);
});

test('rc.37 低阶星尘卡包：免费之后按 2000/5000 扣现金，第 4 包被拦', () => {
  let s = run(initial(), 'PLAYER_PACK_DRAW', { poolTier: 'low' });
  const before = s.user.cashCents;
  s = run(s, 'PLAYER_PACK_DRAW', { poolTier: 'low' });
  assert.equal(s.user.cashCents, before - 200000);
  s = run(s, 'PLAYER_PACK_DRAW', { poolTier: 'low' });
  assert.equal(s.wheel.lowPackTodayPaid, 2);
  assert.throws(() => run(s, 'PLAYER_PACK_DRAW', { poolTier: 'low' }), /LOW_PACK_DAILY_LIMIT/);
  const memo = Object.values(s.finance.ledger).filter((l) => l.kind === 'WISH_WHEEL_SPIN');
  assert.equal(memo.length, 2, '两次现金启封各写一笔流水');
});

test('rc.37 高阶圣典卡包：未解锁拒绝；解锁后 3 张高阶卡且计入今日次数', () => {
  assert.throws(() => run(initial(), 'PLAYER_PACK_DRAW', { poolTier: 'high' }), /WISH_LOCKED/);
  const s1 = run(rich(), 'PLAYER_PACK_DRAW', { poolTier: 'high' });
  const cards = Object.values(s1.inventory).filter((i) => i.category === 'WISH_CARD');
  assert.equal(cards.length, 3);
  for (const c of cards) assert([20, 60, 200, 800].includes(c.currentPoints));
  assert.equal(s1.wheel.wishTodaySpins, 1);
  assert.equal(s1.wheel.wishWeekFreeUsed, true);
});

test('rc.37 旧 PLAYER_CARD_DRAW 仍可调用，返回压轴卡的单卡字段', () => {
  const s1 = run(rich(), 'PLAYER_CARD_DRAW');
  assert(s1.operationHistory[Object.keys(s1.operationHistory).at(-1)].result.rarity);
  assert.equal(Object.values(s1.inventory).filter((i) => i.category === 'WISH_CARD').length, 3);
});

// ---------- 低阶卡进赌场：禁绿格 + 240 封顶 ----------
test('rc.37 低阶星尘卡：禁押翡翠格、可达 240 封顶后不可再加押', () => {
  let s = withCard(initial(), { rarity: 'red', points: 30, poolTier: 'low' });
  assert.throws(() => run(s, 'PLAYER_CASINO_BET', { cardId: 'card_t', betColor: 'green' }), /LOW_CARD_NO_GREEN/);
  s = withCard(initial(), { rarity: 'red', points: 240, poolTier: 'low' });
  assert.throws(() => run(s, 'PLAYER_CASINO_BET', { cardId: 'card_t', betColor: 'red' }), /LOW_CARD_CAPPED/);
});

test('rc.37 低阶星尘卡：赢分被 240 硬封顶，永远不会超过', () => {
  const base = withCard(initial(), { rarity: 'red', points: 200, poolTier: 'low' });
  for (const betColor of ['red', 'black']) {
    const snap = JSON.parse(JSON.stringify(base));
    let out;
    try { out = run(snap, 'PLAYER_CASINO_BET', { cardId: 'card_t', betColor }); } catch { continue; }
    if (out.inventory.card_t) assert(out.inventory.card_t.currentPoints <= 240, '低阶卡赢分不得超过 240');
  }
});

test('rc.37 高阶卡仍是 2 倍无上限，押绿可用', () => {
  const s = withCard(initial(), { rarity: 'gold', points: 200, poolTier: 'high' });
  const outs = ['red', 'black', 'green'].map((betColor) => {
    try { return run(JSON.parse(JSON.stringify(s)), 'PLAYER_CASINO_BET', { cardId: 'card_t', betColor }); } catch (e) { throw e; }
  });
  assert(outs.some((o) => o.inventory.card_t && o.inventory.card_t.currentPoints > 200), '高阶卡能翻倍');
});

// ---------- 珍藏锁 ----------
test('rc.37 珍藏锁：锁上后不能押注也不能兑换，解锁后恢复', () => {
  let s = withCard(initial(), { rarity: 'gold', points: 200, poolTier: 'high' });
  s = run(s, 'PLAYER_CARD_LOCK', { cardId: 'card_t', locked: true });
  assert.equal(s.inventory.card_t.locked, true);
  assert.throws(() => run(s, 'PLAYER_CASINO_BET', { cardId: 'card_t', betColor: 'red' }), /CARD_LOCKED/);
  assert.throws(() => run(s, 'PLAYER_CARD_REDEEM', { cardId: 'card_t' }), /CARD_LOCKED/);
  s = run(s, 'PLAYER_CARD_LOCK', { cardId: 'card_t', locked: false });
  const done = run(s, 'PLAYER_CARD_REDEEM', { cardId: 'card_t' });
  assert.equal(done.inventory.card_t, undefined);
});

// ---------- 玩法券 → 日程 → 核销 ----------
test('rc.37 玩法券：排入日程锁成 SCHEDULED，取消日程当场退回 READY', () => {
  let s = withPrize(initial());
  const used = run(s, 'PLAYER_USE_WHEEL_PRIZE', { itemId: 'item_t', date: '2026-01-06', time: '10:30', location: '云澜市·温泉山庄', notes: '记得带伞', participants: ['char_a'] });
  const appt = Object.values(used.calendar.appointments).at(-1);
  assert.equal(used.inventory.item_t.status, 'SCHEDULED');
  assert.equal(used.inventory.item_t.scheduledAppointmentId, appt.id);
  assert.equal(appt.sourceItemId, 'item_t');
  assert.deepEqual(used.inventory.item_t.targetCharacterIds, ['char_a']);

  const cancelled = replayPlayerCommand(used, { kind: 'appointment', operationId: crypto.randomUUID(), value: { ...appt, status: 'CANCELLED' } }, anchor(), schemas);
  assert.equal(cancelled.inventory.item_t.status, 'READY', '取消日程后券退回');
  assert.equal(cancelled.inventory.item_t.scheduledAppointmentId, null);

  const completed = replayPlayerCommand(used, { kind: 'appointment', operationId: crypto.randomUUID(), value: { ...appt, status: 'COMPLETED' } }, anchor(), schemas);
  assert.equal(completed.inventory.item_t.status, 'USED', '日程完成即核销');
  assert.equal(completed.inventory.item_t.usedDate, completed.world.date);

  assert.throws(() => run(used, 'PLAYER_USE_WHEEL_PRIZE', { itemId: 'item_t', date: '2026-01-07', time: '09:00', location: 'x' }), /ITEM_NOT_READY/);
});

// ---------- 奇物使用 ----------
test('rc.37 奇物：窥心镜解暗伤门槛、香水给在场女性 +25 情欲、消耗后变 USED', () => {
  let s = initial();
  s.inventory = { ...s.inventory, it1: { itemId: 'it1', source: 'SHOP', category: 'SURREAL_ITEM', refId: 'it_mirror', rarity: 'gold', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null } };
  s.scene = { ...s.scene, presentCharacterIds: ['char_a'] };
  s.characters.char_a.arousal = 10;
  const used = run(s, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'it1', targetCharacterId: 'char_a' });
  assert.equal(used.inventory.it1.status, 'USED');
  assert(used.wheel.unlockedSecretPages.includes('char_a'));

  const p = JSON.parse(JSON.stringify(s));
  p.inventory.it2 = { ...p.inventory.it1, itemId: 'it2', refId: 'it_perfume', rarity: 'rainbow' };
  const perfume = run(p, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'it2' });
  assert.equal(perfume.characters.char_a.arousal, 35);
  assert.equal(perfume.inventory.it2.status, 'USED');

  const none = { ...s, scene: { ...s.scene, presentCharacterIds: [] } };
  none.inventory = { ...none.inventory, it3: { ...none.inventory.it1, itemId: 'it3', refId: 'it_perfume' } };
  assert.throws(() => run(none, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'it3' }), /NO_PRESENT_CHARACTER/);
});

test('rc.37 奇物：持久型不可消耗使用', () => {
  const s = initial();
  s.inventory = { ...s.inventory, it9: { itemId: 'it9', source: 'SHOP', category: 'SURREAL_ITEM', refId: 'it_choker', rarity: 'rainbow', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null } };
  assert.throws(() => run(s, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'it9' }), /ITEM_NOT_READY/);
});

// ---------- 结构断言：四个缺陷的落点 ----------
test('rc.37 落点高亮：黄框挂在每个环组内，开转先清高亮', () => {
  const frame = fs.readFileSync('src/ui/wheel-frame.js', 'utf8');
  assert(frame.includes('`${wedge('), '每个环组末尾都要带自己的 hit-wedge');
  assert(frame.includes('const wedge = ('));
  assert(!frame.includes("svg.querySelector('.hit-wedge')"), '不得再用顶层单条黄框');
  assert(frame.includes('clearHit();\n  hideResult();'), '每个玩法开转前先清高亮');
  assert(!frame.includes('lastIndexOf'), '星愿盘双口径已删除');
});

test('rc.37 折叠条高度账与弹窗叉号居中', () => {
  const css = fs.readFileSync('src/ui/style.css', 'utf8');
  assert(css.includes('body.is-folded-bar'), '折叠态必须锁 overflow');
  assert(css.includes('.folded.folded-bar{box-sizing:border-box!important;height:52px!important'), '折叠条 52px + 2×2 边框 = 56');
  assert(css.includes('.modal-close span{'), '叉号要有独立字形层做居中');
  const host = fs.readFileSync('src/runtime/host.js', 'utf8');
  assert(host.includes('isBar?56'), 'iframe 折叠视口必须是 56px');
  const app = fs.readFileSync('src/ui/app.js', 'utf8');
  assert(app.includes("api.geometry?.({width:365,height:56})"));
  assert(app.includes("document.body.classList.add('is-folded-bar')"));
});

test('rc.37 三页：轮盘页不再有第二层标题，背包商城都带分类', () => {
  const screens = fs.readFileSync('src/ui/screens.js', 'utf8');
  assert(!screens.includes('wheel-wallet'), '旧钱包卡已合并为顶部胶囊条');
  assert(!screens.includes('wheels.hub.title'), '页面内不再重复标题');
  assert(screens.includes("data-open-wheel=\\\"pack\\\"") || screens.includes('data-open-wheel="pack"'));
  const app = fs.readFileSync('src/ui/app.js', 'utf8');
  assert(app.includes('segTabs('), '背包与商城都要有分段切换');
  assert(app.includes("bagTab = 'cards'") && app.includes("shopTab = 'ability'"));
  assert(app.includes('PLAYER_USE_WHEEL_PRIZE') && app.includes('PLAYER_USE_SURREAL_ITEM'));
});

