// ⚠ 本项目定制副本：来源 C:\Users\Administrator\.agents\skills\zero-api-card-test\scripts\noapi\run-suite.mjs
// 唯一差异（2026-11-23）：依赖改绝对 file URL；attachSpace() 换成 attachSpace('NOAPI-RC55B')，
// 因为默认的 NOAPI-HARNESS space(id=41) 控制权在 YG 手里，ego 会硬停、且同名 taskSpace 会复用那个。
// 判定逻辑与 skill 版逐字一致；skill 升级后需重新同步本文件。
// scripts/noapi/run-suite.mjs —— 数据驱动执行器（一份 suite.json 就是一份测试计划）
//
// 设计：执行器只认 action 名，不认任何卡的业务知识；卡的常量放 config.json，
// 用例放 suite.json。加新功能 = 加一条用例，不改这份代码。
// 每个失败步骤都会走 codes.mjs 归因（F0–F9）并落证据包，输出可读结论。
//
// 跑法：
//   node scripts/noapi/run-suite.mjs --config suites/shenghao-rc37.config.json --suite suites/shenghao-rc37.suite.json
//   （断言需要浏览器，真跑要经 ego：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/run-suite.mjs')"）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeUrl, assertSafePath } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/guards.mjs';
import { classify, oneLine } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/codes.mjs';
import { installRuntime, waitFor, attachSpace, finishSpace } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/runtime.mjs';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 控制文件优先（ego 运行时里 env / argv 都不可靠）：.work/noapi/noapi-ctl.json
//   { "projectRoot": "E:/项目", "config": "suites/x.config.json", "suite": "suites/x.suite.json", "avatar": "卡.png" }
const PROJECT_BASE = globalThis.__NOAPI_PROJECT_ROOT__ || process.env.NOAPI_PROJECT_ROOT || process.cwd();
const CTL_PATH = path.resolve(PROJECT_BASE, '.work', 'noapi', 'noapi-ctl.json');
let CTL = {};
try { CTL = JSON.parse(fs.readFileSync(CTL_PATH, 'utf8')); } catch { }
const ROOT = path.resolve(CTL.projectRoot || process.cwd());

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
if (!CTL.config || !CTL.suite) {
  console.log(`[SUITE] 缺少控制文件 ${CTL_PATH}\n  需要 { "projectRoot": "...", "config": "suites/x.config.json", "suite": "suites/x.suite.json" }`);
  process.exit(2);
}
const cfgPath = path.resolve(ROOT, CTL.config);
const suitePath = path.resolve(ROOT, CTL.suite);
assertSafePath(cfgPath, [ROOT]);
assertSafePath(suitePath, [ROOT]);

const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
const BASE_URL = config.baseUrl || 'http://127.0.0.1:8001/';
assertSafeUrl(BASE_URL);

const OUT_DIR = path.resolve(ROOT, '.work', 'noapi');
assertSafePath(OUT_DIR, [ROOT]);
fs.mkdirSync(OUT_DIR, { recursive: true });

const avatar = arg('avatar', CTL.avatar || config.avatar);
const HOST = config.hostApi || '__CJ_SHENGHAO_V2__';
const PHONE_ID = (config.frames?.phone || []).slice(-1)[0] || null;
const WHEEL_ID = (config.frames?.wheel || []).slice(-1)[0] || null;
const only = CTL.only || arg('only', '') || '';           // 逗号分隔的 case id，只跑匹配的
const log = (...a) => console.log('[SUITE]', ...a);

// ── 页面内通用探针：按 frame + 选择器取"候选节点事实" ──────────────
const PROBE_FN = function (opts) {
  const api = window.__NOAPI__;
  const pathArr = opts.path || [];
  // 解析 frame
  let win = window;
  for (const id of pathArr) {
    const doc = win.document;
    let el = String(id).startsWith('#') ? doc.querySelectorAll('iframe,frame')[Number(String(id).slice(1))] : (doc.getElementById(id) || doc.querySelector(`iframe[name="${id}"]`));
    if (!el) return { ok: false, why: 'FRAME_NOT_FOUND', path: pathArr };
    win = el.contentWindow;
    if (!win) return { ok: false, why: 'FRAME_NO_WINDOW', path: pathArr };
  }
  const doc = win.document;
  let list = [];
  try { list = [...doc.querySelectorAll(opts.selector)]; } catch (e) { return { ok: false, why: 'BAD_SELECTOR', error: String(e.message || e) }; }
  const facts = list.map((el) => {
    const r = el.getBoundingClientRect();
    let cs = {};
    try { cs = win.getComputedStyle(el); } catch { }
    const vis = typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : (r.width > 0 && r.height > 0);
    const attrs = {};
    for (const a of el.attributes) if (a.name.startsWith('data-') || a.name === 'disabled' || a.name === 'aria-disabled' || a.name === 'aria-current' || a.name === 'class') attrs[a.name] = a.value;
    return {
      tag: el.tagName.toLowerCase(), id: el.id || '',
      text: String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600),
      visible: !!vis, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      overflow: el.scrollHeight > el.clientHeight + 1,
      scrollH: el.scrollHeight, clientH: el.clientHeight,
      // rc.50：滚动位置断言（TOY·LINK 子页点按钮不许跳回顶部）
      scrollTop: Math.round(el.scrollTop || 0),
      // rc.38：输入框/文本域的值要能被断言（背包塞引导词要用）。
      value: typeof el.value === 'string' ? el.value : undefined,
      attrs,
    };
  });
  return { ok: true, count: facts.length, facts, viewport: { w: doc.documentElement.clientWidth, h: doc.documentElement.clientHeight } };
};

function framePath(name) {
  const p = config.frames?.[name];
  if (!p) throw new Error(`config.frames 里没有 ${name}`);
  return p;
}

async function probe(page, frameName, selector) {
  return page.evaluate(PROBE_FN, { path: framePath(frameName), selector });
}

