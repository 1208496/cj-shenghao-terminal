// 只截「异能」卡片区域，便于确认说明文字完整可见。
import path from 'node:path';
import { waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端30.png';
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
      if (d?.querySelector('nav.bottom .tab[data-tab="mine"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click?.();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await ph(`d.querySelector('nav.bottom .tab[data-tab="mine"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    if (f) { f.style.left = '20px'; f.style.top = '8px'; }
  });
  await page.waitForTimeout(300);

  await ph(`d.documentElement.scrollTop = 99999; if(d.body) d.body.scrollTop = 99999; const sc=d.getElementById('phoneScreen'); if(sc){sc.scrollTop=99999;} return true;`);
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const d = f?.contentDocument;
    const card = d?.querySelector('.ability-card');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    const fr = f.getBoundingClientRect();
    const scale = fr.width / f.offsetWidth;
    return { x: Math.round(fr.left + r.left * scale) - 6, y: Math.round(fr.top + r.top * scale) - 6, width: Math.round(r.width * scale) + 12, height: Math.round(r.height * scale) + 12 };
  });
  console.log('[SHOT] box', box);
  const f = path.join(SHOTS, `rc40-ability-card-${Date.now()}.png`);
  await page.screenshot({ path: f, clip: box });
  console.log('[SHOT]', f);
} catch (e) {
  console.log('[SHOT] ERROR', String(e?.message || e).slice(0, 300));
} finally {
  await finishSpace(task, []);
}
