// rc.51：TOY·LINK 玩法多样化（九模差异 + 寸止锁/破顶 + 夹腿忍耐/强刺 + 处境失态 + 手法轨迹）。
// 断言口径逐条取自 RC51 方案 §9.1；时间参数按方案 §2.1 的新物理取可判定值。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepToyTick, toyMode, toyStackOf, buildToyInputLine, buildToyPromptBlock, tacticSummaryOf, toyBurstMult
} from '../src/core/toylink-engine.js';
import {createToyLinkBridge} from '../src/runtime/toylink-bridge.js';

const dt = 0.1;
const clock = 1.234;

function stepN(run, n, startClock = 0) {
  let cur = run;
  let c = startClock;
  let last = null;
  for (let i = 0; i < n; i++) {
    last = stepToyTick(cur, dt, c);
    cur = last.nextRun;
    c += dt;
  }
  return {run: cur, res: last};
}

function untilPeak(run, maxTicks) {
  let cur = run;
  let c = 0;
  let last = null;
  for (let i = 0; i < maxTicks; i++) {
    last = stepToyTick(cur, dt, c);
    cur = last.nextRun;
    c += dt;
    if (last.peaked) return {run: cur, res: last};
  }
  return {run: cur, res: last};
}

function fakeWin() {  const map = new Map();
  return {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); }
    },
    _map: map
  };
}

function bridgeOf() {
  const win = fakeWin();
  const state = {characters: {c1: {id: 'c1', name: '苏婉', trackingState: 'RECORDED', affection: 80, corruption: 70}}};
  const b = createToyLinkBridge(win, {getBranchKey: () => 'b1', getState: () => state});
  return {b, win};
}

// ---------- 方案 §9.1-1：撩拨卡 85% 与饥渴双绝顶 ----------
test('rc51.toylink：撩拨硬卡 85 攒满渴求，换模式后单次冲顶溃堤双绝顶', (t) => {
  // 真机路径：她被夹腿强忍压回去时玩家点强刺破防，才会一路吊到 85%。全程 mock 计时器驱动 100ms 物理。
  t.mock.timers.enable({apis: ['setInterval', 'Date'], now: 1700000000000});
  const {b} = bridgeOf();
  b.open({});
  b.action('wear', {id: 'c1'});
  b.action('mode', {id: 'tease'});
  b.action('pow', {delta: 45});
  b.action('freq', {delta: 60});
  b.action('start', {id: 'c1'});
  let shocks = 0;
  for (let i = 0; i < 4000; i++) {
    const f = b.snapshot();
    if (f.resisting) { b.action('shock', {}); shocks += 1; }
    if (f.aro >= 85 && f.crave >= 60) break;
    t.mock.timers.tick(100);
  }
  const capped = b.snapshot();
  assert.ok(capped.aro <= 85 + 1e-9, '撩拨必须硬卡 85%，实际 ' + capped.aro);
  assert.equal(capped.peak, 0, '撩拨不得自己绝顶');
  assert.ok(capped.crave >= 60, '到顶后每秒 +12 渴求，实际 ' + capped.crave);
  assert.ok(shocks >= 1, '期间必须触发过夹腿强忍，实际 ' + shocks);

  // 切冲刺：crave ≥60 同时触发「溃堤双绝顶」与「首轮秒破」
  b.action('mode', {id: 'rush'});
  let peaked = null;
  for (let i = 0; i < 100 && !peaked; i++) {
    t.mock.timers.tick(100);
    const f = b.snapshot();
    if (f.peak > 0) peaked = f;
  }
  assert.ok(peaked, '切冲刺后必须冲破 100');
  assert.equal(peaked.peak, 2, '溃堤双绝顶必须一次跳两层，实际 ' + peaked.peak);
  assert.equal(peaked.crave, 0, '双绝顶后渴求清零');
});

// ---------- 方案 §9.1-2：寸止锁死 96% 与破顶释放 ----------
test('rc51.toylink：寸止锁卡 96 反复回落并累加 edgeCount，破顶结算连跳两层', () => {
  const start = {mode: 'edge', pow: 95, freq: 90, aro: 96, stage: 5, peak: 0, here: 'with', sceneId: 'away_home'};
  const {run} = stepN(start, 1200);
  assert.ok(run.aro <= 96 + 1e-9, '临界必须卡在 96%，实际 ' + run.aro);
  assert.equal(run.peak, 0, '寸止期间不得绝顶');
  assert.ok(run.edgeCount >= 2, '必须累计寸止次数，实际 ' + run.edgeCount);

  const burst = stepToyTick({...run, edgeLocked: false, burst: true}, dt, 200);
  assert.equal(burst.peaked, true, '破顶必须当场绝顶');
  assert.ok(burst.nextRun.peak >= 2, 'edgeCount ≥3 时连跳两层，实际 ' + burst.nextRun.peak);
  assert.equal(burst.nextRun.edgeLocked, false);
  assert.equal(toyBurstMult(3), 2.05);
});

