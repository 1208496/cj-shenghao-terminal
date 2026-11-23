// rc.52：TOY·LINK 独立宽屏与佩戴链路的引擎/桥接层回归。
// 断言口径取自 RC52 方案 §3.1 / §7.2 / §7.3 / §9。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepToyTick, toySceneId, toySceneOf, buildToyInputLine, buildToyPromptBlock,
  buildToyWearInputLine, buildToyWearPromptBlock, TOY_WITH_EXP_RATE, TOY_AWAY_SCENE_DEFAULT, TOY_MODES
} from '../src/core/toylink-engine.js';
import {WHEEL_COPY} from '../src/core/wheel-ui-copy.js';
import {createToyLinkBridge} from '../src/runtime/toylink-bridge.js';

const dt = 0.1;

function fakeWin() {
  const map = new Map();
  return {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); }
    },
    _map: map,
    _injected: [],
    _uninjected: [],
    TavernHelper: {
      injectPrompts: (p) => { fakeWin.lastInject.push(p); },
      uninjectPrompts: (ids) => { fakeWin.lastUninject.push(ids); }
    }
  };
}
fakeWin.lastInject = [];
fakeWin.lastUninject = [];

function bridgeOf() {
  const win = fakeWin();
  fakeWin.lastInject = [];
  fakeWin.lastUninject = [];
  const state = {characters: {c1: {id: 'c1', name: '苏婉', trackingState: 'RECORDED', affection: 80, corruption: 70}}};
  const b = createToyLinkBridge(win, {getBranchKey: () => 'b1', getState: () => state});
  return {b, win};
}

// ---------- 方案 §3.1：现场没有处境 ----------
test('rc52.toylink：现场没有处境，别处默认回落到严肃会议', () => {
  assert.equal(toySceneId({here: 'with', sceneId: 'away_meeting'}), null);
  assert.equal(toySceneId({here: 'away', sceneId: 'away_boutique'}), 'away_boutique');
  assert.equal(toySceneId({here: 'away', sceneId: 'nope'}), TOY_AWAY_SCENE_DEFAULT);
  assert.equal(toySceneId({here: 'away', sceneId: 'with_sofa'}), TOY_AWAY_SCENE_DEFAULT, '旧 with_* 处境必须被归正');
  const scenes = WHEEL_COPY.workshop.toylink.scenes;
  assert.equal(Object.keys(scenes).length, 8, '别处处境必须 8 条');
  for (const [id, sc] of Object.entries(scenes)) {
    assert.equal(sc.here, 'away', id + ' 必须是别处处境');
    assert.ok(['low', 'mid', 'high'].includes(sc.tier), id + ' 必须带张力分层');
    assert.ok(sc.desc && sc.directive, id + ' 必须有 desc 与正文口径');
  }
});

test('rc52.toylink：现场失态倍率取中性 1.0，别处按处境 expRate', () => {
  assert.equal(TOY_WITH_EXP_RATE, 1.0);
  const at = {mode: 'wave', pow: 90, freq: 60, aro: 40, stage: 2, peak: 0, exposure: 0, resistCd: 999};
  const withRun = stepToyTick({...at, here: 'with'}, 1, 1.234);
  assert.ok(Math.abs((withRun.nextRun.exposure - 0) - 4.5) < 1e-6, '现场 1 秒应涨 (90-45)×1.0÷10 = 4.5');
  const awayRun = stepToyTick({...at, here: 'away', sceneId: 'away_meeting'}, 1, 1.234);
  assert.ok(Math.abs((awayRun.nextRun.exposure - 0) - 6.975) < 1e-6, '严肃会议 1 秒应涨 (90-45)×1.55÷10 = 6.975');
});

