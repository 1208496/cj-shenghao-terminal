// 复现：点 GO → 点「再想想」→ 看是否误提交
import { attachSpace, finishSpace } from './runtime.mjs';

const AV = process.argv[2] || '神豪终端17.png';
const { task, page } = await attachSpace();
try {
  await page.goto('http://127.0.0.1:8001/', { timeout: 30000 });
  for (let i = 0; i < 20; i++) { const ok = await page.evaluate(() => !!(window.SillyTavern?.getContext?.().chat)); if (ok) break; await page.waitForTimeout(500); }
  await page.evaluate(async ([av]) => {
    const c = window.SillyTavern.getContext();
    const i = c.characters.findIndex((x) => x.avatar === av);
    await c.selectCharacterById(i);
    await c.openCharacterChat('__NOAPI_TEST_empty_bag');
  }, [AV]);
  await page.waitForTimeout(2500);
  for (let i = 0; i < 12; i++) {
    const r = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
      if (d?.querySelector('[data-open-wheel="play"]')) return true;
      d?.querySelector('.folded,.folded-bar,#folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click?.();
      d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click?.();
      return false;
    });
    if (r) break;
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);
  const before = await page.evaluate(() => Object.keys(window.__CJ_SHENGHAO_V2__.read().state.operationHistory || {}).length);
  await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame').contentDocument;
    const b = fd.getElementById('wfGo');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
    b.click();
  });
  await page.waitForTimeout(900);
  const mid = await page.evaluate(() => ({ ops: Object.keys(window.__CJ_SHENGHAO_V2__.read().state.operationHistory || {}).length, modal: document.getElementById('cj-shenghao-wheel-frame').contentDocument.getElementById('wfConfirm').className }));
  await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame').contentDocument;
    const b = fd.querySelector('[data-wf-confirm="cancel"]');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
    b.click();
  });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const st = window.__CJ_SHENGHAO_V2__.read().state;
    const ops = Object.entries(st.operationHistory || {});
    return { count: ops.length, last: ops.length ? { type: ops.at(-1)[1].type, status: ops.at(-1)[1].status } : null, modal: document.getElementById('cj-shenghao-wheel-frame').contentDocument.getElementById('wfConfirm').className, result: !!document.getElementById('cj-shenghao-wheel-frame').contentDocument.querySelector('#wfResult.on') };
  });
  console.log(JSON.stringify({ before, mid, after }, null, 1));
} finally {
  await finishSpace(task, []);
}
