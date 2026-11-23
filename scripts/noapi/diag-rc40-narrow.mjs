// rc.40 尾验：375 窄屏（卡册 / 卡包）+ 卡册 20 张同屏性能 + 「押注」跳轮盘预选卡。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端30.png';
const CHAT = '__NOAPI_TEST_many_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[NARROW]', ...a);

const { task, page } = await attachSpace();
const ph = (fn) => page.evaluate((src) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  // eslint-disable-next-line no-new-func
  return new Function('d', src)(d);
}, String(fn));
const wh = (fn) => page.evaluate((src) => {
  const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
  if (!fd) return { __noFrame: true };
  // eslint-disable-next-line no-new-func
  return new Function('fd', src)(fd);
}, String(fn));

try {
  // 375 窄屏（先设视口再进页面）
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await page.goto(BASE, { timeout: 30000 });
  await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'READY' });
  await page.evaluate(installRuntime);
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  await page.evaluate(async ([av, chat]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    await ctx.selectCharacterById(idx);
    await ctx.openCharacterChat(chat);
  }, [AVATAR, CHAT]);
  await page.waitForTimeout(2600);
  for (let i = 0; i < 12; i++) {
    const ready = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
      if (d?.querySelector('nav.bottom .tab[data-tab="wheel"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click?.();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await ph(`d.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click(); return true;`);
  await page.waitForTimeout(800);

  // ---- 1) 卡册窄屏布局 ----
  await ph(`d.querySelector('[data-act="open-binder"]')?.click(); return true;`);
  await page.waitForTimeout(1100);
  const binderLayout = await ph(`const root=d.querySelector('[data-screen="binder"]'); const sc=d.getElementById('phoneScreen'); const grid=d.querySelector('.binder-decks'); return {
    cards: root.querySelectorAll('.wc-card').length,
    stacks: root.querySelectorAll('.binder-stack').length,
    docOverflowX: d.documentElement.scrollWidth - d.documentElement.clientWidth,
    screenOverflowX: sc ? sc.scrollWidth - sc.clientWidth : null,
    gridCols: grid ? fdCols(grid) : null,
    cardW: root.querySelector('.wc-card')?.getBoundingClientRect().width || 0,
    filterChips: root.querySelectorAll('[data-binder-filter]').length,
    fxChips: root.querySelectorAll('[data-card-fxq]').length,
    limitChips: root.querySelectorAll('[data-binder-limit]').length,
    stackSum: [...root.querySelectorAll('.binder-stack')].reduce((n,el)=>n+Number(el.dataset.stackCount||0),0),
    stackCounts: [...root.querySelectorAll('.binder-stack')].map(el=>el.dataset.stackCount),
    counts: [...root.querySelectorAll('[data-binder-filter]')].map(b=>b.textContent.trim())
  };
  function fdCols(el){ return getComputedStyle(el).gridTemplateColumns.split(' ').length; }`);
  out.checks.push({ step: 'binder-375', ...binderLayout }); log('binder-375', binderLayout);
  const s1 = path.join(SHOTS, `rc40-narrow-binder-${Date.now()}.png`);
  await page.screenshot({ path: s1 }); out.shots.push(s1);

  // 把全部 5 摞都展开 → 同屏 18 张（20 张级压力）
  for (let i = 0; i < 6; i++) {
    const clicked = await ph(`const deck=d.querySelector('.stack-deck'); if(!deck) return false; deck.click(); return true;`);
    if (!clicked) break;
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(500);
  const expandedCount = await ph(`return d.querySelectorAll('[data-screen="binder"] .wc-card').length`);
  // ---- 2) 卡册 20 张同屏性能（longtask + 帧间隔 P95 + 建页耗时）----
  const perf = await ph(`const w=d.defaultView;
    const t0=performance.now();
    d.querySelector('[data-binder-filter="all"]')?.click();
    const build=performance.now()-t0;
    return { buildMs: Math.round(build), cards: d.querySelectorAll('[data-screen="binder"] .wc-card').length };`);
  const measured = await page.evaluate(async () => {
    const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
    const w = d?.defaultView;
    if (!w) return { __noPhone: true };
    const longtasks = [];
    let obs = null;
    try {
      obs = new w.PerformanceObserver((l) => { for (const e of l.getEntries()) longtasks.push(Math.round(e.duration)); });
      obs.observe({ entryTypes: ['longtask'] });
    } catch {}
    const frames = [];
    let last = 0;
    const scroller = d.getElementById('phoneScreen');
    const tick = (t) => {
      if (last) frames.push(t - last);
      last = t;
      if (frames.length < 120) w.requestAnimationFrame(tick);
    };
    w.requestAnimationFrame(tick);
    // 滚动卡册，模拟玩家翻看
    for (let i = 0; i < 30; i++) {
      if (scroller) scroller.scrollTop = (i % 10) * 60;
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 900));
    try { obs?.disconnect(); } catch {}
    const sorted = [...frames].sort((a, b) => a - b);
    const pick = (q) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]) : null);
    return { frames: sorted.length, p50: pick(0.5), p95: pick(0.95), max: sorted.length ? Math.round(sorted[sorted.length - 1]) : null, longtasks };
  });
  out.checks.push({ step: 'binder-perf', onScreenCards: expandedCount, ...perf, ...measured }); log('binder-perf', perf, measured);

  // ---- 3) 卡册 ⚙ → 押注 → 轮盘预选卡 ----
  await ph(`d.querySelector('.stack-deck')?.click(); return true;`);
  await page.waitForTimeout(700);
  await ph(`d.querySelector('.binder-stack.is-expanded .wc-gear')?.click(); return true;`);
  await page.waitForTimeout(500);
  const betId = await ph(`const b=d.querySelector('[data-card-action="bet"]'); return b ? b.dataset.cardId : ''`);
  await ph(`d.querySelector('[data-card-action="bet"]')?.click(); return true;`);
  await page.waitForTimeout(2600);
  const preselect = await wh(`const stake=fd.querySelector('[data-stake-card]'); const slot=fd.querySelector('.bh-card.in-slot'); return {
    mode: fd.getElementById('wfRoot')?.dataset.mode,
    stakeCard: stake ? stake.dataset.stakeCard : '',
    inSlot: slot ? slot.dataset.card : '',
    stakeFaces: fd.querySelectorAll('.stake-card-wrap .wc-card').length,
    goEnabled: fd.querySelector('#wfGo')?.disabled === false
  }`);
  out.checks.push({ step: 'bet-preselect', expect: betId, ...preselect }); log('bet-preselect', betId, preselect);

  // ---- 4) 卡包窄屏 ----
  await wh(`fd.querySelector('[data-mode="pack"]')?.click(); return true;`);
  await page.waitForTimeout(1600);
  const packLayout = await wh(`const arc=fd.getElementById('pkFloatArc'); const go=fd.getElementById('wfGo'); return {
    floatCards: fd.querySelectorAll('.pk-float-slot').length,
    arcOverflowX: arc ? arc.scrollWidth - arc.clientWidth : null,
    docOverflowX: fd.documentElement.scrollWidth - fd.documentElement.clientWidth,
    goBox: go ? { w: Math.round(go.getBoundingClientRect().width), h: Math.round(go.getBoundingClientRect().height) } : null,
    boardW: Math.round(fd.querySelector('.wf-board').getBoundingClientRect().width)
  }`);
  out.checks.push({ step: 'pack-375', ...packLayout }); log('pack-375', packLayout);
  const s2 = path.join(SHOTS, `rc40-narrow-pack-${Date.now()}.png`);
  await page.screenshot({ path: s2 }); out.shots.push(s2);
} catch (e) {
  out.error = String(e?.message || e).slice(0, 400);
  log('ERROR', out.error);
} finally {
  try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}); } catch {}
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-narrow-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out.checks, null, 1).slice(0, 2600));
  await finishSpace(task, []);
}
