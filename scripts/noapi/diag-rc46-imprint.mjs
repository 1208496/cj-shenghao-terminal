// rc.46 诊断：印记工坊从点开到落库，逐步抓 toast / 报错 / 状态 revision。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端7.png';
const CHAT = '__NOAPI_TEST_two_women';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
const out = { checks: [], shots: [] };
const log = (...a) => console.log('[IMP]', ...a);

const { task, page } = await attachSpace();
const ph = (fn) => page.evaluate((src) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  return new Function('d', src)(d);
}, String(fn));
const shot = async (tag) => { try { const f = path.join(SHOTS, `rc46-imp-${tag}-${Date.now()}.png`); await page.screenshot({ path: f }); out.shots.push(f); } catch {} };
const toast = () => page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.getElementById('toast')?.textContent || '');

try {
  await page.goto(BASE, { timeout: 30000 });
  await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'READY' });
  await page.evaluate(installRuntime);
  await page.evaluate((avatar) => window.__NOAPI__.openChat(avatar, '__NOAPI_TEST_two_women'), AVATAR).catch(() => {});
  await page.waitForTimeout(2500);
  log('open workshop');
  await ph(() => { const b = d.querySelector('.folded'); b?.click(); return true; });
  await page.waitForTimeout(1200);
  await ph(() => { d.querySelector('[data-tab="mine"]')?.click(); return true; });
  await page.waitForTimeout(800);
  const cards = await ph(() => d.querySelectorAll('.mine-device-stack .wcard-b').length);
  out.checks.push({ step: 'cards', cards });
  await ph(() => { d.querySelector('[data-open-workshop="imprint"]')?.click(); return true; });
  await page.waitForTimeout(900);
  const wsState = await ph(() => {
    const page = d.querySelector('.ws-page[data-workshop="imprint"]');
    const save = d.querySelector('[data-ws-save]');
    return { hasPage: !!page, saveDisabled: save ? save.disabled : null, targets: d.querySelectorAll('[data-ws-target]').length, place: d.querySelector('.ws-place.on')?.dataset.wsPlace || null, error: d.querySelector('.ws-error')?.textContent || '' };
  });
  out.checks.push({ step: 'open', ...wsState });
  await shot('open');

  await ph(() => { d.querySelector('[data-ws-place="left_breast"]')?.click(); return true; });
  await page.waitForTimeout(500);
  await ph(() => { d.querySelector('[data-ws-pattern="tally_zheng"]')?.click(); return true; });
  await page.waitForTimeout(500);
  await ph(() => { d.querySelector('[data-ws-inspo="Eternal"]')?.click(); return true; });
  await page.waitForTimeout(500);
  const beforeSave = await ph(() => ({ text: d.getElementById('wsText')?.value || '', error: d.querySelector('.ws-error')?.textContent || '' }));
  out.checks.push({ step: 'beforeSave', ...beforeSave });
  await ph(() => { d.querySelector('[data-ws-save]')?.click(); return true; });
  await page.waitForTimeout(2500);
  out.checks.push({ step: 'afterSave', toast: await toast() });
  const after = await ph(() => ({
    marked: d.querySelectorAll('.ws-place .ws-mark-dot').length,
    removeBtn: d.querySelectorAll('[data-ws-remove-one]').length,
    error: d.querySelector('.ws-error')?.textContent || ''
  }));
  out.checks.push({ step: 'after', ...after });
  await shot('after');
} catch (error) {
  out.checks.push({ step: 'ERROR', message: String(error?.message || error) });
} finally {
  console.log(JSON.stringify(out, null, 1));
  await finishSpace(task);
}