// ---------- 方案 §9.1-3：夹腿忍耐减速与瞬时强刺破防 ----------
test('rc51.toylink：忍耐把累积压到 0.30 倍（脉冲 0.75 / 乱流穿透），强刺立即破防并冷却 4 秒', (t) => {
  const base = {mode: 'wave', pow: 80, freq: 60, aro: 48, stage: 3, peak: 0, here: 'with', sceneId: 'away_home'};
  const free = stepToyTick({...base, resistCd: 999}, dt, clock);
  const held = stepToyTick({...base, resisting: true, resistLeft: 4.5}, dt, clock);
  const dFree = free.nextRun.aro - base.aro;
  const dHeld = held.nextRun.aro - base.aro;
  assert.ok(Math.abs(dHeld / dFree - 0.30) < 1e-6, '忍耐态必须是 0.30 倍，实际 ' + (dHeld / dFree));

  const pulseFree = stepToyTick({...base, mode: 'pulse', resistCd: 999}, dt, clock);
  const pulseHeld = stepToyTick({...base, mode: 'pulse', resisting: true, resistLeft: 4.5}, dt, clock);
  const pr = (pulseHeld.nextRun.aro - base.aro) / (pulseFree.nextRun.aro - base.aro);
  assert.ok(Math.abs(pr - 0.75) < 1e-6, '脉冲破盾 2.5 倍 → 0.75 倍，实际 ' + pr);

  const chaos = stepToyTick({...base, mode: 'chaos', resisting: true, resistLeft: 4.5}, dt, clock);
  assert.equal(chaos.nextRun.resisting, false, '乱流必须无视夹腿强忍');

  // 桥接层：强刺真机路径（mock 计时器驱动 100ms 物理）
  t.mock.timers.enable({apis: ['setInterval', 'Date'], now: 1700000000000});
  const {b} = bridgeOf();
  b.open({});
  b.action('wear', {id: 'c1'});
  b.action('pow', {delta: 45});
  b.action('freq', {delta: 60});
  b.action('start', {id: 'c1'});
  let resistingFrame = null;
  b.subscribeTick((f) => { if (f.resisting && !resistingFrame) resistingFrame = f; });
  for (let i = 0; i < 1200 && !resistingFrame; i++) t.mock.timers.tick(100);
  assert.ok(resistingFrame, '桥接层必须跑到夹腿强忍状态');
  const before = resistingFrame.aro;
  const r = b.action('shock', {});
  assert.equal(r.ok, true);
  const snap = b.snapshot();
  assert.equal(snap.resisting, false, '强刺必须击碎忍耐');
  assert.equal(snap.breakCount, 1, '破防计数 +1');
  assert.ok(snap.aro >= before, '强刺必须灌入快感');
  assert.ok(Math.abs(snap.shockCd - 4) < 1e-6, '强刺必须进入 4 秒冷却');
  assert.equal(b.action('shock', {}).skip, 'cooldown', '冷却期间不得二次释放');
});

// ---------- 方案 §9.1-4：处境与手法轨迹写入引导词 ----------
test('rc51.toylink：处境与手法轨迹写进引导词与注入块', () => {
  const run = {
    mode: 'edge', pow: 95, freq: 90, aro: 96, stage: 5, peak: 0, here: 'away', sceneId: 'away_meeting',
    edgeCount: 3, breakCount: 1, exposure: 82, exposedCount: 0, trace: ['撩拨', '临界', '寸止×3']
  };
  const line = buildToyInputLine(run, '苏婉', 'away');
  assert.ok(line.includes('严肃会议'), '引导词必须写明处境');
  assert.ok(line.includes('已连续寸止折磨3次'));
  assert.ok(line.includes('瞬时强刺破防1次'));
  assert.ok(line.includes('当前失态风险高达82%'));
  assert.ok(line.includes('｜手法轨迹：撩拨→临界→寸止×3'));
  assert.ok(line.includes('96%死线'), '必须带当前模式的专属口径');

  const block = buildToyPromptBlock(run, '苏婉');
  assert.ok(block.includes('严肃会议'));
  assert.ok(block.includes('｜已连续寸止折磨3次'));
  assert.ok(block.endsWith('不得替玩家操控或关闭装置。'));

  const idle = tacticSummaryOf({mode: 'wave', pow: 55, freq: 40, aro: 10, stage: 1, peak: 0, here: 'with'});
  assert.equal(idle, '', '无额外操作时不得出现空摘要');
});

// ---------- 九模物理差异（方案 §2.1 可直接判定的两条余量规则）----------
test('rc51.toylink：潮汐余韵保底 18%，冲刺绝顶后从 35% 续接', () => {
  const wave = untilPeak({mode: 'wave', pow: 100, freq: 100, aro: 99, stage: 5, peak: 0, here: 'with'}, 400);
  assert.ok(wave.res.peaked, '潮汐必须能自己冲破 100');
  assert.ok(wave.run.aro >= 18, '潮汐绝顶后必须保底 18% 余韵，实际 ' + wave.run.aro);
  assert.ok(wave.run.aro < 100);
  const rush = untilPeak({mode: 'rush', pow: 100, freq: 100, aro: 99, stage: 5, peak: 0, here: 'with'}, 400);
  assert.ok(rush.res.peaked, '冲刺必须能冲破 100');
  assert.ok(rush.run.aro >= 35 && rush.run.aro < 36, '冲刺必须从 35% 基底续接，实际 ' + rush.run.aro);
});

