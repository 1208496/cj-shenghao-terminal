// scripts/noapi/discover.mjs —— 结构自动探测（只发现，不断言）
//
// 目的：拿到一张卡（本项目或其他卡）时，先把"可点的东西长什么样"dump 出来，
// 再据实写 suite.json。绝不靠人猜类名，也绝不让探测结果直接进断言
// （启发式命中即 PASS 是假绿的源头 —— 见 rc47 对照报告 D7）。
//
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/discover.mjs')"

import fs from 'node:fs';
import path from 'node:path';
import { assertSafeUrl, assertSafePath } from './guards.mjs';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE_URL = 'http://127.0.0.1:8001/';
const ROOT = 'E:\\SHZDCHOSSS';
assertSafeUrl(BASE_URL);

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const avatar = arg('avatar', '神豪终端5.png');
const chatName = arg('chat', '__NOAPI_TEST_three_cards');

const OUT_DIR = path.resolve(ROOT, '.work', 'noapi');
assertSafePath(OUT_DIR, [ROOT]);
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log('[DISCOVER]', ...a);

// 在页面里跑：把一个 document 的结构压成可读清单
const DUMP_FN = function (opts) {
  const doc = opts.doc;
  const OUT = {
    title: (doc.querySelector('title') || {}).textContent || '',
    nodes: 0,
    dataAttrs: {},   // 属性名 → 取值集合
    ids: [],         // 有 id 的元素（tag#id + 文本）
    buttons: [],     // 可点候选
    sections: [],    // 顶层容器
    outline: [],     // 浅层结构
  };
  const all = doc.querySelectorAll('*');
  OUT.nodes = all.length;
  const cap = (arr, v, n) => { if (!arr.includes(v) && arr.length < n) arr.push(v); };

  for (const el of all) {
    for (const a of el.attributes) {
      if (!a.name.startsWith('data-')) continue;
      if (!OUT.dataAttrs[a.name]) OUT.dataAttrs[a.name] = [];
      cap(OUT.dataAttrs[a.name], a.value, opts.maxAttrValues || 24);
    }
    if (el.id && OUT.ids.length < (opts.maxIds || 120)) {
      OUT.ids.push(`${el.tagName.toLowerCase()}#${el.id}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} :: ${String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)}`);
    }
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const clickable = tag === 'button' || tag === 'a' || role === 'button' || el.hasAttribute('data-open-wheel') || el.hasAttribute('data-tab') || el.onclick;
    if (clickable && OUT.buttons.length < (opts.maxButtons || 120)) {
      const r = el.getBoundingClientRect();
      OUT.buttons.push({
        tag, id: el.id || '', cls: String(el.className || '').slice(0, 60),
        text: String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        data: [...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `${a.name}=${a.value}`).join(' '),
        disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
      });
    }
  }

  const body = doc.body;
  const walk = (el, depth, maxDepth) => {
    if (!el || depth > maxDepth || OUT.outline.length > (opts.maxOutline || 260)) return;
    for (const ch of el.children) {
      const t = ch.tagName.toLowerCase();
      if (t === 'script' || t === 'style' || t === 'svg') continue;
      const cls = typeof ch.className === 'string' ? ch.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      const r = ch.getBoundingClientRect();
      OUT.outline.push(`${'  '.repeat(depth)}${t}${ch.id ? '#' + ch.id : ''}${cls ? '.' + cls : ''} [${Math.round(r.width)}×${Math.round(r.height)}]${ch.children.length ? '' : ' "' + String(ch.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) + '"'}`);
      walk(ch, depth + 1, maxDepth);
    }
  };
  walk(body, 0, opts.depth || 3);
  return OUT;
};

const { task, page } = await attachSpace();
const report = { at: new Date().toISOString(), avatar, chatName, phone: {}, wheel: {}, frames: [], folded: null };

