// rc.43 发布前守卫：把这一轮修掉的 P0 缺陷钉成可回归的断言。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation, projection, tierBasis, ASSET_VALUATION_BOUNDS, settleEvents} from '../src/core/engine.js';
import {fresh, anchor} from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => schemas.state.parse(completeInitialState(fresh(), {startDate: '2026-01-05', startTime: '09:00'}));
const run = (s, type, extra = {}) => applyOperation(s, {type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra}, anchor());
const settle = (s, events) => settleEvents(s, events, anchor(s.meta.revision + 2), '测试正文。', []).state;

// 手动补录一项自定义资产（引擎侧只收名称与描述）
function registerCustom(s, name = '湾流 G700 私人飞机', description = '机身银灰，登记在自己名下，停在东郊公务机楼') {
  return {state: run(s, 'PLAYER_ASSET_REGISTER', {name, description}), assetId: null};
}
function lastAssetId(s) {
  const ids = Object.keys(s.finance.assets).filter((k) => s.finance.assets[k].isCustom === true);
  return ids[ids.length - 1];
}

test('rc.43 P0-1：存量待估值资产经 settleNative 补估值仍然生效，超上限被钳位', () => {
  let s = initial();
  // rc.44 起补录即时定值；这里手工造一条「旧存档遗留的待估值资产」，验证事件通道本身仍可用。
  s.finance.assets.asset_legacy_pending = {assetId: 'asset_legacy_pending', kind: 'YACHT_JET', name: '湾流 G700 私人飞机', ownerId: 'USER', bookValueCents: 0, basisCents: 0, status: 'OWNED', acquisitionEventId: 'manual_x', acquisitionIsInitial: true, description: '机身银灰', locationNote: '', ownershipNote: '玩家补录 · 待估值', valuationPending: true, isCustom: true};
  s = settle(s, [{type: 'ASSET_VALUATION', assetId: 'asset_legacy_pending', kind: 'YACHT_JET', bookValueYuan: '9亿'}]);
  const a = s.finance.assets.asset_legacy_pending;
  assert.equal(a.valuationPending, false, '模型提交的估值应当落地');
  assert.equal(a.bookValueCents, 90000000000, '9 亿 = 900 亿分，未触上限则原样保留');

  // 再喂一个超上限的：必须钳到 ¥100 亿
  const s2 = initial();
  s2.finance.assets.asset_legacy_2 = {...a, assetId: 'asset_legacy_2', bookValueCents: 0, valuationPending: true, valuationTier: null};
  const s3 = settle(s2, [{type: 'ASSET_VALUATION', assetId: 'asset_legacy_2', kind: 'YACHT_JET', bookValueYuan: '900亿'}]);
  assert.equal(s3.finance.assets.asset_legacy_2.bookValueCents, ASSET_VALUATION_BOUNDS.YACHT_JET.max, '超上限必须钳到硬顶');
});

test('rc.43 P0-3：删掉自定义资产不会把「每日 2 项」上限洗回去', () => {
  let s = initial();
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '云玺湾江景平层', description: '南向一线江景，双车位'});
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '百达翡丽腕表', description: '白金款，表扣有细微磨痕'});
  assert.equal(s.finance.customAssetCount, 2);
  const first = Object.keys(s.finance.assets).find((k) => s.finance.assets[k].isCustom);
  s = run(s, 'PLAYER_ASSET_DELETE', {assetId: first});
  assert.equal(s.finance.assets[first], undefined, '删除是真删键');
  assert.equal(s.finance.customAssetCount, 2, '删资产不能减少当日已用次数');
  assert.throws(() => run(s, 'PLAYER_ASSET_REGISTER', {name: '法拉利 SF90', description: '红黑碳纤维内饰'}), /CUSTOM_ASSET_DAILY_LIMIT/);
});

