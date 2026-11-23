// rc.40 追加：卡册四档叠卡 + 展开/收回 + 卡面 ⚙ 操作弹窗 + 删除卡牌 取证。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端29.png';
const CHAT = '__NOAPI_TEST_many_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[STACK]', ...a);

const { task, page } = await attachSpace();
const ph = (fn) => page.evaluate((src) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  // eslint-disable-next-line no-new-func
  return new Function('d', src)(d);
}, String(fn));
const shot = async (tag) => {
  const f = path.join(SHOTS, `rc40-stack-${tag}-${Date.now()}.png`);
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
  await page.waitForTimeout(700);
  await ph(`d.querySelector('[data-act="open-binder"]')?.click(); return true;`);
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    if (f) { f.style.left = '24px'; f.style.top = '10px'; }
  });
  await page.waitForTimeout(250);

  // 1) 叠卡态
  const stacked = await ph(`const root=d.querySelector('[data-screen="binder"]'); return {
    stacks: root.querySelectorAll('.binder-stack').length,
    stacked: root.querySelectorAll('.binder-stack.is-stacked').length,
    decks: root.querySelectorAll('.stack-deck').length,
    counts: [...root.querySelectorAll('.binder-stack')].map(s=>s.dataset.stackCount),
    limitOn: [...root.querySelectorAll('[data-binder-limit]')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.binderLimit)
  }`);
  out.checks.push({ step: 'stacked', ...stacked }); log('stacked', stacked);
  await shot('stacked');

  // 2) 叠加上限切到 4
  await ph(`d.querySelector('[data-binder-limit="4"]')?.click(); return true;`);
  await page.waitForTimeout(700);
  const limit4 = await ph(`const root=d.querySelector('[data-screen="binder"]'); return {
    stacks: root.querySelectorAll('.binder-stack').length,
    counts: [...root.querySelectorAll('.binder-stack')].map(s=>s.dataset.stackCount),
    limitOn: [...root.querySelectorAll('[data-binder-limit]')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.binderLimit)
  }`);
  out.checks.push({ step: 'limit4', ...limit4 }); log('limit4', limit4);

  // 3) 展开
  await ph(`d.querySelector('.stack-deck')?.click(); return true;`);
  await page.waitForTimeout(700);
  const expanded = await ph(`const root=d.querySelector('[data-screen="binder"]'); const ex=root.querySelector('.binder-stack.is-expanded'); return {
    expanded: !!ex,
    cards: ex ? ex.querySelectorAll('.wc-card').length : 0,
    gears: ex ? ex.querySelectorAll('.wc-gear').length : 0,
    collapseBtn: !!(ex && ex.querySelector('[data-stack-toggle]'))
  }`);
  out.checks.push({ step: 'expanded', ...expanded }); log('expanded', expanded);
  await shot('expanded');

  // 4) ⚙ 操作弹窗
  await ph(`d.querySelector('.binder-stack.is-expanded .wc-gear')?.click(); return true;`);
  await page.waitForTimeout(600);
  const menu = await ph(`const m=d.getElementById('modal'); return {
    open: d.getElementById('modalOverlay')?.style.display==='flex',
    title: (m?.querySelector('h3')?.textContent||'').trim(),
    actions: [...(m?.querySelectorAll('[data-card-action]')||[])].map(b=>({a:b.dataset.cardAction, dis:b.disabled})),
    meta: (m?.querySelector('.card-menu-meta')?.textContent||'').replace(/\\s+/g,' ').trim()
  }`);
  out.checks.push({ step: 'menu', ...menu }); log('menu', menu);
  await shot('menu');

  // 5) 删除：二次确认 → 删除
  const before = await ph(`return d.querySelectorAll('[data-screen="binder"] .binder-stack').length`);
  await ph(`d.querySelector('[data-card-action="delete"]')?.click(); return true;`);
  await page.waitForTimeout(500);
  const confirm = await ph(`const m=d.getElementById('modal'); return {
    open: d.getElementById('modalOverlay')?.style.display==='flex',
    title: (m?.querySelector('h3')?.textContent||'').trim(),
    text: (m?.querySelector('p')?.textContent||'').trim(),
    hasConfirm: !!m?.querySelector('[data-confirm-delete-card]')
  }`);
  out.checks.push({ step: 'delete-confirm', ...confirm }); log('delete-confirm', confirm);
  await shot('delete-confirm');

  await ph(`d.querySelector('[data-confirm-delete-card]')?.click(); return true;`);
  await page.waitForTimeout(1200);
  const after = await ph(`const root=d.querySelector('[data-screen="binder"]'); return {
    modalOpen: d.getElementById('modalOverlay')?.style.display==='flex',
    stacks: root.querySelectorAll('.binder-stack').length,
    counts: [...root.querySelectorAll('.binder-stack')].map(s=>s.dataset.stackCount),
    toast: (d.getElementById('toast')?.textContent||'').trim()
  }`);
  out.checks.push({ step: 'deleted', before, ...after }); log('deleted', before, after);
  await shot('deleted');

  // 6) 锁定后再试删除（应被禁用）
  await ph(`d.querySelector('.stack-deck')?.click(); return true;`);
  await page.waitForTimeout(600);
  await ph(`d.querySelector('.binder-stack.is-expanded .wc-gear')?.click(); return true;`);
  await page.waitForTimeout(500);
  await ph(`d.querySelector('[data-card-action="lock"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  const locked = await ph(`const m=d.getElementById('modal'); return {
    lockText: (m?.querySelector('[data-card-action="lock"]')?.textContent||'').trim(),
    deleteDisabled: m?.querySelector('[data-card-action="delete"]')?.disabled === true
  }`);
  out.checks.push({ step: 'locked', ...locked }); log('locked', locked);
  await shot('locked');
  await ph(`d.querySelector('[data-act="cancel"]')?.click(); return true;`);
} catch (e) {
  out.error = String(e?.message || e).slice(0, 400);
  log('ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-stack-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out.checks, null, 1).slice(0, 2600));
  await finishSpace(task, []);
}
