// rc.53：TOY·LINK 极简版（模式锁 + 清空状态）引擎 / 桥接 / 渲染回归。
// 断言口径取自 RC53总方案/02 §3.1、§4.2 与 03 §2、§3、§6、§8；
// C-34（YG 2026-11-23 18:46 批准）：摘光最后一人不自动解锁，只有 resetAll() 解锁。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  TOY_LITE_GEARS, TOY_LITE_GEAR_NAMES, TOY_LITE_GEAR_DESC, toyLiteGearOf, buildToyLitePromptBlock
} from '../src/core/toylink-engine.js';
import {WHEEL_COPY} from '../src/core/wheel-ui-copy.js';
import {createToyLinkBridge, TOYLINK_LITE_PROMPT_ID, TOYLINK_PROMPT_ID, TOYLINK_WEAR_PROMPT_ID} from '../src/runtime/toylink-bridge.js';
import {renderToyLinkLite} from '../src/ui/toylink-lite.js';

function fakeWin() {
  const map = new Map();
  const calls = {inject: [], uninject: []};
  return {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); }
    },
    _map: map,
    _calls: calls,
    TavernHelper: {
      injectPrompts: (p) => { calls.inject.push(p); },
      uninjectPrompts: (ids) => { calls.uninject.push(ids); }
    }
  };
}

const stateOf = () => ({characters: {
  c1: {id: 'c1', name: '苏婉', trackingState: 'RECORDED', affection: 80, corruption: 70},
  c2: {id: 'c2', name: '林夏', trackingState: 'RECORDED', affection: 75, corruption: 10},
  c3: {id: 'c3', name: '叶棠', trackingState: 'RECORDED', affection: 10, corruption: 5}
}});

function bridgeOf(seed) {
  const win = fakeWin();
  if (seed) win.localStorage.setItem('cj-shenghao:toylink:v1:b1', JSON.stringify(seed));
  const b = createToyLinkBridge(win, {getBranchKey: () => 'b1', getState: stateOf});
  return {b, win};
}

const liteCopy = () => WHEEL_COPY.workshop.toylinkLite;
const lastInject = (win) => win._calls.inject.at(-1)?.[0] || null;
const injectedIds = (win) => win._calls.uninject.flat();

// ---------- 档位映射（02 §3.1） ----------
test('rc53.lite：三档落在现有 pow 语义上，双向映射无损', () => {
  assert.deepEqual(TOY_LITE_GEARS, [30, 60, 90]);
  assert.deepEqual(TOY_LITE_GEAR_NAMES, ['1 档 · 轻柔', '2 档 · 中等', '3 档 · 强烈']);
  assert.equal(toyLiteGearOf(5), 1);
  assert.equal(toyLiteGearOf(30), 1);
  assert.equal(toyLiteGearOf(45), 1);
  assert.equal(toyLiteGearOf(46), 2);
  assert.equal(toyLiteGearOf(60), 2);
  assert.equal(toyLiteGearOf(75), 2);
  assert.equal(toyLiteGearOf(76), 3);
  assert.equal(toyLiteGearOf(90), 3);
  assert.equal(toyLiteGearOf(100), 3);
  assert.equal(TOY_LITE_GEAR_DESC[1].startsWith('1档（轻柔）'), true);
  assert.equal(TOY_LITE_GEAR_DESC[2].startsWith('2档（中等）'), true);
  assert.equal(TOY_LITE_GEAR_DESC[3].startsWith('3档（强烈）'), true);
});

// ---------- 极简版占用 → 实验版被拦 → 清空 → 实验版可用 ----------
test('rc53.lite：极简版占锁时实验版写命令全部被拦，清空后恢复', () => {
  const {b, win} = bridgeOf();
  assert.equal(b.snapshot().activeMode, null, '初始无锁，两版都能进');
  assert.equal(b.liteAction('wear', {id: 'c1'}).ok, true);
  assert.equal(b.snapshot().activeMode, 'lite');
  for (const cmd of ['wear', 'unwear', 'start', 'stop', 'mode', 'pow', 'freq', 'here', 'scene', 'edge-lock', 'shock', 'burst', 'write']) {
    const r = b.action(cmd, {id: 'c2', delta: 5, on: true, gear: 2});
    assert.equal(r.ok, false, cmd + ' 必须被拦');
    assert.equal(r.code, 'TOYLINK_MODE_LOCKED', cmd + ' 错误码');
    assert.equal(r.lockedBy, 'lite');
  }
  // select 属浏览，不拦
  assert.equal(b.action('select', {id: 'c2'}).ok, true);

  const r = b.resetAll();
  assert.equal(r.ok, true);
  assert.equal(b.snapshot().activeMode, null);
  assert.equal(b.snapshot().wearingIds.length, 0);
  for (const id of [TOYLINK_LITE_PROMPT_ID, TOYLINK_PROMPT_ID, TOYLINK_WEAR_PROMPT_ID]) {
    assert.ok(injectedIds(win).includes(id), '清空必须撤 ' + id);
  }
  assert.equal(win.localStorage.getItem('cj-shenghao:toylink:v1:b1'), null, '分支键必须被删');
  // 清空后实验版恢复
  const back = b.action('wear', {id: 'c1', here: 'with'});
  assert.equal(back.ok, true);
  assert.equal(b.snapshot().activeMode, 'lab');
});

