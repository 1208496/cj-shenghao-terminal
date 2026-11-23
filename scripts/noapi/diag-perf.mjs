// A5：轮盘性能量化——SVG 节点数、longtask、旋转期帧间隔 P95；三档画质各量一次。
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/diag-perf.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';
import { assertSafeUrl } from './guards.mjs';

const BASE = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE);
const ROOT = 'E:\\SHZDCHOSSS';
const AVATAR = '神豪终端21.png';
const CHAT = '__NOAPI_TEST_three_cards';
const OUT = path.resolve(ROOT, '.work', 'noapi', `diag-perf-${Date.now()}.json`);

const { task, page } = await attachSpace();
const ev = { at: new Date().toISOString(), runs: [] };
const log = (...a) => console.log('[PERF]', ...a);

try {
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
  await page.waitForTimeout(2500);

  for (let i = 0; i < 10; i++) {
    const ready = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
      if (d?.querySelector('[data-open-wheel="play"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click();
      d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);

  const nodes = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    const g = fd?.getElementById('wfSvg');
    return { svgChildren: g ? g.querySelectorAll('*').length : -1, rings: g ? g.querySelectorAll('.ring').length : -1 };
  });
  ev.nodes = nodes;
  log('nodes', nodes);

  // 三档画质各转一次，量 longtask + 帧间隔
  for (const q of ['medium', 'high', 'low']) {
    // 切到目标画质（走画质下拉选档，不再循环点击）
    await page.evaluate((target) => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const btn = fd?.querySelector('[data-fxq-btn]');
      if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
      fd?.querySelector(`[data-fxq-opt="${target}"]`)?.click();
    }, q);
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const w = fd?.defaultView;
      w.__perf = { longtasks: [], frames: [], last: 0, on: true };
      try {
        w.__perfObserver?.disconnect();
        w.__perfObserver = new w.PerformanceObserver((list) => {
          for (const e of list.getEntries()) w.__perf.longtasks.push(Math.round(e.duration));
        });
        w.__perfObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) { w.__perf.noObserver = String(e.message || e); }
      const tick = (t) => {
        if (!w.__perf.on) return;
        if (w.__perf.last) w.__perf.frames.push(t - w.__perf.last);
        w.__perf.last = t;
        w.requestAnimationFrame(tick);
      };
      w.requestAnimationFrame(tick);
    });

    await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('#wfGo')?.click());
    await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('[data-wf-confirm="ok"]')?.click());
    await page.waitForTimeout(8000);

    const r = await page.evaluate(() => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const w = fd?.defaultView;
      const p = w.__perf || { frames: [], longtasks: [] };
      p.on = false;
      const d = [...p.frames].sort((a, b) => a - b);
      const pick = (q) => d.length ? Math.round(d[Math.min(d.length - 1, Math.floor(d.length * q))]) : null;
      return {
        qualityLabel: fd?.querySelector('[data-fxq-btn]')?.textContent || '',
        frames: d.length, p50: pick(0.5), p95: pick(0.95), max: d.length ? Math.round(d[d.length - 1]) : null,
        longtasks: p.longtasks, noObserver: p.noObserver || null,
        resultOn: !!fd?.querySelector('#wfResult.on')
      };
    });
    ev.runs.push({ quality: q, ...r });
    log('run', q, r);
    await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('[data-dismiss]')?.click());
    await page.waitForTimeout(500);
  }
} catch (e) {
  ev.error = String(e?.stack || e).slice(0, 600);
  log('ERROR', ev.error);
} finally {
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 1), 'utf8');
  console.log('[PERF] evidence →', OUT);
  await finishSpace(task, []);
}
