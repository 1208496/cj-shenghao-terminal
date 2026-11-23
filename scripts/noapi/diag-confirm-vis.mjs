// 诊断：确认弹窗的 ok 按钮为什么被判不可见。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';
import { assertSafeUrl } from './guards.mjs';

const BASE = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE);
const AVATAR = '神豪终端6.png';
const CHAT = '__NOAPI_TEST_three_cards';
const OUT = path.resolve('E:\\SHZDCHOSSS', '.work', 'noapi', `diag-confirm-vis-${Date.now()}.json`);

const { task, page } = await attachSpace();
const ev = { at: new Date().toISOString(), steps: {} };
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
  await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('#wfGo')?.click());

  for (const ms of [200, 400, 800, 1500]) {
    await page.waitForTimeout(ms);
    ev.steps['t' + ms] = await page.evaluate(() => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const mask = fd?.getElementById('wfConfirm');
      const ok = fd?.querySelector('[data-wf-confirm="ok"]');
      const cs = mask ? fd.defaultView.getComputedStyle(mask) : null;
      const os = ok ? fd.defaultView.getComputedStyle(ok) : null;
      const r = ok?.getBoundingClientRect();
      return {
        maskClass: mask?.className || '',
        maskHidden: mask?.hidden,
        maskDisplay: cs?.display, maskOpacity: cs?.opacity, maskVisibility: cs?.visibility,
        maskRect: mask ? { w: mask.getBoundingClientRect().width, h: mask.getBoundingClientRect().height } : null,
        okRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
        okOpacity: os?.opacity, okDisplay: os?.display, okVisibility: os?.visibility,
        okCheck: typeof ok?.checkVisibility === 'function' ? ok.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : null,
        wheelFrameRect: (() => { const f = document.getElementById('cj-shenghao-wheel-frame'); const b = f?.getBoundingClientRect(); return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null; })()
      };
    });
  }
} catch (e) {
  ev.error = String(e).slice(0, 500);
} finally {
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 1), 'utf8');
  console.log(JSON.stringify(ev, null, 1).slice(0, 3000));
  await finishSpace(task, []);
}