test('rc.43 P0-3：手动补录的自定义资产不允许上赌桌押注', () => {
  let s = initial();
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '湾流 G700 私人飞机', description: '机身银灰，停在东郊公务机楼'});
  const assetId = lastAssetId(s);
  s = settle(s, [{type: 'ASSET_VALUATION', assetId, kind: 'YACHT_JET', bookValueYuan: '1000万'}]);
  assert.throws(() => run(s, 'PLAYER_CASINO_BET', {stakeKind: 'asset', assetId, betColor: 'red'}), /CUSTOM_ASSET_NO_CASINO/);
});

test('rc.43 P0-3：押输删掉后购资产时成本进 retiredBasisCents，身家不回落', () => {
  let s = initial();
  const before = tierBasis(s);
  // 后购资产：非 initial 且有成本
  s.finance.assets.asset_car_x = {assetId: 'asset_car_x', kind: 'CAR', name: '保时捷 911 GT3', ownerId: 'USER', bookValueCents: 260000000, basisCents: 260000000, status: 'OWNED', acquisitionEventId: 'buy_1', acquisitionIsInitial: false, description: '哑光黑', locationNote: '', ownershipNote: ''};
  const withCar = tierBasis(s);
  assert.equal(withCar, before + 260000000);
  s = run(s, 'PLAYER_ASSET_DELETE', {assetId: 'asset_car_x'});
  assert.equal(s.finance.assets.asset_car_x, undefined);
  assert.equal(s.finance.retiredBasisCents, 260000000);
  assert.equal(tierBasis(s), withCar, '删资产后计级身家不得回落');
});

test('rc.43 P0-4 + A：使用玩法券后进 mustDepictUsedItems，可撤销，结算后自动失效', () => {
  let s = initial();
  s.inventory = {...s.inventory, prize_u: {itemId: 'prize_u', source: 'WHEEL', category: 'WHEEL_PRIZE', refId: 'w14', rarity: 'red', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null}};
  s = run(s, 'PLAYER_USE_WHEEL_PRIZE', {itemId: 'prize_u', immediate: true});
  const item = s.inventory.prize_u;
  assert.equal(item.status, 'USED');
  assert.equal(item.pendingUndo, true, '正文生成前应处于待撤状态');
  assert.equal(item.usedRevision, s.meta.revision, 'rc.43：usedRevision 必须等于写入后的新版本');
  assert.deepEqual((projection(s).mustDepictUsedItems || []).map((x) => x.name).length, 1);

  // 撤销：状态回 READY、待撤标记与索引一起消失
  s = run(s, 'PLAYER_UNDO_ITEM_USE', {itemId: 'prize_u'});
  assert.equal(s.inventory.prize_u.status, 'READY');
  assert.equal(s.inventory.prize_u.pendingUndo, false);
  assert.equal(s.inventory.prize_u.usedDate, null);
  assert.equal((projection(s).mustDepictUsedItems || []).length, 0);
});

test('rc.43 A：正文生成后待撤窗口关闭，再撤销被拒', () => {
  let s = initial();
  s.inventory = {...s.inventory, prize_v: {itemId: 'prize_v', source: 'WHEEL', category: 'WHEEL_PRIZE', refId: 'w14', rarity: 'red', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null}};
  s = run(s, 'PLAYER_USE_WHEEL_PRIZE', {itemId: 'prize_v', immediate: true});
  s = settle(s, []);
  assert.equal(s.inventory.prize_v.pendingUndo, false, '结算后应自动落定');
  assert.throws(() => run(s, 'PLAYER_UNDO_ITEM_USE', {itemId: 'prize_v'}), /UNDO_NOT_ALLOWED/);
});

test('rc.43 A：异能发动记待撤锚点，撤销后恢复原样', () => {
  let s = initial();
  s.user.abilities = [{abilityId: 'ab_mind', obtainedDate: s.world.date}];
  assert.throws(() => run(s, 'PLAYER_USE_ABILITY', {abilityId: 'ab_voice'}), /ABILITY_NOT_OWNED/);
  s = run(s, 'PLAYER_USE_ABILITY', {abilityId: 'ab_mind'});
  assert.equal(Object.keys(s.wheel.pendingAbilityUses).length, 1);
  assert.equal((projection(s).pendingAbilityUses || []).length, 1);
  s = run(s, 'PLAYER_UNDO_ABILITY_USE', {abilityId: 'ab_mind'});
  assert.equal(Object.keys(s.wheel.pendingAbilityUses).length, 0);
  assert.equal((projection(s).pendingAbilityUses || []).length, 0);
});

