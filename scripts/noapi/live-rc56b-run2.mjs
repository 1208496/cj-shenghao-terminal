// rc56b 真实生成验收（第二轮尝试）：接管被用户持有的 space 后再跑。
// 改进：连接 API 的检测更稳（多个选择器 + 明确失败即止，不发消息不花钱）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');
const AVATAR = '神豪终端7.png';
const OUT = path.join(ROOT, '.work', 'live-rc56b');
fs.mkdirSync(OUT, { recursive: true });
const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';

const MSG1 = '上午十点，沈清弦在客厅窗边改图纸，陆晚晴盘腿坐在地毯上翻展册；苏晚刚从门口进来，把两杯手冲放在茶几上，站在旁边没说话。我靠在沙发上打量她们三个。';
const MSG2 = '我抬手按住沈清弦的手腕，直视她说：“以后别叫我陆总了，叫我阿澈。”';

const SPACE_NAME = 'NOAPI-RC56B-LIVE';
let task, page;
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === SPACE_NAME);
if (!entry) {
  task = await taskSpace(SPACE_NAME);
  page = task.page('p1') ?? await task.newPage();
} else if (entry.ownership === 'agent') {
  task = await taskSpace(entry.id);
  page = (await task.pages())[0] ?? await task.newPage();
} else {
  task = await takeOverTaskSpace(entry.id);
  page = (await task.adopt((await task.tabs())[0].page));
}
console.log('[RC56B] space', task.spaceId, 'page', page.label);

const result = { at: new Date().toISOString(), rounds: [], connect: null };
const save = () => fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
const log = (...a) => console.log('[RC56B]', ...a);

const statusClass = () => page.evaluate(() => document.getElementById('API-status-top')?.className || '');

async function ensureConnected() {
  const before = await statusClass();
  const ok = (c) => c.includes('fa-plug') && !c.includes('exclamation');
  result.connect = { before };
  if (ok(before)) { result.connect.ok = true; result.connect.how = 'already'; return true; }
  // 打开 API 面板
  await page.evaluate(() => document.querySelector('#API-status-top')?.click());
  await page.waitForTimeout(1500);
  // 候选：常见 id / 类名 / 文案
  const clicked = await page.evaluate(() => {
    const cands = [
      '#api_connect_btn', '#connect_api', 'button.connect', '.api_connect',
    ];
    for (const sel of cands) { const el = document.querySelector(sel); if (el) { el.click(); return sel; } }
    const pool = [...document.querySelectorAll('button,div,span,a,.menu_button')]
      .filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
    const hit = pool.find((el) => (el.textContent || '').trim() === '连接');
    if (hit) { hit.click(); return 'text:连接'; }
    return null;
  });
  result.connect.clicked = clicked;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(900);
    const c = await statusClass();
    if (ok(c)) { result.connect.ok = true; result.connect.how = 'clicked'; result.connect.after = c; break; }
  }
  // 收起面板
  await page.evaluate(() => document.querySelector('#API-status-top')?.click());
  await page.waitForTimeout(400);
  result.connect.after = await statusClass();
  result.connect.ok = result.connect.ok || ok(result.connect.after);
  return result.connect.ok === true;
}

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
  const beforeCount = await page.evaluate(() => (window.SillyTavern.getContext().chat || []).length);
  await page.evaluate((t) => {
    const ta = document.querySelector('#send_textarea');
    ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#send_but')?.click();
  }, text);
  // 轮询等新消息落地（最多 4 分钟）
  const deadline = Date.now() + 240000;
  let mes = '';
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    const st = await page.evaluate((n) => {
      const ctx = window.SillyTavern.getContext();
      const msgs = ctx.chat || [];
      const last = msgs[msgs.length - 1] || {};
      return { count: msgs.length, mes: String(last.mes || ''), isUser: !!last.is_user, generating: !!ctx.isGenerating?.() };
    }, beforeCount);
    if (st.count > beforeCount && !st.isUser && !st.generating && st.mes.length > 5) { mes = st.mes; break; }
  }
  await page.waitForTimeout(2500);
  return { mes };
};

try {
  const connected = await ensureConnected();
  save();
  log('connect', JSON.stringify(result.connect));
  if (!connected) throw new Error('API_NOT_CONNECTED：未点通连接按钮，本轮不发消息、不花钱');

  const seedRaw = execFileSync(NODE_BIN, [path.join(ROOT, 'scripts', 'test-noapi-seed.mjs'), '--char', '神豪终端7', '--preset', 'three_women_live', '--unique'], { encoding: 'utf8', cwd: ROOT });
  const seed = JSON.parse(seedRaw.slice(seedRaw.indexOf('{'), seedRaw.lastIndexOf('}') + 1));
  result.chatId = seed.chatId;
  save();

  await page.evaluate(async ([av, chat]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((x) => x.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
    if (typeof ctx.openCharacterChat === 'function') await ctx.openCharacterChat(chat);
  }, [AVATAR, seed.chatId]);
  await page.waitForTimeout(6000);
  result.before = await snapshot();
  save();
  log('before audit', JSON.stringify(result.before.audit));

  const r1 = await sendAndWait(MSG1);
  if (!r1.mes) throw new Error('R1_NO_OUTPUT');
  result.rounds.push({ id: 'R-1', sent: MSG1, mes: r1.mes.slice(0, 5000), after: await snapshot() });
  save();
  log('R-1 audit', JSON.stringify(result.rounds[0].after.audit));

  const r2 = await sendAndWait(MSG2);
  if (!r2.mes) throw new Error('R2_NO_OUTPUT');
  result.rounds.push({ id: 'R-2', sent: MSG2, mes: r2.mes.slice(0, 5000), after: await snapshot() });
  save();
  log('R-2 chars', JSON.stringify(result.rounds[1].after.chars));
  result.ok = true;
} catch (e) {
  result.error = String(e?.message || e);
  save();
  log('ERROR', result.error);
} finally {
  await finishSpace(task);
}
console.log('DONE ' + path.join(OUT, 'result.json'));