// ---------- 方案 §5.2 / §5.3 / §5.4：三种文案口径 ----------
test('rc52.toylink：佩戴引导词与注入块分现场 / 别处两套', () => {
  const withLine = buildToyWearInputLine('苏婉', 'with', null);
  assert.ok(withLine.startsWith('【TOY·LINK佩戴：苏婉 · 现场】'));
  assert.ok(withLine.includes('切勿一句带过'));
  const awayLine = buildToyWearInputLine('苏婉', 'away', 'away_boutique');
  assert.ok(awayLine.includes('（高奢专柜）'));
  assert.ok(awayLine.includes(toySceneOf('away_boutique').desc));

  const withBlock = buildToyWearPromptBlock('苏婉', 'with', null);
  assert.ok(withBlock.startsWith('[TOY·LINK 佩戴事件 · 现场]'));
  assert.ok(withBlock.includes('禁止另编无关场景'));
  const awayBlock = buildToyWearPromptBlock('苏婉', 'away', 'away_meeting');
  assert.ok(awayBlock.startsWith('[TOY·LINK 佩戴事件 · 别处]'));
  assert.ok(awayBlock.includes('「严肃会议」'));
  assert.ok(awayBlock.includes(toySceneOf('away_meeting').directive), '别处注入块必须带处境正文口径');

  const runWith = buildToyInputLine({mode: 'wave', pow: 60, freq: 45, aro: 50, stage: 3, peak: 2, here: 'with'}, '苏婉', 'with');
  assert.ok(runWith.includes('· 现场】'));
  assert.ok(!runWith.includes('当前处境：'), '现场口径不得带处境');
  const runAway = buildToyPromptBlock({mode: 'wave', pow: 60, freq: 45, aro: 50, stage: 3, peak: 2, here: 'away', sceneId: 'away_cafe'}, '苏婉');
  assert.ok(runAway.startsWith('[TOY·LINK 实时状态 · 别处]'));
  assert.ok(runAway.includes('处境写作口径：'));
});

// ---------- 方案 §7.3：wear / unwear / here 的扩展语义 ----------
test('rc52.toylink：佩戴走确认落点、写状态并挂一次性注入，摘下撤回未发送的引导', () => {
  const {b, win} = bridgeOf();
  b.open({});
  const wear = b.action('wear', {id: 'c1', here: 'away', sceneId: 'away_party'});
  assert.equal(wear.ok, true);
  assert.equal(wear.here, 'away');
  assert.equal(wear.sceneId, 'away_party');
  assert.ok(wear.wearInputLine.includes('（晚宴人群）'));
  const injected = fakeWin.lastInject.flat();
  assert.ok(injected.some((p) => p.id === 'cj_shenghao_toylink_wear'), '必须挂一次性佩戴注入');
  assert.ok(b.getPendingWear() && b.getPendingWear().charId === 'c1');

  const saved = JSON.parse(win._map.get('cj-shenghao:toylink:v1:b1'));
  assert.equal(saved.last.sceneId, 'away_party');
  assert.equal(saved.last.here, 'away');

  const again = b.action('wear', {id: 'c1', here: 'with'});
  assert.equal(again.already, true, '重复佩戴必须幂等');
  assert.equal(fakeWin.lastInject.flat().filter((p) => p.id === 'cj_shenghao_toylink_wear').length, 1, '不得叠两份');

  const un = b.action('unwear', {id: 'c1'});
  assert.equal(un.ok, true);
  assert.ok(un.pendingWearText.includes('【TOY·LINK佩戴：'), '摘下必须回传待清理的引导词');
  assert.ok(fakeWin.lastUninject.flat().includes('cj_shenghao_toylink_wear'), '摘下必须撤回佩戴注入');
  assert.equal(b.getPendingWear(), null);
});

test('rc52.toylink：切现场时 sceneId 置空但保留上次别处处境，切别处自动恢复', () => {
  const {b} = bridgeOf();
  b.open({});
  b.action('scene', {id: 'away_office'});
  assert.equal(b.snapshot().sceneId, 'away_office');
  b.action('here', {value: 'with'});
  assert.equal(b.snapshot().sceneId, null);
  assert.equal(b.snapshot().lastAwaySceneId, 'away_office');
  b.action('here', {value: 'away'});
  assert.equal(b.snapshot().sceneId, 'away_office');
});

test('rc52.toylink：九模带上新特性标签，错误码补齐 TOYLINK_NOT_WORN', () => {
  const modes = WHEEL_COPY.workshop.toylink.modes;
  assert.equal(modes.length, 9);
  for (const m of modes) {
    assert.ok(m.tag && m.icon, m.id + ' 必须有 tag 与 icon');
    assert.ok(TOY_MODES.some((x) => x.id === m.id), m.id + ' 必须与引擎九模对齐');
  }
  assert.ok(WHEEL_COPY.errors.TOYLINK_NOT_WORN.includes('佩戴'));
  assert.ok(WHEEL_COPY.workshop.toylink.hereWith === '现场');
});
