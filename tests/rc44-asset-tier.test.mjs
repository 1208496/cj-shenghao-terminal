// rc.44：手动补录资产改成「类别 × 四档」即时定值（YG 拍板方案二）。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation, projection, tierBasis, ASSET_TIER_TABLE, ASSET_VALUATION_BOUNDS, resolveCustomAssetKind, settleEvents} from '../src/core/engine.js';
import {fresh, anchor} from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => schemas.state.parse(completeInitialState(fresh(), {startDate: '2026-01-05', startTime: '09:00'}));
const run = (s, type, extra = {}) => applyOperation(s, {type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra}, anchor());
const findBy = (s, name) => Object.values(s.finance.assets).find((a) => a.name === name);

test('rc.44：补录即定值 —— 档次 × 类别查表，pending 直接关掉', () => {
  let s = initial();
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '湾流 G700 私人飞机', description: '机身银灰，停在东郊公务机楼', tier: 'TOP'});
  const a = findBy(s, '湾流 G700 私人飞机');
  assert.equal(a.kind, 'YACHT_JET');
  assert.equal(a.valuationTier, 'TOP');
  assert.equal(a.bookValueCents, ASSET_TIER_TABLE.YACHT_JET.TOP);
  assert.equal(a.valuationPending, false, '不再等模型补估值');
  assert.equal(a.basisCents, 0);
  assert.equal(tierBasis(s), initial().user.cashCents, '不计入计级身家');
  assert.ok(!('pendingAssetValuations' in projection(s)), '投影里不再挂待估值索引');
});

test('rc.44：类别判定 —— 腕表不会被「游艇名仕」抬进游艇档', () => {
  let s = initial();
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '劳力士游艇名仕腕表', description: '白金表圈，蓝盘', tier: 'HIGH'});
  const a = findBy(s, '劳力士游艇名仕腕表');
  assert.equal(a.kind, 'LUXURY');
  assert.equal(a.bookValueCents, ASSET_TIER_TABLE.LUXURY.HIGH);
  assert.equal(resolveCustomAssetKind('劳力士游艇名仕腕表', '白金表圈'), 'LUXURY');
  assert.equal(resolveCustomAssetKind('云玺湾江景平层', ''), 'HOUSE');
  assert.equal(resolveCustomAssetKind('手工定制玫瑰木电吉他', ''), 'COLLECTIBLE');
  assert.equal(resolveCustomAssetKind('一具不知名的东西', ''), 'OTHER');
});

test('rc.44：档次默认中端，非法档次回落中端', () => {
  let s = initial();
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '云玺湾江景平层', description: '南向一线江景', tier: 'whatever'});
  const a = findBy(s, '云玺湾江景平层');
  assert.equal(a.valuationTier, 'MID');
  assert.equal(a.bookValueCents, ASSET_TIER_TABLE.HOUSE.MID);
  assert.equal(a.ownershipNote, '玩家补录 · 中端品质');
});

test('rc.44：四档单调递增且在钳位区间内，上限已放到 ¥100 亿', () => {
  for (const [kind, tiers] of Object.entries(ASSET_TIER_TABLE)) {
    const b = ASSET_VALUATION_BOUNDS[kind];
    const vals = ['ENTRY', 'MID', 'HIGH', 'TOP'].map((t) => tiers[t]);
    for (let i = 1; i < vals.length; i += 1) assert.ok(vals[i] > vals[i - 1], kind + ' 档位必须递增');
    assert.ok(vals[0] >= b.min, kind + ' 入门档不得低于下限');
    assert.ok(vals.at(-1) <= b.max, kind + ' 顶奢档不得高于上限');
    assert.equal(b.max, 1000000000000, kind + ' 上限统一放到 ¥100 亿');
  }
});

