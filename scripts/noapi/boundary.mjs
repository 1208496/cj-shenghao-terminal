// scripts/noapi/boundary.mjs —— 采集 test boundary + 依赖就位证据（照 runtime-debug 的必记项）
//
// 只读：不改状态、不重导入、不调模型。输出 .work/noapi/boundary-<ts>.json
// 用法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/boundary.mjs')"

import fs from 'node:fs';
import path from 'node:path';
import { assertSafeUrl, assertSafePath } from './guards.mjs';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE_URL = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE_URL);
const OUT_DIR = path.resolve(ROOT, '.work', 'noapi');
assertSafePath(OUT_DIR, [ROOT]);
fs.mkdirSync(OUT_DIR, { recursive: true });

const CTL = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'noapi-ctl.json'), 'utf8'));
const avatar = CTL.avatar || '神豪终端5.png';
const cfg = JSON.parse(fs.readFileSync(path.resolve(ROOT, CTL.config), 'utf8'));
const hostApi = cfg.hostApi || '__CJ_SHENGHAO_V2__';

const { task, page } = await attachSpace();
const out = { at: new Date().toISOString(), avatar, hostApi };

try {
  await page.goto(BASE_URL, { timeout: 30000 });
  const ready = await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'READY', timeout: 25000 });
  if (!ready.ok) throw new Error('TAVERN_READY');

  // ① 宿主与版本
  out.tavern = await page.evaluate(() => {
    const ctx = window.SillyTavern.getContext();
    const pick = {};
    for (const k of ['version', 'tavernVersion', 'helperVersion']) { try { pick[k] = ctx[k]; } catch { } }
    let ext = [];
    try { ext = (ctx.extensions || []).map((e) => e.name || e.slug || String(e)); } catch { }
    return {
      version: pick.version || null,
      tavernVersion: pick.tavernVersion || null,
      helperVersion: typeof window.TavernHelper ? (window.TavernHelper.version || null) : null,
      extensionsCount: ext.length,
      extensions: ext.slice(0, 40),
      userAgent: navigator.userAgent,
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
      locale: navigator.language,
    };
  });

  await page.evaluate(installRuntime);
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));

  // ② 卡与聊天身份
  out.card = await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) return { found: false, avatars: ctx.characters.slice(-6).map((c) => c.avatar) };
    await ctx.selectCharacterById(idx);
    const c = window.SillyTavern.getContext().characters[idx];
    let world = null, regex = null, scripts = null;
    try { world = c.data?.extensions?.world || null; } catch { }
    try { regex = (c.data?.extensions?.regex_scripts || []).length; } catch { }
    try { scripts = (c.data?.extensions?.TavernHelper_scripts || []).length; } catch { }
    return { found: true, name: c.name, avatar: c.avatar, createDate: c.create_date || null, world, regexCount: regex, scriptCount: scripts };
  }, avatar);
  await page.waitForTimeout(2200);

  await page.evaluate(async () => { await window.SillyTavern.getContext().openCharacterChat('__NOAPI_TEST_three_cards'); });
  const phone = await waitFor(page, (o) => {
    const f = document.getElementById(o.pid);
    const h = window[o.host];
    const v = h && h.read ? h.read() : null;
    return { ok: !!f && !!(v && v.state && v.state.meta && v.state.meta.initialized) };
  }, { pid: (cfg.frames?.phone || []).slice(-1)[0], host: hostApi }, { label: 'PHONE', timeout: 25000 });

  out.runtime = await page.evaluate((o) => {
    const h = window[o.host];
    const v = h && h.read ? h.read() : null;
    const s = v?.state || null;
    const ctx = window.SillyTavern.getContext();
    const thFrames = document.querySelectorAll('iframe[id^="TH-script--"]').length;
    const frames = [...document.querySelectorAll('iframe')].map((f) => f.id || f.getAttribute('src') || '(no-id)');
    return {
      phoneReady: !!document.getElementById(o.pid),
      hostApi: !!h,
      mvu: typeof window.Mvu,
      schemaObject: typeof window.__CJ_SHENGHAO_SCHEMA__,
      thScriptFrames: thFrames,
      frames,
      phoneFrame: !!document.getElementById((o.frames?.phone || [])[0]),
      wheelFrame: !!document.getElementById((o.frames?.wheel || [])[0]),
      chatId: ctx.chatId || null,
      floors: (ctx.chat || []).length,
      firstSwipe: ctx.chat?.[0]?.swipe_id ?? null,
      version: v?.version || null,
      initKey: s?.meta?.initKey || null,
      revision: s?.meta?.revision ?? null,
      contractRevision: s?.meta?.contractRevision ?? null,
      prefs: v?.prefs || null,
      busy: v?.busy ?? null,
    };
  }, { host: hostApi, pid: (cfg.frames?.phone || []).slice(-1)[0], frames: cfg.frames });

  out.violations = await page.evaluate(() => window.__NOAPI__.violations());

  const file = path.join(OUT_DIR, `boundary-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log('BOUNDARY', JSON.stringify(out, null, 2));
  console.log('落盘：', file);
} catch (e) {
  out.fatal = String(e.message || e);
  const file = path.join(OUT_DIR, `boundary-FATAL-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log('BOUNDARY FATAL:', out.fatal, '→', file);
} finally {
  await finishSpace(task);
}