// ---------- 实验版占用 → 极简版只读 → 清空 → 极简版可用 ----------
test('rc53.lite：实验版占锁时极简版只读，清空后恢复', () => {
  const {b} = bridgeOf();
  assert.equal(b.action('wear', {id: 'c1', here: 'with'}).ok, true);
  assert.equal(b.action('start', {id: 'c1'}).ok, true);
  assert.equal(b.snapshot().activeMode, 'lab');
  for (const cmd of ['wear', 'unwear', 'start', 'stop', 'gear']) {
    const r = b.liteAction(cmd, {id: 'c1', gear: 1});
    assert.equal(r.ok, false, 'lite ' + cmd + ' 必须被拦');
    assert.equal(r.code, 'TOYLINK_MODE_LOCKED');
    assert.equal(r.lockedBy, 'lab');
  }
  assert.equal(b.liteAction('select', {id: 'c2'}).ok, true, '选人属浏览，不拦');
  b.resetAll();
  assert.equal(b.snapshot().activeMode, null);
  assert.equal(b.liteAction('wear', {id: 'c2'}).ok, true);
  assert.equal(b.snapshot().activeMode, 'lite');
});

// ---------- 边界：浏览不上锁 / 摘光不放锁 / 刷新保留锁（C-34） ----------
test('rc53.lite：只浏览不上锁；摘光不自动解锁；刷新不清锁', () => {
  const {b, win} = bridgeOf();
  b.openLite({preview: false});
  assert.equal(b.liteAction('select', {id: 'c2'}).ok, true);
  assert.equal(b.snapshot().activeMode, null, '只选人不上锁');

  assert.equal(b.liteAction('wear', {id: 'c1'}).ok, true);
  assert.equal(b.snapshot().activeMode, 'lite');
  assert.equal(b.liteAction('stop').ok, true, '未开启时 stop 幂等');
  assert.equal(b.snapshot().activeMode, 'lite', '关闭震动不放锁');
  assert.equal(b.liteAction('unwear', {id: 'c1'}).ok, true);
  assert.equal(b.snapshot().wearingIds.length, 0);
  // C-34：摘光最后一人也必须显式清空才解锁
  assert.equal(b.snapshot().activeMode, 'lite', '摘光不放锁');

  // 刷新（重建 bridge）后锁仍在，且不因空佩戴自愈
  const reborn = createToyLinkBridge(win, {getBranchKey: () => 'b1', getState: stateOf});
  assert.equal(reborn.snapshot().activeMode, 'lite');
  assert.equal(reborn.liteAction('wear', {id: 'c2'}).ok, true);
  reborn.resetAll();
  const after = createToyLinkBridge(win, {getBranchKey: () => 'b1', getState: stateOf});
  assert.equal(after.snapshot().activeMode, null, '清空后刷新就是无锁');
});