async function stateOf(page) {
  return page.evaluate(() => {
    const api = window.__NOAPI_HOST__;
    if (!api) return null;
    const v = api.read();
    return { state: v.state, busy: v.busy, rev: v.state && v.state.meta ? v.state.meta.revision : null, lineage: v.lineage };
  });
}

/** 只读探针：拿"聊天/宿主"层面的标量事实（Lifecycle 类断言用） */
async function pageProbe(page, name) {
  return page.evaluate((n) => {
    const h = window.__NOAPI_HOST__;
    const ctx = (window.SillyTavern && window.SillyTavern.getContext) ? window.SillyTavern.getContext() : null;
    const chat = (ctx && ctx.chat) || [];
    const lastAI = [...chat].reverse().find((m) => m && m.is_user === false);
    let st = null;
    try { st = h && h.read ? h.read().state : null; } catch { }
    switch (n) {
      case 'floors': return chat.length;
      case 'swipeId': return lastAI ? (lastAI.swipe_id ?? 0) : null;
      case 'swipeCount': return lastAI && lastAI.swipes ? lastAI.swipes.length : 0;
      case 'revision': return st && st.meta ? st.meta.revision : null;
      // rc.38：确认弹窗点「再想想」之后必须一条操作都没落盘。
      case 'ops': return st && st.operationHistory ? Object.keys(st.operationHistory).length : null;
      case 'cash': return st && st.user ? st.user.cashCents : null;
      case 'initialized': return !!(st && st.meta && st.meta.initialized);
      case 'fingerprint': return st && st.meta && st.meta.sourceAnchor ? st.meta.sourceAnchor.fingerprint : null;
      case 'hostReady': return !!(h && h.read);
      case 'chatId': return (ctx && ctx.chatId) || null;
      case 'phoneVisible': { const f = document.getElementById(window.__NOAPI_PHONE_ID__); return !!f && getComputedStyle(f).display !== 'none'; }
      default: return null;
    }
  }, name);
}

function pick(obj, dotted) {
  return dotted.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
}