test('rc.44：正文获得的资产不受档次表影响，完全用模型给的实际金额', () => {
  const s0 = schemas.state.parse(completeInitialState(fresh({initialCashCents: 3000000000}), {startDate: '2026-01-05', startTime: '09:00'}));
  const price = 12800000; // ¥1,280 万，刻意高于 CAR 顶奢档 ¥1,000 万，好识别是否被档次表压下来
  const s = settleEvents(s0, [{
    type: 'CASH_TRANSACTION', direction: 'OUT', amountYuan: String(price), completed: true,
    kind: 'SHOPPING', payer: 'USER', itemName: '兰博基尼 Revuelto', memo: '全款购买', allocations: [],
    asset: {assetId: 'asset_lambo_buy', kind: 'CAR', name: '兰博基尼 Revuelto', ownerId: 'USER', bookValueYuan: `${price / 10000}万`, locationNote: '地下车库', description: '全款购入的混动旗舰超跑'},
    evidence: '我今天把库里那辆兰博基尼 Revuelto 全款买了回来。',
  }], anchor(s0.meta.revision + 2), '我今天把库里那辆兰博基尼 Revuelto 全款买了回来，一千二百八十万当场刷完。', []).state;
  const a = Object.values(s.finance.assets).find((x) => /Revuelto/.test(x.name));
  assert.ok(a, '正文买的车必须建档');
  assert.equal(a.bookValueCents, price * 100, '估值必须等于正文实际成交价');
  assert.notEqual(a.bookValueCents, ASSET_TIER_TABLE.CAR.TOP, '不得被档次表顶奢档覆盖');
  assert.notEqual(a.bookValueCents, ASSET_TIER_TABLE.CAR.MID, '不得被档次表中端覆盖');
  assert.ok(!a.isCustom, '不属于手动补录资产');
  assert.ok(!a.valuationPending);
  assert.ok(a.valuationTier == null, '没有档次标记');
  assert.equal(a.acquisitionIsInitial, false, '花钱买的是后购资产，要计入身家');
  assert.equal(s.user.cashCents, s0.user.cashCents - price * 100, '实扣成交价');
});

test('rc.44：正文无偿获得的资产同样不受档次表影响', () => {
  const s0 = initial();
  const s = settleEvents(s0, [{
    type: 'ASSET_GRANT', completed: true, factId: 'fact_grant_1', evidence: '林总把车过户到我名下了。',
    asset: {assetId: 'asset_free_car', kind: 'CAR', name: '法拉利 SF90', ownerId: 'USER', bookValueYuan: '498万', locationNote: '车库', description: '无偿过户'},
  }], anchor(s0.meta.revision + 2), '林总把那台法拉利 SF90 无偿过户到我名下了，一分钱没让我出。', []).state;
  const a = Object.values(s.finance.assets).find((x) => /SF90/.test(x.name));
  assert.ok(a);
  assert.equal(a.bookValueCents, 498000000, '用模型给的 498 万，不是档次表值');
  assert.ok(!a.isCustom);
  assert.ok(a.valuationTier == null);
  assert.equal(a.acquisitionIsInitial, true, '非现金获得不计身家');
});

test('rc.44：补录不实扣现金，仍然禁上赌桌、每日 2 项不可回退', () => {
  let s = initial();
  const cash = s.user.cashCents;
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '百达翡丽腕表', description: '白金款', tier: 'HIGH'});
  assert.equal(s.user.cashCents, cash, '补录不扣现金');
  const assetId = findBy(s, '百达翡丽腕表').assetId;
  assert.throws(() => run(s, 'PLAYER_CASINO_BET', {stakeKind: 'asset', assetId, betColor: 'red'}), /CUSTOM_ASSET_NO_CASINO/);
  s = run(s, 'PLAYER_ASSET_REGISTER', {name: '云玺湾江景平层', description: '南向', tier: 'MID'});
  assert.throws(() => run(s, 'PLAYER_ASSET_REGISTER', {name: '法拉利 SF90', description: '红黑', tier: 'TOP'}), /CUSTOM_ASSET_DAILY_LIMIT/);
});
