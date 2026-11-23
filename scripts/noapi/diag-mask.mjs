// 复刻 runner 的指针链点击，看确认弹窗从打开到 1.5s 的每 150ms 状态。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端6.png';
const CHAT = '__NOAPI_TEST_three_cards';
const OUT = path.resolve('E:\\SHZDCHOSSS', '.work', 'noapi', `diag-mask-${Date.now()}.json`);

const { task, page } = await attachSpace();
const ev = { samples: [] };
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
  ev.rules = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    const out = [];
    for (const sheet of [...fd.styleSheets]) {
      let rules = []; try { rules = [...sheet.cssRules]; } catch { }
      for (const r of rules) { if (r.selectorText && /wf-confirm|core-glow/.test(r.selectorText)) out.push(r.selectorText + ' { ' + r.style.cssText.slice(0, 90) + ' }'); }
    }
    return out;
  });
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
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);

  // 指针链点击 GO（与 runner 一致）
  await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    const btn = fd.getElementById('wfGo');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
    btn.click();
  });

  ev.rules = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    const out = [];
    for (const sheet of [...fd.styleSheets]) {
      let rules = []; try { rules = [...sheet.cssRules]; } catch { }
      for (const r of rules) { if (r.selectorText && /wf-confirm|core-glow/.test(r.selectorText)) out.push(r.selectorText + ' { ' + r.style.cssText.slice(0, 90) + ' }'); }
    }
    return out;
  });
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(150);
    ev.samples.push(await page.evaluate(() => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const m = fd?.getElementById('wfConfirm');
      const ok = fd?.querySelector('[data-wf-confirm="ok"]');
      const cs = m ? fd.defaultView.getComputedStyle(m) : null;
      return {
        t: Math.round(performance.now()),
        cls: m?.className || '', hidden: m?.hidden, display: cs?.display, op: cs?.opacity,
        okExists: !!ok, okVis: ok ? ok.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : null,
        okRect: ok ? (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(ok.getBoundingClientRect()) : null,
        htmlLen: m ? m.innerHTML.length : 0,
        goText: fd?.getElementById('wfGo')?.textContent
      };
    }));
  }
} catch (e) { ev.error = String(e?.message || e).slice(0, 300); }
finally {
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 1), 'utf8');
  console.log(JSON.stringify(ev, null, 1).slice(0, 2600));
  await finishSpace(task, []);
}
