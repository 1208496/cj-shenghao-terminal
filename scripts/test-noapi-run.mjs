// scripts/test-noapi-run.mjs
// 零 API + 免开局表单的实机断言（ego-browser 运行时；不依赖 playwright，也不装新包）。
//
// 用法（8001 必须已在跑）：
//   ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/test-noapi-run.mjs')"
//   node scripts/test-noapi-run.mjs --preset three_cards        # 纯 Node 也能跑 seed，但断言需要 ego 运行时
//
// 参数：
//   --avatar 神豪终端4.png   角色卡头像文件名（决定聊天目录名）
//   --char 神豪终端4          聊天目录名（默认从 avatar 去掉 .png）
//   --preset empty_bag|three_cards|wish_unlocked|high_wealth|max_pity
//   --dock float|bottom       小手机停靠方式
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE_URL = 'http://127.0.0.1:8001/';
const ROOT = 'E:/SHZDCHOSSS';
const SHOT_DIR = path.resolve(ROOT, 'reports/noapi-test-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

if (new URL(BASE_URL).port !== '8001') throw new Error('SAFETY_BLOCK: 仅允许连接 8001 测试实例');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[k.slice(2)] = true;
    else { out[k.slice(2)] = next; i++; }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const avatar = args.avatar || process.env.NOAPI_AVATAR || '神豪终端4.png';
const charFolder = args.char || avatar.replace(/\.png$/i, '');
const preset = args.preset || process.env.NOAPI_PRESET || 'empty_bag';
const dock = args.dock || 'float';

const log = (...a) => console.log('[NOAPI]', ...a);
const fail = (step, detail) => { throw new Error(`FAIL ${step}: ${JSON.stringify(detail)}`); };

async function waitFor(page, fn, arg, { timeout = 15000, label = 'wait', interval = 250 } = {}) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try { last = await page.evaluate(fn, arg); } catch (e) { last = { error: String(e).slice(0, 120) }; }
    if (last === true || last?.ok === true) return last;
    await page.waitForTimeout(interval);
  }
  fail(`${label}_TIMEOUT`, last);
}

