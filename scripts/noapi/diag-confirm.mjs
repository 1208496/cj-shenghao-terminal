// rc.38 诊断：点确认后轮盘为什么不出结果。#wfResult.on 等不到 → 抓三处证据。
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/diag-confirm.mjs')"
// 只读：不改存档、不改配置、不调模型（哨兵 block）。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';
import { assertSafeUrl } from './guards.mjs';

const BASE = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE);
const ROOT = 'E:\\SHZDCHOSSS';
const AVATAR = '神豪终端6.png';
const CHAT = '__NOAPI_TEST_three_cards';
const OUT = path.resolve(ROOT, '.work', 'noapi', `diag-confirm-${Date.now()}.json`);
const log = (...a) => console.log('[DIAG]', ...a);

const { task, page } = await attachSpace();
const consoleLines = [];
page.on?.('console', (m) => { consoleLines.push(m.text().slice(0, 200)); });
const pageErrors = [];
page.on?.('pageerror', (e) => pageErrors.push(String(e).slice(0, 400)));

const ev = { at: new Date().toISOString(), avatar: AVATAR, chat: CHAT, steps: [], consoleLines, pageErrors, wheel: {} };
const step = (name, detail) => { ev.steps.push({ name, detail }); log(name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 200)); };

try {
  await page.goto(BASE, { timeout: 30000 });
  await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'READY' });
  step('READY');
  await page.evaluate(installRuntime);
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  step('SENTINEL');

  const sel = await page.evaluate(async ([av, chat]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) return { ok: false, why: 'NO_CHAR' };
    await ctx.selectCharacterById(idx);
    const opened = await ctx.openCharacterChat(chat);
    return { ok: true, idx, opened };
  }, [AVATAR, CHAT]);
  step('SELECT+CHAT', sel);

  await page.waitForTimeout(2500);
  // 展开小手机 → 轮盘页 → 打开命运轮盘
  await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const d = f?.contentDocument;
    d?.querySelector('[data-act="expand"]')?.click();
    d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click();
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);
  const wheelReady = await page.evaluate(() => !!document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('#wfGo'));
  step('WHEEL_READY', wheelReady);

  // 点 GO → 等确认 → 点确认
  await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('#wfGo')?.click());
  await page.waitForTimeout(600);
  const modal = await page.evaluate(() => {
    const d = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    const box = d?.getElementById('wfConfirm');
    return { on: !!box?.classList.contains('on'), hidden: box?.hidden, text: (box?.textContent || '').slice(0, 200) };
  });
  step('CONFIRM', modal);
  await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('[data-wf-confirm="ok"]')?.click());

  // 采样 12 秒，看结果卡、提示条、报错、宿主诊断
  for (const ms of [400, 400, 600, 800, 1200, 1500, 2000, 2500, 3000]) {
    await page.waitForTimeout(ms);
    const snap = await page.evaluate(() => {
      const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
      const host = window.__CJ_SHENGHAO_V2__;
      const v = host?.read?.();
      const res = fd?.getElementById('wfResult');
      return {
        t: Math.round(performance.now()),
        resultOn: !!fd?.querySelector('#wfResult.on'),
        resultClass: res?.className || '',
        resultHtmlLen: (res?.innerHTML || '').length,
        hitWedge: fd?.querySelectorAll('.hit-wedge.on').length ?? -1,
        toast: (fd?.getElementById('wfToast')?.textContent || '').slice(0, 120),
        goText: (fd?.getElementById('wfGo')?.textContent || '').slice(0, 30),
        wheelErr: (fd?.defaultView?.__CJ_WHEEL_ERR__ || []).slice(-4),
        rev: v?.state?.meta?.revision,
        ops: Object.keys(v?.state?.operationHistory || {}).length,
        lastOp: Object.values(v?.state?.operationHistory || {}).slice(-1).map((o) => ({ type: o.type, status: o.status, code: o.reason || o.code }))[0] || null
      };
    });
    ev.wheel[ms + '_' + Object.keys(ev.wheel).length] = snap;
    log('sample', snap);
    if (snap.resultOn) break;
  }
} catch (e) {
  ev.error = String(e?.stack || e).slice(0, 800);
  log('ERROR', ev.error);
} finally {
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 1), 'utf8');
  console.log('[DIAG] evidence →', OUT);
  await finishSpace(task, []);
}
