// rc.39 §四 复验：「我的」页异能栏是否显示正名 / 短标签 / 等级徽章 / 完整效果说明。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端30.png';
const CHAT = '__NOAPI_TEST_high_wealth';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[ABILITY]', ...a);

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
  // 把手机挪进视口，方便截图
  await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    if (f) { f.style.left = '24px'; f.style.top = '10px'; }
  });
  await page.waitForTimeout(300);

  const ability = await ph(`const card=d.querySelector('.ability-card'); const items=[...(card?.querySelectorAll('[data-ability-id]')||[])]; return {
    card: !!card,
    head: (card?.querySelector('.ability-head b')?.textContent||'').trim(),
    countText: (card?.querySelector('.ability-head .muted')?.textContent||'').trim(),
    items: items.map(el=>({
      id: el.dataset.abilityId,
      rarity: el.dataset.rarity,
      name: (el.querySelector('.ability-item-title b')?.textContent||'').trim(),
      tag: (el.querySelector('.ability-tag')?.textContent||'').trim(),
      level: (el.querySelector('.ability-lv')?.textContent||'').trim(),
      desc: (el.querySelector('.ability-desc')?.textContent||'').trim(),
      descLen: (el.querySelector('.ability-desc')?.textContent||'').trim().length
    })),
    empty: !!card?.querySelector('.ability-empty')
  }`);
  out.checks.push({ step: 'mine-ability', ...ability }); log('mine-ability', JSON.stringify(ability));

  const el = await ph(`const card=d.querySelector('.ability-card'); if(!card) return null; const r=card.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }`);
  const full = path.join(SHOTS, `rc40-ability-mine-${Date.now()}.png`);
  await page.screenshot({ path: full });
  out.shots.push(full);
  console.log('[ABILITY] cardBox', el, 'shot', full);

  // 再验一次「升级后等级徽章」：把 ab_voice 从 Lv2 变成 Lv3 用引擎不允许（只读），这里只核对 Lv 文案格式
  const lvFormat = await ph(`const el=d.querySelector('[data-ability-id="ab_voice"] .ability-lv'); return { text: (el?.textContent||'').trim(), cls: el?.className||'' }`);
  out.checks.push({ step: 'lv-badge', ...lvFormat }); log('lv-badge', lvFormat);
} catch (e) {
  out.error = String(e?.message || e).slice(0, 400);
  log('ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-ability-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out.checks, null, 1).slice(0, 2200));
  await finishSpace(task, []);
}
