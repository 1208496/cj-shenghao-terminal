// 端到端：商城里买一个异能 → 回到「我的」看异能栏是否立刻出现（正名 + 标签 + 等级 + 说明）。
import path from 'node:path';
import { waitFor, installRuntime, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端30.png';
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
const log = (o) => { out.checks.push(o); console.log('[ABILITY-BUY]', JSON.stringify(o)); };

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
  const before = await ph(`return { count: d.querySelectorAll('[data-ability-id]').length }`);
  log({ step: 'before', ...before, note: '「我的」页当前不渲染，需先切到 mine' });

  // 打开商城买一个红阶异能（微表情洞悉 350）
  await ph(`d.querySelector('[data-act="open-shop"]')?.click(); return true;`);
  await page.waitForTimeout(800);
  const shop = await ph(`const m=d.getElementById('modal'); const abilityTab=m?.querySelector('[data-shop-tab="ability"]'); abilityTab?.click(); const rows=[...(m?.querySelectorAll('[data-shop-buy]')||[])]; return { open: d.getElementById('modalOverlay')?.style.display==='flex', buyBtns: rows.length, first: rows[0]?.dataset.shopBuy||'', firstPrice: rows[0]?.dataset.price||'' }`);
  log({ step: 'shop', ...shop });

  await ph(`d.querySelector('[data-shop-tab="ability"]')?.click(); return true;`);
  await page.waitForTimeout(500);
  await ph(`d.querySelector('[data-shop-buy]')?.click(); return true;`);
  await page.waitForTimeout(1200);
  const afterBuy = await ph(`const m=d.getElementById('modal'); return { modalOpen: d.getElementById('modalOverlay')?.style.display==='flex', toast: (d.getElementById('toast')?.textContent||'').trim(), rows: m? m.querySelectorAll('[data-shop-buy]').length : -1 }`);
  log({ step: 'buy', ...afterBuy });

  // 关闭弹窗 → 我的 → 异能栏
  await ph(`d.querySelector('[data-act="cancel"]')?.click(); return true;`);
  await page.waitForTimeout(500);
  await ph(`d.querySelector('nav.bottom .tab[data-tab="mine"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  const mine = await ph(`const card=d.querySelector('.ability-card'); const items=[...(card?.querySelectorAll('[data-ability-id]')||[])]; return {
    card: !!card,
    countText: (card?.querySelector('.ability-head .muted')?.textContent||'').trim(),
    ids: items.map(el=>el.dataset.abilityId),
    hasDesc: items.every(el=>((el.querySelector('.ability-desc')?.textContent||'').trim().length>0)),
    firstDesc: (items[0]?.querySelector('.ability-desc')?.textContent||'').trim()
  }`);
  log({ step: 'mine-after-buy', ...mine });

  const f = path.join(SHOTS, `rc40-ability-afterbuy-${Date.now()}.png`);
  await page.screenshot({ path: f });
  console.log('[ABILITY-BUY] shot', f);
} catch (e) {
  console.log('[ABILITY-BUY] ERROR', String(e?.message || e).slice(0, 300));
} finally {
  await finishSpace(task, []);
}
