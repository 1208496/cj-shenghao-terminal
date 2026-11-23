// rc.55：修掉 codex 审查里三条不触经济口径的缺陷。
// 依据 reports/rc54-codex审查最新整卡BUG-20261123.md §二 / §三，清单 .work/checklist-rc55-bugfix.md。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { z } from 'zod';
import { createSchema } from '../src/runtime/schema.js';
import { completeInitialState, settleNative, prepareModelCommand } from '../src/runtime/settlement.js';
import { applyOperation, clone, requireRule } from '../src/core/engine.js';
import { fresh, anchor, source, payment, event } from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => schemas.state.parse(completeInitialState(fresh(), { startDate: '2026-01-05', startTime: '09:00' }));
const run = (s, type, extra = {}) => applyOperation(s, { type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra }, anchor());
const settle = (before, pendingEvents, body = '本轮正文') => { const candidate = clone(before); candidate.pendingEvents = pendingEvents; return settleNative(before, candidate, anchor(), body, schemas); };

// ---------- F-01 / B-08：商城历史写满 200 条后不得锁死购买 ----------
test('rc.55 B-08 商城历史已有 200 条时仍能购买，且历史只保留最近 200 条', () => {
  const s0 = initial();
  s0.wheel.starPoints = 10000000;
  s0.wheel.shopHistory = Array.from({ length: 200 }, (_, i) => ({ purchaseId: 'old_' + i, catalogId: 'it_perfume', costPoints: 1, date: s0.world.date }));
  const pointsBefore = s0.wheel.starPoints;

  const s1 = run(s0, 'PLAYER_SHOP_BUY', { operationId: 'op_201', catalogId: 'it_perfume' });

  // 修复前：历史变 201 条 → 这一行抛 too_big，整个操作被拒，此后永远买不了。
  assert.doesNotThrow(() => schemas.state.parse(s1), '第 201 次购买必须能通过 state 校验');
  assert.equal(s1.wheel.shopHistory.length, 200, '历史长度恒定为 200');
  assert.equal(s1.wheel.shopHistory.at(-1).purchaseId, 'op_201', '最新一笔在最末位');
  assert.equal(s1.wheel.shopHistory[0].purchaseId, 'old_1', '最旧一笔被挤出');
  const spent = pointsBefore - s1.wheel.starPoints;
  assert.ok(spent > 0, '确实扣了分');
  const pointsMid = s1.wheel.starPoints;
  const s2 = run(s1, 'PLAYER_SHOP_BUY', { catalogId: 'it_perfume' });
  assert.equal(pointsMid - s2.wheel.starPoints, spent, '同一商品单价固定，截断不影响经济口径');
});

test('rc.55 B-08 连续再买 120 次仍全部成功，不会在第 201 次之后永久卡死', () => {
  let s = initial();
  s.wheel.starPoints = 10000000;
  s.wheel.shopHistory = Array.from({ length: 200 }, (_, i) => ({ purchaseId: 'old_' + i, catalogId: 'it_perfume', costPoints: 1, date: s.world.date }));
  const startPoints = s.wheel.starPoints;
  let spent = 0;
  for (let i = 0; i < 120; i++) {
    const before = s.wheel.starPoints;
    s = run(s, 'PLAYER_SHOP_BUY', { catalogId: 'it_perfume' });
    assert.doesNotThrow(() => schemas.state.parse(s), `第 ${201 + i} 次购买必须成功`);
    assert.equal(s.wheel.shopHistory.length, 200);
    spent += before - s.wheel.starPoints;
  }
  assert.equal(s.wheel.starPoints, startPoints - spent, '每次扣分与历史条数互不影响');
  assert.equal(s.wheel.shopHistory.at(-1).purchaseId !== undefined, true);
});

// ---------- F-03 / B-06：整对象 replace 不得抹掉脚本独占的装置字段 ----------
test('rc.55 B-06 模型整对象 replace 带 choker:null 时，已佩戴项圈必须保留', () => {
  const before = initial();
  before.wheel.chokerUnlocked = true;
  const worn = { worn: true, styleId: 'rose_gold_lock', inscription: '私有', wornDate: '2026-01-05' };
  before.characters.char_a.choker = worn;

  const candidate = clone(before);
  candidate.characters.char_a.choker = null;
  candidate.characters.char_a.imprints = null;
  candidate.characters.char_a.occupation = '画廊主理人';

  const { state, diagnostics } = settleNative(before, candidate, anchor(), source, schemas);

  assert.deepEqual(state.characters.char_a.choker, worn, '已佩戴项圈不得被整对象提交抹掉');
  assert.equal(state.characters.char_a.occupation, '画廊主理人', '同轮的正常字段改动仍要生效');
  assert.deepEqual(diagnostics, []);
});

