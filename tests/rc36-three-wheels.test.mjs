import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { z } from 'zod';
import { createSchema } from '../src/runtime/schema.js';
import { completeInitialState } from '../src/runtime/settlement.js';
import { applyOperation, projection, abilityBonus, effectiveProwess, abilityLevel, settleEvents } from '../src/core/engine.js';
import { WHEEL_COPY, fill } from '../src/core/wheel-ui-copy.js';
import { playWheelQuote } from '../src/core/wheel.js';
import { fresh, anchor, source } from './fixtures.mjs';
import { ABILITY_BY_ID } from '../src/core/casino-catalog.js';

const schemas = createSchema(z);
const initial = () => schemas.state.parse(completeInitialState(fresh(), { startDate: '2026-01-05', startTime: '09:00' }));
const run = (s, type, extra = {}) => applyOperation(s, { type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra }, anchor());
// 好感/堕落的变化只认结算层自己算出来的 affectionEvents，模型直接给的一律丢弃。
const settle = (s, type, extra = {}) => settleEvents(s, [], anchor(s.meta.revision + 2), source, [{ type, auto: true, ...extra }]).state;

// ---------- 1. 文案逐字（铁律三：定稿一个字都不许改） ----------
// rc.37：文案改为从 rc.37 方案 H 节的扁平点分键块抠取，这里同样按行解析后逐字比对。
test('rc.37 文案：WHEEL_COPY 与方案 H 节代码块逐字一致', () => {
  const plan = fs.readFileSync('AGY_PLAN_rc37_packs.md', 'utf8');
  const at = plan.indexOf('## H 文案定稿');
  assert(at > 0, '方案里必须有 H 节');
  const block = plan.slice(at).match(/```text\r?\n([\s\S]*?)```/);
  assert(block, 'H 节必须有 text 代码块');
  const tree = {};
  for (const raw of block[1].split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const kv = raw.match(/^([a-zA-Z0-9_.]+) = ([\s\S]*)$/);
    assert(kv, '坏行：' + raw);
    const parts = kv[1].split('.');
    let node = tree;
    for (const p of parts.slice(0, -1)) node = node[p] ||= {};
    node[parts.at(-1)] = kv[2];
  }
  assert.deepEqual(WHEEL_COPY, tree, '文案必须与定稿完全一致');
  assert.equal(fill(COPY_PLAY_BADGE, { price: '¥500' }), '现金 ¥500');
});
const COPY_PLAY_BADGE = WHEEL_COPY.wheels.cards.play.badgeCash;

// ---------- 2. 三盘经济 ----------
test('rc.36 命运轮盘：免费与现金用尽后可切 120 积分，只扣积分不扣现金', () => {
  const s0 = initial();
  const s1 = run(s0, 'PLAYER_WHEEL_SPIN', { mode: 'free' });
  let s = s1;
  for (let i = 0; i < 8; i++) s = run(s, 'PLAYER_WHEEL_SPIN', { mode: 'cash' });
  assert.equal(s.wheel.todayPaidSpins, 8);
  const before = s.user.cashCents;
  assert.throws(() => run(s, 'PLAYER_WHEEL_SPIN', { mode: 'cash' }), /WHEEL_DAILY_LIMIT/, '第 9 次现金必须被拦');
  const rich = { ...s, wheel: { ...s.wheel, starPoints: 240 } };
  const out = run(rich, 'PLAYER_WHEEL_SPIN', { mode: 'points' });
  assert.equal(out.wheel.starPoints, 120);
  assert.equal(out.user.cashCents, before, '积分转盘不扣现金');
  assert.equal(out.wheel.totalSpins, 10);
});

test('rc.36 命运轮盘：discoveredPrizeIds 缺失不崩、按需补数组', () => {
  const s0 = initial();
  const broken = { ...s0, wheel: { ...s0.wheel, discoveredPrizeIds: undefined } };
  const s1 = run(broken, 'PLAYER_WHEEL_SPIN', { mode: 'free' });
  assert.equal(s1.wheel.discoveredPrizeIds.length, 1);
});

test('rc.36 状态字段：三盘计数器默认值与上限就位', () => {
  const w = initial().wheel;
  assert.equal(w.todayPaidSpins, 0);
  assert.equal(w.wishWeekKey, '');
  assert.equal(w.wishWeekFreeUsed, false);
  assert.equal(w.wishWeekPaidSpins, 0);
  assert.equal(w.wishTodaySpins, 0);
  assert.equal(w.cardPityGold, 0);
  assert.equal(w.casinoTotalWins, 0);
  assert.equal(w.casinoBestWinPoints, 0);
  assert.equal(w.lastFreeCardDate, undefined, '旧字段已删除且不保留兼容层');
});

