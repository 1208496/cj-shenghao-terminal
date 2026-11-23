// rc.40 追加：背包双分段 + 已用/已核销折叠栏 + 删除物品（含二次确认）取证。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端30.png';
const CHAT = '__NOAPI_TEST_three_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[BAG]', ...a);

const { task, page } = await attachSpace();
const ph = (fn) => page.evaluate((src) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  // eslint-disable-next-line no-new-func
  return new Function('d', src)(d);
}, String(fn));
const shot = async (tag) => {
  const f = path.join(SHOTS, `rc40-bag-${tag}-${Date.now()}.png`);
  for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: f }); break; } catch { await page.waitForTimeout(900); } }
  out.shots.push(f);
  return f;
};

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
  await ph(`d.querySelector('[data-act="open-bag"]')?.click(); return true;`);
  await page.waitForTimeout(900);

  const bag = await ph(`const m=d.getElementById('modal'); return {
    open: d.getElementById('modalOverlay')?.style.display==='flex',
    tabs: [...(m?.querySelectorAll('[data-bag-tab]')||[])].map(b=>b.dataset.bagTab),
    items: m?.querySelectorAll('[data-item-id]').length||0,
    delBtns: m?.querySelectorAll('[data-delete-item]').length||0,
    fold: !!m?.querySelector('[data-bag-used-fold]')
  }`);
  out.checks.push({ step: 'bag', ...bag }); log('bag', bag);
  await shot('open');

  // 删除一个奇物（当前在「玩法券」tab，先切到奇物）
  await ph(`d.querySelector('[data-bag-tab="surreal"]')?.click(); return true;`);
  await page.waitForTimeout(700);
  const surreal = await ph(`const m=d.getElementById('modal'); return { items: m?.querySelectorAll('[data-item-id]').length||0, del: m?.querySelectorAll('[data-delete-item]').length||0 }`);
  out.checks.push({ step: 'surreal-tab', ...surreal }); log('surreal-tab', surreal);

  await ph(`d.querySelector('[data-delete-item]')?.click(); return true;`);
  await page.waitForTimeout(600);
  const confirm = await ph(`const m=d.getElementById('modal'); return {
    title: (m?.querySelector('h3')?.textContent||'').trim(),
    text: (m?.querySelector('p')?.textContent||'').trim(),
    hasConfirm: !!m?.querySelector('[data-confirm-delete-item]')
  }`);
  out.checks.push({ step: 'delete-confirm', ...confirm }); log('delete-confirm', confirm);
  await shot('delete-confirm');

  await ph(`d.querySelector('[data-confirm-delete-item]')?.click(); return true;`);
  await page.waitForTimeout(1200);
  const afterDel = await ph(`const m=d.getElementById('modal'); return {
    items: m?.querySelectorAll('[data-item-id]').length||0,
    toast: (d.getElementById('toast')?.textContent||'').trim()
  }`);
  out.checks.push({ step: 'deleted', before: surreal.items, ...afterDel }); log('deleted', afterDel);

  // 回到玩法券，用掉一张 → 重开背包看折叠栏
  await ph(`d.querySelector('[data-bag-tab="prizes"]')?.click(); return true;`);
  await page.waitForTimeout(500);
  await ph(`d.querySelector('[data-use-now]')?.click(); return true;`);
  await page.waitForTimeout(1200);
  await ph(`d.querySelector('[data-act="open-bag"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  const fold = await ph(`const m=d.getElementById('modal'); const f=m?.querySelector('[data-bag-used-fold]'); return {
    fold: !!f,
    openAttr: f ? f.hasAttribute('open') : null,
    title: f ? (f.querySelector('summary')?.textContent||'').trim() : '',
    usedItems: f ? f.querySelectorAll('[data-item-id]').length : 0,
    activeItems: [...(m?.querySelectorAll('.bag-list:not(.bag-used-fold .bag-list) [data-item-id]')||[])].length
  }`);
  out.checks.push({ step: 'used-fold', ...fold }); log('used-fold', fold);
  await shot('used-fold');
} catch (e) {
  out.error = String(e?.message || e).slice(0, 400);
  log('ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-bag-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out.checks, null, 1).slice(0, 2400));
  await finishSpace(task, []);
}
