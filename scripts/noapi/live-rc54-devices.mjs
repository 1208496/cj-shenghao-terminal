// rc54 真实生成驱动（会花钱：3 轮生成，每轮只发一次，失败不重试）
//   R-01 项圈进正文 / R-02 印记进正文 / R-03 TOY 戴上未开启 / R-06 三件同场   → 第 1 轮
//   R-04 开启 2 档                                                            → 第 2 轮
//   R-05 切档 2 → 3                                                           → 第 3 轮
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-rc54-devices.mjs')"
// 前置：8001 在跑、模型配置保持现状（本轮不动任何 API 设置）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { attachSpace, finishSpace, waitFor } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/runtime.mjs';
import { openTavern, lastSig, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端7.png';
const PHONE_ID = 'cj-shenghao-phone-frame';
const OUT_DIR = path.join(ROOT, '.work', 'live-rc54');
fs.mkdirSync(OUT_DIR, { recursive: true });
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');
const CTL_FILE = path.join(OUT_DIR, 'ctl.json');
let CTL = {};
try { CTL = JSON.parse(fs.readFileSync(CTL_FILE, 'utf8')); } catch { CTL = {}; }

const result = { at: new Date().toISOString(), avatar: AVATAR, baseUrl: BASE, model: null, chatId: null, setup: {}, rounds: [], injectionProbe: null };
const log = (...a) => console.log('[LIVE54]', ...a);
const save = () => fs.writeFileSync(path.join(OUT_DIR, 'live-result.json'), JSON.stringify(result, null, 2), 'utf8');

// ── 1) 播种：三件全解锁、未佩戴未落印、char_a 达标 ──────────────────
const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';
const seedOut = execFileSync(NODE_BIN, [path.join(ROOT, 'scripts', 'test-noapi-seed.mjs'), '--char', '神豪终端7', '--preset', 'device_ready', '--unique'], { encoding: 'utf8', cwd: ROOT });
const seed = JSON.parse(seedOut.slice(seedOut.indexOf('{'), seedOut.lastIndexOf('}') + 1));
result.chatId = seed.chatId;
log('SEED', seed.chatId, seed.initKey);

const { task, page } = await attachSpace('NOAPI-RC54-LIVE');
const ph = (src) => page.evaluate((s) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  return new Function('d', s)(d);
}, String(src));
const imp = (src) => page.evaluate((s) => {
  const d = document.getElementById('cj-shenghao-imprint-frame')?.contentDocument;
  if (!d) return { __noImprint: true };
  return new Function('d', s)(d);
}, String(src));
const sleep = (ms) => page.waitForTimeout(ms);

// 抓真实请求体（证据用）：每次发送后看 messages 里有没有注入块
const captured = [];
try {
  page.on?.('request', (req) => {
    try {
      const u = String(req.url() || '');
      if (!/chat-completions\/generate|\/api\/backends\/|gcli\.ggchan\.dev/.test(u)) return;
      const body = req.postData ? req.postData() : null;
      if (body) captured.push({ url: u, body });
    } catch { /* 抓不到就算了，不阻塞 */ }
  });
} catch (e) { log('请求监听装不上（不影响跑）', String(e?.message || e).slice(0, 80)); }

const stateSnapshot = () => page.evaluate(() => {
  const h = window.__CJ_SHENGHAO_V2__;
  const v = h?.read?.() || {};
  const s = v.state || null;
  const a = s?.characters?.char_a || null;
  let toy = null;
  try { toy = h?.toyLinkState?.() || null; } catch { toy = null; }
  return {
    rev: s?.meta?.revision ?? null,
    chokerWorn: !!a?.choker?.worn,
    chokerStyle: a?.choker?.styleId || null,
    chokerIns: a?.choker?.inscription || null,
    accessories: a?.outfit?.accessories || '',
    imprintKeys: Object.keys(a?.imprints?.items || {}),
    tattooScar: a?.physiology?.tattooScar || '',
    toy: toy ? { wearingIds: toy.wearingIds || [], running: !!toy.running, pow: toy.pow ?? null, activeMode: toy.activeMode || null, selectedId: toy.selectedId || null } : null,
  };
});