test('rc.55 B-06 未佩戴人物的 choker 保持 null，保护不会凭空造出装置', () => {
  const before = initial();
  before.wheel.chokerUnlocked = true;
  assert.equal(before.characters.char_a.choker, null);
  const candidate = clone(before);
  candidate.characters.char_a.choker = { worn: true, styleId: 'crimson_thorn', inscription: '偷穿', wornDate: '2026-01-05' };

  const { state } = settleNative(before, candidate, anchor(), source, schemas);
  assert.equal(state.characters.char_a.choker, null, '模型不能自己给人物戴上项圈');
});

// ---------- F-02 / B-02：摘要计算期间切聊天，不得写入任何楼层 ----------
test('rc.55 B-02 摘要计算窗口内切聊天，旧聊天状态不得写入新聊天同号楼层', async () => {
  const hostSource = await fs.readFile(new URL('../src/runtime/host.js', import.meta.url), 'utf8');
  const start = hostSource.indexOf('async function mutateState(');
  const end = hostSource.indexOf('\n});}', start) + 5;
  assert.ok(start > 0 && end > start, '必须能从 host.js 原样抽出 mutateState');

  const liveState = { meta: { revision: 7 }, characters: {} };
  const ctl = { branchKey: 'CHAT_A', messageId: 5, swipeId: 0 };
  const written = [];
  let releaseDigest;
  const gate = new Promise((resolve) => { releaseDigest = resolve; });
  let digestCalls = 0;

  const context = vm.createContext({
    clone, requireRule,
    serial: (fn) => fn(),
    busy: () => false,
    readCurrent: async () => ({ state: clone(liveState), lineage: 'L1', anchor: { branchKey: ctl.branchKey }, message: { message_id: ctl.messageId } }),
    schemas: () => ({ state: { parse: (x) => x } }),
    replayPlayerCommand: (s) => s,
    assertState: () => {},
    refreshContext: () => {},
    messageList: () => [{ message_id: ctl.messageId, swipe_id: ctl.swipeId, message: '本轮正文' }],
    branch: () => ctl.branchKey,
    textOf: (m) => m.message,
    withoutUpdates: (s) => s,
    clean: (s) => String(s).trim(),
    digest: async () => { digestCalls++; await gate; return 'fp'; },
    native: () => ({
      getMvuData: () => ({ stat_data: { shenghao: clone(liveState) } }),
      replaceMvuData: async (vars, opts) => { written.push({ messageId: opts?.message_id, branch: ctl.branchKey }); },
    }),
    rememberOp: () => {},
    stateView: () => 'VIEW',
    poolParts: () => ({}),
    withdrawalQuote: () => 0,
    console: { log: () => {} },
  });

  vm.runInContext(
    `let epoch=0;globalThis.__setEpoch=v=>{epoch=v};\n` + hostSource.slice(start, end) + `\nglobalThis.__mutate=mutateState;`,
    context
  );

  const pending = context.__mutate({ operationId: 'op_1', type: 'PLAYER_STAR' }, 'L1');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(digestCalls, 1, '必须先进入摘要计算窗口');

  // 摘要还没返回，玩家切到另一个聊天：分支变了，CHAT_CHANGED 也让 epoch 自增。
  ctl.branchKey = 'CHAT_B';
  context.__setEpoch(1);
  releaseDigest();

  await assert.rejects(pending, /STALE_SOURCE/);
  assert.equal(written.length, 0, '切聊后不得对任何聊天发起写入');
});