/** 断言求值：返回 {pass, why} */
function evalAssert(a, ctx) {
  if (a.kind === 'count') {
    const n = ctx.probe.count;
    if (a.equals != null && n !== a.equals) return { pass: false, why: `${a.selector} 命中 ${n} 个，期望 ${a.equals}` };
    if (a.min != null && n < a.min) return { pass: false, why: `${a.selector} 命中 ${n} 个，至少要 ${a.min}` };
    if (a.max != null && n > a.max) return { pass: false, why: `${a.selector} 命中 ${n} 个，最多 ${a.max}` };
    return { pass: true, why: `${a.selector} ×${n}` };
  }
  if (a.kind === 'text') {
    const f = ctx.probe.facts[a.index ?? 0];
    if (!f) return { pass: false, why: `第 ${a.index ?? 0} 个节点不存在` };
    if (a.includes && !f.text.includes(a.includes)) return { pass: false, why: `文本里没有「${a.includes}」：${f.text.slice(0, 80)}` };
    if (a.matches && !new RegExp(a.matches).test(f.text)) return { pass: false, why: `文本不匹配 /${a.matches}/：${f.text.slice(0, 80)}` };
    if (a.equals != null && f.text !== a.equals) return { pass: false, why: `文本「${f.text.slice(0, 60)}」≠「${a.equals}」` };
    return { pass: true, why: `文本命中` };
  }
  if (a.kind === 'textAny') {
    const hit = ctx.probe.facts.some((f) => (a.matches ? new RegExp(a.matches).test(f.text) : a.includes ? f.text.includes(a.includes) : true));
    if (!hit) return { pass: false, why: `${ctx.probe.count} 个节点里没有一个匹配 ${a.matches || a.includes}` };
    return { pass: true, why: `${ctx.probe.count} 个节点中命中 ${a.matches || a.includes}` };
  }
  if (a.kind === 'visible') {
    const bad = ctx.probe.facts.filter((f) => (a.equals === false ? f.visible : !f.visible));
    return bad.length ? { pass: false, why: `${bad.length} 个节点可见性不符（首个：${bad[0].tag}.${JSON.stringify(bad[0].attrs)}）` } : { pass: true, why: '可见性符合' };
  }
  if (a.kind === 'enabled') {
    const bad = ctx.probe.facts.filter((f) => (a.equals === false ? !f.disabled : f.disabled));
    return bad.length ? { pass: false, why: `${bad.length} 个节点可用性不符（首：${bad[0].tag}.${bad[0].attrs['data-*'] || ''} disabled=${bad[0].disabled}）` } : { pass: true, why: '可用性符合' };
  }
  if (a.kind === 'attr') {
    const f = ctx.probe.facts[a.index ?? 0];
    if (!f) return { pass: false, why: '节点不存在' };
    const got = f.attrs[a.name];
    if (a.equals != null && got !== String(a.equals)) return { pass: false, why: `${a.name}="${got}" ≠ "${a.equals}"` };
    if (a.present === true && got === undefined) return { pass: false, why: `缺少属性 ${a.name}` };
    return { pass: true, why: `${a.name}=${got}` };
  }
  if (a.kind === 'geometry') {
    const f = ctx.probe.facts[a.index ?? 0];
    if (!f) return { pass: false, why: '节点不存在' };
    if (a.heightEquals != null && f.rect.h !== a.heightEquals) return { pass: false, why: `高度 ${f.rect.h} ≠ ${a.heightEquals}` };
    if (a.heightLte != null && f.rect.h > a.heightLte) return { pass: false, why: `高度 ${f.rect.h} > ${a.heightLte}` };
    if (a.minSize != null && (f.rect.w < a.minSize || f.rect.h < a.minSize)) return { pass: false, why: `尺寸 ${f.rect.w}×${f.rect.h} 小于 ${a.minSize}` };
    if (a.noOverflow && f.overflow) return { pass: false, why: `出现滚动溢出（scrollH ${f.scrollH} > clientH ${f.clientH}）` };
    if (a.insideViewport && ctx.probe.viewport) {
      const vp = ctx.probe.viewport;
      if (f.rect.x < -1 || f.rect.y < -1 || f.rect.x + f.rect.w > vp.w + 2 || f.rect.y + f.rect.h > vp.h + 2) return { pass: false, why: `超出视口 ${JSON.stringify(f.rect)} / ${JSON.stringify(vp)}` };
    }
    return { pass: true, why: `几何 ${f.rect.w}×${f.rect.h}（无溢出=${!f.overflow}）` };
  }
  if (a.kind === 'state') {
    const v = pick(ctx.state, a.path);
    if (a.equals !== undefined && v !== a.equals) return { pass: false, why: `${a.path} = ${JSON.stringify(v)} ≠ ${JSON.stringify(a.equals)}` };
    if (a.gte != null && !(v >= a.gte)) return { pass: false, why: `${a.path} = ${v} < ${a.gte}` };
    if (a.lte != null && !(v <= a.lte)) return { pass: false, why: `${a.path} = ${v} > ${a.lte}` };
    if (a.exists === true && v == null) return { pass: false, why: `${a.path} 不存在` };
    if (a.matches && !new RegExp(a.matches).test(String(v))) return { pass: false, why: `${a.path} = ${v} 不匹配 /${a.matches}/` };
    return { pass: true, why: `${a.path} = ${JSON.stringify(v)?.slice(0, 60)}` };
  }
  if (a.kind === 'value') {
    const f = ctx.probe.facts[a.index ?? 0];
    if (!f) return { pass: false, why: '目标输入框不存在' };
    const v = String(f.value ?? '');
    if (a.empty === true) return v.trim() ? { pass: false, why: `期望为空，实际「${v.slice(0, 40)}」` } : { pass: true, why: '确为空' };
    if (a.equals != null && v !== a.equals) return { pass: false, why: `值「${v.slice(0, 60)}」≠「${String(a.equals).slice(0, 60)}」` };
    if (a.includes && !v.includes(a.includes)) return { pass: false, why: `值里没有「${a.includes}」：${v.slice(0, 80)}` };
    if (a.matches && !new RegExp(a.matches).test(v)) return { pass: false, why: `值不匹配 /${a.matches}/：${v.slice(0, 80)}` };
    return { pass: true, why: `值命中（${v.length} 字）` };
  }
  if (a.kind === 'scrollTop') {
    const f = ctx.probe.facts[a.index ?? 0];
    if (!f) return { pass: false, why: `${a.selector || '目标'} 节点不存在` };
    const v = Number(f.scrollTop || 0);
    if (a.equals != null && v !== a.equals) return { pass: false, why: `scrollTop ${v} ≠ ${a.equals}` };
    if (a.gte != null && !(v >= a.gte)) return { pass: false, why: `scrollTop ${v} < ${a.gte}` };
    if (a.lte != null && !(v <= a.lte)) return { pass: false, why: `scrollTop ${v} > ${a.lte}` };
    return { pass: true, why: `scrollTop ${v}` };
  }
  if (a.kind === 'lastOp') {
    const hist = ctx.state?.operationHistory || {};
    const ids = Object.keys(hist);
    if (!ids.length) return { pass: false, why: `operationHistory 为空（rev=${ctx.state?.rev}）：操作没有落盘` };
    const last = hist[ids[ids.length - 1]];
    if (a.status && last.status !== a.status) return { pass: false, why: `末条操作 status=${last.status}，期望 ${a.status}（type=${last.type}）` };
    if (a.type && last.type !== a.type) return { pass: false, why: `末条操作 type=${last.type}，期望 ${a.type}` };
    return { pass: true, why: `末条操作 ${last.type} / ${last.status}` };
  }
  if (a.kind === 'revIncreased') {
    const now = ctx.state?.meta?.revision ?? ctx.state?.rev ?? 0;
    const delta = now - (ctx.revBefore ?? 0);
    return delta > 0 ? { pass: true, why: `revision +${delta}` } : { pass: false, why: `revision 未增加（${ctx.revBefore} → ${now}）` };
  }
  return { pass: false, why: `未知断言 kind=${a.kind}` };
}

// ── 执行 ────────────────────────────────────────────────────────
const { task, page } = await attachSpace('NOAPI-RC55B');
const pageErrors = [];
page.on?.('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));

const results = [];
let currentPreset = null;

async function boot(chatId, preset) {
  await page.goto(BASE_URL, { timeout: 30000 });
  const ready = await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'TAVERN_READY', timeout: 25000 });
  if (!ready.ok) throw new Error('TAVERN_READY');
  // 宿主对象名由 config.hostApi 指定。必须装成 **getter** 实时解析：
  // 酒馆就绪那一刻卡的运行时对象还不存在（选卡/进聊天后才创建，且会 destroy 重建），
  // 早期取值会捕成 null，之后永远指不到。
  await page.evaluate((n) => {
    window.__NOAPI_HOST_NAME__ = n;
    try {
      Object.defineProperty(window, '__NOAPI_HOST__', {
        configurable: true,
        get() { return window[window.__NOAPI_HOST_NAME__] || null; },
      });
    } catch (e) { console.log('[NOAPI] host getter 装不上', e.message); }
  }, HOST);
  await page.evaluate(installRuntime);
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
  }, avatar);
  await page.waitForTimeout(2500);
  await page.evaluate(async (c) => { await window.SillyTavern.getContext().openCharacterChat(c); }, chatId);
  const shown = await waitFor(page, (o) => {
    const f = document.getElementById(o.pid);
    const v = window.__NOAPI_HOST__ && window.__NOAPI_HOST__.read ? window.__NOAPI_HOST__.read() : null;
    return { ok: !!f && getComputedStyle(f).display !== 'none' && !!(v && v.state && v.state.meta && v.state.meta.initialized) };
  }, { pid: PHONE_ID }, { label: 'PHONE', timeout: 25000 });
  await page.evaluate((id) => { window.__NOAPI_PHONE_ID__ = id; }, PHONE_ID);
  if (!shown.ok) throw new Error('PHONE_NOT_READY: ' + JSON.stringify(shown.last));
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  await page.evaluate(() => window.__NOAPI__.startDomWatch());
  currentPreset = preset;
  log('BOOTED', chatId, 'preset=', preset, 'phone=', PHONE_ID, 'wheel=', WHEEL_ID);
}

