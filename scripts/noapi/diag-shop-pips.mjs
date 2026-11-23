// 校验：不可升级的异能不再画三段进度条；可升级的仍保留。
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端2.png';
const CHAT = '__NOAPI_TEST_high_wealth';
const SHOTS = 'E:\\SHZDCHOSSS\\reports\\noapi-test-shots';
const { task, page } = await attachSpace();
const ph = (fn) => page.evaluate((src) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  // eslint-disable-next-line no-new-func
  return new Function('d', src)(d);
}, String(fn));
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
  await page.waitForTimeout(700);
  await ph(`d.querySelector('[data-act="open-shop"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  const rows = await ph(`const m=d.getElementById('modal'); return [...(m?.querySelectorAll('.shop-item')||[])].map(r=>({
    name: (r.querySelector('.shop-title b')?.textContent||'').trim(),
    pips: r.querySelectorAll('.shop-level i').length,
    badge: (r.querySelector('.shop-owned')?.textContent||'').trim(),
    btn: r.querySelector('[data-shop-buy]')?.dataset.shopBuy || ''
  }))`);
  console.log('[PIPS]', JSON.stringify(rows, null, 0).slice(0, 1500));
  await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    if (f) { f.style.left = '20px'; f.style.top = '8px'; }
  });
  await page.waitForTimeout(300);
  const f = path.join(SHOTS, `rc40-shop-pips-${Date.now()}.png`);
  await page.screenshot({ path: f });
  console.log('[PIPS] shot', f);
} finally {
  await finishSpace(task, []);
}
