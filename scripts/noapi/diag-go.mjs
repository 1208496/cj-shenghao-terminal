// scripts/noapi/diag-go.mjs —— Step 1：用新内核给 rc.37「轮盘 GO 点不动」定性
//
// 跑法（8001 必须在跑，且已导入 rc.37 = 神豪终端5.png、已有 __NOAPI_TEST_three_cards 聊天）：
//   ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/diag-go.mjs')"
// 参数：
//   --avatar 神豪终端5.png   --chat __NOAPI_TEST_three_cards   --preset three_cards
//
// 它只做一件事：把「GO 到底为什么没提交」从两条假设变成一条结论，并落盘证据包。
// 不写存档、不改配置、不调模型；哨兵为 block 模式，命中生成路由直接 reject。

import fs from 'node:fs';
import path from 'node:path';
import { assertSafeUrl, assertSafePath } from './guards.mjs';
import { classify, oneLine } from './codes.mjs';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE_URL = 'http://127.0.0.1:8001/';
const ROOT = 'E:\\SHZDCHOSSS';
assertSafeUrl(BASE_URL);

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const avatar = arg('avatar', '神豪终端5.png');
const chatName = arg('chat', '__NOAPI_TEST_three_cards');
const preset = arg('preset', 'three_cards');

const OUT_DIR = path.resolve(ROOT, '.work', 'noapi');
const SHOT_DIR = path.resolve(ROOT, 'reports', 'noapi-test-shots');
assertSafePath(OUT_DIR, [ROOT]);
assertSafePath(SHOT_DIR, [ROOT]);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });

const log = (...a) => console.log('[DIAG]', ...a);
const steps = [];
const step = (name, detail) => { steps.push({ name, detail, at: new Date().toISOString() }); log(name, detail ?? ''); };

const { task, page } = await attachSpace();
const pageErrors = [];
page.on?.('pageerror', (e) => pageErrors.push(String(e).slice(0, 400)));

const evidence = { at: new Date().toISOString(), avatar, chatName, preset, steps, violations: [], wait: null, snapshots: [], pageErrors };