test('rc.55 B-02 全程不切聊天时，正常写入仍然成功', async () => {
  const hostSource = await fs.readFile(new URL('../src/runtime/host.js', import.meta.url), 'utf8');
  const start = hostSource.indexOf('async function mutateState(');
  const end = hostSource.indexOf('\n});}', start) + 5;

  const liveState = { meta: { revision: 7 }, characters: {} };
  const ctl = { branchKey: 'CHAT_A', messageId: 5, swipeId: 0 };
  const written = [];
  let remembered = 0;

  const context = vm.createContext({
    clone, requireRule,
    serial: (fn) => fn(),
    busy: () => false,
    readCurrent: async () => ({ state: clone(liveState), lineage: 'L1', anchor: { branchKey: ctl.branchKey }, message: { message_id: ctl.messageId } }),
    schemas: () => ({ state: { parse: (x) => x } }),
    replayPlayerCommand: (s) => s,
    assertState: () => {},
    refreshContext: () => {},
    messageList: () => [{ message_id: ctl.messageId, swipe_id: ctl.swipeId, message: '本轮正文' }],
    branch: () => ctl.branchKey,
    textOf: (m) => m.message,
    withoutUpdates: (s) => s,
    clean: (s) => String(s).trim(),
    digest: async () => 'fp',
    native: () => ({
      getMvuData: () => ({ stat_data: { shenghao: clone(liveState) } }),
      replaceMvuData: async (vars, opts) => { written.push(opts?.message_id); },
    }),
    rememberOp: () => { remembered++; },
    stateView: () => 'VIEW',
    poolParts: () => ({}),
    withdrawalQuote: () => 0,
    console: { log: () => {} },
  });
  vm.runInContext(
    `let epoch=0;globalThis.__setEpoch=v=>{epoch=v};\n` + hostSource.slice(start, end) + `\nglobalThis.__mutate=mutateState;`,
    context
  );

  const result = await context.__mutate({ operationId: 'op_2', type: 'PLAYER_STAR' }, 'L1');
  assert.equal(result, 'VIEW');
  assert.deepEqual(written, [5], '未切聊时照常写入原楼层');
  assert.equal(remembered, 1, '未切聊时照常记操作日志');
});

// ---------- B-01：YG 2026-11-23 明确「保持原样」，这里守护 rc.25 的零漏单口径 ----------
test('rc.55 B-01 维持 rc.25 口径 · evidence 完全缺失时用正文兜底，零漏单目标不变', () => {
  const before = initial();
  const body = '我把名片递了过去，她收下收好。';
  const { state, diagnostics } = settle(before, [payment({ evidence: undefined })], body);
  assert.ok(state.user.cashCents < before.user.cashCents, '模型没给证据时仍要扣款');
  assert.deepEqual(diagnostics, []);
});

test('rc.55 B-01 维持 rc.25 口径 · 模型改写 evidence 时仍由正文首句兜底，不丢单', () => {
  const before = initial();
  const body = '我把名片递了过去，她收下收好。';
  // 这条在 2026-11-23 一度改成「拒单」，但 YG 当即喊停并决定保持 rc.25 原样：
  // 收紧后模型改写证据的正常单会被静默丢弃（partial 模式不抛错，只进 diagnostics）。
  const { state, diagnostics } = settle(before, [payment({ evidence: '我前几天把那幅一直收着的画卖给画廊了' })], body);
  assert.ok(state.user.cashCents < before.user.cashCents, '改写证据时仍要扣款（零漏单口径）');
  assert.deepEqual(diagnostics, []);
});

test('rc.55 B-01 维持 rc.25 口径 · 正文写了付款、evidence 也对得上时照常扣款', () => {
  const before = initial();
  const body = '我当场转账三万元，替她把欠的账结清。';
  const { state } = settle(before, [payment({ evidence: '我当场转账三万元' })], body);
  assert.ok(state.user.cashCents < before.user.cashCents);
});

// ---------- F-05 / B-05：免费包不得继承上一周期的付费计数 ----------
test('rc.55 B-05 星尘跨日先领免费包：付费计数归零，当天仍可买满 2 包', () => {
  let s = initial();
  s.world.date = '2026-01-05';
  s.wheel = { ...s.wheel, lowPackTodayDate: '2026-01-04', lowPackTodayFreeUsed: true, lowPackTodayPaid: 2 };
  s = run(s, 'PLAYER_PACK_DRAW', { poolTier: 'low' });
  assert.equal(s.wheel.lowPackTodayFreeUsed, true, '新的一天先走免费包');
  assert.equal(s.wheel.lowPackTodayPaid, 0, '付费计数必须按新周期归零');
  const cash = s.user.cashCents;
  s = run(s, 'PLAYER_PACK_DRAW', { poolTier: 'low' });
  assert.equal(s.user.cashCents, cash - 200000, '第一笔付费走首档 ¥2,000');
  assert.equal(s.wheel.lowPackTodayPaid, 1);
  s = run(s, 'PLAYER_PACK_DRAW', { poolTier: 'low' });
  assert.equal(s.wheel.lowPackTodayPaid, 2);
  assert.throws(() => run(s, 'PLAYER_PACK_DRAW', { poolTier: 'low' }), /LOW_PACK_DAILY_LIMIT/);
});

