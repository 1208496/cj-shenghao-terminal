// rc.40 A 方案验证：纯叙事异能买完 Lv1 恒定，不再出现升级按钮。
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端1.png';
const CHAT = '__NOAPI_TEST_high_wealth';
const SHOTS = 'E:\\SHZDCHOSSS\\reports\\noapi-test-shots';
const out = { checks: [] };

const { task, page } = await attachSpace();
const ph = (fn) => page.evaluate((src) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  // eslint-disable-next-line no-new-func
  return new Function('d', src)(d);
}, String(fn));
const log = (o) => { out.checks.push(o); console.log('[ABILITY-FIX]', JSON.stringify(o)); };

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

  // 买「微表情洞悉」
  await ph(`d.querySelector('[data-act="open-shop"]')?.click(); return true;`);
  await page.waitForTimeout(800);
  await ph(`d.querySelector('[data-shop-tab="ability"]')?.click(); return true;`);
  await page.waitForTimeout(400);
  const beforeBuy = await ph(`const m=d.getElementById('modal'); const row=[...(m?.querySelectorAll('.shop-item')||[])].find(r=>r.querySelector('[data-shop-buy="ab_micro"]')); return { hasBuy: !!row, price: row?.querySelector('[data-shop-buy]')?.dataset.price || '' }`);
  log({ step: 'before-buy', ...beforeBuy });
  await ph(`d.querySelector('[data-shop-buy="ab_micro"]')?.click(); return true;`);
  await page.waitForTimeout(1200);

  // 重开商城：ab_micro 应变成「已拥有」，没有升级按钮
  await ph(`d.querySelector('[data-act="cancel"]')?.click(); return true;`);
  await page.waitForTimeout(400);
  await ph(`d.querySelector('[data-act="open-shop"]')?.click(); return true;`);
  await page.waitForTimeout(800);
  await ph(`d.querySelector('[data-shop-tab="ability"]')?.click(); return true;`);
  await page.waitForTimeout(400);
  const afterBuy = await ph(`const m=d.getElementById('modal'); const row=[...(m?.querySelectorAll('.shop-item')||[])].find(r=>r.innerHTML.includes('微表情洞悉')); return {
    buyBtn: !!row?.querySelector('[data-shop-buy]'),
    ownedTag: (row?.querySelector('.shop-owned')?.textContent||'').trim(),
    text: (row?.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60)
  }`);
  log({ step: 'after-buy', ...afterBuy });

  // 对照：数值型 ab_voice 应仍然可以买/升
  const voiceRow = await ph(`const m=d.getElementById('modal'); const row=[...(m?.querySelectorAll('.shop-item')||[])].find(r=>r.innerHTML.includes('语感共鸣')); return { buyBtn: !!row?.querySelector('[data-shop-buy]'), price: row?.querySelector('[data-shop-buy]')?.dataset.price || '' }`);
  log({ step: 'voice-row', ...voiceRow });

  // 我的页：ab_micro 徽章应为「恒定」
  await ph(`d.querySelector('[data-act="cancel"]')?.click(); return true;`);
  await page.waitForTimeout(400);
  await ph(`d.querySelector('nav.bottom .tab[data-tab="mine"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  const mine = await ph(`const el=d.querySelector('[data-ability-id="ab_micro"]'); return { has: !!el, name: (el?.querySelector('b')?.textContent||'').trim(), level: (el?.querySelector('.ability-lv')?.textContent||'').trim(), descLen: ((el?.querySelector('.ability-desc')?.textContent||'')).trim().length }`);
  log({ step: 'mine', ...mine });

  const f = path.join(SHOTS, `rc40-ability-fixed-${Date.now()}.png`);
  await page.screenshot({ path: f });
  console.log('[ABILITY-FIX] shot', f);
} catch (e) {
  console.log('[ABILITY-FIX] ERROR', String(e?.message || e).slice(0, 300));
} finally {
  await finishSpace(task, []);
}
