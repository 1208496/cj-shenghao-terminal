// extra（额外模型解析）模式 · 1 轮真实生成（会花钱：正文 + 变量解析两份）
// 验：① 正文生成成功；② stat_data 是否回写（revision 与关键字段变化）；③ extra 下正文里是否还带 JSONPatch 块；④ 有无报错
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-rc54-extra-mode.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { attachSpace, finishSpace, waitFor } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/runtime.mjs';
import { openTavern, lastSig, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端7.png';
const OUT_DIR = path.join(ROOT, '.work', 'live-extra');
fs.mkdirSync(OUT_DIR, { recursive: true });
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');
const SENT = '我端着两杯咖啡走进客厅，把其中一杯推到她面前，顺手把窗帘拉开一半。';

const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';
const seedRaw = execFileSync(NODE_BIN, [path.join(ROOT, 'scripts', 'test-noapi-seed.mjs'), '--char', '神豪终端7', '--preset', 'device_ready', '--unique'], { encoding: 'utf8', cwd: ROOT });
const seed = JSON.parse(seedRaw.slice(seedRaw.indexOf('{'), seedRaw.lastIndexOf('}') + 1));

const result = { at: new Date().toISOString(), chatId: seed.chatId, sent: SENT };
const log = (...a) => console.log('[EXTRA]', ...a);
const save = () => fs.writeFileSync(path.join(OUT_DIR, 'extra-result.json'), JSON.stringify(result, null, 2), 'utf8');

const { task, page } = await attachSpace('NOAPI-RC54-LIVE');
const snap = () => page.evaluate(() => {
  const h = window.__CJ_SHENGHAO_V2__;
  const s = h?.read?.()?.state || null;
  const a = s?.characters?.char_a || null;
  let mode = null;
  try { mode = window.SillyTavern.getContext().extensionSettings?.mvu_settings?.['更新方式'] ?? null; } catch { mode = null; }
  return {
    rev: s?.meta?.revision ?? null,
    aff: a?.affection ?? null,
    corr: a?.corruption ?? null,
    action: a?.currentAction || '',
    time: s?.world ? `${s.world.date} ${s.world.time}` : '',
    mode,
    ops: s?.operationHistory ? Object.keys(s.operationHistory).length : null,
  };
});

try {
  await openTavern(page);
  const conn = { ok: false, before: null, after: null };
  conn.before = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
  if (!(conn.before || '').includes('fa-plug') || (conn.before || '').includes('exclamation')) {
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const pool = [...document.querySelectorAll('button, .menu_button, div, span')].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
      pool.find((el) => (el.textContent || '').trim() === '连接')?.click();
    });
    for (let i = 0; i < 18; i += 1) {
      await page.waitForTimeout(900);
      conn.after = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
      if (conn.after && conn.after.includes('fa-plug') && !conn.after.includes('exclamation')) { conn.ok = true; break; }
    }
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(400);
  } else { conn.ok = true; conn.after = conn.before; }
  result.connect = conn;
  if (!conn.ok) throw new Error('API_NOT_CONNECTED');

  await page.evaluate(async ([av, c]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((x) => x.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
    await ctx.openCharacterChat(c);
  }, [AVATAR, seed.chatId]);
  await waitFor(page, (o) => {
    const f = document.getElementById(o);
    const s = window.__CJ_SHENGHAO_V2__?.read?.();
    return { ok: !!f && !!(s?.state?.meta?.initialized) };
  }, 'cj-shenghao-phone-frame', { label: 'PHONE', timeout: 25000 });
  await page.waitForTimeout(2200);

  result.before = await snap();
  log('MODE', result.before.mode, '｜before', JSON.stringify({ rev: result.before.rev, aff: result.before.aff, time: result.before.time }));
  if (!/额外/.test(String(result.before.mode))) log('WARN: 更新方式不是「额外模型解析」，当前 =', result.before.mode);

  const sig = await lastSig(page);
  await page.evaluate((t) => {
    const ta = document.getElementById('send_textarea');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, t);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('send_but')?.click();
  }, SENT);
  const t0 = Date.now();
  const gen = await waitGeneration(page, sig, { timeout: 900000 }); // extra 要两次调用，给 15 分钟
  const ai = await page.evaluate(() => {
    const chat = window.SillyTavern.getContext().chat || [];
    const m = [...chat].reverse().find((x) => x && x.is_user === false);
    return m ? String(m.mes || '') : null;
  });
  result.gen = { ok: !!gen.ok, why: gen.why || '', chars: ai ? ai.length : 0, ms: Date.now() - t0 };
  if (ai) fs.writeFileSync(path.join(OUT_DIR, 'round-extra.md'), `# extra 模式生成正文\n\n- 发送：${SENT}\n- 字符数：${ai.length}\n\n---\n\n${ai}\n`, 'utf8');
  result.hasJsonPatchInMessage = ai ? /<UpdateVariable|<JSONPatch/.test(ai) : null;
  await page.waitForTimeout(4000); // 给额外模型解析 + MVU 回写留时间
  result.after = await snap();
  result.toasts = await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast, #toast-container > *')].map((t) => String(t.textContent || '').trim()).filter(Boolean).slice(-6));
  save();
  log('GEN', JSON.stringify(result.gen));
  log('AFTER', JSON.stringify({ rev: result.after.rev, aff: result.after.aff, corr: result.after.corr, action: String(result.after.action).slice(0, 40), time: result.after.time }));
  log('JSONPATCH_IN_MESSAGE', result.hasJsonPatchInMessage);
  log('TOASTS', JSON.stringify(result.toasts));
} catch (e) {
  result.error = String(e?.message || e).slice(0, 400);
  save();
  log('ERROR', result.error);
  throw e;
} finally {
  await finishSpace(task, []);
}
