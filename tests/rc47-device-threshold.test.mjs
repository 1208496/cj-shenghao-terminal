// rc.47 步一：三装置使用门槛（好感 ≥70 或堕落 ≥60）的真值与引擎守卫。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation} from '../src/core/engine.js';
import {checkDeviceThreshold, DEVICE_MIN_AFFECTION, DEVICE_MIN_CORRUPTION} from '../src/core/device-catalog.js';
import {fresh, anchor} from './fixtures.mjs';

const schemas = createSchema(z);
const base = () => {
  const s = schemas.state.parse(completeInitialState(fresh(), {startDate: '2026-01-05', startTime: '09:00'}));
  s.characters.char_a.trackingState = 'RECORDED';
  s.characters.char_a.affection = 50;
  s.characters.char_a.corruption = 30;
  s.wheel.imprintUnlocked = true;   // rc.50：本用例只验门槛，印记先按已解锁建档
  return s;
};
const run = (s, type, extra = {}) => applyOperation(s, {type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra}, anchor());
const saveImprint = (s, extra = {}) => run(s, 'PLAYER_IMPRINT_SET', {
  personRef: 'char_a', action: 'save', placement: 'nape',
  patternEnabled: true, patternId: 'tally_zheng', patternScale: 'md', patternColor: 'crimson',
  textEnabled: true, text: '陆氏私有', textLayout: 'arc_wrap', textScale: 'md', textAngle: 0,
  font: 'script', textColor: 'gold', ...extra
});
const wearChoker = (s, extra = {}) => run(s, 'PLAYER_CHOKER_SET', {personRef: 'char_a', action: 'wear', styleId: 'rose_gold_lock', inscription: 'Eternal', ...extra});

test('rc47.threshold.boundary-values：边界、双轴、非收录态', () => {
  assert.equal(DEVICE_MIN_AFFECTION, 70);
  assert.equal(DEVICE_MIN_CORRUPTION, 60);

  const near = checkDeviceThreshold({trackingState: 'RECORDED', affection: 69, corruption: 59});
  assert.equal(near.eligible, false);
  assert.equal(near.affGap, 1);
  assert.equal(near.corGap, 1);
  assert.equal(near.metBy, null);

  const byAff = checkDeviceThreshold({trackingState: 'RECORDED', affection: 70, corruption: 0});
  assert.equal(byAff.eligible, true);
  assert.equal(byAff.metBy, 'affection');
  assert.equal(byAff.corGap, 60);

  const byCor = checkDeviceThreshold({trackingState: 'RECORDED', affection: 0, corruption: 60});
  assert.equal(byCor.eligible, true);
  assert.equal(byCor.metBy, 'corruption');
  assert.equal(byCor.affGap, 70);

  const both = checkDeviceThreshold({trackingState: 'RECORDED', affection: 80, corruption: 70});
  assert.equal(both.eligible, true);
  assert.equal(both.metBy, 'both');

  const hidden = checkDeviceThreshold({trackingState: 'HIDDEN', affection: 100, corruption: 100});
  assert.equal(hidden.eligible, false);
  assert.equal(hidden.metBy, null);

  const none = checkDeviceThreshold(null);
  assert.equal(none.eligible, false);
  assert.equal(none.affection, 0);
});

test('rc47.engine.imprint-threshold-guard：未达标拒绝落印，已刻保留，抹除不受限', () => {
  let s = base();
  assert.throws(() => saveImprint(s), /DEVICE_THRESHOLD_NOT_MET/);

  // 达标后正常落印
  s.characters.char_a.affection = 70;
  s = saveImprint(s);
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, 1);

  // 数值跌破门槛：已有印记不清除，存档仍合法
  s.characters.char_a.affection = 50;
  s.characters.char_a.corruption = 30;
  assert.equal(schemas.state.safeParse(s).success, true);
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, 1);

  // 覆盖更新被拦
  assert.throws(() => saveImprint(s, {text: 'Eternal'}), /DEVICE_THRESHOLD_NOT_MET/);

  // 抹除始终允许
  const removed = run(s, 'PLAYER_IMPRINT_SET', {personRef: 'char_a', action: 'remove_one', placement: 'nape'});
  assert.equal(removed.characters.char_a.imprints, null);

  // 堕落达标也能落印（或关系）
  let t = base();
  t.characters.char_a.corruption = 60;
  t = saveImprint(t);
  assert.equal(Object.keys(t.characters.char_a.imprints.items).length, 1);

  // remove_all 在未达标时同样允许
  const cleared = run(t, 'PLAYER_IMPRINT_SET', {personRef: 'char_a', action: 'remove_all'});
  assert.equal(cleared.characters.char_a.imprints, null);
});

test('rc47.engine.choker-threshold-guard：先商城锁后门槛，摘下永不受限', () => {
  let s = base();
  // 未解锁：先抛 CHOKER_LOCKED
  assert.throws(() => wearChoker(s), /CHOKER_LOCKED/);

  // 已解锁但人物未达标
  s.wheel.chokerUnlocked = true;
  assert.throws(() => wearChoker(s), /DEVICE_THRESHOLD_NOT_MET/);

  // 达标后佩戴成功
  s.characters.char_a.affection = 72;
  s = wearChoker(s);
  assert.equal(s.characters.char_a.choker.worn, true);
  assert.equal(s.characters.char_a.choker.styleId, 'rose_gold_lock');

  // 跌破门槛：不自动摘除，存档合法
  s.characters.char_a.affection = 50;
  s.characters.char_a.corruption = 30;
  assert.equal(schemas.state.safeParse(s).success, true);
  assert.equal(s.characters.char_a.choker.worn, true);

  // 换款被拦
  assert.throws(() => wearChoker(s, {styleId: 'obsidian_velvet'}), /DEVICE_THRESHOLD_NOT_MET/);

  // 摘下允许
  const off = run(s, 'PLAYER_CHOKER_SET', {personRef: 'char_a', action: 'remove'});
  assert.equal(off.characters.char_a.choker, null);

  // 堕落达标可再次佩戴
  let t = base();
  t.wheel.chokerUnlocked = true;
  t.characters.char_a.corruption = 60;
  t = wearChoker(t);
  assert.equal(t.characters.char_a.choker.worn, true);
});
