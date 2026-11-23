// 专项：卡册 ⚙ → 押注 → 轮盘预选卡（逐步骤打印，便于定位卡在哪一步）。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端30.png';
const CHAT = '__NOAPI_TEST_many_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
const out = { steps: [] };

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
const step = (o) => { out.steps.push(o); console.log('[PRESEL]', JSON.stringify(o)); };

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
  await ph(`d.querySelector('[data-act="open-binder"]')?.click(); return true;`);
  await page.waitForTimeout(1000);
  step({ at: 'binder', ...(await ph(`const r=d.querySelector('[data-screen="binder"]'); return { screen: !!r, stacks: r.querySelectorAll('.binder-stack').length }`)) });

  // 直接展开第一摞
  await ph(`d.querySelector('.stack-deck')?.click(); return true;`);
  await page.waitForTimeout(800);
  step({ at: 'expanded', ...(await ph(`const ex=d.querySelector('.binder-stack.is-expanded'); return { expanded: !!ex, gears: ex ? ex.querySelectorAll('.wc-gear').length : 0, gearHtml: ex ? (ex.querySelector('.wc-gear')?.outerHTML || '').slice(0, 80) : '' }`)) });

  await ph(`d.querySelector('.binder-stack.is-expanded .wc-gear')?.click(); return true;`);
  await page.waitForTimeout(700);
  step({ at: 'menu', ...(await ph(`const m=d.getElementById('modal'); return { modalOpen: d.getElementById('modalOverlay')?.style.display === 'flex', title: (m?.querySelector('h3')?.textContent||'').trim(), bet: m?.querySelector('[data-card-action="bet"]')?.dataset.cardId || '' }`)) });

  const betId = await ph(`return d.querySelector('[data-card-action="bet"]')?.dataset.cardId || ''`);
  await ph(`d.querySelector('[data-card-action="bet"]')?.click(); return true;`);
  await page.waitForTimeout(3000);
  step({ at: 'wheel', expect: betId, ...(await wh(`const stake=fd.querySelector('[data-stake-card]'); const slot=fd.querySelector('.bh-card.in-slot'); return { mode: fd.getElementById('wfRoot')?.dataset.mode, stakeCard: stake?.dataset.stakeCard || '', inSlot: slot?.dataset.card || '', stakeFaces: fd.querySelectorAll('.stake-card-wrap .wc-card').length, goReady: fd.querySelector('#wfGo')?.disabled === false }`)) });

  const s = path.join(SHOTS, `rc40-preselect-${Date.now()}.png`);
  await page.screenshot({ path: s });
  console.log('[PRESEL] shot', s);
} catch (e) {
  console.log('[PRESEL] ERROR', String(e?.message || e).slice(0, 300));
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-preselect-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  await finishSpace(task, []);
}
