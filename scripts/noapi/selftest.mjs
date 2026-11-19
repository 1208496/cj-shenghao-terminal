// scripts/noapi/selftest.mjs —— Phase 0/1：先证明「归因器本身可信」，再去碰真卡。
//
// 跑法：node scripts/noapi/selftest.mjs
// 通过时打印 N/N PASS 并以 0 退出；任何一条不符即非 0 退出。
//
// 为什么需要它：归因码判错，会把「脚本点错东西」当成「卡的 bug」上报，
// 这比没有归因更糟。所以先离线注入每一种故障形态，验证每个码都落在该落的位置。

import { classify } from './codes.mjs';
import { assertSafeUrl, assertSafePath, SafetyBlock } from './guards.mjs';

let pass = 0, fail = 0;
const rows = [];

function t(name, fn) {
  try { fn(); pass++; rows.push(`  PASS  ${name}`); }
  catch (e) { fail++; rows.push(`  FAIL  ${name}\n        ${e.message}`); }
}
function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what || '值'} 期望 ${expected}，实际 ${actual}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || '条件不成立'); }

const base = () => ({
  violations: [],
  env: { ready: true, reasons: [] },
  error: null,
  target: { found: true, count: 1, indexGiven: false, selector: '#wfGo' },
  visibility: { visible: true, rect: { x: 0, y: 0, w: 80, h: 30 }, display: 'block', visibility: 'visible', opacity: '1', inCollapsed: false, coveredBy: null },
  interact: { disabled: false, ariaDisabled: false, pointerEventsNone: false, coveredBy: null, hostBusy: false, busyReasons: { generation: false, setup: false, mvu: false, extra: false } },
  reaction: { domChanged: true, stateChanged: true, postMessage: true, consoleErrors: [] },
  render: { expectation: '结果卡出现', matched: true, revisionBefore: 1, revisionAfter: 2 },
});

// ── 归因码 ──────────────────────────────────────────────────────
t('PASS：全绿', () => eq(classify(base()).code, 'PASS'));

t('F8：零 API 违约优先于其它一切', () => {
  const ev = base();
  ev.violations = ['fetch @ top /api/backends/chat-completions/generate'];
  ev.env.ready = false; ev.target.found = false;
  eq(classify(ev).code, 'F8');
});

t('F0：环境未就绪（手机没出来 / 关卡没过）', () => {
  const ev = base();
  ev.env = { ready: false, reasons: ['phone-frame 未挂载'] };
  eq(classify(ev).code, 'F0');
});

t('F7：采集异常', () => {
  const ev = base();
  ev.error = 'TypeError: Cannot read properties of undefined';
  eq(classify(ev).code, 'F7');
});

t('F4：多匹配且未指定 index', () => {
  const ev = base();
  ev.target = { found: true, count: 3, indexGiven: false, selector: '.wf-modes button' };
  eq(classify(ev).code, 'F4');
});

t('F4 反例：多匹配但指定了 index → 不算歧义', () => {
  const ev = base();
  ev.target = { found: true, count: 3, indexGiven: true, selector: '.wf-modes button' };
  eq(classify(ev).code, 'PASS');
});

t('F1：元素不存在', () => {
  const ev = base();
  ev.target = { found: false, count: 0, selector: '#wfGo' };
  eq(classify(ev).code, 'F1');
});

t('F2：存在但 display:none', () => {
  const ev = base();
  ev.visibility = { ...ev.visibility, visible: false, display: 'none' };
  eq(classify(ev).code, 'F2');
});

t('F2：存在但 0×0', () => {
  const ev = base();
  ev.visibility = { ...ev.visibility, visible: false, rect: { x: 0, y: 0, w: 0, h: 0 } };
  eq(classify(ev).code, 'F2');
});

t('F3：disabled（rc.37 的 GO 卡点假设①）', () => {
  const ev = base();
  ev.interact = { ...ev.interact, disabled: true };
  eq(classify(ev).code, 'F3');
  ok(classify(ev).reason.includes('disabled'), '应点明 disabled');
});

t('F3：宿主 busy=extra（rc.37 的 GO 卡点假设②的近亲）', () => {
  const ev = base();
  ev.interact = { ...ev.interact, hostBusy: true, busyReasons: { generation: false, setup: false, mvu: false, extra: true } };
  eq(classify(ev).code, 'F3');
  ok(classify(ev).reason.includes('extra'), `应点明是哪个 busy 位：${classify(ev).reason}`);
});

t('F3：被遮挡', () => {
  const ev = base();
  ev.interact = { ...ev.interact, coveredBy: 'div#cj-shenghao-wheel-veil' };
  eq(classify(ev).code, 'F3');
});

