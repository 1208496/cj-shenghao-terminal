// RC52 收尾那一轮（会花钱：1 次生成）：宽屏佩戴引导词是否进正文
// 前置：rc47_gate（TOY 已解锁、char_a 达标）→ 极简版清空 → 切实验版 → 佩戴（现场）
// 判据：① 输入框里出现【TOY·LINK佩戴：…】；② 正文写出「刚戴上/置入/微凉异物」类；③ 不与该轮「未开启」矛盾
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-rc52-wear-lead.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { attachSpace, finishSpace, waitFor } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/runtime.mjs';
import { openTavern, lastSig, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端7.png';
const OUT_DIR = path.join(ROOT, '.work', 'live-rc52');
fs.mkdirSync(OUT_DIR, { recursive: true });
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');

const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';
const seedRaw = execFileSync(NODE_BIN, [path.join(ROOT, 'scripts', 'test-noapi-seed.mjs'), '--char', '神豪终端7', '--preset', 'rc47_gate', '--unique'], { encoding: 'utf8', cwd: ROOT });
const seed = JSON.parse(seedRaw.slice(seedRaw.indexOf('{'), seedRaw.lastIndexOf('}') + 1));

const result = { at: new Date().toISOString(), chatId: seed.chatId, steps: [] };
const log = (...a) => console.log('[LIVE52]', ...a);
const save = () => fs.writeFileSync(path.join(OUT_DIR, 'round-wear-result.json'), JSON.stringify(result, null, 2), 'utf8');

const { task, page } = await attachSpace('NOAPI-RC54-LIVE');
const ph = (src) => page.evaluate((s) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  return new Function('d', s)(d);
}, String(src));
const tl = (src) => page.evaluate((s) => {
  const d = document.getElementById('cj-shenghao-toylink-frame')?.contentDocument;
  if (!d) return { __noToy: true };
  return new Function('d', s)(d);
}, String(src));
const sleep = (ms) => page.waitForTimeout(ms);

try {
  await openTavern(page);
  // 连接（页面级状态）
  const conn = { before: null, after: null, ok: false };
  conn.before = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
  if (!(conn.before || '').includes('fa-plug') || (conn.before || '').includes('exclamation')) {
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await sleep(1500);
    await page.evaluate(() => {
      const pool = [...document.querySelectorAll('button, .menu_button, div, span')].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
      pool.find((el) => (el.textContent || '').trim() === '连接')?.click();
    });
    for (let i = 0; i < 18; i += 1) {
      await sleep(900);
      conn.after = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
      if (conn.after && conn.after.includes('fa-plug') && !conn.after.includes('exclamation')) { conn.ok = true; break; }
    }
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await sleep(400);
  } else { conn.ok = true; conn.after = conn.before; }
  result.connect = conn;
  if (!conn.ok) throw new Error('API_NOT_CONNECTED');
  log('CONNECT ok');

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
  await sleep(2200);

  // 手机 → 我的 → 极简版 → 清空 → 切实验版
  await ph(`const f=d.querySelector('.folded,.folded-bar,#folded'); if(f){f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1}));f.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1}));f.click();} return true;`);
  await sleep(600);
  await ph(`[...d.querySelectorAll('nav.bottom .tab')].find(b=>b.dataset.tab==='mine')?.click(); return true;`);
  await sleep(500);
  await ph(`const sc=d.querySelector('.phone-screen'); if(sc) sc.scrollTop=260; return true;`);
  await ph(`d.querySelector('[data-toylink]')?.click(); return true;`);
  await sleep(1200);
  await ph(`d.querySelector('[data-tl-lite-reset="1"]:not([disabled])')?.click(); return true;`);
  await sleep(500);
  await ph(`d.querySelector('[data-confirm-tl-reset="1"]')?.click(); return true;`);
  await sleep(1000);
  await ph(`d.querySelector('[data-tl-open-lab="1"]')?.click(); return true;`);
  await sleep(1800);
  const wide = await page.evaluate(() => !!document.getElementById('cj-shenghao-toylink-frame'));
  result.wideOpen = wide;
  log('WIDE_OPEN', wide);
  if (!wide) throw new Error('WIDE_NOT_OPEN');
  await waitFor(page, () => {
    const d = document.getElementById('cj-shenghao-toylink-frame')?.contentDocument;
    return { ok: !!d?.querySelector('[data-screen="toylink-wide"]') };
  }, null, { label: 'WIDE_READY', timeout: 15000 });

  // 佩戴：戴上 → 确认(1/2) → 现场 → 确认(2/2)
  await page.evaluate(() => { const d = document.getElementById('send_textarea'); if (d) { d.value = ''; d.dispatchEvent(new Event('input', { bubbles: true })); } });
  await tl(`d.getElementById('tlBtnWear')?.click(); return true;`);
  await sleep(600);
  await tl(`d.getElementById('tlModalOk')?.click(); return true;`);
  await sleep(500);
  await tl(`d.querySelector('[data-modal-loc="with"]')?.click(); return true;`);
  await sleep(400);
  await tl(`d.getElementById('tlModalOk')?.click(); return true;`);
  await sleep(1200);
  const draft = await page.evaluate(() => String(document.getElementById('send_textarea')?.value || ''));
  result.wearDraft = draft;
  log('DRAFT', JSON.stringify({ len: draft.length, head: draft.slice(0, 120) }));
  if (!draft.includes('【TOY·LINK佩戴：')) throw new Error('WEAR_DRAFT_MISSING');

  // 直接发送输入框里已有的佩戴引导词（不覆盖内容）
  const sig = await lastSig(page);
  await page.evaluate(() => document.getElementById('send_but')?.click());
  const t0 = Date.now();
  const gen = await waitGeneration(page, sig, { timeout: 540000 });
  const ai = await page.evaluate(() => {
    const chat = window.SillyTavern.getContext().chat || [];
    const m = [...chat].reverse().find((x) => x && x.is_user === false);
    return m ? String(m.mes || '') : null;
  });
  result.gen = { ok: !!gen.ok, why: gen.why || '', chars: ai ? ai.length : 0, ms: Date.now() - t0 };
  result.sentDraft = draft;
  if (ai) fs.writeFileSync(path.join(OUT_DIR, 'round-wear.md'), `# RC52 佩戴引导词 · 生成正文\n\n- 发送（= 输入框里的佩戴引导词）：\n\n\`\`\`\n${draft}\n\`\`\`\n\n- 字符数：${ai.length}\n\n---\n\n${ai}\n`, 'utf8');
  result.inputAfter = await page.evaluate(() => String(document.getElementById('send_textarea')?.value || ''));
  save();
  log('ROUND', JSON.stringify(result.gen));
} catch (e) {
  result.error = String(e?.message || e).slice(0, 300);
  save();
  log('ERROR', result.error);
  throw e;
} finally {
  await finishSpace(task, []);
}