// ---------- 四步注入链路 + 零填字 ----------
test('rc53.lite：戴上 / 开启 / 切档 / 关闭 各写一次同 ID 注入，且不碰输入框', () => {
  const {b, win} = bridgeOf();
  assert.equal(b.liteAction('wear', {id: 'c1'}).ok, true);
  let p = lastInject(win);
  assert.equal(p.id, TOYLINK_LITE_PROMPT_ID);
  assert.equal(p.position, 'in_chat');
  assert.equal(p.depth, 1);
  assert.equal(p.role, 'system');
  assert.equal(p.should_scan, false);
  assert.ok(p.content.includes('已佩戴·未开启'));
  assert.ok(p.content.includes('严禁描写任何震动'));

  // 生成结束 → 持续佩戴态
  b.onLiteGenerationEnded();
  p = lastInject(win);
  assert.ok(p.content.includes('持续佩戴·未开启'));
  assert.ok(p.content.includes('切勿重复描写佩戴过程'));

  // 未开启时预设档位：不自动开启
  assert.equal(b.liteAction('gear', {gear: 3}).ok, true);
  assert.equal(b.snapshot().running, false, '预设档位不得自动开启');
  assert.equal(b.snapshot().pow, 90);

  assert.equal(b.liteAction('start').ok, true);
  assert.equal(b.snapshot().running, true);
  p = lastInject(win);
  assert.ok(p.content.includes('刚开启·3 档 · 强烈'));
  assert.ok(p.content.includes(TOY_LITE_GEAR_DESC[3]));

  assert.equal(b.liteAction('gear', {gear: 1}).ok, true);
  p = lastInject(win);
  assert.ok(p.content.includes('3 档 · 强烈 → 1 档 · 轻柔'));
  assert.ok(p.content.includes('调弱'));

  assert.equal(b.liteAction('stop').ok, true);
  p = lastInject(win);
  assert.ok(p.content.includes('刚关闭·仍佩戴'));

  // 摘下：注入撤除
  b._calls = win._calls;
  const before = win._calls.uninject.length;
  assert.equal(b.liteAction('unwear', {id: 'c1'}).ok, true);
  assert.ok(win._calls.uninject.length > before);

  // 零填字：返回值里不得出现任何写入输入框的字段，源码不得调用 fillChatInput
  const src = readFileSync(new URL('../src/ui/toylink-lite.js', import.meta.url), 'utf8');
  assert.equal(/fillChatInput|removeChatInputDraft/.test(src), false, '极简版 UI 不得碰输入框');
  const bridgeSrc = readFileSync(new URL('../src/runtime/toylink-bridge.js', import.meta.url), 'utf8');
  const liteSection = bridgeSrc.slice(bridgeSrc.indexOf('极简版命令'), bridgeSrc.indexOf('function snapshot()'));
  assert.equal(/fillChatInput|removeChatInputDraft/.test(liteSection), false, '极简版命令段不得碰输入框');
});

// ---------- 渲染：锁定态 / 清空按钮 / 底部切换态 ----------
test('rc53.lite：渲染锁定横幅、清空按钮与底部切换态', () => {
  const base = {wheel: {toyLinkUnlocked: true}, ...stateOf()};
  const labToy = {activeMode: 'lab', wearingIds: ['c1'], running: true, targetId: 'c1', pow: 85, selectedId: 'c1'};
  const html = renderToyLinkLite({state: base, toy: labToy});
  assert.ok(html.includes('data-tl-mode-lock="lab"'), '实验版占用必须渲染锁定横幅');
  assert.ok(html.includes(liteCopy().btnReset));
  assert.equal((html.match(/ disabled/g) || []).length >= 5, true, '锁定态控件必须全灰');
  assert.ok(html.includes('回到实验版（宽屏）'));
  assert.ok(html.includes('3 档 · 强烈'), '85% 应映射为 3 档');

  const liteToy = {activeMode: 'lite', wearingIds: ['c1'], running: true, targetId: 'c1', pow: 60, selectedId: 'c1'};
  const html2 = renderToyLinkLite({state: base, toy: liteToy});
  assert.ok(html2.includes('data-tl-lab-blocked-hint'));
  assert.ok(html2.includes(liteCopy().btnOpenLabLocked));
  assert.ok(html2.includes('2 档 · 中等'));
  assert.equal(html2.includes('data-tl-mode-lock="lab"'), false);

  const idleToy = {activeMode: null, wearingIds: [], running: false, targetId: null, pow: 55, selectedId: 'c1'};
  const html3 = renderToyLinkLite({state: base, toy: idleToy});
  assert.ok(html3.includes(liteCopy().btnResetIdle));
  assert.ok(html3.includes(liteCopy().btnOpenLab));
  assert.ok(html3.includes(`${liteCopy().btnResetIdle}</button>`) && html3.includes('disabled'), '空闲时清空按钮禁用');

  // 未解锁预览态：横幅 + 全灰，且不出现商城跳转
  const locked = renderToyLinkLite({state: {wheel: {toyLinkUnlocked: false}, ...stateOf()}, toy: {activeMode: null, wearingIds: [], running: false, pow: 55, selectedId: 'c1'}});
  assert.ok(locked.includes('is-locked'));
  assert.equal(locked.includes('前往星愿商城'), false);
  assert.equal(locked.includes('写进正文'), false);
});