// 1) 预置存档
// ego 运行时里 process.execPath 是 Electron，必须显式找 node
// ego 运行时的 process.execPath 是 ego.exe，不能拿它当 node 用；只有真的是 node 才用 execPath。
const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';
const seedOut = path.resolve(ROOT, '.work/test-noapi-seed.json');
const seedStart = Date.now();
const seedRaw = execFileSync(NODE_BIN, [
  path.resolve(ROOT, 'scripts/test-noapi-seed.mjs'),
  '--char', charFolder, '--preset', preset,
  '--out', seedOut,
  ...(args['with-swipe-floor'] ? ['--with-swipe-floor'] : []),
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// 必须确认这次真的写出了新文件：文件比启动时间还旧，说明 seed 没跑起来，绝不能拿旧预置冒充
const st = fs.existsSync(seedOut) ? fs.statSync(seedOut) : null;
if (!st || st.mtimeMs < seedStart - 1000) {
  throw new Error('SEED_NOT_WRITTEN: seed 子进程没有写出预置（stdout=' + String(seedRaw).slice(0, 200) + '）');
}
const seed = JSON.parse(fs.readFileSync(seedOut, 'utf8').replace(/^\uFEFF/, ''));
log('SEED_OK', seed.chatId, seed.initKey);

// 2) 浏览器（ego 运行时）
const task = await taskSpace('NOAPI ' + Date.now());
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
const violations = [];
const pageErrors = [];
page.on?.('pageerror', (e) => pageErrors.push(String(e)));

try {
  // 3) 打开 8001（不连 API）
  await page.goto(BASE_URL, { timeout: 30000 });
  await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'TAVERN_READY', timeout: 25000 });

  // 4) 零 API 哨兵：把 fetch 包一层审计，命中生成端点即记违规
  await page.evaluate(() => {
    if (window.__NOAPI_HOOKED__) return;
    window.__NOAPI_HOOKED__ = true;
    window.__NOAPI_VIOLATIONS__ = [];
    const re = /\/api\/(backends|openai|anthropic|google|openrouter|novelai|horde|kobold|textgen)|\/generate\b|\/chat\/completions/;
    const of = window.fetch.bind(window);
    window.fetch = function (...a) {
      const url = String(a[0]?.url || a[0] || '');
      if (re.test(url)) window.__NOAPI_VIOLATIONS__.push(url);
      return of(...a);
    };
    const ox = window.XMLHttpRequest?.prototype?.open;
    if (ox) window.XMLHttpRequest.prototype.open = function (m, u, ...rest) {
      if (re.test(String(u))) window.__NOAPI_VIOLATIONS__.push(String(u));
      return ox.call(this, m, u, ...rest);
    };
  });

  // 5) 选卡 + 切到预置聊天（都不触发生成）
  const charOk = await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) return { ok: false, why: 'CHAR_NOT_FOUND', avatars: ctx.characters.slice(-6).map((c) => c.avatar) };
    await ctx.selectCharacterById(idx);
    return { ok: true, idx };
  }, avatar);
  if (!charOk.ok) fail('SELECT_CHAR', charOk);
  await page.waitForTimeout(2500);

  const chatOk = await page.evaluate(async (chatId) => {
    try { await window.SillyTavern.getContext().openCharacterChat(chatId); return { ok: true }; }
    catch (e) { return { ok: false, why: String(e).slice(0, 160) }; }
  }, seed.chatId);
  if (!chatOk.ok) fail('OPEN_CHAT', chatOk);

  // 6) 小手机必须自己出现（不等生成、不提交开局表单）
  const shown = await waitFor(page, (initKey) => {
    const frame = document.getElementById('cj-shenghao-phone-frame');
    const api = window.__CJ_SHENGHAO_V2__;
    const v = api?.read?.();
    return {
      ok: !!frame && getComputedStyle(frame).display !== 'none' && v?.state?.meta?.initKey === initKey,
      display: frame ? getComputedStyle(frame).display : null,
      initKey: v?.state?.meta?.initKey || null,
      wizard: !!document.querySelector('#wizard'),
    };
  }, seed.initKey, { label: 'PHONE_APPEAR', timeout: 20000 });
  log('PHONE_OK', shown);

  const prefs = await page.evaluate((d) => {
    window.__CJ_SHENGHAO_V2__.preferences({ displayDock: d, randomAvatar: false });
    return true;
  }, dock);

  // 7) 展开小手机 + 五个 tab 全套断言
  const tabs = await page.evaluate(async () => {
    const f = document.getElementById('cj-shenghao-phone-frame');
    const pd = f.contentDocument;
    // 折叠球绑定的是 pointer 拖拽：先补一次 pointerdown/up，再点一下，确保任何实现都能展开。
    const foldEl = pd.querySelector('.folded');
    if (foldEl) {
      foldEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
      foldEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
      foldEl.click();
    }
    await new Promise((r) => setTimeout(r, 600));
    const order = [...pd.querySelectorAll('nav.bottom .tab')].map((b) => b.dataset.tab);
    const pages = {};
    for (const id of order) {
      const btn = [...pd.querySelectorAll('nav.bottom .tab')].find((b) => b.dataset.tab === id);
      btn?.click();
      await new Promise((r) => setTimeout(r, 350));
      pages[id] = {
        active: !!pd.querySelector(`nav.bottom .tab[data-tab="${id}"][aria-current="page"]`),
        title: pd.querySelector('.phone-hd b')?.textContent || '',
        hasHub: !!pd.querySelector('.wheel-hub-grid'),
        hubCards: pd.querySelectorAll('.wheel-hub-grid .wheel-card').length,
        hasTopbar: !!pd.querySelector('.wheel-topbar'),
        topbarActs: pd.querySelectorAll('.wheel-topbar-acts button').length,
        dupHead: pd.querySelectorAll('.phone-screen .section-head h3').length,
        hasPool: !!pd.querySelector('.pool'),
        assetTabs: pd.querySelectorAll('[data-asset-tab]').length,
      };
    }
    return { order, pages };
  });
  const expected = ['scene', 'women', 'mine', 'wealth', 'wheel'];
  if (JSON.stringify(tabs.order) !== JSON.stringify(expected)) fail('TAB_ORDER', tabs);
  if (!tabs.pages.wheel.hasHub) fail('WHEEL_HUB', tabs.pages.wheel);
  if (!tabs.pages.wheel.hasTopbar || tabs.pages.wheel.topbarActs !== 2) fail('WHEEL_TOPBAR', tabs.pages.wheel);
  if (tabs.pages.wheel.hubCards !== 3) fail('WHEEL_HUB_CARDS', tabs.pages.wheel);
  if (tabs.pages.wheel.dupHead !== 0) fail('WHEEL_DUP_TITLE', tabs.pages.wheel);
  if (!tabs.pages.wealth.hasPool) fail('WEALTH_POOL', tabs.pages.wealth);
  if (tabs.pages.wealth.assetTabs !== 8) fail('WEALTH_ASSET_TABS', tabs.pages.wealth);

  const phoneShot = path.join(SHOT_DIR, `${preset}-phone.png`);
  await page.screenshot({ path: phoneShot });

  // 8) 全屏轮盘：真跨 iframe 握手 + 几何量测
  const openRes = await page.evaluate(async () => {
    const pd = document.getElementById('cj-shenghao-phone-frame').contentDocument;
    const btn = pd.querySelector('[data-open-wheel="play"]');
    if (!btn) return { ok: false, why: 'NO_BUTTON' };
    btn.click();
    return { ok: true };
  });
  if (!openRes.ok) fail('OPEN_WHEEL_BUTTON', openRes);

  const wheelReady = await waitFor(page, () => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = f?.contentDocument;
    const dbg = window.__CJ_SHENGHAO_V2__?.wheelDebug?.() || {};
    return {
      ok: !!f && getComputedStyle(f).display !== 'none' && d?.querySelectorAll('#wfSvg .ring').length > 0 && dbg.ready === true,
      dbg,
      nodes: d ? d.querySelectorAll('#wfSvg *').length : 0,
    };
  }, null, { label: 'WHEEL_HANDSHAKE', timeout: 12000 });
  log('WHEEL_OK', { nodes: wheelReady.nodes });

  const geom = await page.evaluate(() => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = f.contentDocument;
    const r = (el) => { const b = el?.getBoundingClientRect(); return b ? { w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) } : null; };
    return {
      frame: r(f),
      board: r(d.querySelector('.wf-board')),
      side: r(d.querySelector('.wf-side')),
      vw: innerWidth, vh: innerHeight,
      err: d.defaultView.__CJ_WHEEL_ERR__ || [],
      modes: d.querySelectorAll('.wf-modes button').length,
    };
  });
  if (!geom.side || geom.side.right > geom.vw + 2) fail('WHEEL_SIDE_CLIPPED', geom);
  if (geom.modes !== 3) fail('WHEEL_MODES', geom);
  if (geom.err.length) fail('WHEEL_JS_ERROR', geom);

  // 9) 零 API 抽一次（引擎本地运算），等确定性完成判据
  const prevRev = await page.evaluate(() => window.__CJ_SHENGHAO_V2__.read().state.meta.revision);
  await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame').contentDocument.getElementById('wfGo').click());
  const settled = await waitFor(page, (prev) => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = f?.contentDocument;
    const dbg = window.__CJ_SHENGHAO_V2__?.wheelDebug?.() || {};
    const rev = window.__CJ_SHENGHAO_V2__.read()?.state?.meta?.revision ?? 0;
    return {
      ok: !!d?.getElementById('wfResult')?.classList.contains('on') && !dbg.spinning && rev > prev,
      rev, spinning: dbg.spinning,
      result: d?.getElementById('wfResult')?.innerText?.replace(/\s+/g, ' ').slice(0, 80) || '',
    };
  }, prevRev, { label: 'WHEEL_SETTLE', timeout: 20000, interval: 400 });
  log('SPIN_OK', settled);
  const wheelShot = path.join(SHOT_DIR, `${preset}-wheel.png`);
  await page.screenshot({ path: wheelShot });

  // 10) 刷新回读：8001 没开 auto_load_chat，刷新后要重新选卡进聊天，再断言状态没丢
  await page.goto(BASE_URL, { timeout: 30000 });
  await waitFor(page, () => ({ ok: document.readyState === 'complete' && !!document.getElementById('send_form') }), null, { label: 'RELOAD_READY', timeout: 25000 });

  const picked = await waitFor(page, (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    return { ok: idx >= 0, idx, count: ctx.characters.length, avs: ctx.characters.slice(-4).map((c) => c.avatar) };
  }, avatar, { label: 'RELOAD_CHAR_LIST', timeout: 20000, interval: 400 });
  await page.evaluate(async (idx) => { await window.SillyTavern.getContext().selectCharacterById(idx); }, picked.idx);
  await page.waitForTimeout(2600);

  const opened = await page.evaluate(async (chatId) => {
    try {
      await window.SillyTavern.getContext().openCharacterChat(chatId);
      return { ok: true, chat: window.SillyTavern.getContext().chatId };
    } catch (e) { return { ok: false, why: String(e).slice(0, 160) }; }
  }, seed.chatId);
  log('RELOAD_CHAT', opened);

  const reloaded = await waitFor(page, (rev) => {
    const phone = document.getElementById('cj-shenghao-phone-frame');
    const api = window.__CJ_SHENGHAO_V2__;
    const v = api?.read?.();
    return {
      ok: !!phone && getComputedStyle(phone).display !== 'none' && (v?.state?.meta?.revision ?? 0) >= rev,
      rev: v?.state?.meta?.revision ?? 0,
      initKey: v?.state?.meta?.initKey || null,
      chat: window.SillyTavern?.getContext?.().chatId || null,
      frames: document.querySelectorAll('iframe#cj-shenghao-phone-frame').length,
    };
  }, settled.rev, { label: 'RELOAD_PERSIST', timeout: 25000 });
  log('RELOAD_OK', reloaded);

  // 11) 零 API 与零报错断言
  const jsViolations = await page.evaluate(() => window.__NOAPI_VIOLATIONS__ || []);
  if (jsViolations.length) fail('ZERO_API_VIOLATION', jsViolations);
  if (pageErrors.length) fail('PAGE_ERRORS', pageErrors);

  console.log(JSON.stringify({
    status: 'PASS', preset, initKey: seed.initKey,
    tabs: tabs.order, revisionAfterSpin: settled.rev, wheelNodes: wheelReady.nodes,
    geom, shots: [phoneShot, wheelShot], apiCalls: 0,
  }, null, 2));
} finally {
  // 不销毁 space，方便人工接着点；需要清场用 seed --restore
}