test('rc.55 B-05 圣典跨周先领免费包：首笔付费按首档报价，不再跳第二档', () => {
  let s = schemas.state.parse(completeInitialState(fresh({ initialCashCents: 600000000 }), { startDate: '2026-01-05', startTime: '09:00' }));
  s.wheel = { ...s.wheel, wishWeekKey: '2025-W51', wishWeekFreeUsed: true, wishWeekPaidSpins: 1, wishTodayDate: '2025-12-20', wishTodaySpins: 0 };
  s = run(s, 'PLAYER_PACK_DRAW', { poolTier: 'high' });
  assert.equal(s.wheel.wishWeekFreeUsed, true);
  assert.equal(s.wheel.wishWeekPaidSpins, 0, '周付费次数必须按新周归零');
});

// ---------- F-06 / B-07：同一句证据登记多件资产 ----------
const carGrant = (ordinal, factId, name, assetId, yuan) => event('ASSET_GRANT', {
  ordinal, factId,
  evidence: '他把两把车钥匙推过来：一辆奔驰，一辆保时捷。',
  asset: { assetId, kind: 'CAR', name, bookValueYuan: yuan },
});

test('rc.55 B-07 同一句证据登记两件不同资产时，两件都要入账', () => {
  const body = '他把两把车钥匙推过来：一辆奔驰，一辆保时捷。';
  const { state, diagnostics } = settle(initial(), [
    carGrant(0, 'asset_1', '奔驰 S', 'asset_benz', 500000),
    carGrant(1, 'asset_2', '保时捷 911', 'asset_porsche', 800000),
  ], body);
  const owned = Object.values(state.finance.assets).filter((a) => a.ownerId === 'USER');
  assert.equal(owned.length, 2, '两件资产都要登记');
  assert.deepEqual(owned.map((a) => a.name).sort(), ['保时捷 911', '奔驰 S'].sort());
  assert.deepEqual(diagnostics, []);
});

test('rc.55 B-07 同一件资产同轮重复提案仍然只登记一次', () => {
  const body = '他把两把车钥匙推过来：一辆奔驰，一辆保时捷。';
  const { state } = settle(initial(), [
    carGrant(0, 'asset_1', '奔驰 S', 'asset_benz', 500000),
    carGrant(1, 'asset_1b', '奔驰 S', 'asset_benz', 500000),
  ], body);
  const owned = Object.values(state.finance.assets).filter((a) => a.ownerId === 'USER');
  assert.equal(owned.length, 1, '同资产重复提案不得重复入账');
});

// ---------- F-07 / B-12：多件香水撤销按启用顺序重算 ----------
const perfumeItem = (itemId) => ({
  itemId, source: 'SHOP', category: 'SURREAL_ITEM', refId: 'it_perfume', rarity: 'rainbow',
  obtainedDate: '2026-01-05', status: 'READY', currentPoints: null, winStreak: 0,
  scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null,
});

test('rc.55 B-12 两瓶香水先撤较早那瓶，不得抹掉后一瓶的加成', () => {
  let s = initial();
  s.characters.char_a.arousal = 0;
  s.scene.presentCharacterIds = ['char_a'];
  s.inventory = { ...s.inventory, p_1: perfumeItem('p_1'), p_2: perfumeItem('p_2') };
  s = run(s, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'p_1' });
  assert.equal(s.characters.char_a.arousal, 25);
  s = run(s, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'p_2' });
  assert.equal(s.characters.char_a.arousal, 50);
  s = run(s, 'PLAYER_UNDO_ITEM_USE', { itemId: 'p_1' });
  assert.equal(s.characters.char_a.arousal, 25, '撤较早那瓶后，后一瓶的加成必须留下');
  s = run(s, 'PLAYER_UNDO_ITEM_USE', { itemId: 'p_2' });
  assert.equal(s.characters.char_a.arousal, 0, '全部撤完不得残留加成');
});