// ego 运行时里 process.execPath 是 ego.exe，不能当 node 用（基线 run.mjs 踩过同一个坑）
const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';

// ── 用例之间的"廉价复位"（不重载整页） ─────────────────────────────
// 整页重载要重新等 UI + 4 个第三方扩展初始化（2.5–4 s/次），既慢又是假红来源。
// 这里分三档，逐档验证后再降级：
//   ① 同预置 → 内存注入（Mvu.replaceMvuData）把状态打回基线，约几十毫秒
//   ② 换预置 → 重播文件 + reloadCurrentChat / openCharacterChat（ST 从磁盘重读）
//   ③ 上面都失败 → 退回整页 boot()
let session = { booted: false, key: null, chatId: null, baseline: null };

async function captureBaseline() {
  // 记录"承载状态的最后一楼"与它的完整状态，供内存注回
  const snap = await page.evaluate(() => {
    const ctx = window.SillyTavern.getContext();
    const rows = ctx.chat || [];
    let target = null, vars = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      try {
        const v = window.Mvu.getMvuData({ type: 'message', message_id: rows[i].message_id });
        if (v?.stat_data?.shenghao?.meta?.initialized) { target = rows[i]; vars = v; break; }
      } catch { }
    }
    if (!target) return null;
    return { messageId: target.message_id, state: vars.stat_data.shenghao, journal: vars.cj_native_operations ?? null, revision: vars.stat_data.shenghao.meta.revision, initKey: vars.stat_data.shenghao.meta.initKey };
  });
  return snap;
}

async function restoreBaseline(baseline) {
  const ok = await page.evaluate((b) => {
    const rows = window.SillyTavern.getContext().chat || [];
    const target = rows.find((m) => m.message_id === b.messageId) || rows[rows.length - 1];
    if (!target) return { ok: false, why: 'NO_TARGET_MESSAGE' };
    try {
      const vars = window.Mvu.getMvuData({ type: 'message', message_id: target.message_id }) || {};
      vars.stat_data = { ...(vars.stat_data || {}), shenghao: b.state };
      if (b.journal) vars.cj_native_operations = b.journal; else delete vars.cj_native_operations;
      window.Mvu.replaceMvuData(vars, { type: 'message', message_id: target.message_id });
      return { ok: true, messageId: target.message_id };
    } catch (e) { return { ok: false, why: String((e && e.message) || e) }; }
  }, baseline);
  if (!ok.ok) return ok;
  // 等宿主重新读回（MVU 事件 → host 的 VARIABLE_UPDATE_ENDED → schedule）
  const back = await waitFor(page, (rev) => {
    const v = window.__NOAPI_HOST__ && window.__NOAPI_HOST__.read ? window.__NOAPI_HOST__.read() : null;
    return { ok: !!v && v.state && v.state.meta && v.state.meta.revision === rev };
  }, baseline.revision, { label: 'RESTORE', timeout: 3000, interval: 150 });
  return { ok: back.ok, why: back.ok ? '' : 'RESTORE_NOT_APPLIED', last: back.last };
}

async function reloadCurrentChatCheap(chatId) {
  // 先试 ST 自己的 reloadCurrentChat（带 mutex），再试 openCharacterChat（从磁盘读），都不行就返回 false。
  // 关键：reloadCurrentChat 只重读"当前那个聊天"。目标聊天不是当前聊天时必须走 openCharacterChat，
  // 否则会把旧聊天的状态当成本次基线（表现为"换了预置但数据没变"）。
  const tried = await page.evaluate(async (c) => {
    const ctx = window.SillyTavern.getContext();
    const out = [];
    const current = ctx.chatId || null;
    if (current === c && typeof ctx.reloadCurrentChat === 'function') {
      try { await ctx.reloadCurrentChat(); return { ok: true, how: 'reloadCurrentChat' }; }
      catch (e) { out.push('reloadCurrentChat:fail:' + ((e && e.message) || e)); }
    }
    if (typeof ctx.openCharacterChat === 'function') {
      try { await ctx.openCharacterChat(c); return { ok: true, how: 'openCharacterChat' }; }
      catch (e) { out.push('openCharacterChat:fail:' + ((e && e.message) || e)); }
    }
    return { ok: false, why: out.join(' | ') || 'no_chat_reload_api' };
  }, chatId);
  if (!tried.ok) return tried;
  return waitedPhone(tried);
}

async function waitedPhone(prev) {
  const shown = await waitFor(page, (o) => {
    const f = document.getElementById(o.pid);
    const v = window.__NOAPI_HOST__ && window.__NOAPI_HOST__.read ? window.__NOAPI_HOST__.read() : null;
    return { ok: !!f && getComputedStyle(f).display !== 'none' && !!(v && v.state && v.state.meta && v.state.meta.initialized) };
  }, { pid: PHONE_ID }, { label: 'PHONE', timeout: 12000 });
  if (!shown.ok) return { ok: false, how: prev && prev.how, why: 'PHONE_NOT_READY_AFTER_RELOAD' };
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  return { ok: true, how: prev && prev.how };
}

