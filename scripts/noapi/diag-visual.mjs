// rc.38 视觉诊断：三环到底转没转、黄框落在哪一环。
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/diag-visual.mjs')"
// 只读：不改存档、不调模型（哨兵 block）。证据落 .work/noapi/diag-visual-*.json + reports/noapi-test-shots/。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';
import { assertSafeUrl, assertSafePath } from './guards.mjs';

const BASE = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE);
const ROOT = 'E:\\SHZDCHOSSS';
const AVATAR = '神豪终端8.png';
const CHAT = '__NOAPI_TEST_three_cards';
const OUT = path.resolve(ROOT, '.work', 'noapi', `diag-visual-${Date.now()}.json`);
const SHOTS = path.resolve(ROOT, 'reports', 'noapi-test-shots');
assertSafePath(SHOTS, [ROOT]);
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log('[VIS]', ...a);

const { task, page } = await attachSpace();
const ev = { at: new Date().toISOString(), avatar: AVATAR, samples: [], shots: [] };

const readRings = () => {
  const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
  if (!fd) return null;
  const rings = [...fd.querySelectorAll('#wfSvg .ring')].map((g) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(g).transform === 'none' ? '' : getComputedStyle(g).transform);
    const deg = Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    return { ring: g.getAttribute('data-ring'), deg: (deg + 360) % 360 };
  });
  const hit = fd.querySelector('.hit-wedge.on');
  const hitRing = hit?.closest('[data-ring]')?.getAttribute('data-ring') ?? null;
  const toastEl = fd.getElementById('wfToast');
  return { rings, hitRing, resultOn: !!fd.querySelector('#wfResult.on'), toast: (toastEl?.textContent || '').slice(0, 80) };
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

  // 小手机可能停在折叠态（前面的用例改过 dock 偏好），反复点到出现轮盘入口为止。
  for (let i = 0; i < 12; i++) {
    const ready = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
      if (!d) return { ok: false, why: 'NO_PHONE' };
      const entry = d.querySelector('[data-open-wheel="play"]');
      if (entry) return { ok: true };
      d.querySelector('.folded, .folded-bar, #folded')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
      d.querySelector('.folded, .folded-bar, #folded')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
      d.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d.querySelector('[data-act="expand"]')?.click();
      d.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click();
      return { ok: false };
    });
    if (ready.ok) break;
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);

  ev.before = await page.evaluate(readRings);
  let f = path.join(SHOTS, `rc38-visual-before-${Date.now()}.png`);
  await page.screenshot({ path: f }); ev.shots.push(f); log('before', ev.before);

  // 连转 5 次：看每次黄框落在哪一环、哪一环真的转了。
  ev.spins = [];
  for (let n = 1; n <= 5; n++) {
    const go = await page.evaluate(() => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const btn = fd?.getElementById('wfGo');
      if (!btn || btn.disabled) return { ok: false, text: btn?.textContent };
      btn.click();
      return { ok: true };
    });
    if (!go.ok) { ev.spins.push({ n, skipped: go }); break; }
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('[data-wf-confirm="ok"]')?.click());
    let landed = null;
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(600);
      const s = await page.evaluate(readRings);
      if (s?.resultOn) { landed = s; break; }
    }
    ev.spins.push({ n, landed });
    log('spin', n, landed);
    if (landed?.hitRing && landed.hitRing !== '0') {
      f = path.join(SHOTS, `rc38-visual-ring${landed.hitRing}-${Date.now()}.png`);
      await page.screenshot({ path: f }); ev.shots.push(f);
    }
    await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('[data-dismiss]')?.click());
    await page.waitForTimeout(600);
  }
  ev.after = await page.evaluate(readRings);
  log('after', ev.after);
} catch (e) {
  ev.error = String(e?.stack || e).slice(0, 600);
  log('ERROR', ev.error);
} finally {
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 1), 'utf8');
  console.log('[VIS] evidence →', OUT);
  await finishSpace(task, []);
}
