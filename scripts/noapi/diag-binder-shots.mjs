// 卡册独立页取证：把小手机 iframe 挪进视口后，分别拍 卡面：流光 / 精简 / 极简 三档。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端25.png';
const CHAT = '__NOAPI_TEST_three_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
const out = { shots: [] };

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
  await page.waitForTimeout(700);
  await ph(`d.querySelector('[data-act="open-binder"]')?.click(); return true;`);
  await page.waitForTimeout(1000);
  // 把小手机挪进视口左上，方便整页截图
  await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    if (f) { f.style.left = '24px'; f.style.top = '12px'; }
  });
  await page.waitForTimeout(400);

  for (const q of ['high', 'medium', 'low']) {
    await ph(`d.querySelector('[data-card-fxq="${q}"]')?.click(); return true;`);
    await page.waitForTimeout(700);
    // 切档会触发 phone() 重排 → 挪 iframe 必须在切档之后、截图之前
    await page.evaluate(() => {
      const f = document.getElementById('cj-shenghao-phone-frame');
      if (f) { f.style.left = '24px'; f.style.top = '12px'; }
    });
    await page.waitForTimeout(250);
    const f = path.join(SHOTS, `rc40-binder-${q}-${Date.now()}.png`);
    for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: f }); break; } catch { await page.waitForTimeout(900); } }
    out.shots.push(f);
    console.log('[BINDER-SHOT]', q, f);
  }
} catch (e) {
  console.log('[BINDER-SHOT] ERROR', String(e?.message || e).slice(0, 300));
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-binder-shots-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  await finishSpace(task, []);
}