try {
  await page.goto(BASE_URL, { timeout: 30000 });
  const ready = await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'TAVERN_READY', timeout: 25000 });
  if (!ready.ok) throw new Error('TAVERN_READY 失败：' + JSON.stringify(ready.last));
  step('TAVERN_READY');

  await page.evaluate(installRuntime);
  let sen = await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  step('SENTINEL', { frames: sen.frames, hooks: sen.installed.length, block: sen.block });

  // 选卡 + 进预置聊天（都不触发生成）
  const picked = await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) return { ok: false, why: 'CHAR_NOT_FOUND', avatars: ctx.characters.slice(-8).map((c) => c.avatar) };
    await ctx.selectCharacterById(idx);
    return { ok: true, idx, name: ctx.characters[idx].name };
  }, avatar);
  if (!picked.ok) throw new Error('SELECT_CHAR: ' + JSON.stringify(picked));
  step('SELECT_CHAR', picked);
  await page.waitForTimeout(2500);

  const opened = await page.evaluate(async (chat) => {
    try { await window.SillyTavern.getContext().openCharacterChat(chat); return { ok: true }; }
    catch (e) { return { ok: false, why: String(e.message || e) }; }
  }, chatName);
  if (!opened.ok) throw new Error('OPEN_CHAT: ' + JSON.stringify(opened));
  step('OPEN_CHAT');

  const phone = await waitFor(page, () => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const api = window.__CJ_SHENGHAO_V2__;
    const v = api && api.read ? api.read() : null;
    return { ok: !!f && getComputedStyle(f).display !== 'none' && !!(v && v.state && v.state.meta && v.state.meta.initialized), rev: (v && v.state && v.state.meta.revision) ?? null, wizard: !!document.querySelector('#wizard') };
  }, null, { label: 'PHONE', timeout: 25000 });
  if (!phone.ok) throw new Error('PHONE 未出现：' + JSON.stringify(phone.last));
  step('PHONE', phone.last);

  // 打开后新 frame 出现，补装哨兵
  sen = await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  await page.evaluate(() => window.__NOAPI__.startDomWatch());

  // 展开小手机 → 切到「轮盘」页 → 点轮盘入口（入口只在该页存在）
  const expand = await page.evaluate(() => {
    const t = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const fold = t.querySelector('.folded');
    if (fold) { fold.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 })); fold.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 })); fold.click(); }
    const tabs = [...t.querySelectorAll('nav.bottom .tab')].map((b) => b.dataset.tab);
    const wheelTab = [...t.querySelectorAll('nav.bottom .tab')].find((b) => b.dataset.tab === 'wheel');
    wheelTab?.click();
    return { hadFold: !!fold, tabs, clickedWheelTab: !!wheelTab, entries: t.querySelectorAll('[data-open-wheel]').length };
  });
  await page.waitForTimeout(600);
  step('EXPAND_TO_WHEEL_TAB', expand);

  const openTap = await page.evaluate(() => window.__NOAPI__.tap('[data-open-wheel="play"]', { path: ['cj-shenghao-phone-frame'] }));
  if (!openTap.ok) {
    const dump = await page.evaluate(() => {
      const t = document.getElementById('cj-shenghao-phone-frame').contentDocument;
      return {
        tabs: [...t.querySelectorAll('nav.bottom .tab')].map((b) => ({ tab: b.dataset.tab, cur: b.getAttribute('aria-current') })),
        entries: [...t.querySelectorAll('[data-open-wheel]')].map((b) => ({ attr: b.getAttribute('data-open-wheel'), tag: b.tagName, text: String(b.textContent || '').trim().slice(0, 30) })),
        hd: (t.querySelector('.phone-hd b') || {}).textContent || '',
        hubCards: t.querySelectorAll('.wheel-hub-grid .wheel-card').length,
      };
    });
    evidence.openTapDump = dump;
    step('OPEN_WHEEL_DUMP', dump);
  }
  step('TAP_OPEN_WHEEL', { ok: openTap.ok, code: openTap.code, gates: openTap.gates });

  const handshake = await waitFor(page, () => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = f && f.contentDocument;
    const wd = (window.__CJ_SHENGHAO_V2__ && window.__CJ_SHENGHAO_V2__.wheelDebug) ? window.__CJ_SHENGHAO_V2__.wheelDebug() : {};
    return { ok: !!f && getComputedStyle(f).display !== 'none' && !!d && d.querySelectorAll('#wfSvg .ring').length > 0 && wd.ready === true, wd, rings: d ? d.querySelectorAll('#wfSvg .ring').length : 0, nodes: d ? d.querySelectorAll('#wfSvg *').length : 0 };
  }, null, { label: 'WHEEL_HANDSHAKE', timeout: 20000 });
  if (!handshake.ok) { evidence.wait = handshake; throw new Error('WHEEL_HANDSHAKE: ' + JSON.stringify(handshake.last)); }
  step('WHEEL_HANDSHAKE', handshake.last);

  // 打开轮盘后 wheel frame 里可能又一次新建子 frame，补装
  sen = await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));

  const SNAP = () => page.evaluate(() => ({ snap: window.__NOAPI__.snap(), ops: window.__NOAPI__.opHistory(), domWatch: window.__NOAPI__.domWatchCount(), host: window.__NOAPI__.host() }));

  const before = await SNAP();
  const goFacts = await page.evaluate(() => window.__NOAPI__.find('#wfGo', { path: ['cj-shenghao-wheel-frame'] }));
  evidence.goFacts = goFacts;
  step('GO_FACTS', { found: goFacts.found, count: goFacts.count, disabled: goFacts.disabled, text: goFacts.text, visible: goFacts.visibility && goFacts.visibility.visible, coveredBy: goFacts.visibility && goFacts.visibility.coveredBy, hostBusy: goFacts.hostBusy, busyReasons: goFacts.busyReasons, rect: goFacts.visibility && goFacts.visibility.rect });

  // 探针：message 全量旁听 + api.action 监视。用来区分「消息没到处理分支」和「处理了但没回包」。
  const spy = await page.evaluate(() => {
    const D = { msgs: [], actionCalls: [], actionErrors: [], actionOk: 0 };
    window.__DIAG__ = D;
    const frame = document.getElementById('cj-shenghao-wheel-frame');
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object' || !d.channel) return;
      D.msgs.push({ type: d.type, nonce: String(d.nonce || '').slice(0, 8), reqId: d.reqId || null, fromWheel: !!(frame && e.source === frame.contentWindow) });
    }, true);
    const api = window.__CJ_SHENGHAO_V2__;
    if (api && api.action && !api.action.__diag) {
      const orig = api.action;
      const wrapped = async function (op, lineage) {
        D.actionCalls.push({ type: op && op.type, lineageHead: String(lineage || '').slice(0, 12), revisionHint: op && op.expectedRevision });
        try { const r = await orig.call(api, op, lineage); D.actionOk++; return r; }
        catch (e) { D.actionErrors.push(String((e && e.message) || e).slice(0, 200)); throw e; }
      };
      wrapped.__diag = true;
      api.action = wrapped;
    }
    return { ok: !!window.__DIAG__, hostNonce: (api && api.wheelDebug ? api.wheelDebug().nonce : null) };
  });
  evidence.spyInit = spy;
  step('SPY_INSTALLED', spy);

  const tapRes = await page.evaluate(() => window.__NOAPI__.tap('#wfGo', { path: ['cj-shenghao-wheel-frame'] }));
  evidence.tap = { ok: tapRes.ok, code: tapRes.code, gates: tapRes.gates };

  // 20 秒内每 400ms 取一次，把"到底走到哪一步"记下来
  const deadline = Date.now() + 20000;
  let last = null, settled = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(400);
    last = await SNAP();
    evidence.snapshots.push({ t: new Date().toISOString(), rev: last.snap && last.snap.rev, spinning: last.snap && last.snap.wheel && last.snap.wheel.spinning, toast: last.snap && last.snap.toast, msgs: last.snap && last.snap.wheelMsgs, ops: last.ops && last.ops.last, domWatch: last.domWatch });
    const resOn = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-wheel-frame');
      const r = d && d.contentDocument && d.contentDocument.getElementById('wfResult');
      return { on: !!(r && r.classList.contains('on')), text: r ? String(r.innerText || '').replace(/\s+/g, ' ').slice(0, 120) : '' };
    });
    const revNow = last.snap && last.snap.rev;
    if (resOn.on && !(last.snap && last.snap.wheel && last.snap.wheel.spinning) && revNow > (before.snap && before.snap.rev)) { settled = true; evidence.resultText = resOn.text; break; }
    evidence.resultText = resOn.text;
  }
  const after = await SNAP();
  const diag = await page.evaluate(() => window.__DIAG__ || null);
  evidence.diag = diag;
  const hostNonce = await page.evaluate(() => (window.__CJ_SHENGHAO_V2__ && window.__CJ_SHENGHAO_V2__.wheelDebug) ? window.__CJ_SHENGHAO_V2__.wheelDebug().nonce : null);
  evidence.hostNonce = hostNonce;
  step('SPY_RESULT', { msgs: diag && diag.msgs, actionCalls: diag && diag.actionCalls, actionErrors: diag && diag.actionErrors, actionOk: diag && diag.actionOk, hostNonce });
  sen = await page.evaluate(() => window.__NOAPI__.installSentinel({ block: false })); // 复位为不拦截，避免影响后续人工操作

  // ── 归因 ──
  const vis = (goFacts.visibility) || {};
  const ev = {
    violations: await page.evaluate(() => window.__NOAPI__.violations()),
    env: { ready: true, reasons: [] },
    error: null,
    target: { found: !!goFacts.found, count: goFacts.count || 0, indexGiven: true, selector: '#wfGo', framePath: ['cj-shenghao-wheel-frame'] },
    visibility: { visible: vis.visible, rect: vis.rect, display: vis.display, opacity: vis.opacity, visibilityHidden: vis.visibilityHidden, inCollapsed: vis.inCollapsed },
    interact: { disabled: !!goFacts.disabled, ariaDisabled: !!goFacts.ariaDisabled, pointerEventsNone: !!goFacts.pointerEventsNone, coveredBy: vis.coveredBy || null, hostBusy: !!goFacts.hostBusy, busyReasons: goFacts.busyReasons || null },
    reaction: {
      domChanged: (after.domWatch ?? 0) > (before.domWatch ?? 0),
      stateChanged: (after.snap?.rev ?? 0) > (before.snap?.rev ?? 0),
      postMessage: JSON.stringify(after.snap?.wheelMsgs || []) !== JSON.stringify(before.snap?.wheelMsgs || []),
      consoleErrors: pageErrors,
      hostError: (diag && diag.actionErrors && diag.actionErrors[0]) || null,
      hostActionCalls: (diag && diag.actionCalls || []).length,
    },
    render: { expectation: '结果卡 .on + revision 增加', matched: settled, revisionBefore: before.snap?.rev ?? null, revisionAfter: after.snap?.rev ?? null },
  };
  evidence.evidence = ev;
  evidence.verdict = classify(ev);

  const shot = path.join(SHOT_DIR, `diag-go-${preset}-${Date.now()}.png`);
  try { await page.screenshot({ path: shot }); evidence.screenshot = shot; } catch { }

  const out = path.join(OUT_DIR, `evidence-go-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2), 'utf8');

  console.log('\n=========== 结论 ===========');
  console.log(oneLine(evidence.verdict));
  console.log('动作：', evidence.verdict.action);
  console.log('rev：', ev.render.revisionBefore, '→', ev.render.revisionAfter, '| settled:', settled);
  console.log('wheelMsgs 末 6 条：', JSON.stringify((after.snap && after.snap.wheelMsgs || []).slice(-6)));
  console.log('operationHistory 末条：', JSON.stringify((after.ops && after.ops.last) || null));
  console.log('toast：', JSON.stringify((after.snap && after.snap.toast) || ''));
  console.log('旁听 message：', JSON.stringify(evidence.diag && evidence.diag.msgs));
  console.log('api.action：调用', (evidence.diag && evidence.diag.actionCalls || []).length, '次，成功', (evidence.diag && evidence.diag.actionOk) || 0, '次，异常', JSON.stringify((evidence.diag && evidence.diag.actionErrors) || []));
  console.log('hostNonce：', hostNonce);
  console.log('JS 错误：', JSON.stringify((pageErrors || []).slice(0, 3)));
  console.log('零 API 违约：', JSON.stringify(ev.violations || []));
  console.log('证据包：', out);
  console.log('截图：', shot);
  console.log(JSON.stringify({ status: evidence.verdict.code === 'PASS' ? 'PASS' : 'FAIL', code: evidence.verdict.code, verdict: evidence.verdict.reason, evidence: out, apiCalls: ev.violations.length }, null, 2));
} catch (e) {
  evidence.fatal = String(e.message || e);
  const out = path.join(OUT_DIR, `evidence-go-FATAL-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2), 'utf8');
  console.log('\n[DIAG] FATAL:', evidence.fatal);
  console.log('[DIAG] 证据包：', out);
  console.log(JSON.stringify({ status: 'FATAL', error: evidence.fatal, evidence: out }, null, 2));
}

// 收尾：ego 规矩——一个目标一个 space，用完必须关掉，别把窗口堆在任务栏
await finishSpace(task);

