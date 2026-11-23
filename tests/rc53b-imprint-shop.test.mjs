// rc.53b：星愿商城「持久奇物」补上专属私密印记条目（RC46 D-2：3000 星愿积分付费解锁）。
// 断言口径：YG 2026-11-23 20:03 特批直接做完；引擎购买分支与 app.js 已拥有判定为既有实现，本批补目录与文案。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation} from '../src/core/engine.js';
import {SURREAL_ITEMS, SURREAL_ITEM_BY_ID} from '../src/core/casino-catalog.js';
import {WHEEL_COPY} from '../src/core/wheel-ui-copy.js';
import {createScreens} from '../src/ui/screens.js';
import {fresh, anchor} from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => schemas.state.parse(completeInitialState(fresh(), {startDate: '2026-01-05', startTime: '09:00'}));
const run = (s, type, extra = {}) => {
  const out = applyOperation(s, {type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra}, anchor(s.meta.revision + 1));
  return out?.state ?? out;
};

test('rc53b.shop：持久奇物含三条永久装置，印记 3000 分', () => {
  const permanent = SURREAL_ITEMS.filter((i) => i.consumable !== true);
  const ids = permanent.map((i) => i.itemId);
  assert.ok(ids.includes('it_choker') && ids.includes('it_imprint') && ids.includes('it_toylink'), '三条永久装置必须在列：' + ids.join(','));
  const imprint = SURREAL_ITEM_BY_ID.it_imprint;
  assert.equal(imprint.name, '专属私密印记');
  assert.equal(imprint.price, 3000);
  assert.equal(imprint.rarity, 'rainbow');
  assert.equal(imprint.consumable, false);
  assert.equal(imprint.kindText, '永久解锁');
  assert.ok(imprint.effect.includes('专属私密印记') && imprint.impact.includes('imprintUnlocked = true'));
});

test('rc53b.shop：兑换印记置 imprintUnlocked、扣分、写商城流水，重复兑换被拒', () => {
  let s = initial();
  s.wheel.starPoints = 3200;
  assert.equal(s.wheel.imprintUnlocked, false);
  s = run(s, 'PLAYER_SHOP_BUY', {catalogId: 'it_imprint'});
  assert.equal(s.wheel.imprintUnlocked, true);
  assert.equal(s.wheel.starPoints, 200);
  const last = s.wheel.shopHistory.at(-1);
  assert.equal(last.catalogId, 'it_imprint');
  assert.equal(last.costPoints, 3000);
  assert.throws(() => run({...s, wheel: {...s.wheel, starPoints: 4000}}, 'PLAYER_SHOP_BUY', {catalogId: 'it_imprint'}), /SHOP_ALREADY_OWNED/);
});

test('rc53b.shop：星愿积分不足时拒绝兑换', () => {
  const s = initial();
  s.wheel.starPoints = 2999;
  assert.throws(() => run(s, 'PLAYER_SHOP_BUY', {catalogId: 'it_imprint'}), /INSUFFICIENT_POINTS/);
});

test('rc53b.shop：未兑换前落印被 IMPRINT_LOCKED 拦住，并有玩家可读提示', () => {
  const s = initial();
  assert.throws(() => run(s, 'PLAYER_IMPRINT_SET', {
    personRef: 'char_a', action: 'save', placement: 'lower_abdomen', patternEnabled: true, patternId: 'succubus_heart',
    patternScale: 'md', patternColor: 'crimson', textEnabled: true, text: '测试', textLayout: 'arc_wrap',
    textScale: 'md', textAngle: 0, font: 'script', textColor: 'gold'
  }), /IMPRINT_LOCKED/);
  assert.ok(WHEEL_COPY.errors.IMPRINT_LOCKED && WHEEL_COPY.errors.IMPRINT_LOCKED.includes('星愿商城'));
});

test('rc53b.ui：我的页印记卡按解锁位显示未解锁 / 可铭刻', async () => {
  const mk = (unlocked) => {
    const s = initial();
    s.wheel.imprintUnlocked = unlocked;
    const data = {view: {state: s, prefs: {}, busy: false}, expanded: new Set(), section: null, privateSection: null, consumptionPage: 0, sceneSectionByChar: new Map(), assetTab: 'ALL', mineExpanded: new Set()};
    return createScreens({data: () => data, esc: (v) => String(v ?? ''), yuan: (v) => '¥' + v / 100, image: () => '', avatar: () => ''}).mine();
  };
  const locked = mk(false);
  assert.ok(locked.includes(WHEEL_COPY.mine.devices.imprint.badgeLocked), '未解锁态角标');
  assert.ok(locked.includes(WHEEL_COPY.mine.devices.imprint.metaLocked), '未解锁态副标');
  assert.ok(locked.includes('data-device-state="locked"'), '卡片必须标 locked');
  const unlocked = mk(true);
  assert.ok(unlocked.includes(WHEEL_COPY.mine.devices.imprint.badgeEmpty), '解锁后显示可铭刻');
  assert.ok(!unlocked.includes(WHEEL_COPY.mine.devices.imprint.badgeLocked));
});
