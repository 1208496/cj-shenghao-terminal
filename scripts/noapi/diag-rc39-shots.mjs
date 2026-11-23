// rc.39 视觉取证：B 版轮盘页、TOY·LINK 未获得态、三档画质盘面对比。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端21.png';
const CHAT = '__NOAPI_TEST_three_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[RC39]', ...a);

const { task, page } = await attachSpace();
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
      if (d?.querySelector('[data-open-wheel="play"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click();
      d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(700);

  // 1) 轮盘页（B 版）+ TOY·LINK 未获得态
  const hub = await page.evaluate(() => {
    const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
    const card = d?.querySelector('[data-toylink-card]');
    const btn = card?.querySelector('[data-toylink]');
    return {
      stats: !!d?.querySelector('[data-wheel-stats]'),
      stack: d?.querySelectorAll('.wcard-b').length,
      dock: [...(d?.querySelectorAll('[data-wheel-dock] .dock-row') || [])].map((b) => b.textContent.replace(/\s+/g, ' ').trim().slice(0, 24)),
      toyState: card?.getAttribute('data-toylink-state'),
      toyDisabled: btn?.disabled === true,
      toyText: (btn?.textContent || '').trim(),
      bagSummaryGone: !d?.querySelector('.bag-summary')
    };
  });
  out.hub = hub; log('hub', hub);
  await page.waitForTimeout(800);
  let f = path.join(SHOTS, `rc39-wheel-hub-${Date.now()}.png`);
  for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: f }); break; } catch (e) { log('hub shot retry', k, String(e.message||e).slice(0,60)); await page.waitForTimeout(1200); } }
  out.shots.push(f);

  // 2) 打开全屏轮盘
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);

  // 2a) 画质下拉：点一下展开三档（rc.39 YG 要求：不再点一下换一档）
  const menu = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    const btn = fd?.querySelector('[data-fxq-btn]');
    btn?.click();
    const box = fd?.querySelector('[data-fxq-menu]');
    return {
      expanded: btn?.getAttribute('aria-expanded') === 'true',
      open: !!box && box.hidden === false,
      options: [...(box?.querySelectorAll('[data-fxq-opt]') || [])].map((b) => ({ q: b.dataset.fxqOpt, text: (b.textContent || '').trim(), on: b.classList.contains('on') })),
      before: fd?.getElementById('wfRoot')?.dataset.fxq
    };
  });
  out.menu = menu; log('menu', menu);
  await page.waitForTimeout(500);
  const menuShot = path.join(SHOTS, `rc39-fxq-menu-${Date.now()}.png`);
  for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: menuShot }); break; } catch (e) { log('menu shot retry', k); await page.waitForTimeout(1200); } }
  out.shots.push(menuShot);

  // 2b) 三档各拍一张（走下拉选项，不再靠循环点击）
  for (const q of ['high', 'medium', 'low']) {
    await page.evaluate((target) => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const btn = fd?.querySelector('[data-fxq-btn]');
      if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
      fd?.querySelector(`[data-fxq-opt="${target}"]`)?.click();
    }, q);
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const root = fd?.getElementById('wfRoot');
      const tick = fd?.querySelector('.wf-ticks-minor');
      const ring = fd?.querySelector('.wf-ring1-a');
      const frame = fd?.querySelector('.wf-frame-outer');
      const glow = fd?.querySelector('.core-glow');
      return {
        fxq: root?.dataset.fxq,
        label: fd?.querySelector('.wf-fxq')?.textContent,
        menuClosed: fd?.querySelector('[data-fxq-menu]')?.hidden === true,
        ticksMinor: tick ? fd.defaultView.getComputedStyle(tick).opacity : null,
        ringFill: ring ? fd.defaultView.getComputedStyle(ring).fill : null,
        frameOuter: frame ? fd.defaultView.getComputedStyle(frame).opacity : null,
        coreGlow: glow ? fd.defaultView.getComputedStyle(glow).opacity : null,
        nodes: fd?.getElementById('wfSvg')?.querySelectorAll('*').length
      };
    });
    out.checks.push({ q, ...state }); log(q, state);
    await page.waitForTimeout(1200);
    const shot = path.join(SHOTS, `rc39-fxq-${q}-${Date.now()}.png`);
    for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: shot }); break; } catch (e) { log('shot retry', q, k); await page.waitForTimeout(1500); } }
    out.shots.push(shot);
  }
} catch (e) {
  out.error = String(e?.message || e).slice(0, 300);
  log('ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc39-shots-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out, null, 1).slice(0, 2200));
  await finishSpace(task, []);
}
