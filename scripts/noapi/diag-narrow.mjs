// A6：375 窄屏 + 三主题 + 三字号（rc.38 复验）
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/diag-narrow.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';
import { assertSafeUrl, assertSafePath } from './guards.mjs';

const BASE = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE);
const ROOT = 'E:\\SHZDCHOSSS';
const AVATAR = '神豪终端9.png';
const CHAT = '__NOAPI_TEST_three_cards';
const OUT = path.resolve(ROOT, '.work', 'noapi', `diag-narrow-${Date.now()}.json`);
const SHOTS = path.resolve(ROOT, 'reports', 'noapi-test-shots');
assertSafePath(SHOTS, [ROOT]);
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log('[NARROW]', ...a);

const { task, page } = await attachSpace();
const ev = { at: new Date().toISOString(), shots: [], checks: [] };
const check = (name, pass, detail) => { ev.checks.push({ name, pass, detail }); log(name, pass, detail || ''); };

try {
  // ego 没有 setViewportSize，走 CDP 模拟 375 布局视口（mobile:false 才是真 375px）
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });
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
      if (d?.querySelector('nav.bottom .tab[data-tab]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }

  const nav = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
    const tabs = [...(fd?.querySelectorAll('nav.bottom .tab[data-tab]') || [])];
    const fps = fd?.getElementById('phone');
    return {
      tabs: tabs.length,
      visible: tabs.filter((t) => t.getBoundingClientRect().width > 0).length,
      overflowX: fd ? fd.documentElement.scrollWidth > fd.documentElement.clientWidth + 1 : null,
      phoneW: fps ? Math.round(fps.getBoundingClientRect().width) : null,
      vw: window.innerWidth
    };
  });
  check('五页 tab 在 375 宽可见', nav.tabs === 5 && nav.visible === 5, nav);
  check('小手机无横向溢出', nav.overflowX === false, { overflowX: nav.overflowX });

  // 三主题 × 三字号
  for (const theme of ['sage', 'gold', 'purple']) {
    for (const fontSize of ['small', 'medium', 'large']) {
      const applied = await page.evaluate(async ([t, fs2]) => {
        const h = window.__CJ_SHENGHAO_V2__;
        if (!h?.preferences) return { ok: false };
        h.preferences({ theme: t, fontSize: fs2 });
        await new Promise((r) => setTimeout(r, 400));
        const fd = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
        const scale = fd ? fd.defaultView.getComputedStyle(fd.documentElement).getPropertyValue('--cj-font-scale') : '';
        const cl = fd ? fd.documentElement.className : '';
        return { ok: true, scale: scale.trim(), themeClass: cl };
      }, [theme, fontSize]);
      check(`主题 ${theme} / 字号 ${fontSize} 生效`, applied.ok === true && applied.scale !== '', applied);
      if (theme === 'sage' && fontSize === 'medium') {
        const f = path.join(SHOTS, `rc38-375-${theme}-${fontSize}-${Date.now()}.png`);
        await page.screenshot({ path: f }); ev.shots.push(f);
      }
    }
  }

  // 轮盘在 375 宽下是否铺满视口（先切到轮盘页再点入口）
  await page.evaluate(() => {
    const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
    d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click();
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);
  const wheel = await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const r = f?.getBoundingClientRect();
    const fd = f?.contentDocument;
    const go = fd?.getElementById('wfGo')?.getBoundingClientRect();
    return {
      rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      inner: { w: window.innerWidth, h: window.innerHeight },
      go: go ? { w: Math.round(go.width), h: Math.round(go.height) } : null,
      overflowX: fd ? fd.documentElement.scrollWidth > fd.documentElement.clientWidth + 1 : null
    };
  });
  const covers = wheel.rect && Math.abs(wheel.rect.w - wheel.inner.w) <= 2 && Math.abs(wheel.rect.h - wheel.inner.h) <= 2;
  check('轮盘 iframe 铺满 375×812 视口', !!covers, wheel);
  check('轮盘内部无横向溢出', wheel.overflowX === false, { overflowX: wheel.overflowX });
  check('GO 按钮在窄屏仍可点（≥40px）', !!wheel.go && wheel.go.w >= 40 && wheel.go.h >= 40, wheel.go);
  const f = path.join(SHOTS, `rc38-375-wheel-${Date.now()}.png`);
  await page.screenshot({ path: f }); ev.shots.push(f);

  await page.cdp('Emulation.clearDeviceMetricsOverride', {});
} catch (e) {
  ev.error = String(e?.stack || e).slice(0, 600);
  log('ERROR', ev.error);
} finally {
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 1), 'utf8');
  console.log('[NARROW] evidence →', OUT);
  await finishSpace(task, []);
}