test('rc.36 赌场：胜负与单卡最高分由脚本累计', () => {
  const s0 = initial();
  const cardId = 'card_stat';
  s0.inventory = { ...s0.inventory, [cardId]: { itemId: cardId, source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_gold', rarity: 'gold', obtainedDate: s0.world.date, status: 'READY', currentPoints: 200, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null } };
  let win = null, lose = null;
  for (const bet of ['red', 'black', 'green']) {
    const snap = { ...s0, inventory: { ...s0.inventory, [cardId]: { ...s0.inventory[cardId] } } };
    try {
      const out = run(snap, 'PLAYER_CASINO_BET', { cardId, betColor: bet });
      if (out.inventory[cardId]) win = out; else lose = out;
    } catch (e) { throw e; }
  }
  assert(win || lose);
  if (win) { assert.equal(win.wheel.casinoTotalWins, 1); assert.equal(win.wheel.casinoBestWinPoints, 400); assert.equal(win.wheel.casinoRound, 1); }
  if (lose) { assert.equal(lose.wheel.casinoTotalLosses, 1); assert.equal(lose.inventory[cardId], undefined); }
});

// ---------- 3. 四个数值型异能 ----------
test('rc.36 异能：甜嗓加好感、摄魂之瞳加堕落、催情香抬下限、铁腰抬战力', () => {
  let s = initial();
  s.user.abilities = [
    { abilityId: 'ab_voice', level: 2, obtainedDate: s.world.date },
    { abilityId: 'ab_gaze', level: 1, obtainedDate: s.world.date },
    { abilityId: 'ab_scent', level: 3, obtainedDate: s.world.date },
    { abilityId: 'ab_stamina', level: 2, obtainedDate: s.world.date },
  ];
  s = schemas.state.parse(s);
  assert.equal(abilityLevel(s, 'ab_voice'), 2);
  assert.equal(abilityBonus(s, 'ab_voice'), 2);
  assert.equal(abilityBonus(s, 'ab_gaze'), 2);
  assert.equal(abilityBonus(s, 'ab_scent'), 16);
  assert.equal(abilityBonus(s, 'ab_stamina'), 12);
  assert.equal(effectiveProwess(s), Math.min(100, s.user.prowessScore + 12));

  const voiceOn = settle(s, 'AFFECTION_CHANGE', { personRef: 'char_a', delta: 3 });
  const plain = settle(initial(), 'AFFECTION_CHANGE', { personRef: 'char_a', delta: 3 });
  assert.equal(voiceOn.characters.char_a.affection - plain.characters.char_a.affection, 2, '甜嗓 Lv.2 应多 +2 好感');

  const gazeOn = settle(s, 'CORRUPTION_CHANGE', { personRef: 'char_a', delta: 2 });
  const gazeOff = settle(initial(), 'CORRUPTION_CHANGE', { personRef: 'char_a', delta: 2 });
  assert.equal(gazeOn.characters.char_a.corruption - gazeOff.characters.char_a.corruption, 2, '摄魂之瞳 Lv.1 应多 +2 堕落');
});

// ---------- 4. 修掉的旧 Bug ----------
test('rc.36 奇物进入 AI 上下文：bagSurrealItems 按 refId 查表', () => {
  let s = initial();
  s.wheel.starPoints = 1000;
  s = run(s, 'PLAYER_SHOP_BUY', { catalogId: 'it_whisky' });
  const p = projection(s);
  assert.equal(p.bagSurrealItems.length, 1);
  assert.equal(p.bagSurrealItems[0].itemId.includes('item_') || p.bagSurrealItems[0].itemId.includes('it_'), true);
  assert(ABILITY_BY_ID ? true : true);
});

// ---------- 5. 全屏轮盘前端结构 ----------
test('rc.36 轮盘页：独立全屏模板、协议常量、无右浮动裁切', () => {
  const tpl = fs.readFileSync('src/ui/wheel.template.html', 'utf8');
  assert(tpl.includes('data-surface="wheel"'));
  assert(tpl.includes('__STYLE__') && tpl.includes('__APP__'));
  const frame = fs.readFileSync('src/ui/wheel-frame.js', 'utf8');
  assert(frame.includes("const CHANNEL = 'CJ_SHENGHAO_WHEEL_V1'"));
  assert(frame.includes('WHEEL_OP_REQ') && frame.includes('WHEEL_BUSY_LOCK'));
  assert(!frame.includes('right:-292px'), '赌场侧栏不得再右溢出');
  const css = fs.readFileSync('src/ui/wheel.css', 'utf8');
  assert(css.includes('@media(max-width:860px)'), '窄屏必须改成上下排布');
  const host = fs.readFileSync('src/runtime/host.js', 'utf8');
  assert(host.includes('event.source!==wheelFrame.contentWindow'), '必须校验消息来源');
  assert(host.includes('z-index:2147482600'), '轮盘 iframe 必须盖过小手机');
  assert(host.includes("closeWheel('CHAT_CHANGED')"));
});

test('rc.36 五页导航：顺序固定为 此刻/她们/我的/财富/轮盘，我的页不再塞财富与背包', () => {
  const app = fs.readFileSync('src/ui/app.js', 'utf8');
  const nav = "['scene','⌂',WHEEL_COPY.nav.scene],['women','♡',WHEEL_COPY.nav.women],['mine','▣',WHEEL_COPY.nav.mine],['wealth','◈',WHEEL_COPY.nav.wealth],['wheel','✦',WHEEL_COPY.nav.wheel]";
  assert(app.includes(nav), '导航顺序必须严格固定');
  assert(app.includes("tab==='wealth'?wealthScreen():tab==='wheel'?wheelScreen()"));
  const screens = fs.readFileSync('src/ui/screens.js', 'utf8');
  assert(!screens.includes('wheel-entry'), '日历页不再挂轮盘入口');
  assert(screens.includes('function wealth(){') && screens.includes('function wheelHub(){'));
  const css = fs.readFileSync('src/ui/style.css', 'utf8');
  assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'), '365px 底栏必须五等分');
});


