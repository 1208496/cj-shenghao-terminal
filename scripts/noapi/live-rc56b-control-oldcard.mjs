// 对照组：旧卡（发行版 9639432B，无 rc56b 改动）跑一轮，看模型会不会输出变量补丁。
// 与 run3 用同一条消息、同一个 seed 预设，保证可比。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { lastSig, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');
const OUT = path.join(ROOT, '.work', 'live-rc56b');
const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';
const MSG1 = '上午十点，沈清弦在客厅窗边改图纸，陆晚晴盘腿坐在地毯上翻展册；苏晚刚从门口进来，把两杯手冲放在茶几上，站在旁边没说话。我靠在沙发上打量她们三个。';
const SPACE_NAME = 'NOAPI-RC56B-LIVE';

let task, page;
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === SPACE_NAME);
if (!entry) { task = await taskSpace(SPACE_NAME); page = (await task.pages())[0] ?? await task.newPage(); }
else if (entry.ownership === 'agent') { task = await taskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
else { task = await takeOverTaskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }

const result = { at: new Date().toISOString(), kind: 'control-old-card' };
const save = () => fs.writeFileSync(path.join(OUT, 'control-oldcard.json'), JSON.stringify(result, null, 2), 'utf8');
const log = (...a) => console.log('[CONTROL]', ...a);

try {
  if (!String(await page.url()).includes('127.0.0.1:8001')) await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function', undefined, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const isOk = (c) => c.includes('fa-plug') && !c.includes('exclamation');
  let conn = await page.evaluate(() => document.getElementById('API-status-top')?.className || '');
  if (!isOk(conn)) {
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(1500);
    const clicked = await page.evaluate(() => {
      for (const sel of ['#api_connect_btn', '#connect_api', 'button.connect', '.api_connect']) { const el = document.querySelector(sel); if (el) { el.click(); return sel; } }
      const pool = [...document.querySelectorAll('button,div,span,a,.menu_button')].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
      const hit = pool.find((el) => (el.textContent || '').trim() === '连接'); if (hit) { hit.click(); return 'text:连接'; } return null;
    });
    for (let i = 0; i < 25; i++) { await page.waitForTimeout(900); conn = await page.evaluate(() => document.getElementById('API-status-top')?.className || ''); if (isOk(conn)) break; }
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(400);
    result.connect = { clicked, after: conn };
  } else result.connect = { ok: true, how: 'already' };
  if (!isOk(conn)) throw new Error('API_NOT_CONNECTED');

  const seedRaw = execFileSync(NODE_BIN, [path.join(ROOT, 'scripts', 'test-noapi-seed.mjs'), '--char', '神豪终端7', '--preset', 'three_women_live', '--unique'], { encoding: 'utf8', cwd: ROOT });
  const seed = JSON.parse(seedRaw.slice(seedRaw.indexOf('{'), seedRaw.lastIndexOf('}') + 1));
  result.chatId = seed.chatId; save();

  await page.evaluate(async ([av, chat]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((x) => x.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
    if (typeof ctx.openCharacterChat === 'function') await ctx.openCharacterChat(chat);
  }, ['神豪终端7.png', seed.chatId]);
  await page.waitForTimeout(8000);

  result.before = await page.evaluate(() => {
    const s = window.__CJ_SHENGHAO_V2__?.read?.()?.state || null;
    return { rev: s?.meta?.revision ?? null, present: s?.scene?.presentCharacterIds || [], hostAlive: !!window.__CJ_SHENGHAO_V2__ };
  });
  save(); log('before', JSON.stringify(result.before));

  const sig = await lastSig(page);
  await page.evaluate((t) => {
    const ta = document.querySelector('#send_textarea');
    ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#send_but')?.click();
  }, MSG1);
  const w = await waitGeneration(page, sig, { timeout: 300000 });
  const after = await page.evaluate(() => {
    const msgs = window.SillyTavern.getContext().chat || [];
    const last = msgs[msgs.length - 1] || {};
    const s = window.__CJ_SHENGHAO_V2__?.read?.()?.state || null;
    const insp = (() => { try { return window.__CJ_SHENGHAO_V2__?.inspect?.() || null; } catch { return null; } })();
    return {
      mes: String(last.mes || ''),
      rev: s?.meta?.revision ?? null,
      thoughts: Object.fromEntries(['char_a', 'char_b', 'char_c'].map((id) => [id, String(s?.characters?.[id]?.currentThought || '').slice(0, 60)])),
      diagnostics: (insp?.diagnostics || []).map((d) => d?.code || '?').slice(0, 8),
    };
  });
  result.round = {
    wait: w,
    len: after.mes.length,
    mes: after.mes.slice(0, 8000),
    revBefore: result.before.rev,
    revAfter: after.rev,
    hasUpdateVariable: /<UpdateVariable>/i.test(after.mes),
    hasJSONPatch: /JSONPatch/i.test(after.mes),
    hasShenghao: /shenghao/.test(after.mes),
    thoughts: after.thoughts,
    diagnostics: after.diagnostics,
  };
  save();
  log('result', JSON.stringify({ len: result.round.len, upd: result.round.hasUpdateVariable, json: result.round.hasJSONPatch, sh: result.round.hasShenghao, rev: [result.round.revBefore, result.round.revAfter], diag: result.round.diagnostics }));
} catch (e) {
  result.error = String(e?.message || e); save(); log('ERROR', result.error);
} finally {
  try { await task.finish({ keep: [] }); } catch {}
}
console.log('DONE control-oldcard.json');