t('F9：宿主拒绝操作（LEDGER_MISMATCH —— rc.37 轮盘 GO 卡点的真凶）', () => {
  const ev = base();
  ev.reaction = { ...ev.reaction, stateChanged: false, hostError: 'LEDGER_MISMATCH', hostActionCalls: 1 };
  ev.render = { expectation: '结果卡 .on', matched: false, revisionBefore: 1, revisionAfter: 1 };
  eq(classify(ev).code, 'F9');
  ok(classify(ev).reason.includes('LEDGER_MISMATCH'), '必须把规则码原样写进结论');
});

t('优先级：F9 先于 F5（点了有反应但被拒 ≠ 点了没反应）', () => {
  const ev = base();
  ev.reaction = { domChanged: false, stateChanged: false, postMessage: false, consoleErrors: [], hostError: 'STALE_REVISION' };
  eq(classify(ev).code, 'F9');
});

t('优先级：F3 先于 F9（根本点不到时不该怪宿主）', () => {
  const ev = base();
  ev.interact = { ...ev.interact, disabled: true };
  ev.reaction = { ...ev.reaction, hostError: 'LEDGER_MISMATCH' };
  eq(classify(ev).code, 'F3');
});

t('F5：四维全零（点了没反应）', () => {
  const ev = base();
  ev.reaction = { domChanged: false, stateChanged: false, postMessage: false, consoleErrors: [] };
  ev.render = { ...ev.render, matched: false };
  eq(classify(ev).code, 'F5');
});

t('F6：状态变了但没渲染（STALE_REVISION 也会落这里之前先看反应）', () => {
  const ev = base();
  ev.reaction = { domChanged: false, stateChanged: true, postMessage: false, consoleErrors: [] };
  ev.render = { expectation: '结果卡出现', matched: false, revisionBefore: 1, revisionAfter: 2 };
  eq(classify(ev).code, 'F6');
});

t('优先级：F1 先于 F2/F3/F5', () => {
  const ev = base();
  ev.target = { found: false, count: 0 };
  ev.visibility = { visible: false };
  ev.interact = { disabled: true };
  eq(classify(ev).code, 'F1');
});

t('优先级：F3 先于 F5', () => {
  const ev = base();
  ev.interact = { ...ev.interact, disabled: true };
  ev.reaction = { domChanged: false, stateChanged: false, postMessage: false, consoleErrors: [] };
  eq(classify(ev).code, 'F3');
});

t('缺 target.found 视为 F7（证据不全不许乱判）', () => {
  const ev = base();
  ev.target = { count: 1 };
  eq(classify(ev).code, 'F7');
});

t('空证据包不会静默 PASS', () => eq(classify({}).code, 'F7'));

// ── 守卫 ────────────────────────────────────────────────────────
t('守卫：8001 放行', () => eq(assertSafeUrl('http://127.0.0.1:8001/'), true));

t('守卫：8000 拒绝', () => {
  let threw = false;
  try { assertSafeUrl('http://127.0.0.1:8000/'); } catch (e) { threw = e instanceof SafetyBlock; }
  ok(threw, '8000 必须抛 SafetyBlock');
});

t('守卫：其它端口拒绝', () => {
  let threw = false;
  try { assertSafeUrl('http://127.0.0.1:4176/x'); } catch (e) { threw = e instanceof SafetyBlock; }
  ok(threw, '非 8001 必须抛');
});

t('守卫：C:\\jiuguan 玩家实例拒绝', () => {
  let threw = false;
  try { assertSafePath('C:\\jiuguan\\SillyTavern\\data\\default-user\\chats\\x.jsonl', ['C:\\jiuguan\\SillyTavern\\data\\default-user\\chats']); } catch (e) { threw = e instanceof SafetyBlock; }
  ok(threw, 'C:\\jiuguan 必须抛，即使被列为允许根也不行');
});

t('守卫：E:\\Ajiuguanagentceshi（8001）不误伤', () => {
  const p = assertSafePath('E:\\Ajiuguanagentceshi\\SillyTavern\\data\\default-user\\chats\\神豪终端5\\__NOAPI_TEST_three_cards.jsonl', ['E:\\Ajiuguanagentceshi\\SillyTavern\\data\\default-user\\chats']);
  ok(p.includes('Ajiuguanagentceshi'), '8001 实例路径必须放行');
});

t('守卫：允许根之外拒绝', () => {
  let threw = false;
  try { assertSafePath('E:\\SHZDCHOSSS\\reports\\x.json', ['E:\\SHZDCHOSSS\\.work']); } catch (e) { threw = e instanceof SafetyBlock; }
  ok(threw, '越界路径必须抛');
});

// ── 输出 ────────────────────────────────────────────────────────
console.log(rows.join('\n'));
console.log(`\nSELFTEST ${fail ? 'FAIL' : 'OK'}: ${pass}/${pass + fail} 通过${fail ? `，${fail} 条失败` : ''}`);
process.exit(fail ? 1 : 0);