test('rc.55 B-12 后进先出撤销也正确，且封顶 100 不会溢出', () => {
  let s = initial();
  s.characters.char_a.arousal = 80;
  s.scene.presentCharacterIds = ['char_a'];
  s.inventory = { ...s.inventory, q_1: perfumeItem('q_1'), q_2: perfumeItem('q_2') };
  s = run(s, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'q_1' });
  assert.equal(s.characters.char_a.arousal, 100, '25 点加成受 100 封顶');
  s = run(s, 'PLAYER_USE_SURREAL_ITEM', { itemId: 'q_2' });
  assert.equal(s.characters.char_a.arousal, 100);
  s = run(s, 'PLAYER_UNDO_ITEM_USE', { itemId: 'q_2' });
  assert.equal(s.characters.char_a.arousal, 100, '撤后一瓶后，前一瓶仍把值顶在 100');
  s = run(s, 'PLAYER_UNDO_ITEM_USE', { itemId: 'q_1' });
  assert.equal(s.characters.char_a.arousal, 80, '全部撤完回到启用前的 80');
});

// ---------- F-08 / B-03：取消过的旧日程不得释放已重排的票券 ----------
const prizeItem = (s, { itemId = 'item_t', status = 'READY' } = {}) => {
  s.inventory = { ...s.inventory, [itemId]: { itemId, source: 'WHEEL', category: 'WHEEL_PRIZE', refId: 'w01', rarity: 'gray', obtainedDate: s.world.date, status, currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null } };
  return s;
};

test('rc.55 B-03 取消 A 并把券重排到 B 后，普通结算不得把券打回 READY', () => {
  let s = initial();
  prizeItem(s);
  s = run(s, 'PLAYER_USE_WHEEL_PRIZE', { itemId: 'item_t', date: '2026-01-06', time: '19:00' });
  const apptA = s.inventory.item_t.scheduledAppointmentId;
  assert.ok(apptA, '先排到 A');
  assert.equal(s.inventory.item_t.status, 'SCHEDULED');

  const cancelled = clone(s);
  cancelled.calendar.appointments[apptA].status = 'CANCELLED';
  s = settle(cancelled, [], '本轮正文').state;
  assert.equal(s.inventory.item_t.status, 'READY', '取消 A 后券退回背包');

  s = run(s, 'PLAYER_USE_WHEEL_PRIZE', { itemId: 'item_t', date: '2026-01-07', time: '20:00' });
  const apptB = s.inventory.item_t.scheduledAppointmentId;
  assert.ok(apptB && apptB !== apptA, '再排到 B');
  assert.equal(s.inventory.item_t.status, 'SCHEDULED');

  const after = settle(s, [], '本轮正文').state;
  assert.equal(after.inventory.item_t.status, 'SCHEDULED', '券必须仍绑定 B，不得被旧日程 A 释放');
  assert.equal(after.inventory.item_t.scheduledAppointmentId, apptB);
  assert.equal(after.calendar.appointments[apptB].status, 'PLANNED', 'B 仍是有效约定');
});

test('rc.55 B-03 正常完成 B 时券照常核销', () => {
  let s = initial();
  prizeItem(s);
  s = run(s, 'PLAYER_USE_WHEEL_PRIZE', { itemId: 'item_t', date: '2026-01-06', time: '19:00' });
  const appt = s.inventory.item_t.scheduledAppointmentId;
  const done = clone(s);
  done.calendar.appointments[appt].status = 'COMPLETED';
  s = settle(done, [], '本轮正文').state;
  assert.equal(s.inventory.item_t.status, 'USED', '完成的日程照常核销');
});

