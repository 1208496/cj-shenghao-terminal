// rc.46 回归：单处印记必须能通过整卡 schema 校验。
// 背景：`items: z.record(imprintPlacementEnum, imprintEntry)` 在 zod 4 里把枚举键当成必须齐备，
// 只刻 1 处时其余 18 处报「expected object, received undefined」→ 实机 toast
// 「操作未能完成（ZodError）」。改 z.partialRecord 后本文件守住这条边界。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation, syncImprintText} from '../src/core/engine.js';
import {PLACEMENTS} from '../src/core/device-catalog.js';
import {fresh, anchor} from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => {
  const s = schemas.state.parse(completeInitialState(fresh(), {startDate: '2026-01-05', startTime: '09:00'}));
  s.characters.char_a.trackingState = 'RECORDED';
  s.wheel.imprintUnlocked = true;   // rc.50：印记改为商城付费解锁（D-2），夹具按已解锁建档
  return s;
};
const run = (s, type, extra = {}) => applyOperation(s, {type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra}, anchor());
const saveOp = (placement, extra = {}) => ['PLAYER_IMPRINT_SET', {
  personRef: 'char_a', action: 'save', placement,
  patternEnabled: true, patternId: 'tally_zheng', patternScale: 'md', patternColor: 'crimson',
  textEnabled: true, text: '陆氏私有', textLayout: 'arc_wrap', textScale: 'md', textAngle: 0,
  font: 'script', textColor: 'gold', ...extra
}];

test('rc46.schema: 单处印记落库后整卡通过校验（防 z.record 枚举键必须齐备）', () => {
  const s = run(initial(), ...saveOp('nape'));
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, 1);
  const parsed = schemas.state.safeParse(s);
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 5)));
  assert.equal(schemas.root.safeParse({shenghao: s}).success, true);
});

test('rc46.schema: 多处与 19 处满刻都能通过校验', () => {
  let s = initial();
  for (const p of PLACEMENTS) s = run(s, ...saveOp(p.id, {text: 'Eternal', textAngle: -15, font: 'gothic'}));
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, PLACEMENTS.length);
  assert.equal(schemas.state.safeParse(s).success, true);
});

test('rc46.schema: 非法部位键仍被拒绝（partialRecord 不放开发枚举约束）', () => {
  const s = run(initial(), ...saveOp('nape'));
  s.characters.char_a.imprints.items.not_a_placement = s.characters.char_a.imprints.items.nape;
  syncImprintText(s.characters.char_a);
  assert.equal(schemas.state.safeParse(s).success, false);
});