try {
  await openTavern(page);
  // ST 的「API 已连接」是页面级状态：新开页面一律回落到未连接，发送会被静默拦掉。
  // 这里只点界面上的「连接」按钮做一次状态检查，不改任何 API 设置（模型/URL/key 全保持现状）。
  const conn = { before: null, after: null, clicked: false, ok: false };
  conn.before = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
  if (!(conn.before || '').includes('fa-plug') || (conn.before || '').includes('exclamation')) {
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(1500);
    conn.clicked = await page.evaluate(() => {
      const pool = [...document.querySelectorAll('button, .menu_button, div, span')].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
      const b = pool.find((el) => (el.textContent || '').trim() === '连接');
      b?.click();
      return !!b;
    });
    for (let i = 0; i < 18; i += 1) {
      await page.waitForTimeout(900);
      conn.after = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
      if (conn.after && conn.after.includes('fa-plug') && !conn.after.includes('exclamation')) { conn.ok = true; break; }
    }
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(500);
  } else { conn.ok = true; conn.after = conn.before; }
  result.connect = conn;
  log('CONNECT', JSON.stringify(conn));
  if (!conn.ok) throw new Error('API_NOT_CONNECTED（未连接，按规则不发送）');
  save();
  await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
  }, AVATAR);
  await sleep(2400);
  await page.evaluate(async (c) => { await window.SillyTavern.getContext().openCharacterChat(c); }, seed.chatId);
  const phone = await waitFor(page, (o) => {
    const f = document.getElementById(o.pid);
    const v = window.__CJ_SHENGHAO_V2__;
    const s = v?.read?.() || null;
    return { ok: !!f && getComputedStyle(f).display !== 'none' && !!(s?.state?.meta?.initialized) };
  }, { pid: PHONE_ID }, { label: 'PHONE', timeout: 25000 });
  if (!phone.ok) throw new Error('PHONE_NOT_READY');
  log('PHONE_READY');

  result.model = await page.evaluate(() => {
    const ctx = window.SillyTavern.getContext();
    const o = ctx.chatCompletionSettings || {};
    return { source: o.chat_completion_source || null, custom_model: o.custom_model || null, custom_url: o.custom_url || null, max_tokens: o.openai_max_tokens ?? null, stream: !!o.stream_openai };
  });
  save();

  // 展开手机 + 滚动我的页
  await ph(`const f=d.querySelector('.folded,.folded-bar,#folded'); if(f){f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1}));f.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1}));f.click();} return true;`);
  await sleep(600);
  await ph(`[...d.querySelectorAll('nav.bottom .tab')].find(b=>b.dataset.tab==='mine')?.click(); return true;`);
  await sleep(600);
  await ph(`const sc=d.querySelector('.phone-screen'); if(sc) sc.scrollTop=260; return true;`);
  await sleep(200);

  // ── 2) 项圈：玫瑰金锁圈 + 刻字 Eternal ──────────────────────────
  await ph(`d.querySelector('[data-open-workshop="choker"] .wcard-b-top')?.click(); return true;`);
  await sleep(1400);
  await ph(`d.querySelector('[data-ws-style="rose_gold_lock"]')?.click(); return true;`);
  await sleep(400);
  await ph(`
    const i=d.getElementById('wsChokerIns');
    if(!i) return {ok:false};
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(i,'Eternal');
    i.dispatchEvent(new Event('input',{bubbles:true}));
    return {ok:true, value:i.value};
  `);
  await sleep(300);
  await ph(`d.querySelector('[data-ws-choker-save]')?.click(); return true;`);
  await sleep(800);
  await ph(`d.querySelector('[data-confirm-ws-choker="1"]')?.click(); return true;`);
  await sleep(1800);
  result.setup.choker = await stateSnapshot();
  log('CHOKER', JSON.stringify({ worn: result.setup.choker.chokerWorn, style: result.setup.choker.chokerStyle, ins: result.setup.choker.chokerIns, acc: result.setup.choker.accessories.slice(0, 60) }));
  if (!result.setup.choker.chokerWorn) throw new Error('CHOKER_NOT_WORN');
  await ph(`d.querySelector('[data-act="close-workshop"]')?.click(); return true;`);
  await sleep(900);

  // ── 3) 印记：下腹 + 魅魔心翼 + 「陆氏私有」──────────────────────
  await ph(`const sc=d.querySelector('.phone-screen'); if(sc) sc.scrollTop=260; return true;`);
  await sleep(200);
  await ph(`d.querySelector('[data-open-workshop="imprint"]')?.click(); return true;`);
  await sleep(1600);
  await imp(`
    const want='succubus_heart';
    const on=d.querySelector('[data-ws-pattern][data-ws-pattern].on');
    const target=d.querySelector('[data-ws-pattern="'+want+'"]');
    if(target && (!on || on.dataset.wsPattern!==want)) target.click();
    const plc=d.querySelector('[data-ws-place="lower_abdomen"]');
    if(plc && !plc.classList.contains('on')) plc.click();
    return {ok:true};
  `);
  await sleep(600);
  await imp(`
    const i=d.getElementById('wsImprintText');
    if(!i) return {ok:false};
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(i,'陆氏私有');
    i.dispatchEvent(new Event('input',{bubbles:true}));
    return {ok:true, value:i.value};
  `);
  await sleep(400);
  await imp(`const b=d.getElementById('btnSave'); const dis=b?b.disabled:null; b?.click(); return {clicked:!!b, disabled:dis};`);
  await sleep(2200);
  result.setup.imprint = await stateSnapshot();
  log('IMPRINT', JSON.stringify({ keys: result.setup.imprint.imprintKeys, scar: result.setup.imprint.tattooScar.slice(0, 80) }));
  if (!result.setup.imprint.imprintKeys.length) throw new Error('IMPRINT_NOT_SAVED');
  await imp(`d.getElementById('btnClose')?.click(); return true;`);
  await sleep(900);

  // ── 4) TOY：选 char_a，戴上但**不开启** ─────────────────────────
  await ph(`const sc=d.querySelector('.phone-screen'); if(sc) sc.scrollTop=260; return true;`);
  await sleep(200);
  await ph(`d.querySelector('[data-toylink]')?.click(); return true;`);
  await sleep(1000);
  await ph(`d.querySelector('[data-tl-lite-select="char_a"]')?.click(); return true;`);
  await sleep(600);
  await ph(`d.querySelector('[data-tl-lite-wear="1"]')?.click(); return true;`);
  await sleep(1000);
  result.setup.toy = await stateSnapshot();
  const pill = await ph(`return { pill: d.querySelector('[data-tl-lite-pill]')?.textContent?.trim()||'', state: d.querySelector('[data-tl-lite-state]')?.textContent?.trim()||'' };`);
  result.setup.toyPill = pill;
  log('TOY', JSON.stringify({ toy: result.setup.toy.toy, pill }));
  if (!result.setup.toy.toy?.wearingIds?.length) throw new Error('TOY_NOT_WORN');
  if (result.setup.toy.toy?.running) throw new Error('TOY_SHOULD_NOT_BE_RUNNING');
  save();

  // 注入探针：ST 没有读注入的 API，只能用 slash /inject 碰一下，成败都记录
  try {
    const inj = await page.evaluate(async () => {
      const H = window.TavernHelper;
      if (!H || typeof H.triggerSlash !== 'function') return { ok: false, why: 'NO_triggerSlash' };
      try {
        const r = await H.triggerSlash('/inject id=cj_shenghao_toylink_lite');
        return { ok: true, out: String(r ?? '').slice(0, 600) };
      } catch (e) { return { ok: false, why: String(e?.message || e).slice(0, 200) }; }
    });
    result.injectionProbe = inj;
    log('INJECT_PROBE', JSON.stringify(inj).slice(0, 300));
  } catch (e) { result.injectionProbe = { ok: false, why: String(e?.message || e).slice(0, 160) }; }
  save();

  // ── 5) 三轮生成 ────────────────────────────────────────────────
  if (CTL.setupOnly) {
    log('SETUP_ONLY：前置与注入探针已记录，未发送任何消息');
    save();
    await finishSpace(task, []);
    process.exit(0);
  }
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  const lastAI = () => page.evaluate(() => {
    const chat = window.SillyTavern.getContext().chat || [];
    const m = [...chat].reverse().find((x) => x && x.is_user === false);
    return m ? { messageId: m.message_id, text: String(m.mes || '') } : null;
  });

  const rounds = [
    { n: 1, label: 'R-01 项圈 / R-02 印记 / R-03 戴上未开启 / R-06 三件同场', gear: null, text: '我放下杯子，走过去从背后环住她的腰，低声问她今天累不累。' },
    { n: 2, label: 'R-04 开启 2 档', gear: 2, text: '指腹贴着她的后腰，慢慢往下压，问她现在什么感觉。' },
    { n: 3, label: 'R-05 切档 2 → 3', gear: 3, text: '手上加重了一点，贴着她耳边说话。' },
  ];

  const sendAndWait = async (text) => {
    const sig = await lastSig(page);
    await page.evaluate((t) => {
      const ta = document.getElementById('send_textarea');
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, t);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('send_but')?.click();
    }, text);
    // 单轮上限 9 分钟：8k–12k 字流式输出比库默认的 180s 长
    return waitGeneration(page, sig, { timeout: 540000 });
  };

  for (const rd of rounds) {
    if (rd.gear != null) {
      const before = await ph(`return { running: !!d.querySelector('[data-tl-lite-stop="1"]'), cur: d.querySelector('[data-tl-lite-gear-cur]')?.textContent?.trim()||'' };`);
      if (!before.running) {
        await ph(`d.querySelector('[data-tl-lite-start="1"]')?.click(); return true;`);
        await sleep(1000);
      }
      const cur = await ph(`return { running: !!d.querySelector('[data-tl-lite-stop="1"]'), cur: d.querySelector('[data-tl-lite-gear-cur]')?.textContent?.trim()||'' };`);
      if (!new RegExp(`${rd.gear}\\s*档`).test(cur.cur)) {
        await ph(`d.querySelector('[data-tl-lite-gear="${rd.gear}"]')?.click(); return true;`);
        await sleep(900);
      }
      const post = await ph(`return { running: !!d.querySelector('[data-tl-lite-stop="1"]'), cur: d.querySelector('[data-tl-lite-gear-cur]')?.textContent?.trim()||'', pill: d.querySelector('[data-tl-lite-pill]')?.textContent?.trim()||'' };`);
      const st = await stateSnapshot();
      result.gearSteps = result.gearSteps || [];
      result.gearSteps.push({ round: rd.n, want: rd.gear, before, after: post, toy: st.toy });
      log('GEAR', rd.n, JSON.stringify({ want: rd.gear, got: post.cur, running: post.running, pill: post.pill, pow: st.toy?.pow }));
    }
    const before = await stateSnapshot();
    const capBefore = captured.length;
    const t0 = Date.now();
    const gen = await sendAndWait(rd.text);
    const ai = await lastAI();
    const round = {
      n: rd.n, label: rd.label, sent: rd.text, ok: !!gen.ok, why: gen.why || '', chars: ai ? ai.text.length : 0,
      ms: Date.now() - t0, before, after: await stateSnapshot(),
      requests: captured.slice(capBefore).map((c) => ({ url: c.url, len: c.body.length, hasLite: /cj_shenghao_toylink_lite|TOY·LINK/.test(c.body) })),
    };
    if (ai) fs.writeFileSync(path.join(OUT_DIR, `round-${rd.n}.md`), `# R-${rd.n} 生成正文\n\n- 目标：${rd.label}\n- 发送：${rd.text}\n- 字符数：${ai.text.length}\n\n---\n\n${ai.text}\n`, 'utf8');
    result.rounds.push(round);
    save();
    log('ROUND', rd.n, JSON.stringify({ ok: round.ok, chars: round.chars, ms: round.ms, reqs: round.requests }));
    if (!gen.ok) { log('生成未成功，按规则不重试', gen.why); break; }
  }

  // 首轮请求体里找注入块（只留命中片段，不落全量）
  const hit = captured.map((c) => c.body).find((b) => /TOY·LINK|TOY_LINK|cj_shenghao_toylink_lite/.test(b));
  if (hit) {
    const m = hit.match(/[\s\S]{0,300}(?:TOY·LINK|TOY_LINK|cj_shenghao_toylink_lite)[\s\S]{0,600}/);
    fs.writeFileSync(path.join(OUT_DIR, 'prompt-injection-snippet.txt'), String(m ? m[0] : ''), 'utf8');
    result.promptInjectionFound = true;
  } else {
    result.promptInjectionFound = false;
  }
  save();
  log('DONE');
} catch (e) {
  result.error = String(e?.message || e).slice(0, 400);
  save();
  log('ERROR', result.error);
  throw e;
} finally {
  await finishSpace(task, []);
}