// ---------- 方案 §9.2 的前置：子页钩子与失态条 ----------

// ---------- 桥接层命令：处境 / 寸止锁 / 破顶前置 ----------
test('rc51.toylink：处境切换同步 here 并持久化，寸止锁反相，无寸止次数时破顶被拒', () => {
  const {b, win} = bridgeOf();
  b.open({});
  const away = b.action('scene', {id: 'away_meeting'});
  assert.equal(away.ok, true);
  assert.equal(b.snapshot().here, 'away');
  assert.equal(b.snapshot().sceneId, 'away_meeting');
  const saved = JSON.parse(win._map.get('cj-shenghao:toylink:v1:b1'));
  assert.equal(saved.last.sceneId, 'away_meeting');
  assert.equal(saved.last.here, 'away');
  assert.equal(b.action('scene', {id: 'away_cafe'}).ok, true, '别处处境可自由切换');
  assert.equal(b.snapshot().here, 'away', '选别处处境后 here 必须为 away');
  assert.equal(b.snapshot().sceneId, 'away_cafe');
  assert.equal(b.action('here', {value: 'with'}).ok, true);
  assert.equal(b.snapshot().here, 'with');
  assert.equal(b.snapshot().sceneId, null, 'rc.52：现场没有处境');
  assert.equal(b.action('scene', {id: 'nope'}).ok, false, '未定义处境必须拒绝');

  assert.equal(b.action('edge-lock', {}).edgeLocked, true);
  assert.equal(b.action('edge-lock', {}).edgeLocked, false);
  assert.equal(b.action('burst', {}).ok, false, '没有寸止次数不得破顶');

  const shock = b.action('shock', {});
  assert.equal(shock.ok, true);
  assert.equal(b.snapshot().aro, 18, '非忍耐态强刺 +18%');
  assert.equal(b.snapshot().feedKey, 'shock_normal');

  b.action('scene', {id: 'away_meeting'});
  const w = b.action('write', {});
  assert.ok(w.inputLine.includes('（严肃会议）'), '引导词必须带当前处境');
  assert.ok(w.inputLine.includes('远程'), 'here 与处境必须保持一致');
});

// ---------- 方案 §6.2 暴露值：公式按字面 ÷10（YG 2026-11-23 批准，避免 3 秒一次失态）----------
test('rc51.toylink：失态暴露值按批准口径增长（pow90+严肃会议 6.975%/秒，一次失态约 15 秒）', () => {
  const run = {mode: 'wave', pow: 90, freq: 60, aro: 40, stage: 2, peak: 0, here: 'away', sceneId: 'away_meeting', exposure: 0, resistCd: 999};
  const res = stepToyTick(run, 1, clock);
  const grew = res.nextRun.exposure - run.exposure;
  assert.ok(Math.abs(grew - 6.975) < 1e-6, '1 秒增长应为 (90-45)×1.55÷10 = 6.975，实际 ' + grew);
  // 连续跑到满值：不得再出现「3 秒一次失态」
  let cur = {...run, exposure: 0};
  let c = 0;
  let hit = -1;
  for (let i = 0; i < 400 && hit < 0; i++) {
    const r = stepToyTick(cur, dt, c);
    cur = r.nextRun;
    c += dt;
    if (r.exposedHit) hit = c;
  }
  assert.ok(hit > 12, '一次当众失态不得少于 12 秒，实际 ' + hit.toFixed(1) + 's');
  assert.equal(cur.exposedCount, 1);
  assert.ok(cur.exposure < 100, '失态后必须回落');
});

// ---------- 方案 §3.1 撞线微颤：tick 必须带 edgeHit 标记（前端据此挂 .is-edging-hit）----------
test('rc51.toylink：撞线那一步返回 edgeHit 标记', () => {
  let cur = {mode: 'edge', pow: 95, freq: 90, aro: 96, stage: 5, peak: 0, here: 'with', sceneId: 'away_home'};
  let c = 0;
  let hit = false;
  for (let i = 0; i < 200 && !hit; i++) {
    const r = stepToyTick(cur, dt, c);
    cur = r.nextRun;
    c += dt;
    if (r.edgeHit) hit = true;
  }
  assert.equal(hit, true, '200 步内必须至少撞线一次并带回 edgeHit');
  assert.ok(cur.edgeCount >= 1);
});

test('rc51.toylink：潮汐档绝顶后叠加档位推进，档位倍率随 peak 递增', () => {  assert.equal(toyStackOf(0).tierLabel, '初潮');
  assert.equal(toyMode('edge').name, '临界');
  const res = stepToyTick({mode: 'rush', pow: 100, freq: 100, aro: 99.9, stage: 5, peak: 2, here: 'with'}, dt, clock);
  assert.ok(res.stack.rateMult > 1.4);
});
