// rc.50：TOY·LINK 轻量模块回归。断言口径逐条取自 RC50 方案 §8.1。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOY_MODES, TOY_MAX_PEAK, TOY_STAGE_CN, toyMode, toyHz, toyStageOf, toyStackOf, stepToyTick,
  buildToyInputLine, buildToyPromptBlock
} from '../src/core/toylink-engine.js';

const clock = 1.234;
const dt = 0.5;

function runOf(id, extra = {}) {
  return {mode: id, pow: 100, freq: 100, aro: 99.9, stage: 5, peak: 0, ...extra};
}

test('rc50.toylink：非锁上限模式绝顶后都不停机，进度以溢出余量续填', () => {
  // rc.51（方案 §2.1）：撩拨硬卡 85%、临界硬锁 96%，这两模按设计不会自己绝顶，单列在后面断言。
  const capped = ['tease', 'edge'];
  for (const m of TOY_MODES) {
    if (capped.includes(m.id)) continue;
    const run = runOf(m.id);
    const res = stepToyTick(run, dt, clock);
    assert.equal(res.peaked, true, m.id + ' 必须记一次绝顶');
    assert.equal(res.nextRun.peak, 1, m.id + ' 绝顶次数 +1');
    assert.ok(res.nextRun.aro >= 0 && res.nextRun.aro < 100, m.id + ' 进度必须是续填后的有效值');
    assert.ok(Number.isFinite(res.env) && res.env >= 0 && res.env <= 1);
    // 引擎没有停机字段，返回体里也不存在 autoStopped
    assert.equal(Object.hasOwn(res, 'autoStopped'), false);
  }
  for (const id of capped) {
    const res = stepToyTick(runOf(id, {aro: 80, stage: 4}), dt, clock);
    assert.equal(res.peaked, false, id + ' 锁上限模式不得自己绝顶');
    assert.ok(res.nextRun.aro <= (id === 'tease' ? 85 : 96), id + ' 必须卡在阈值内');
  }
});

test('rc50.toylink：叠加档位倍率与九次封顶', () => {
  const s0 = toyStackOf(0);
  assert.deepEqual({tier: s0.tier, rateMult: s0.rateMult, envMult: s0.envMult, capped: s0.capped}, {tier: 0, rateMult: 1, envMult: 1, capped: false});
  const s1 = toyStackOf(1);
  assert.deepEqual({tier: s1.tier, rateMult: s1.rateMult, envMult: s1.envMult, tierLabel: s1.tierLabel}, {tier: 1, rateMult: 1.22, envMult: 1.06, tierLabel: '一重叠加'});
  const s2 = toyStackOf(2);
  assert.deepEqual({tier: s2.tier, rateMult: s2.rateMult, envMult: s2.envMult, tierLabel: s2.tierLabel}, {tier: 2, rateMult: 1.44, envMult: 1.12, tierLabel: '二重叠加'});
  assert.equal(toyStackOf(6).rateMult, 2.2);
  const s9 = toyStackOf(9);
  assert.equal(s9.capped, true);
  assert.equal(s9.tier, 3);
  assert.equal(s9.tierLabel, '过载叠加');
  // 第 10 次满圈：peak 保持 9、aro 保持 100，仍不停机
  const res = stepToyTick(runOf('rush', {peak: TOY_MAX_PEAK, aro: 100}), dt, clock);
  assert.equal(res.nextRun.peak, TOY_MAX_PEAK);
  assert.equal(res.nextRun.aro, 100);
  assert.equal(res.peaked, false);
});

test('rc50.toylink：阶段换算与 Hz 换算', () => {
  assert.equal(toyHz(5), 0.7);
  assert.equal(toyHz(40), 2.4);
  assert.equal(toyHz(100), 20);
  assert.deepEqual([0, 21, 22, 47, 48, 73, 74, 92, 93, 100].map(toyStageOf), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(TOY_STAGE_CN.length, 5);
  assert.equal(toyMode('nope').id, 'wave');
});

test('rc50.toylink：正文引导词两种口径与注入块', () => {
  const run = {mode: 'wave', pow: 60, freq: 45, aro: 50, stage: 3, peak: 2, here: 'with'};
  const withLine = buildToyInputLine(run, '苏婉', 'with');
  assert.ok(withLine.includes('完整写出本次操控从启动推进'));
  assert.ok(withLine.includes('已绝顶2次'));
  assert.ok(withLine.includes('二重叠加'));
  assert.ok(withLine.includes('1.44×'));
  const awayLine = buildToyInputLine(run, '苏婉', 'away');
  assert.ok(awayLine.includes('先在正文上方切出一段她所在之处的独立视角'));
  assert.ok(awayLine.includes('完整过程'));
  const block = buildToyPromptBlock(run, '苏婉');
  assert.ok(block.startsWith('[TOY·LINK 实时状态 · 现场]'));
  assert.ok(block.includes('已连续绝顶2次'));
  assert.ok(block.includes('二重叠加'));
  assert.ok(block.includes('不得替玩家操控或关闭装置'));
});

