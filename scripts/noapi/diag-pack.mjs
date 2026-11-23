// rc.39 追加：星愿卡包五阶段取证（待机阵 → 环绕 → 撕封 → 翻面揭晓 → 收束成扇 → 飞入卡册）。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端23.png';
const CHAT = '__NOAPI_TEST_three_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[PACK]', ...a);

const { task, page } = await attachSpace();
const w = (fn, arg) => page.evaluate(([src, a]) => {
  const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
  if (!fd) return { __noFrame: true };
  // eslint-disable-next-line no-new-func
  return new Function('fd', 'a', src)(fd, a);
}, [String(fn), arg ?? null]);

async function waitEl(sel, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await w(`return !!fd.querySelector(${JSON.stringify(sel)})`)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}
const shot = async (tag) => {
  const f = path.join(SHOTS, `rc39-pack-${tag}-${Date.now()}.png`);
  for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: f }); break; } catch { await page.waitForTimeout(1000); } }
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
      if (d?.querySelector('[data-open-wheel="pack"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click?.();
      d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click?.();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="pack"]')?.click());
  await page.waitForTimeout(2200);

  // 1) 待机阵
  const idle = await w(`return { arc: !!fd.querySelector('#pkFloatArc'), floatCards: fd.querySelectorAll('.pk-float-slot').length, phase: fd.querySelector('[data-pack-phase]')?.dataset.packPhase }`);
  out.checks.push({ step: 'idle', ...idle }); log('idle', idle);
  await shot('idle');

  // 2) 确认 → 环绕
  await w(`fd.querySelector('#wfGo')?.click(); return true;`);
  const confirmUp = await waitEl('#wfConfirm.on', 6000);
  await w(`fd.querySelector('[data-wf-confirm="ok"]')?.click(); return true;`);
  await page.waitForTimeout(220);
  const orbiting = await w(`return { confirmUp: !!fd.querySelector('#wfConfirm.on'), orbiting: !!fd.querySelector('.pk-float-arc.is-orbiting') }`);
  out.checks.push({ step: 'orbit', confirmUp, ...orbiting }); log('orbit', confirmUp, orbiting);
  await shot('orbit');

  // 3) 撕封
  const sealedUp = await waitEl('#pkPack', 20000);
  const sealed = await w(`return { pack: !!fd.querySelector('#pkPack'), hint: (fd.querySelector('.pk-hint')?.textContent||'').trim(), quick: !!fd.querySelector('[data-quicktear]') }`);
  out.checks.push({ step: 'sealed', sealedUp, ...sealed }); log('sealed', sealedUp, sealed);
  await shot('sealed');

  await w(`fd.querySelector('[data-quicktear]')?.click(); return true;`);
  const fanUp = await waitEl('.pk-fan', 15000);
  await page.waitForTimeout(600);
  const fan = await w(`return { slots: fd.querySelectorAll('.pk-slot').length, backs: fd.querySelectorAll('.pk-slot.is-back').length, inner: fd.querySelectorAll('.pk-slot .pk-inner').length, rarities: [...fd.querySelectorAll('.pk-slot')].map(s=>(s.className.match(/rar-\\w+/)||[''])[0]) }`);
  out.checks.push({ step: 'fan', fanUp, ...fan }); log('fan', fanUp, fan);
  await shot('fan');

  // 4) 逐张翻面
  await w(`fd.querySelector('[data-reveal="0"]')?.click(); return true;`);
  await page.waitForTimeout(900);
  const one = await w(`const s=fd.querySelector('[data-reveal="0"]'); if(!s) return {missing:true}; return { open: s.classList.contains('is-open'), inner: fd.defaultView.getComputedStyle(s.querySelector('.pk-inner')).transform.slice(0,26), halo: fd.defaultView.getComputedStyle(s.querySelector('.pk-halo')).opacity }`);
  out.checks.push({ step: 'reveal1', ...one }); log('reveal1', one);
  await shot('reveal1');

  // 5) 全翻 → 收束
  await w(`fd.querySelector('[data-reveal="1"]')?.click(); fd.querySelector('[data-reveal="2"]')?.click(); return true;`);
  await page.waitForTimeout(1100);
  const settled = await w(`return { settled: !!fd.querySelector('.pk-fan.is-settled'), open: fd.querySelectorAll('.pk-slot.is-open').length, hint: (fd.querySelector('.pk-settled-hint')?.textContent||'').trim(), hintHidden: !!fd.querySelector('.pk-settled-hint')?.hidden }`);
  out.checks.push({ step: 'settled', ...settled }); log('settled', settled);
  await shot('settled');

  // 6) 收入卡册 → 回到待机阵
  await w(`fd.querySelector('[data-collect]')?.click(); return true;`);
  await page.waitForTimeout(1500);
  const after = await w(`return { backToIdle: !!fd.querySelector('#pkFloatArc'), floatCards: fd.querySelectorAll('.pk-float-slot').length }`);
  out.checks.push({ step: 'collected', ...after }); log('collected', after);
  await shot('collected');
} catch (e) {
  out.error = String(e?.message || e).slice(0, 400);
  log('ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc39-pack-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out, null, 1).slice(0, 2600));
  await finishSpace(task, []);
}