try {
  await page.goto(BASE_URL, { timeout: 30000 });
  const ready = await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'TAVERN_READY', timeout: 25000 });
  if (!ready.ok) throw new Error('TAVERN_READY 失败');

  await page.evaluate(installRuntime);
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));

  const picked = await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) return { ok: false, avatars: ctx.characters.slice(-8).map((c) => c.avatar) };
    await ctx.selectCharacterById(idx);
    return { ok: true, name: ctx.characters[idx].name };
  }, avatar);
  if (!picked.ok) throw new Error('SELECT_CHAR: ' + JSON.stringify(picked));
  await page.waitForTimeout(2500);
  await page.evaluate(async (c) => { await window.SillyTavern.getContext().openCharacterChat(c); }, chatName);

  await waitFor(page, () => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const v = window.__CJ_SHENGHAO_V2__ && window.__CJ_SHENGHAO_V2__.read ? window.__CJ_SHENGHAO_V2__.read() : null;
    return { ok: !!f && !!(v && v.state && v.state.meta && v.state.meta.initialized) };
  }, null, { label: 'PHONE', timeout: 25000 });
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));

  // ① 折叠态：量折叠条（rc.36/37 的 56px 断言就在这里）
  report.folded = await page.evaluate(() => {
    const t = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const el = t.querySelector('.folded, .folded-bar, #folded');
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const cs = t.defaultView.getComputedStyle(el);
    return {
      found: true, cls: String(el.className), rect: { w: Math.round(r.width), h: Math.round(r.height) },
      text: String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      overflowY: cs.overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight,
      overflow: el.scrollHeight > el.clientHeight + 1,
    };
  });
  log('FOLDED', report.folded);

  // ② 展开 + 逐页探测
  await page.evaluate(() => {
    const t = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const f = t.querySelector('.folded, .folded-bar, #folded');
    if (f) { f.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 })); f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 })); f.click(); }
  });
  await page.waitForTimeout(600);

  const tabsList = await page.evaluate(() => {
    const t = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    return [...t.querySelectorAll('nav.bottom .tab')].map((b) => ({ tab: b.dataset.tab, text: String(b.textContent || '').trim().slice(0, 12) }));
  });
  report.tabs = tabsList;
  log('TABS', tabsList);

  report.perTab = {};
  for (const t of tabsList) {
    await page.evaluate((tab) => {
      const d = document.getElementById('cj-shenghao-phone-frame').contentDocument;
      [...d.querySelectorAll('nav.bottom .tab')].find((b) => b.dataset.tab === tab)?.click();
    }, t.tab);
    await page.waitForTimeout(350);
    report.perTab[t.tab] = await page.evaluate((fnSrc) => {
      const fn = eval('(' + fnSrc + ')');
      return fn({ doc: document.getElementById('cj-shenghao-phone-frame').contentDocument, depth: 3, maxIds: 60, maxButtons: 60 });
    }, DUMP_FN.toString());
  }
  log('PER_TAB 采集完成', Object.keys(report.perTab));

  // ③ 打开轮盘，dump 整个轮盘页
  await page.evaluate(() => window.__NOAPI__.tap('[data-open-wheel="play"]', { path: ['cj-shenghao-phone-frame'] }));
  const hs = await waitFor(page, () => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = f && f.contentDocument;
    const wd = window.__CJ_SHENGHAO_V2__ && window.__CJ_SHENGHAO_V2__.wheelDebug ? window.__CJ_SHENGHAO_V2__.wheelDebug() : {};
    return { ok: !!f && !!d && d.querySelectorAll('#wfSvg .ring').length > 0 && wd.ready === true };
  }, null, { label: 'WHEEL', timeout: 20000 });
  if (!hs.ok) throw new Error('WHEEL_HANDSHAKE 失败');

  report.wheel = await page.evaluate((fnSrc) => {
    const fn = eval('(' + fnSrc + ')');
    return fn({ doc: document.getElementById('cj-shenghao-wheel-frame').contentDocument, depth: 4, maxIds: 120, maxButtons: 120, maxOutline: 400 });
  }, DUMP_FN.toString());

  // ④ 叉号居中 + 全屏几何
  report.wheelGeom = await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = f.contentDocument;
    const close = d.querySelector('.wf-close, #wfClose, [data-wheel-close]');
    const fr = f.getBoundingClientRect();
    let closeInfo = null;
    if (close) {
      const r = close.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const chromeW = Math.max(0, fr.width - d.documentElement.clientWidth);
      const chromeH = Math.max(0, fr.height - d.documentElement.clientHeight);
      closeInfo = {
        cls: String(close.className), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        contentCenter: { x: Math.round(d.documentElement.clientWidth / 2), y: Math.round(d.documentElement.clientHeight / 2) },
        dx: Math.round(cx - d.documentElement.clientWidth / 2),
        dy: Math.round(cy - chromeH - d.documentElement.clientHeight / 2),
      };
    }
    return {
      frame: { w: Math.round(fr.width), h: Math.round(fr.height) },
      content: { w: d.documentElement.clientWidth, h: d.documentElement.clientHeight },
      close: closeInfo,
      modes: [...d.querySelectorAll('.wf-modes button')].map((b) => String(b.textContent || '').trim().slice(0, 14)),
      go: (() => { const g = d.getElementById('wfGo'); if (!g) return null; const r = g.getBoundingClientRect(); return { rect: { w: Math.round(r.width), h: Math.round(r.height) }, disabled: g.disabled }; })(),
      rings: d.querySelectorAll('#wfSvg .ring').length,
      svgNodes: d.querySelectorAll('#wfSvg *').length,
    };
  });
  log('WHEEL_GEOM', report.wheelGeom);

  const out = path.join(OUT_DIR, `discover-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n===== 摘要 =====');
  console.log('折叠条：', JSON.stringify(report.folded));
  console.log('五页 tab：', JSON.stringify(report.tabs));
  console.log('轮盘：', JSON.stringify(report.wheelGeom));
  console.log('轮盘页 data-* 属性：', JSON.stringify(Object.keys(report.wheel.dataAttrs || {})));
  console.log('轮盘页可点候选数：', (report.wheel.buttons || []).length);
  console.log('落盘：', out);
} catch (e) {
  const out = path.join(OUT_DIR, `discover-FATAL-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify({ ...report, fatal: String(e.message || e) }, null, 2), 'utf8');
  console.log('[DISCOVER] FATAL:', String(e.message || e), '→', out);
}

// 收尾：ego 规矩——一个目标一个 space，用完必须关掉，别把窗口堆在任务栏
await finishSpace(task);