// ---------- F-09 / B-04：新人物 id 必须等于路径键 ----------
// newCharacter 的默认骨架（beautyScore/affection/relationshipLabel 是必填，无 default）。
const person = (id, extra = {}) => schemas.character.parse({ id, name: '新出现的人', age: 27, beautyScore: null, affection: 20, corruption: 0, relationshipLabel: '熟人', occupation: '', ...extra });
test('rc.55 B-04 新人物对象自带不同 id 时，prepareModelCommand 把 id 纠正成路径键', () => {
  const before = initial();
  const command = { type: 'set', args: ['shenghao.characters.char_new', JSON.stringify({ id: 'char_other', name: '新出现的人', age: 27 })] };
  assert.equal(prepareModelCommand(command, before, schemas), true);
  const written = JSON.parse(command.args[command.args.length - 1]);
  assert.equal(written.id, 'char_new', '人物 id 必须等于落库键');
  assert.equal(written.name, '新出现的人');
});

test('rc.55 B-04 已落库的人物对象 id 与键不一致时，结算会把它纠正成键值', () => {
  const before = initial();
  const candidate = clone(before);
  candidate.characters.char_new = { ...person('char_new'), id: 'char_other' };
  const { state } = settleNative(before, candidate, anchor(), source, schemas);
  assert.equal(state.characters.char_new.id, 'char_new', 'id 必须收敛到路径键，否则经济校验会 UNKNOWN_PERSON');
});

test('rc.55 B-04 新人物的同轮正常字段仍完整落库', () => {
  const before = initial();
  const candidate = clone(before);
  candidate.characters.char_new = person('char_new');
  candidate.characters.char_new.occupation = '独立策展人';
  candidate.characters.char_new.personalityTags = ['冷淡', '敏锐'];
  const { state, diagnostics } = settleNative(before, candidate, anchor(), source, schemas);
  assert.equal(state.characters.char_new.occupation, '独立策展人');
  assert.deepEqual(state.characters.char_new.personalityTags, ['冷淡', '敏锐']);
  assert.deepEqual(diagnostics, []);
});

// ---------- F-10 / B-10：项圈工坊编辑控件必须读草稿 ----------
test('rc.55 B-10 已佩戴人物点换款后，选中态与预览显示草稿而不是落库值', async () => {
  const { renderChoker } = await import('../src/ui/workshop.js');
  const s = initial();
  s.wheel.chokerUnlocked = true;
  s.characters.char_a.choker = { worn: true, styleId: 'obsidian_velvet', inscription: '旧刻字', wornDate: '2026-01-05' };
  const html = renderChoker({ state: s, ui: { charId: 'char_a', chokerDraft: { styleId: 'crimson_thorn', inscription: '新刻字' } } });
  const onStyle = html.match(/class="choker-style-btn on"[^>]*data-ws-style="([^"]+)"/);
  assert.ok(onStyle, '必须有一个选中款');
  assert.equal(onStyle[1], 'crimson_thorn', '选中态必须落在草稿款上');
  assert.ok(html.includes('value="新刻字"'), '刻字输入框必须显示草稿值');
  assert.ok(!html.includes('value="旧刻字"'), '不得回退显示落库值');
});

test('rc.55 B-10 没有草稿时回落落库值，未佩戴时回落默认款', async () => {
  const { renderChoker } = await import('../src/ui/workshop.js');
  const s = initial();
  s.wheel.chokerUnlocked = true;
  s.characters.char_a.choker = { worn: true, styleId: 'rose_gold_lock', inscription: '原样', wornDate: '2026-01-05' };
  const html = renderChoker({ state: s, ui: { charId: 'char_a' } });
  const onStyle = html.match(/class="choker-style-btn on"[^>]*data-ws-style="([^"]+)"/);
  assert.equal(onStyle[1], 'rose_gold_lock');
  assert.ok(html.includes('value="原样"'));
});

