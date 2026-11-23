import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端1.png';
const CHAT = '__NOAPI_TEST_high_wealth';
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
  const state = await ph(`const app=d.defaultView; const rows={}; return { abilities: null }`);
  await ph(`d.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click(); return true;`);
  await page.waitForTimeout(700);
  await ph(`d.querySelector('[data-act="open-shop"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  const info = await ph(`const m=d.getElementById('modal'); const rows=[...(m?.querySelectorAll('.shop-item')||[])];
    return {
      without: rows.filter(r=>!r.querySelector('[data-shop-buy]')).map(r=>({ name:(r.querySelector('.shop-title b')?.textContent||'').trim(), owned:(r.querySelector('.shop-owned')?.textContent||'').trim(), lv:(r.querySelector('.shop-level small')?.textContent||'').trim() })),
      withBtn: rows.filter(r=>r.querySelector('[data-shop-buy]')).map(r=>(r.querySelector('[data-shop-buy]')?.dataset.shopBuy))
    }`);
  console.log('[ROWS]', JSON.stringify(info, null, 1).slice(0, 900));
} finally {
  await finishSpace(task, []);
}
