// rc56b 真实生成验收 · 两轮（每目标 1 轮，不重试）
// R-1：三人同场（char_c 只旁观）→ 看 ROUND_FIELD_AUDIT 的三个人心声覆盖
// R-2：玩家明确要求改口 → 看 addressing 是否当轮落库、后续是否稳定
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-rc56b-addressing.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { attachSpace, finishSpace } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/runtime.mjs';
import { openTavern, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');
const AVATAR = '神豪终端7.png';
const OUT = path.join(ROOT, '.work', 'live-rc56b');
fs.mkdirSync(OUT, { recursive: true });
const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';

const MSG1 = '上午十点，沈清弦在客厅窗边改图纸，陆晚晴盘腿坐在地毯上翻展册；苏晚刚从门口进来，把两杯手冲放在茶几上，站在旁边没说话。我靠在沙发上打量她们三个。';
const MSG2 = '我抬手按住沈清弦的手腕，直视她说：“以后别叫我陆总了，叫我阿澈。”';

const seedRaw = execFileSync(NODE_BIN, [path.join(ROOT, 'scripts', 'test-noapi-seed.mjs'), '--char', '神豪终端7', '--preset', 'three_women_live', '--unique'], { encoding: 'utf8', cwd: ROOT });
const seed = JSON.parse(seedRaw.slice(seedRaw.indexOf('{'), seedRaw.lastIndexOf('}') + 1));

const result = { at: new Date().toISOString(), chatId: seed.chatId, rounds: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
const log = (...a) => { console.log('[RC56B]', ...a); };

const snapshot = () => page.evaluate(() => {
  const api = window.__CJ_SHENGHAO_V2__;
  const s = api?.read?.()?.state || null;
  const insp = (() => { try { return api?.inspect?.() || null; } catch { return null; } })();
  const chars = s?.characters || {};
  const strip = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  return {
    rev: s?.meta?.revision ?? null,
    present: s?.scene?.presentCharacterIds || [],
    audit: insp?.roundAudit || null,
    chars: Object.fromEntries(['char_a', 'char_b', 'char_c'].map((id) => [id, {
      name: chars[id]?.name, addressing: chars[id]?.addressing || '',
      thought: strip(chars[id]?.currentThought).slice(0, 120), aff: chars[id]?.affection, arousal: chars[id]?.arousal,
    }])),
    contextHasPresentThoughtIds: (() => { try { return (s?._context || '').includes('presentThoughtIds'); } catch { return null; } })(),
  };
});

const sendAndWait = async (text) => {
  await page.evaluate((t) => {
    const ta = document.querySelector('#send_textarea');
    ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#send_but')?.click();
  }, text);
  await waitGeneration(page, { timeout: 240000 });
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const ctx = window.SillyTavern.getContext();
    const msgs = ctx.chat || [];
    const last = msgs[msgs.length - 1] || {};
    return { mes: String(last.mes || ''), isUser: !!last.is_user };
  });
};

const { task, page } = await attachSpace('NOAPI-RC56B-LIVE');
try {
  await openTavern(page);
  // 只点一次「连接」按钮（不改任何 API 设置）
  const conn = await page.evaluate(() => document.getElementById('API-status-top')?.className || '');
  if (!conn.includes('fa-plug') || conn.includes('exclamation')) {
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => [...document.querySelectorAll('button,.menu_button')].find((b) => (b.textContent || '').trim() === '连接')?.click());
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(900);
      const c = await page.evaluate(() => document.getElementById('API-status-top')?.className || '');
      if (c.includes('fa-plug') && !c.includes('exclamation')) break;
    }
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(400);
  }
  // 选卡 + 打开 seed 出来的那份聊天
  await page.evaluate(async ([av, chat]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((x) => x.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
    if (typeof ctx.openCharacterChat === 'function') await ctx.openCharacterChat(chat);
    else location.reload();
  }, [AVATAR, seed.chatId]);
  await page.waitForTimeout(6000);

  result.before = await snapshot();
  save();
  log('before', JSON.stringify(result.before.audit));

  // ---- R-1 三人同场 ----
  const r1 = await sendAndWait(MSG1);
  result.rounds.push({ id: 'R-1', sent: MSG1, mes: r1.mes.slice(0, 4000), after: await snapshot() });
  save();
  log('R-1 audit', JSON.stringify(result.rounds[0].after.audit));

  // ---- R-2 明确改口 ----
  const r2 = await sendAndWait(MSG2);
  result.rounds.push({ id: 'R-2', sent: MSG2, mes: r2.mes.slice(0, 4000), after: await snapshot() });
  save();
  log('R-2 addressing', JSON.stringify(result.rounds[1].after.chars));

  result.ok = true;
} catch (e) {
  result.error = String(e?.message || e);
  save();
  log('ERROR', result.error);
} finally {
  await finishSpace(task);
}
console.log('DONE ' + path.join(OUT, 'result.json'));