// ---------- F-11 / B-14：注释形式的后代选择器不得再出现 ----------
test('rc.55 B-14 项圈工坊容器选择器不再被注释切成后代选择器', async () => {
  const css = await fs.readFile(new URL('../src/ui/style.css', import.meta.url), 'utf8');
  assert.ok(!/\.workshop-page\.is-choker\s*\/\*[^*]*\*\/\s*\.workshop-page\.is-choker\s*\{/.test(css), '不得再有「类嵌自身」的失效选择器');
  assert.ok(/^\.workshop-page\.is-choker\{/m.test(css), '容器规则必须是单层选择器');
});

// ---------- F-12 / B-09 与 F-13 / B-13：跨聊天与会话生命周期的结构守护 ----------
// 这两条的正确性最终只能在真酒馆验证，这里守的是「关键调用不得被删掉或改回旧顺序」。
test('rc.55 B-09 切聊回调必须先让 current 失效，再通知 TOY 桥', async () => {
  const src = await fs.readFile(new URL('../src/runtime/host.js', import.meta.url), 'utf8');
  const start = src.indexOf("on(events.CHAT_CHANGED,");
  const body = src.slice(start, src.indexOf('});', start) + 3);
  const invalidate = body.indexOf('current=null');
  const notify = body.indexOf('toyLink.onBranchChange()');
  assert.ok(invalidate > 0 && notify > 0);
  assert.ok(invalidate < notify, 'current=null 必须早于 onBranchChange，否则桥会在旧 state 上重建注入');
  assert.ok(body.includes('toyLink.onLiteGenerationEnded()'), '新 state 读回来后必须恢复持续态注入');
});

test('rc.55 B-09 桥的 onBranchChange 必须清掉上一个聊天的事件态', async () => {
  const src = await fs.readFile(new URL('../src/runtime/toylink-bridge.js', import.meta.url), 'utf8');
  const start = src.indexOf('function onBranchChange()');
  const body = src.slice(start, src.indexOf('\n  }', start));
  assert.ok(/liteEvent\s*=\s*null/.test(body), 'onBranchChange 必须清 liteEvent');
  const cleared = body.search(/liteEvent\s*=\s*null/);
  const sync = body.indexOf('syncLiteInjection()');
  assert.ok(sync < 0 || cleared < sync, '清事件必须早于恢复注入，否则旧人物会被注入新聊天');
});

test('rc.55 B-13 宿主销毁时必须移除 TOY 宽屏 iframe', async () => {
  const src = await fs.readFile(new URL('../src/runtime/host.js', import.meta.url), 'utf8');
  const start = src.indexOf('stops.push(()=>{win.removeEventListener');
  const body = src.slice(start, src.indexOf('});', start) + 3);
  assert.ok(body.includes('toylinkFrame?.remove()'), '统一清理必须移除 TOY iframe');
  assert.ok(body.includes('toylinkFrame=null'), '必须清空引用，避免下次初始化复用已摘除的节点');
  for (const frame of ['wheelFrame?.remove()', 'imprintFrame?.remove()']) assert.ok(body.includes(frame), '轮盘与印记的既有清理不得回退');
});

// ---------- F-14 / B-11：勾选「填入输入框」必须真的填 ----------
test('rc.55 B-11 引导词按人物 / 款式 / 刻字正确渲染，无刻字时不带铭牌句', async () => {
  const { WHEEL_COPY, fill } = await import('../src/core/wheel-ui-copy.js');
  const tpl = WHEEL_COPY.workshop.choker.wearInputDraft;
  assert.ok(typeof tpl === 'string' && tpl.length > 20, '必须有定稿引导词文案');
  const withIns = fill(tpl, { name: '顾青禾', styleName: '玫瑰金锁', inscription: '，铭牌上刻着「私有」' });
  assert.ok(withIns.includes('顾青禾'));
  assert.ok(withIns.includes('玫瑰金锁'));
  assert.ok(withIns.includes('铭牌上刻着「私有」'));
  assert.ok(!withIns.includes('{'), '不得残留占位符');
  const noIns = fill(tpl, { name: '顾青禾', styleName: '玫瑰金锁', inscription: '' });
  assert.ok(!noIns.includes('铭牌上刻着'), '无刻字时不得出现铭牌句');
  assert.ok(!noIns.includes('{'));
});

test('rc.55 B-11 保存分支必须读取勾选状态、填入输入框且不自动发送', async () => {
  const src = await fs.readFile(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  const start = src.indexOf('if(d.confirmWsChoker&&workshopUi){');
  assert.ok(start > 0, '必须能找到确认佩戴分支');
  const body = src.slice(start, src.indexOf('\n  }', start));
  assert.ok(body.includes('workshopUi.fillInput'), '必须读取勾选状态');
  assert.ok(body.includes('api.fillChatInput'), '必须真的往聊天输入框填内容');
  assert.ok(body.includes('autoSend:false'), '不得自动发送');
  assert.ok(body.includes('wearAndFillToast'), '勾选时应使用「已填入输入框」的提示');
  assert.ok(body.includes('wearInputDraft'), '必须使用定稿引导词文案');
});