test('rc.43：模型把无偿过户写成金额 0 的 CASH_TRANSACTION 时，改判 ASSET_GRANT 并真的入账', () => {
  const s0 = initial();
  const assetsBefore = Object.keys(s0.finance.assets).length;
  const cashBefore = s0.user.cashCents;
  const s = settle(s0, [{
    type: 'CASH_TRANSACTION', direction: 'IN', amountYuan: '0', payer: 'EXTERNAL', completed: true,
    kind: 'OTHER_INCOME', itemName: '法拉利 SF90', memo: '林总无偿过户法拉利SF90至主角名下，未产生现金支出', allocations: [],
    asset: {assetId: 'asset_ferrari_sf90', kind: 'CAR', name: '法拉利 SF90', ownerId: 'USER', bookValueYuan: '500万', locationNote: '车库', description: '林总无偿过户的跃马混动超跑'},
    evidence: '林总把车库里那台法拉利 SF90 直接过户到我名下了。',
  }]);
  assert.equal(Object.keys(s.finance.assets).length, assetsBefore + 1, '无偿获得的实物必须真的进资产账本');
  const added = Object.values(s.finance.assets).find((a) => /SF90/.test(a.name));
  assert.ok(added, '资产名应被登记');
  assert.equal(added.acquisitionIsInitial, true, '非现金获得不计入计级身家');
  assert.equal(s.user.cashCents, cashBefore, '不得凭空加现金');
});

test('rc.43：示例外品类（定制硅胶娃娃）花钱买入也建资产，字段完整', () => {
  const s0 = schemas.state.parse(completeInitialState(fresh({initialCashCents: 200000000}), {startDate: '2026-01-05', startTime: '09:00'}));
  const s = settleEvents(s0, [{
    type: 'CASH_TRANSACTION', direction: 'OUT', amountYuan: '380000', completed: true,
    kind: 'SHOPPING', payer: 'USER', itemName: '定制硅胶娃娃', memo: '定制硅胶娃娃全款', allocations: [],
    asset: {assetId: 'asset_custom_doll', kind: 'OTHER', name: '定制硅胶娃娃', ownerId: 'USER', bookValueYuan: '38万', locationNote: '主卧衣帽间', description: '140cm 一体全硅胶定制款，脸与身形按本人数据定制'},
    evidence: '我花三十八万在定制作坊订的那具硅胶娃娃今天送到家了。',
  }], anchor(s0.meta.revision + 2), '我花三十八万在定制作坊订的那具硅胶娃娃今天送到家了，钱已经当场付清。', []).state;
  const a = Object.values(s.finance.assets).find((x) => /娃娃/.test(x.name));
  assert.ok(a, '示例里没有的品类也必须建档');
  assert.equal(a.kind, 'OTHER', '未知品类归 OTHER');
  assert.equal(a.bookValueCents, 38000000);
  assert.equal(a.acquisitionIsInitial, false, '花钱买到的是后购资产');
  assert.equal(s.user.cashCents, s0.user.cashCents - 38000000, '必须实扣现金');
  for (const k of ['assetId', 'name', 'kind', 'description', 'locationNote', 'ownershipNote']) {
    assert.ok(a[k] !== undefined && a[k] !== null && a[k] !== '', `字段 ${k} 不能空`);
  }
});

test('rc.43：initialize 后 finance 的三个新字段都有确定值', () => {
  const s = initial();
  assert.equal(s.finance.retiredBasisCents, 0);
  assert.equal(s.finance.customAssetDate, null);
  assert.equal(s.finance.customAssetCount, 0);
});
