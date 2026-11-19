// scripts/noapi/discover-panels.mjs —— 第二轮探测：背包 / 商城 / 卡包 / 赌场 四个面板
//
// discover.mjs 只 dump 了五个页签与轮盘 play 模式；HANDOFF 欠着的 9 类断言都在这四个面板里，
// 所以先把它们的真实契约（data-* 属性）与可点节点 dump 出来，再据实写 suite。

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

const log = (...a) => console.log('[PANELS]', ...a);

const DUMP_FN = function (opts) {
  const doc = opts.doc;
  const OUT = { nodes: doc.querySelectorAll('*').length, dataAttrs: {}, ids: [], buttons: [], outline: [] };
  const cap = (arr, v, n) => { if (!arr.includes(v) && arr.length < n) arr.push(v); };
  for (const el of doc.querySelectorAll('*')) {
    for (const a of el.attributes) {
      if (!a.name.startsWith('data-')) continue;
      if (!OUT.dataAttrs[a.name]) OUT.dataAttrs[a.name] = [];
      cap(OUT.dataAttrs[a.name], a.value, 30);
    }
    if (el.id && OUT.ids.length < 100) OUT.ids.push(`${el.tagName.toLowerCase()}#${el.id}`);
    const tag = el.tagName.toLowerCase();
    const clickable = tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || [...el.attributes].some((a) => a.name.startsWith('data-act') || a.name.startsWith('data-mode') || a.name.startsWith('data-pay') || a.name.startsWith('data-asset-tab'));
    if (clickable && OUT.buttons.length < 90) {
      const r = el.getBoundingClientRect();
      OUT.buttons.push({ tag, id: el.id || '', cls: String(el.className || '').slice(0, 40), text: String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 46), data: [...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `${a.name}=${a.value}`).join(' '), disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true', rect: { w: Math.round(r.width), h: Math.round(r.height) } });
    }
  }
  const walk = (el, d, max) => {
    if (!el || d > max || OUT.outline.length > 300) return;
    for (const ch of el.children) {
      const t = ch.tagName.toLowerCase();
      if (t === 'script' || t === 'style' || t === 'svg') continue;
      const cls = typeof ch.className === 'string' ? ch.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      const r = ch.getBoundingClientRect();
      OUT.outline.push(`${'  '.repeat(d)}${t}${ch.id ? '#' + ch.id : ''}${cls ? '.' + cls : ''} [${Math.round(r.width)}×${Math.round(r.height)}]${ch.children.length ? '' : ' "' + String(ch.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28) + '"'}`);
      walk(ch, d + 1, max);
    }
  };
  walk(doc.body, 0, opts.depth || 4);
  return OUT;
};

const { task, page } = await attachSpace();
const report = { at: new Date().toISOString(), panels: {} };

const dumpPhone = () => page.evaluate((src) => {
  const fn = eval('(' + src + ')');
  return fn({ doc: document.getElementById('cj-shenghao-phone-frame').contentDocument, depth: 4 });
}, DUMP_FN.toString());
const dumpWheel = () => page.evaluate((src) => {
  const fn = eval('(' + src + ')');
  return fn({ doc: document.getElementById('cj-shenghao-wheel-frame').contentDocument, depth: 4 });
}, DUMP_FN.toString());

try {
  await page.goto(BASE_URL, { timeout: 30000 });
  await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'READY', timeout: 25000 });
  await page.evaluate(installRuntime);
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    await ctx.selectCharacterById(idx);
  }, avatar);
  await page.waitForTimeout(2500);
  await page.evaluate(async (c) => { await window.SillyTavern.getContext().openCharacterChat(c); }, chatName);
  await waitFor(page, () => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const v = window.__CJ_SHENGHAO_V2__ && window.__CJ_SHENGHAO_V2__.read ? window.__CJ_SHENGHAO_V2__.read() : null;
    return { ok: !!f && !!(v && v.state && v.state.meta && v.state.meta.initialized) };
  }, null, { label: 'PHONE', timeout: 25000 });
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));

  // 展开 + 切到轮盘页
  await page.evaluate(() => {
    const t = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const f = t.querySelector('.folded, .folded-bar, #folded');
    if (f) { f.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 })); f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 })); f.click(); }
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const d = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    [...d.querySelectorAll('nav.bottom .tab')].find((b) => b.dataset.tab === 'wheel')?.click();
  });
  await page.waitForTimeout(400);

  // ① 背包
  let r = await page.evaluate(() => window.__NOAPI__.tap('[data-act="open-bag"]', { path: ['cj-shenghao-phone-frame'] }));
  await page.waitForTimeout(700);
  report.panels.bag = { tap: { ok: r.ok, code: r.code }, dump: await dumpPhone() };
  log('BAG buttons', (report.panels.bag.dump.buttons || []).length, JSON.stringify(report.panels.bag.dump.dataAttrs));

  // 关背包（挑 data-act=close*/含"关闭"或 .modal-close）
  await page.evaluate(() => {
    const d = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const closer = d.querySelector('[data-act="close-modal"], [data-act="close"], .modal-close, .sheet-close')
      || [...d.querySelectorAll('button')].find((b) => /关|×|✕/.test(String(b.textContent || '')));
    closer?.click();
  });
  await page.waitForTimeout(400);

  // ② 商城
  r = await page.evaluate(() => window.__NOAPI__.tap('[data-act="open-shop"]', { path: ['cj-shenghao-phone-frame'] }));
  await page.waitForTimeout(700);
  report.panels.shop = { tap: { ok: r.ok, code: r.code }, dump: await dumpPhone() };
  log('SHOP buttons', (report.panels.shop.dump.buttons || []).length, JSON.stringify(report.panels.shop.dump.dataAttrs));

  await page.evaluate(() => {
    const d = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const closer = d.querySelector('[data-act="close-modal"], [data-act="close"], .modal-close, .sheet-close')
      || [...d.querySelectorAll('button')].find((b) => /关|×|✕/.test(String(b.textContent || '')));
    closer?.click();
  });
  await page.waitForTimeout(400);

  // ③ 打开轮盘 → 卡包模式
  await page.evaluate(() => window.__NOAPI__.tap('[data-open-wheel="pack"]', { path: ['cj-shenghao-phone-frame'] }));
  await waitFor(page, () => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = f && f.contentDocument;
    return { ok: !!d && d.querySelectorAll('#wfSvg .ring').length > 0 };
  }, null, { label: 'WHEEL', timeout: 20000 });
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  report.panels.pack = await dumpWheel();
  log('PACK buttons', (report.panels.pack.buttons || []).length, JSON.stringify(report.panels.pack.dataAttrs));

  // ④ 切赌场
  await page.evaluate(() => window.__NOAPI__.tap('[data-mode="casino"]', { path: ['cj-shenghao-wheel-frame'] }));
  await page.waitForTimeout(800);
  report.panels.casino = await dumpWheel();
  log('CASINO buttons', (report.panels.casino.buttons || []).length, JSON.stringify(report.panels.casino.dataAttrs));

  // ⑤ 切回命运轮盘
  await page.evaluate(() => window.__NOAPI__.tap('[data-mode="play"]', { path: ['cj-shenghao-wheel-frame'] }));
  await page.waitForTimeout(500);

  // ⑥ 底部停靠的折叠条（56px 断言的真实对象）
  await page.evaluate(() => { window.__CJ_SHENGHAO_V2__.preferences({ displayDock: 'bottom' }); });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const d = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const f = d.querySelector('[data-act="fold"], #fold');
    f?.click();
  });
  await page.waitForTimeout(900);
  report.dockBottom = await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const d = f.contentDocument;
    const bar = d.querySelector('.folded-bar, .folded, #folded');
    const r = f.getBoundingClientRect();
    let barInfo = null;
    if (bar) {
      const br = bar.getBoundingClientRect();
      barInfo = { cls: String(bar.className), rect: { w: Math.round(br.width), h: Math.round(br.height) }, scrollH: bar.scrollHeight, clientH: bar.clientHeight, overflow: bar.scrollHeight > bar.clientHeight + 1, text: String(bar.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) };
    }
    return { frame: { w: Math.round(r.width), h: Math.round(r.height) }, bar: barInfo, dock: window.__CJ_SHENGHAO_V2__.read().prefs.displayDock };
  });
  log('DOCK_BOTTOM', report.dockBottom);

  const out = path.join(OUT_DIR, `discover-panels-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n===== 摘要 =====');
  for (const [k, v] of Object.entries(report.panels)) console.log(k, '→ data-*:', JSON.stringify(Object.keys(v.dataAttrs || {})));
  console.log('底部折叠条：', JSON.stringify(report.dockBottom.bar));
  console.log('落盘：', out);
} catch (e) {
  const out = path.join(OUT_DIR, `discover-panels-FATAL-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify({ ...report, fatal: String(e.message || e) }, null, 2), 'utf8');
  console.log('[PANELS] FATAL:', String(e.message || e), '→', out);
}

// 收尾：ego 规矩——一个目标一个 space，用完必须关掉，别把窗口堆在任务栏
await finishSpace(task);