/** 一条用例开始前，把现场恢复到该用例的基线；返回耗时与所用档位 */
async function ensureCase(preset, seedArgs) {
  const t0 = Date.now();
  const key = preset + '|' + JSON.stringify(seedArgs || []);
  if (CTL.forceBoot) {
    // 对照用：强制走"每条用例整页重载"的老路径，用来实测优化前后的差异
    const seed = reseed(preset, seedArgs);
    await boot(seed.chatId, preset);
    session = { booted: true, key, chatId: seed.chatId, baseline: await captureBaseline() };
    return { mode: 'forced-full-boot', ms: Date.now() - t0, chatId: seed.chatId };
  }
  if (session.booted && session.key === key && session.baseline) {
    let r = await restoreBaseline(session.baseline);
    if (!r.ok) {
      // 刚做完一次"会写状态"的操作后，宿主可能还在 busy / lineage 迁移中，首次注回会被覆盖。
      // 等一下再注一次，比直接退回"重读聊天"（秒级）便宜得多。
      await page.waitForTimeout(600);
      r = await restoreBaseline(session.baseline);
    }
    if (r.ok) return { mode: 'memory', ms: Date.now() - t0, chatId: session.chatId };
    log('内存复位失败，退回重播', r.why, r.last);
  }
  const seed = reseed(preset, seedArgs);
  if (session.booted) {
    const r = await reloadCurrentChatCheap(seed.chatId);
    if (r.ok) {
      const baseline = await captureBaseline();
      // 用 initKey 证明"真的读到了这次新播的档"——比 revision 数字可靠（带 swipe 楼的预置基线 revision 不是 1）
      if (baseline && seed.initKey && baseline.initKey === seed.initKey) {
        session = { booted: true, key, chatId: seed.chatId, baseline };
        return { mode: 'chat-reload:' + (r.how || ''), ms: Date.now() - t0, chatId: seed.chatId };
      }
      log('廉价重读的基线对不上本次预置', JSON.stringify({ how: r.how, got: baseline && baseline.initKey, want: seed.initKey }));
    }
    log('廉价重读不可用，退回整页 boot');
  }
  await boot(seed.chatId, preset);
  const baseline = await captureBaseline();
  session = { booted: true, key, chatId: seed.chatId, baseline };
  return { mode: 'full-boot', ms: Date.now() - t0, chatId: seed.chatId };
}


function reseed(preset, extraArgs) {
  // 播种命令由 config.seed 描述，执行器不写死任何项目的脚本名。
  // {bin, args:[...], chatIdTemplate}；用例可用 seedArgs 追加参数（例如 --with-swipe-floor）
  const seed = config.seed || {};
  if (!seed.args || !seed.args.length) throw Object.assign(new Error('config.seed 未配置：需要 { bin, args, chatIdTemplate }'), { classified: { code: 'F7', action: 'abort', reason: 'config.seed 缺失' } });
  const fill = (s) => String(s)
    .replaceAll('{preset}', preset)
    .replaceAll('{avatar}', avatar)
    .replaceAll('{char}', avatar.replace(/\.png$/i, ''));
  const bin = seed.bin === 'node' || !seed.bin ? NODE_BIN : fill(seed.bin);
  const args = seed.args.map(fill).concat((extraArgs || []).map(fill));
  const out = execFileSync(bin, args, { encoding: 'utf8', cwd: ROOT });
  if (!/"ok": true/.test(out)) throw Object.assign(new Error('SEED_FAILED: ' + out.slice(0, 300)), { classified: { code: 'F0', action: 'abort', reason: '预置播种失败：' + out.slice(0, 200) } });
  const parsed = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
  return {
    chatId: parsed.chatId || fill(seed.chatIdTemplate || '__NOAPI_TEST_{preset}'),
    initKey: parsed.initKey || null,
  };
}

