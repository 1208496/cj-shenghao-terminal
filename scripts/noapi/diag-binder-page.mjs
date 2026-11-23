// 复查：卡册独立页在小手机里到底渲染成什么样（取 iframe 包围盒后裁切截图）。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端25.png';
const CHAT = '__NOAPI_TEST_three_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');

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
  await page.waitForTimeout(2500);
  for (let i = 0; i < 10; i++) {
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
  await ph(`d.querySelector('[data-act="open-binder"]')?.click(); return true;`);
  await page.waitForTimeout(1200);

  const geom = await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const r = f?.getBoundingClientRect();
    const d = f?.contentDocument;
    return {
      rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      style: f ? f.getAttribute('style') : '',
      screen: !!d?.querySelector('[data-screen="binder"]'),
      cards: d?.querySelectorAll('[data-screen="binder"] .wc-card').length ?? 0,
      title: (d?.querySelector('.phone-hd b')?.textContent || '').trim(),
      inner: (d?.querySelector('#phoneScreen')?.textContent || '').replace(/\s+/g, ' ').slice(0, 160)
    };
  });
  console.log('[BINDER]', JSON.stringify(geom));

  const f = path.join(SHOTS, `rc40-binder-page-${Date.now()}.png`);
  await page.screenshot({ path: f });
  console.log('[BINDER] shot', f);
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-binder-${Date.now()}.json`), JSON.stringify(geom, null, 1), 'utf8');
} catch (e) {
  console.log('[BINDER] ERROR', String(e?.message || e).slice(0, 300));
} finally {
  await finishSpace(task, []);
}