async function runCase(c) {
  const res = { id: c.id, title: c.title || '', preset: c.preset || 'three_cards', steps: [], status: 'PASS', code: 'PASS', reason: '' };
  const tCase = Date.now();
  try {
    // 每条用例开始前把现场恢复到该用例的基线。优先内存注入（几十毫秒），
    // 换预置时才重播文件 + 让 ST 重读聊天；只有这两条都不成立才整页重载。
    const ensured = await ensureCase(res.preset, c.seedArgs);
    res.reset = { mode: ensured.mode, ms: ensured.ms };
    let ctx = { revBefore: (await stateOf(page))?.rev ?? 0, chatId: ensured.chatId };
    for (const st of c.steps) {
      const rec = { act: st.act, ok: true };
      try {
        if (st.act === 'expand') {
          await page.evaluate((o) => {
            const t = document.getElementById(o.pid).contentDocument;
            const f = t.querySelector('.folded, .folded-bar, #folded');
            if (f) { f.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 })); f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 })); f.click(); }
          }, { pid: PHONE_ID });
          await page.waitForTimeout(500);
        } else if (st.act === 'tab') {
          await page.evaluate((o) => {
            const d = document.getElementById(o.pid).contentDocument;
            const b = [...d.querySelectorAll('nav.bottom .tab')].find((x) => x.dataset.tab === o.tab);
            b?.click();
          }, { pid: PHONE_ID, tab: st.tab });
          await page.waitForTimeout(400);
        } else if (st.act === 'click') {
          const r = await page.evaluate((o) => window.__NOAPI__.tap(o.selector, { path: o.path, index: o.index, skipDisabled: o.skipDisabled }), { selector: st.selector, path: framePath(st.frame || 'phone'), index: st.index, skipDisabled: !!st.skipDisabled });
          rec.gates = r.gates;
          if (!r.ok) {
            rec.ok = false;
            rec.classified = classify({
              violations: await page.evaluate(() => window.__NOAPI__.violations()),
              target: { found: !!(r.facts && r.facts.found), count: (r.facts && r.facts.count) || 0, indexGiven: st.index != null, selector: st.selector, framePath: framePath(st.frame || 'phone') },
              visibility: r.facts && r.facts.visibility,
              interact: r.facts ? { disabled: r.facts.disabled, ariaDisabled: r.facts.ariaDisabled, pointerEventsNone: r.facts.pointerEventsNone, coveredBy: r.facts.visibility && r.facts.visibility.coveredBy, hostBusy: r.facts.hostBusy, busyReasons: r.facts.busyReasons } : {},
              reaction: { domChanged: false, stateChanged: false },
            });
            throw Object.assign(new Error(r.code + ' 点击被门拦住'), { classified: rec.classified });
          }
          await page.waitForTimeout(st.settle || 700);
        } else if (st.act === 'openWheel') {
          await page.evaluate((o) => window.__NOAPI__.tap(`[data-open-wheel="${o.type}"]`, { path: o.path }), { type: st.type || 'play', path: framePath('phone') });
          // 握手判据与"哪个模式"解耦：play 有三环、pack 有两池、casino 有三色，不能都等 .ring
          const hs = await waitFor(page, (o) => {
            const f = document.getElementById(o.pid);
            const d = f && f.contentDocument;
            const wd = window.__NOAPI_HOST__ && window.__NOAPI_HOST__.wheelDebug ? window.__NOAPI_HOST__.wheelDebug() : {};
            return {
              ok: !!d && wd.ready === true && getComputedStyle(f).display !== 'none'
                && d.querySelectorAll('[data-mode]').length >= 3
                && (d.querySelectorAll('#wfSvg .ring').length > 0 || d.querySelectorAll('[data-pool]').length > 0 || d.querySelectorAll('[data-bet]').length > 0),
              rings: d ? d.querySelectorAll('#wfSvg .ring').length : 0,
              pools: d ? d.querySelectorAll('[data-pool]').length : 0,
              bets: d ? d.querySelectorAll('[data-bet]').length : 0,
            };
          }, { pid: WHEEL_ID }, { label: 'WHEEL_HANDSHAKE', timeout: 20000 });
          if (!hs.ok) throw Object.assign(new Error('WHEEL_HANDSHAKE 失败：' + JSON.stringify(hs.last)), { classified: { code: 'F0', action: 'abort', reason: '轮盘 iframe 没完成握手（ready/mode/盘面任一未就位）' } });
          await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
          await page.waitForTimeout(400);
        } else if (st.act === 'waitForEl') {
          const got = await waitFor(page, (o) => {
            const t = (() => { let w = window; for (const id of o.path) { const d = w.document; const el = d.getElementById(id) || d.querySelector(`iframe[name="${id}"]`); if (!el) return null; w = el.contentWindow; if (!w) return null; } return w.document; })();
            if (!t) return { ok: false };
            let n = 0; try { n = t.querySelectorAll(o.selector).length; } catch { }
            return { ok: n > 0, count: n };
          }, { path: framePath(st.frame || 'wheel'), selector: st.selector }, { label: 'WAIT_EL_' + st.selector, timeout: st.timeout || 15000, interval: 250 });
          if (!got.ok) throw Object.assign(new Error(`等不到 ${st.selector}（${st.timeout || 15000}ms）`), { classified: { code: 'F1', action: 'continue', reason: `等不到 ${st.selector}` } });
        } else if (st.act === 'wheelMode') {
          await page.evaluate((o) => window.__NOAPI__.tap(`[data-mode="${o.mode}"]`, { path: o.path }), { mode: st.mode, path: framePath('wheel') });
          await page.waitForTimeout(st.settle || 800);
        } else if (st.act === 'openModal') {
          await page.evaluate((o) => window.__NOAPI__.tap(`[data-act="${o.a}"]`, { path: o.path, index: o.index }), { a: st.modal, index: st.index, path: framePath('phone') });
          await page.waitForTimeout(st.settle || 700);
        } else if (st.act === 'closeModal') {
          await page.evaluate((o) => {
            const d = document.getElementById(o.pid).contentDocument;
            const btn = d.querySelector('[data-act="cancel"]') || d.querySelector('[data-act="close-modal"]') || [...d.querySelectorAll('button')].find((b) => /关|×|✕|返回/.test(String(b.textContent || '')));
            btn?.click();
          }, { pid: PHONE_ID });
          await page.waitForTimeout(400);
        } else if (st.act === 'setDock') {
          await page.evaluate((v) => { window.__NOAPI_HOST__.preferences({ displayDock: v }); }, st.value);
          await page.waitForTimeout(900);
        } else if (st.act === 'reload') {
          // Lifecycle：真刷新（这条就是要验"刷新之后状态还在"，非真刷不可）
          await boot(ctx.chatId, res.preset);
          session.baseline = await captureBaseline();
          await page.waitForTimeout(st.settle || 1200);
        } else if (st.act === 'slash') {
          const r = await page.evaluate(async (cmd) => {
            const h = window.TavernHelper;
            if (!h || typeof h.triggerSlash !== 'function') return { ok: false, why: 'NO_triggerSlash' };
            try { await h.triggerSlash(cmd); return { ok: true }; } catch (e) { return { ok: false, why: String((e && e.message) || e) }; }
          }, st.cmd);
          await page.waitForTimeout(st.settle || 1500);
          if (!r.ok) throw Object.assign(new Error('slash 失败：' + JSON.stringify(r)), { classified: { code: 'F0', action: 'abort', reason: 'TavernHelper.triggerSlash 不可用或命令失败：' + JSON.stringify(r) } });
        } else if (st.act === 'swipe') {
          // 坑：`.swipe_left` 每个楼层各有一个，第一个往往是模板里的 0×0 隐藏元素，
          // 直接点第一个等于空点。必须取"最后一楼里可见的那个"，并派发完整指针链。
          const r = await page.evaluate((dir) => {
            const cls = dir === 'right' ? '.swipe_right' : '.swipe_left';
            const visible = (root) => [...(root || document).querySelectorAll(cls)].find((el) => {
              const b = el.getBoundingClientRect();
              return b.width > 1 && b.height > 1;
            });
            const lastMes = document.querySelector('#chat .mes:last-of-type') || document.querySelector('.mes:last-of-type');
            const el = visible(lastMes) || visible(document);
            if (!el) return { ok: false, why: 'NO_VISIBLE_SWIPE_BUTTON' };
            const b = el.getBoundingClientRect();
            const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
            const mk = (type, extra) => new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1, view: window }, extra || {}));
            try {
              el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: cx, clientY: cy }));
              el.dispatchEvent(mk('mousedown'));
              el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy }));
              el.dispatchEvent(mk('mouseup'));
              el.dispatchEvent(mk('click', { buttons: 0, detail: 1 }));
            } catch (e) { return { ok: false, why: 'DISPATCH_FAILED:' + e.message }; }
            return { ok: true, rect: { w: Math.round(b.width), h: Math.round(b.height) } };
          }, st.dir || 'left');
          await page.waitForTimeout(st.settle || 2000);
          if (!r.ok) throw Object.assign(new Error('swipe 不可用：' + JSON.stringify(r)), { classified: { code: 'F1', action: 'continue', reason: '最后一楼没有可见的 swipe 箭头（该楼可能只有 1 个 swipe）' } });
        } else if (st.act === 'observe') {
          // 只记录不断言：用于"我不知道会怎样，但要把现场留下来"
          rec.act = 'observe:' + (st.probe || '');
          rec.detail = `${st.label || st.probe} = ${JSON.stringify(await pageProbe(page, st.probe))}`;
          res.steps.push(rec);
          continue;
        } else if (st.act === 'scrollTo') {
          // rc.50：把指定滚动容器滚到 top，用于验证「点按钮不跳回顶部」
          const r = await page.evaluate((o) => {
            let win = window;
            for (const id of o.path) {
              const doc = win.document;
              const el = String(id).startsWith('#') ? doc.querySelectorAll('iframe,frame')[Number(String(id).slice(1))] : (doc.getElementById(id) || doc.querySelector(`iframe[name="${id}"]`));
              if (!el) return { ok: false, why: 'FRAME_NOT_FOUND' };
              win = el.contentWindow;
            }
            const el = win.document.querySelector(o.selector);
            if (!el) return { ok: false, why: 'NODE_NOT_FOUND' };
            if (o.style) { try { Object.assign(el.style, o.style); } catch { } }
            if (o.append) {
              const pad = win.document.createElement('div');
              pad.setAttribute('data-noapi-scroll-pad', '1');
              pad.style.height = Number(o.append) + 'px';
              el.appendChild(pad);
            }
            el.scrollTop = Number(o.top) || 0;
            return { ok: true, scrollTop: Math.round(el.scrollTop), scrollH: el.scrollHeight, clientH: el.clientHeight };
          }, { path: framePath(st.frame || 'phone'), selector: st.selector, top: st.top, style: st.style, append: st.append });
          rec.detail = JSON.stringify(r);
          if (!r.ok) throw Object.assign(new Error(`${st.selector} 滚动失败：${r.why}`), { classified: { code: 'F3', action: 'continue', reason: r.why } });
          await page.waitForTimeout(st.settle || 120);
        } else if (st.act === 'clickIf') {
          // rc.50：目标存在才点，不存在记 skipped 继续（用于「可能已佩戴」这类前置态）
          const r = await page.evaluate((o) => window.__NOAPI__.tap(o.selector, { path: o.path, index: o.index }), { selector: st.selector, path: framePath(st.frame || 'phone'), index: st.index });
          rec.detail = r.ok ? 'clicked' : ('skipped:' + (r.code || 'NOT_FOUND'));
          if (r.ok) await page.waitForTimeout(st.settle || 600);
        } else if (st.act === 'clearInput') {
          // rc.50：用例往输入框填过字就清掉，别把测试残留留在真聊天的输入框里
          const r = await page.evaluate((o) => {
            let win = window;
            for (const id of o.path) {
              const doc = win.document;
              const el = String(id).startsWith('#') ? doc.querySelectorAll('iframe,frame')[Number(String(id).slice(1))] : (doc.getElementById(id) || doc.querySelector(`iframe[name="${id}"]`));
              if (!el) return { ok: false, why: 'FRAME_NOT_FOUND' };
              win = el.contentWindow;
            }
            const el = win.document.querySelector(o.selector);
            if (!el) return { ok: false, why: 'NODE_NOT_FOUND' };
            const before = String(el.value || '').length;
            el.value = '';
            el.dispatchEvent(new win.Event('input', { bubbles: true }));
            el.dispatchEvent(new win.Event('change', { bubbles: true }));
            return { ok: true, before, after: String(el.value || '').length };
          }, { path: framePath(st.frame || 'top'), selector: st.selector });
          rec.detail = JSON.stringify(r);
          if (!r.ok) throw Object.assign(new Error(`清空 ${st.selector} 失败：${r.why}`), { classified: { code: 'F3', action: 'continue', reason: r.why } });
        } else if (st.act === 'wait') {
          await page.waitForTimeout(st.ms || 500);
        } else if (st.act === 'assert') {
          if (st.kind === 'pageProbe') {
            const v = await pageProbe(page, st.probe);
            rec.assert = 'pageProbe:' + st.probe;
            rec.detail = `${st.probe} = ${JSON.stringify(v)}`;
            const bad = (st.equals !== undefined && v !== st.equals)
              || (st.gte != null && !(v >= st.gte))
              || (st.lte != null && !(v <= st.lte))
              || (st.truthy === true && !v);
            if (bad) throw Object.assign(new Error(`${st.probe} = ${JSON.stringify(v)}，不满足 ${JSON.stringify({ equals: st.equals, gte: st.gte, lte: st.lte, truthy: st.truthy })}`), { classified: { code: 'F6', action: 'continue', reason: `${st.probe} 断言不成立：${JSON.stringify(v)}` } });
            res.steps.push(rec);
            continue;
          }
          if (st.kind === 'pageText') {
            // 整页文本断言（用于"计数类"文案，例如图鉴 N/12 藏在长列表深处）
            let txt = '', why = '';
            const got = await waitFor(page, (o) => {
              const t = window.__NOAPI__.allText(o.cap);
              txt = t;
              return { ok: new RegExp(o.matches).test(t), len: t.length, sample: t.slice(0, 160) };
            }, { matches: st.matches, cap: st.cap || 300000 }, { label: 'PAGE_TEXT', timeout: st.timeout || 6000, interval: 400 });
            if (!got.ok && got.last) { why = got.last.why || ''; if (got.last.len != null && got.last.len > 0) txt = got.last.sample || txt; }
            rec.assert = st.kind;
            rec.detail = got.ok ? `整页文本匹配 /${st.matches}/` : `整页 ${txt.length} 字里没找到 /${st.matches}/${why ? '（' + why + '）' : ''}（片段：${txt.slice(0, 120)}…）`;
            if (!got.ok) {
              throw Object.assign(new Error(rec.detail), { classified: { code: 'F6', action: 'continue', reason: rec.detail } });
            }
            res.steps.push(rec);
            continue;
          }
          if (st.kind === 'state' || st.kind === 'revIncreased' || st.kind === 'lastOp') {
            // 状态类断言允许短暂重试：宿主写入是异步的，单次取样会把"还没落盘"误判成"没落盘"
            const deadline = Date.now() + (st.timeout || 6000);
            let state = null, out = null;
            while (Date.now() < deadline) {
              state = (await stateOf(page))?.state ?? null;
              out = evalAssert(st, { probe: { count: 1, facts: [] }, state, revBefore: ctx.revBefore });
              if (out.pass) break;
              await page.waitForTimeout(400);
            }
            rec.assert = st.kind;
            rec.detail = out ? out.why : 'no state';
            if (!out || !out.pass) throw Object.assign(new Error(rec.detail), { classified: { code: st.kind === 'revIncreased' ? 'F5' : 'F6', action: 'continue', reason: rec.detail } });
            res.steps.push(rec);
            continue;
          }
          const state = null;
          const pr = await probe(page, st.frame || 'phone', st.selector || 'body');
          const out = evalAssert(st, { probe: pr, state, revBefore: ctx.revBefore });
          rec.assert = st.kind;
          rec.detail = out.why;
          if (!out.pass) {
            rec.ok = false;
            // 断言失败与"寻址歧义"无关：这里不是点击，别让归因器把 count>1 误判成 F4
            const ev = {
              violations: await page.evaluate(() => window.__NOAPI__.violations()),
              target: { found: pr.count > 0, count: 1, indexGiven: true, selector: st.selector },
              visibility: { visible: pr.facts[0] ? pr.facts[0].visible : undefined },
              interact: pr.facts[0] ? { disabled: pr.facts[0].disabled } : {},
              reaction: { domChanged: true, stateChanged: false },
              render: { expectation: `断言 ${st.kind}: ${JSON.stringify(st)}`, matched: false, revisionBefore: ctx.revBefore, revisionAfter: null },
            };
            throw Object.assign(new Error(out.why), { classified: classify(ev) });
          }
        } else {
          throw Object.assign(new Error(`未知 action ${st.act}`), { classified: { ...{ code: 'F7', action: 'abort' }, reason: `未知 action ${st.act}` } });
        }
      } catch (e) {
        rec.ok = false;
        rec.error = String(e.message || e);
        rec.classified = e.classified || classify({ violations: [], target: { found: true, count: 1 }, error: String(e.message || e) });
        res.steps.push(rec);
        res.status = 'FAIL';
        res.code = rec.classified.code;
        res.reason = rec.classified.reason || rec.error;
        break;
      }
      res.steps.push(rec);
    }
    const apiViol = await page.evaluate(() => window.__NOAPI__.violations());
    res.violations = apiViol;
    if (apiViol.length) { res.status = 'FAIL'; res.code = 'F8'; res.reason = `零 API 违约：${apiViol.slice(0, 3).join(' | ')}`; }
  } catch (e) {
    res.status = 'FAIL';
    res.code = res.code === 'PASS' ? 'F0' : res.code;
    res.reason = res.reason || String(e.message || e);
    results.push(res);
    log('CASE', res.id, res.status, res.code, res.reason);
    return res;
  }
  results.push(res);
  log('CASE', res.id, res.status, res.code, `复位=${res.reset?.mode || '?'} ${res.reset?.ms || 0}ms 总=${Date.now() - tCase}ms`, res.reason || res.steps.filter((s) => s.detail).map((s) => s.detail).slice(-1)[0] || '');
  return res;
}

const cases = (suite.cases || []).filter((c) => !only || only.split(',').some((x) => c.id.includes(x)));
console.log(`\n=== 跑 ${cases.length} 条用例（${suite.name || suitePath}）===\n`);
try {
  for (const c of cases) await runCase(c);
} finally {
  const summary = {
    at: new Date().toISOString(), suite: path.basename(suitePath), avatar,
    total: results.length,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status !== 'PASS').length,
    apiCalls: results.reduce((n, r) => n + (r.violations ? r.violations.length : 0), 0),
    results,
  };
  const out = path.join(OUT_DIR, `suite-result-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8');
  console.log('\n===== 汇总 =====');
  for (const r of results) console.log(`${r.status === 'PASS' ? '✔' : '✘'} ${r.code.padEnd(5)} ${r.id}${r.reason ? ' — ' + r.reason : ''}`);
  console.log(`\nPASS ${summary.pass}/${summary.total}　apiCalls: ${summary.apiCalls}`);
  console.log('结果：', out);
}




// 收尾：ego 规矩——一个目标一个 space，用完必须关掉，别把窗口堆在任务栏
await finishSpace(task);












