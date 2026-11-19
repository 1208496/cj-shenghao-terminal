// rc.37 全屏轮盘：命运轮盘 / 星愿卡包 / 暗夜赌场三块共用一层全屏 iframe。
// 由 host.js 托管在酒馆页面顶层，position:fixed 覆盖 100vw×100dvh，彻底脱离小手机与底部状态栏。
// 性能铁律：扇区合并 path、符号走 <symbol>/<use>、零 SVG filter、粒子 1.6s 后停帧；
// 卡面只播一次扫光，收藏册与背包内零常驻动画。

import { WHEEL_GLYPHS } from './wheel-glyphs.js';
import { WHEEL_POOL } from '../core/wheel-pool.js';
import { CASINO_BETS } from '../core/casino-catalog.js';
import { WHEEL_COPY, fill } from '../core/wheel-ui-copy.js';
import { playWheelQuote, POINTS_PER_SPIN } from '../core/wheel.js';
import { wishWheelQuote, lowPackQuote, LOW_CARD_CASINO_CAP } from '../core/casino.js';
import { RARITY_VISUAL, cardGlyph, CARD_CODES } from './card-art.js';

const CHANNEL = 'CJ_SHENGHAO_WHEEL_V1';
const OP_TIMEOUT_MS = 12000;
const C = 320;
const SLOTS = 37;
const COPY = WHEEL_COPY;
const NAMES = COPY.wheels.names;
const TEAR_GOAL = 0.72;

const RINGS = [
  { from: 0, to: 30, r1: 206, r2: 292, symR: 250, size: 17 },
  { from: 30, to: 46, r1: 132, r2: 198, symR: 166, size: 19 },
  { from: 46, to: 52, r1: 74, r2: 126, symR: 100, size: 21 },
];
const CORE = { r1: 56, r2: 70 };
const RING_FILL = [['#241f27', '#2c2530'], ['#2a2230', '#332839'], ['#2d2436', '#382c42']];
const GOLD_LINE = 'rgba(217,184,120,.26)';
const SYM_COLOR = { gray: '#cfd5e3', red: '#ffd1d8', gold: '#fff0be', rainbow: '#f0e6ff' };

const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
function sector(r1, r2, a0, a1) {
  const [x0, y0] = polar(r2, a0);
  const [x1, y1] = polar(r2, a1);
  const [x2, y2] = polar(r1, a1);
  const [x3, y3] = polar(r1, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r2} ${r2} 0 ${big} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r1} ${r1} 0 ${big} 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
}
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yuan = (cents) => '¥' + new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(Number(cents || 0) / 100));

// ---- 静态骨架：整个会话只构建一次，切盘才重建 ----
const DEFS = `<defs>
<radialGradient id="beadGrad" cx="34%" cy="30%"><stop offset="0%" stop-color="#fffdf2"/><stop offset="52%" stop-color="#dcd6c4"/><stop offset="100%" stop-color="#7d7566"/></radialGradient>
<radialGradient id="vig" cx="50%" cy="50%" r="50%"><stop offset="60%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,.55)"/></radialGradient>
<radialGradient id="coreGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,246,216,.95)"/><stop offset="45%" stop-color="rgba(224,179,255,.55)"/><stop offset="100%" stop-color="rgba(224,179,255,0)"/></radialGradient>
${WHEEL_POOL.map((p) => `<symbol id="g${p.no}" viewBox="0 0 24 24"><path d="${WHEEL_GLYPHS[Number(p.no)] || ''}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>`).join('')}
</defs>`;

function decorativeFrame() {
  return `<circle cx="${C}" cy="${C}" r="303" fill="none" stroke="rgba(217,184,120,.22)" stroke-width="3"/>
<circle cx="${C}" cy="${C}" r="297" fill="none" stroke="rgba(217,184,120,.14)" stroke-width="1"/>
<circle cx="${C}" cy="${C}" r="306" fill="none" stroke="rgba(246,227,176,.1)" stroke-width="1"/>`;
}

// 扇区按深浅交替合并成 2 条 path，分隔线合并成 1 条 —— 一圈只有 3 个渲染节点。
function mergedRing(r1, r2, n, fills, offsetDeg = 0) {
  const step = 360 / n;
  let a = '', b = '', sep = '';
  for (let i = 0; i < n; i++) {
    const seg = sector(r1, r2, offsetDeg + i * step, offsetDeg + (i + 1) * step);
    if (i % 2 === 0) a += seg; else b += seg;
    const [x0, y0] = polar(r1, offsetDeg + i * step);
    const [x1, y1] = polar(r2, offsetDeg + i * step);
    sep += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `<path d="${a}" fill="${fills[0]}"/><path d="${b}" fill="${fills[1]}"/><path d="${sep}" fill="none" stroke="${GOLD_LINE}" stroke-width=".9"/>`;
}

// 落点高亮挂进每个环自己的组里：环转多少度，黄框就跟多少度，连抽多少把都不会歪。
const wedge = (fillColor) => `<path class="hit-wedge" d="" fill="${fillColor}" stroke="#f6e3b0" stroke-width="1.2"/>`;

function playBoard() {
  let out = DEFS + decorativeFrame();
  RINGS.forEach((cfg, ri) => {
    const n = cfg.to - cfg.from;
    const step = 360 / n;
    out += `<g class="ring" data-ring="${ri}">${mergedRing(cfg.r1, cfg.r2, n, RING_FILL[ri])}`;
    for (let i = 0; i < n; i++) {
      const p = WHEEL_POOL[cfg.from + i];
      const [x, y] = polar(cfg.symR, i * step + step / 2);
      out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(i * step + step / 2).toFixed(1)})" style="color:${SYM_COLOR[p.rarity]}"><use href="#g${p.no}" width="24" height="24" x="-12" y="-12" transform="scale(${cfg.size / 24})"/></g>`;
    }
    out += `${wedge('rgba(246,227,176,.3)')}</g>`;
  });
  out += `<circle cx="${C}" cy="${C}" r="${(CORE.r1 + CORE.r2) / 2}" fill="none" stroke="#b79bff" stroke-width="${CORE.r2 - CORE.r1}" opacity=".55"/>`;
  out += `<circle cx="${C}" cy="${C}" r="${CORE.r1 - 3}" fill="none" stroke="rgba(217,184,120,.3)" stroke-width="1"/>`;
  out += `<circle class="core-glow" cx="${C}" cy="${C}" r="${CORE.r2 + 34}" fill="url(#coreGlow)" style="pointer-events:none"/>`;
  out += `<circle cx="${C}" cy="${C}" r="292" fill="url(#vig)" pointer-events="none"/>`;
  return out;
}

function casinoBoard() {
  const r1 = 96, r2 = 300, step = 360 / SLOTS;
  let out = DEFS + decorativeFrame();
  out += `<g class="ring" data-ring="0">`;
  for (const [color, fillColor] of [['green', '#1f6b45'], ['red', '#8c1f30'], ['black', '#1d1d24']]) {
    let d = '', sep = '';
    for (let i = 0; i < SLOTS; i++) {
      const slotColor = i === 0 ? 'green' : i % 2 === 1 ? 'red' : 'black';
      if (slotColor !== color) continue;
      d += sector(r1, r2, i * step, (i + 1) * step);
      const [x0, y0] = polar(r1, i * step), [x1, y1] = polar(r2, i * step);
      sep += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    out += `<path d="${d}" fill="${fillColor}"/><path d="${sep}" fill="none" stroke="rgba(217,184,120,.28)" stroke-width=".9"/>`;
  }
  for (let i = 0; i < SLOTS; i++) {
    const [x, y] = polar(204, i * step + step / 2);
    out += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="rgba(240,232,214,.62)" font-size="9" text-anchor="middle" transform="rotate(${(i * step + step / 2).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${String(i).padStart(2, '0')}</text>`;
  }
  out += `${wedge('rgba(246,227,176,.28)')}</g>`;
  // 铁球挂在盘面坐标系里（不随扇区组转），掷球时由自己绕盘心滚到中奖格。
  out += `<circle class="bead" id="casinoBead" cx="${C}" cy="${C - 204}" r="9" fill="url(#beadGrad)" stroke="rgba(255,255,255,.6)" stroke-width="1"/>`;
  out += `<circle cx="${C}" cy="${C}" r="${r1}" fill="#121016" stroke="rgba(217,184,120,.4)" stroke-width="1.4"/>`;
  return out;
}

// ---- 计时粒子：1.6s 后硬停帧，空闲 0 CPU ----
let fxRunning = false;
function burstParticles(rarity) {
  const canvas = document.getElementById('wfFx');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 640, 640);
  if (fxRunning) return;
  fxRunning = true;
  const count = { gray: 12, red: 20, gold: 30, rainbow: 36 }[rarity] || 16;
  const palette = {
    gray: ['#d4dae6', '#9aa3b5'],
    red: ['#ff8fa3', '#ffd1d8', '#f6e3b0'],
    gold: ['#fff0be', '#f6e3b0', '#d9b878'],
    rainbow: ['#fff0be', '#e0b3ff', '#8ef6e4', '#ff9ebc'],
  }[rarity] || ['#f6e3b0'];
  const pts = Array.from({ length: count }, (_, i) => {
    const a = (Math.PI * 2 * i) / count + (i % 3) * 0.14;
    const v = 2.2 + (i % 5) * 0.9;
    return { x: 320, y: 320, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + (i % 3), c: palette[i % palette.length] };
  });
  const t0 = performance.now();
  const tick = (now) => {
    const elapsed = now - t0;
    ctx.clearRect(0, 0, 640, 640);
    if (elapsed > 1600) { fxRunning = false; return; }
    const life = 1 - elapsed / 1600;
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.975; p.vy *= 0.975;
      ctx.globalAlpha = life;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- 桥接状态 ----
let nonce = '';
let view = null;
let pendingView = null;
let spinning = false;
let builtType = '';
let wheelType = 'play';
let payMode = 'auto';
let packTier = 'low';
let selectedCardId = '';
let selectedBet = '';
let lastWonCardId = '';
const inflight = new Map();
const svg = document.getElementById('wfSvg');
const boardBox = svg.closest('.wf-board');
const packBox = document.getElementById('wfPack');
const side = document.getElementById('wfSide');
const goBtn = document.getElementById('wfGo');
const resultBox = document.getElementById('wfResult');
const toastBox = document.getElementById('wfToast');
const modesBox = document.getElementById('wfModes');
let toastTimer = null;

function send(msg) { window.parent.postMessage({ channel: CHANNEL, nonce, ...msg }, '*'); }
function toast(text) {
  toastBox.textContent = text;
  toastBox.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove('on'), 2600);
}
function errorText(code) {
  const map = COPY.errors || {};
  if (map[code]) return map[code];
  if (code === 'WHEEL_BRIDGE_TIMEOUT') return COPY.overlay.common.timeoutError;
  if (code === 'STALE_REVISION' || code === 'STALE_SOURCE') return COPY.overlay.common.staleRefreshHint;
  return COPY.overlay.common.timeoutError;
}
function requestOp(op) {
  return new Promise((resolve, reject) => {
    const reqId = crypto.randomUUID();
    const timer = setTimeout(() => { inflight.delete(reqId); reject(new Error('WHEEL_BRIDGE_TIMEOUT')); }, OP_TIMEOUT_MS);
    inflight.set(reqId, { resolve, reject, timer });
    send({ type: 'WHEEL_OP_REQ', reqId, op: { ...op, operationId: crypto.randomUUID(), expectedRevision: view?.revision ?? 0 }, lineage: view?.lineage || '' });
  });
}
function setSpinning(flag) {
  spinning = flag;
  send({ type: 'WHEEL_BUSY_LOCK', spinning: flag });
  if (!flag) { syncGo(); if (pendingView) { view = pendingView; pendingView = null; renderSide(); } }
}

function wheel() { return view?.wheel || {}; }
function playQuote() { return playWheelQuote(wheel(), view?.worldDate || '', view?.tierBasisCents || 0); }
function highQuote() { return wishWheelQuote(wheel(), view?.worldDate || '', view?.tierBasisCents || 0, !!view?.hasWithdrawal); }
function lowQuote() { return lowPackQuote(wheel(), view?.worldDate || ''); }
function wishCards() {
  return (view?.wishCards || []).filter((c) => c.category === 'WISH_CARD' && !c.locked);
}
function codexCount() {
  const seen = new Set((wheel().discoveredCardCodes || []).filter((c) => CARD_CODES.includes(c)));
  return Math.min(CARD_CODES.length, seen.size);
}
function cardCopy(code, rarity) {
  const c = (COPY.cards || {})[code] || {};
  return { name: c.name || String(code || rarity || ''), motto: c.motto || '' };
}

// ---- 盘面 ----
let ringAngles = [0, 0, 0];
function ensureBoard(type) {
  if (builtType === type) return;
  builtType = type;
  boardBox.classList.toggle('is-pack', type === 'pack');
  if (type === 'pack') { packBox.hidden = false; svg.innerHTML = ''; return; }
  packBox.hidden = true;
  packBox.innerHTML = '';
  ringAngles = [0, 0, 0];
  svg.innerHTML = type === 'play' ? playBoard() : casinoBoard();
}
function ringOf(ri) { return svg.querySelector(`[data-ring="${ri}"]`); }
function wedgeOf(ri) { return svg.querySelector(`[data-ring="${ri}"] .hit-wedge`); }
function clearHit() {
  svg.querySelectorAll('.hit-wedge').forEach((w) => { w.classList.remove('on'); w.setAttribute('d', ''); });
  const glow = svg.querySelector('.core-glow');
  if (glow) glow.classList.remove('on');
}
// 每个环各自累计转角：先把旧角取模归一、无过渡落位，再叠加本次增量，永不清空跳变。
function spinRing(ri, turns, targetCenter, duration, delay) {
  const g = ringOf(ri);
  if (!g) return;
  let cur = ((ringAngles[ri] % 360) + 360) % 360;
  g.style.transition = 'none';
  g.style.transformOrigin = `${C}px ${C}px`;
  g.style.transform = `rotate(${cur}deg)`;
  void g.offsetWidth;
  const delta = targetCenter === null ? 0 : (((360 - targetCenter) - cur) % 360 + 360) % 360;
  const goal = ringAngles[ri] + turns * 360 + delta;
  g.style.transition = `transform ${duration}s cubic-bezier(.12,.78,.04,1) ${delay}s`;
  g.style.transform = `rotate(${goal}deg)`;
  ringAngles[ri] = goal;
}
// 铁球绕盘心滚动的累计角度（与环角分开记，互不干扰）。
let beadAngle = 0;
function spinBead(target, duration) {
  const bead = svg.querySelector('#casinoBead');
  if (!bead) return;
  const cur = ((beadAngle % 360) + 360) % 360;
  bead.style.transition = 'none';
  bead.style.transformOrigin = `${C}px ${C}px`;
  bead.style.transform = `rotate(${cur}deg)`;
  void bead.getBoundingClientRect();
  const delta = (((target - cur) % 360) + 360) % 360;
  const goal = beadAngle + 6 * 360 + delta;
  bead.style.transition = `transform ${duration}s cubic-bezier(.2,.72,.06,1)`;
  bead.style.transform = `rotate(${goal}deg)`;
  beadAngle = goal;
}
function highlight(type, index, rarity) {
  if (type === 'play') {
    if (index >= 52) { const glow = svg.querySelector('.core-glow'); if (glow) glow.classList.add('on'); return; }
    const owner = index >= 46 ? 2 : index >= 30 ? 1 : 0;
    const cfg = RINGS[owner];
    const n = cfg.to - cfg.from, step = 360 / n, local = index - cfg.from;
    const w = wedgeOf(owner);
    if (!w) return;
    w.setAttribute('d', sector(cfg.r1, cfg.r2, local * step, (local + 1) * step));
    w.classList.add('on');
    return;
  }
  if (type === 'casino') {
    const step = 360 / SLOTS;
    const w = wedgeOf(0);
    if (!w) return;
    w.setAttribute('d', sector(96, 300, index * step, (index + 1) * step));
    w.classList.add('on');
  }
}
// 中奖扇区一律转到 12 点钟落定；黄框是该环的子节点，因此永远压在同一个扇区上。
function animate(type, index) {
  return new Promise((resolve) => {
    if (type === 'play') {
      if (index >= 52) {
        [0, 1, 2].forEach((ri) => spinRing(ri, 3 + ri, null, 4.4 + ri * 0.3, 0));
        setTimeout(resolve, 4400 + 2 * 300 + 200);
        return;
      }
      const owner = index >= 46 ? 2 : index >= 30 ? 1 : 0;
      const cfg = RINGS[owner];
      const step = 360 / (cfg.to - cfg.from);
      const target = (index - cfg.from) * step + step / 2;
      [0, 1, 2].forEach((ri) => spinRing(ri, 4 + ri, ri === owner ? target : null, 4.8 + ri * 0.3, ri * 0.05));
      setTimeout(resolve, 4800 + 2 * 300 + 250);
      return;
    }
    // 盘面只转整圈（净转角 0），真正动的是铁球：它绕盘心滚到中奖格。
    const step = 360 / SLOTS;
    spinRing(0, 4, null, 4.2, 0);
    spinBead(index * step + step / 2, 4.6);
    setTimeout(resolve, 4800);
  });
}

// ---- 侧栏 ----
function renderModes() {
  modesBox.innerHTML = [['play', NAMES.play], ['pack', NAMES.wish], ['casino', NAMES.casino]]
    .map(([id, name]) => `<button data-mode="${id}" class="${wheelType === id ? 'on' : ''}">${id === 'play' ? '✦' : id === 'pack' ? '✧' : '❖'} ${esc(name)}</button>`)
    .join('');
}
function packCostText(tier, q) {
  if (tier === 'low') {
    if (q.reason === 'LOW_PACK_DAILY_LIMIT') return COPY.packs.low.dailyFull;
    return q.mode === 'free' ? COPY.packs.low.costFree : fill(COPY.packs.low.costCash, { price: yuan(q.costCents) });
  }
  if (!q.unlocked) return COPY.packs.high.locked;
  if (q.reason === 'WISH_DAILY_LIMIT') return COPY.packs.high.dailyFull;
  if (q.reason === 'WISH_WEEKLY_LIMIT') return COPY.packs.high.weeklyFull;
  return q.mode === 'free' ? COPY.packs.high.costFree : fill(COPY.packs.high.costCash, { price: yuan(q.costCents), rate: Math.round(q.rate * 100) });
}
function renderSide() {
  if (!view) return;
  if (wheelType === 'play') {
    const q = playQuote();
    const chosen = payMode === 'auto' ? q.defaultMode : payMode;
    side.innerHTML = `<h4>${esc(COPY.overlay.play.sideTitle)}</h4>
      <div class="wf-pays">
        <button data-pay="free" ${q.freeAvailable ? '' : 'disabled'} class="${chosen === 'free' ? 'on' : ''}">${esc(COPY.overlay.play.payModeFree)}</button>
        <button data-pay="cash" ${q.cashAvailable ? '' : 'disabled'} class="${chosen === 'cash' ? 'on' : ''}">${esc(fill(COPY.overlay.play.payModeCash, { price: yuan(q.costCents) }))}</button>
        <button data-pay="points" class="${chosen === 'points' ? 'on' : ''}">${esc(fill(COPY.overlay.play.payModePoints, { points: q.costPoints }))}</button>
      </div>
      <p class="wf-quote">✦ ${esc(NAMES.play)} · ${esc(fill(COPY.wheels.cards.play.metaLine, { paid: q.paidToday, limit: q.paidLimit, pRed: wheel().pityRed || 0, pGold: wheel().pityGold || 0, pRainbow: wheel().pityRainbow || 0 }))}</p>
      <p>${esc(fill(COPY.overlay.play.ruleText, { minPrice: yuan(50000), capPrice: yuan(5000000), limit: q.paidLimit, points: q.costPoints }))}</p>`;
  } else if (wheelType === 'pack') {
    const lo = lowQuote(), hi = highQuote();
    const card = packTier === 'low' ? lo : hi;
    side.innerHTML = `<h4>✧ ${esc(COPY.packs.low.name)} · ${esc(COPY.packs.high.name)}</h4>
      <div class="wf-pools">
        <button data-pool="low" class="${packTier === 'low' ? 'on' : ''}"><b>${esc(COPY.packs.low.name)}</b><small>${esc(COPY.packs.low.tag)}</small><em>${esc(packCostText('low', lo))}</em></button>
        <button data-pool="high" class="${packTier === 'high' ? 'on' : ''}"><b>${esc(COPY.packs.high.name)}</b><small>${esc(COPY.packs.high.tag)}</small><em>${esc(packCostText('high', hi))}</em></button>
      </div>
      <p class="wf-quote">${esc(packTier === 'low' ? COPY.packs.low.sub : COPY.packs.high.sub)}</p>
      <p>${esc(packTier === 'low' ? COPY.packs.low.ruleText : COPY.packs.high.ruleText)}</p>
      <p class="wf-step">${esc(fill(COPY.bag.binder.codexProgress, { count: codexCount() }))}</p>`;
  } else {
    const cards = wishCards();
    const lowSelected = cards.find((c) => c.itemId === selectedCardId)?.poolTier === 'low';
    side.innerHTML = `<h4>${esc(COPY.overlay.casino.sideTitle)}</h4>
      <div class="wf-step">${esc(COPY.overlay.casino.selectBetLabel)}</div>
      <div class="wf-bets">${Object.entries(CASINO_BETS).map(([k, v]) => {
        const off = k === 'green' && lowSelected;
        return `<button data-bet="${k}" class="${selectedBet === k ? 'on' : ''}" ${off ? 'disabled' : ''}><span>${esc(v.name)} ${esc(v.multText)}</span><small>${esc(v.oddsText)}</small></button>`;
      }).join('')}</div>
      ${lowSelected ? `<p class="wf-step">${esc(COPY.overlay.casino.lowNoGreenHint)}</p>` : ''}
      <div class="wf-step">${esc(COPY.overlay.casino.selectCardLabel)}</div>
      <div class="wf-cards">${cards.length ? cards.map((c) => {
        const cc = cardCopy(c.cardCode, c.rarity);
        const capped = c.poolTier === 'low' && (c.currentPoints || 0) >= LOW_CARD_CASINO_CAP;
        return `<button data-card="${esc(c.itemId)}" class="${selectedCardId === c.itemId ? 'on' : ''}" ${capped ? 'disabled' : ''}><b>${esc(cc.name)}</b><span>${esc(String(c.currentPoints ?? 0))} ${esc(COPY.wheels.hub.pointsLabel)}</span></button>`;
      }).join('') : `<div class="wf-step">${esc(COPY.overlay.casino.noCardHint)}</div>`}</div>
      <p>${esc(COPY.overlay.casino.ruleText)}</p>`;
  }
  syncGo();
}
function syncGo() {
  const common = COPY.overlay.common;
  const ready = !view?.busy && !spinning;
  if (wheelType === 'pack') {
    const q = packTier === 'low' ? lowQuote() : highQuote();
    const blocked = spinning || view?.busy || !q.canSpin;
    // 卡包已落台/已翻开时隐藏 GO：此刻的动作在卡包下方，避免与「再开一包」重复。
    goBtn.hidden = packState.phase !== 'IDLE';
    goBtn.disabled = !!blocked;
    goBtn.textContent = spinning ? common.goSpinning : view?.busy ? common.goBusy
      : !q.unlocked ? COPY.packs.ui.btnLocked : !q.canSpin ? COPY.packs.ui.btnSoldOut : COPY.packs.ui.btnDraw;
    return;
  }
  goBtn.hidden = false;
  if (wheelType === 'casino') {
    const armed = ready && !!(selectedCardId && selectedBet);
    goBtn.disabled = !armed;
    goBtn.textContent = spinning ? common.goSpinning : view?.busy ? common.goBusy : armed ? common.goReady : COPY.overlay.casino.goIdle;
    return;
  }
  goBtn.disabled = !ready;
  goBtn.textContent = spinning ? common.goSpinning : view?.busy ? common.goBusy : common.goReady;
}
function showResult(html, rarity) {
  resultBox.dataset.rarity = rarity || '';
  resultBox.innerHTML = html;
  resultBox.classList.add('on');
}
function hideResult() {
  resultBox.classList.remove('on');
  resultBox.innerHTML = '';
}

// ---- 卡面 / 卡包 ----
function cardFace(card) {
  const v = RARITY_VISUAL[card.rarity] || RARITY_VISUAL.gray;
  const cc = cardCopy(card.cardCode, card.rarity);
  const serial = `${COPY.packs.ui.serialPrefix}${String(card.serialNo || 0).padStart(4, '0')}`;
  const pool = card.poolTier === 'low' ? COPY.packs.ui.poolLowBadge : COPY.packs.ui.poolHighBadge;
  return `<div class="wish-card rar-${esc(card.rarity)}" style="--wc-rim:${v.rim};--wc-t1:${v.tone1};--wc-t2:${v.tone2};--wc-halo:${v.halo}">
    <span class="wc-scan" aria-hidden="true"></span>
    <div class="wc-top"><span class="wc-tier">${esc(v.stamp)}</span><span class="wc-pool">${esc(pool)}</span><span class="wc-serial">${esc(serial)}</span></div>
    <div class="wc-mid">${cardGlyph(card.cardCode, v.rim)}</div>
    <div class="wc-bot"><b class="wc-name">${esc(cc.name)}</b><small class="wc-motto">${esc(cc.motto)}</small><span class="wc-points">${esc(String(card.points ?? 0))}</span></div>
    ${card.winStreak ? `<span class="wc-streak">${esc(fill(COPY.packs.ui.streakBadge, { n: card.winStreak }))}</span>` : ''}
    ${card.locked ? `<span class="wc-lock">🔒</span>` : ''}
  </div>`;
}
const packState = { phase: 'IDLE', cards: [], progress: 0, revealed: [] };
function renderPackSealed() {
  const sub = packState.poolTier === 'low' ? COPY.packs.ui.packSubtitleLow : COPY.packs.ui.packSubtitleHigh;
  packBox.innerHTML = `<div class="pk-wrap">
    <div class="pk-pack" id="pkPack" style="--pk:0">
      <div class="pk-foil" aria-hidden="true"></div>
      <div class="pk-flap" aria-hidden="true"></div>
      <div class="pk-seal"><span>${esc(sub)}</span></div>
      <div class="pk-tear" aria-hidden="true"></div>
      <div class="pk-hint">${esc(COPY.packs.ui.tearHint)}</div>
    </div>
    <button class="wf-inline-btn" data-quicktear>${esc(COPY.packs.ui.btnQuickTear)}</button>
  </div>`;
  bindTear();
}
function renderPackFan() {
  const cards = packState.cards;
  packBox.innerHTML = `<div class="pk-fan">${cards.map((c, i) => `
    <button class="pk-slot ${packState.revealed[i] ? 'is-open' : 'is-back'}" data-reveal="${i}" style="--i:${i}">
      <span class="pk-back" aria-hidden="true"></span>
      <span class="pk-face">${cardFace(c)}</span>
    </button>`).join('')}</div>
    <div class="pk-actions">
      <button class="wf-inline-btn" data-revealall>${esc(COPY.packs.ui.btnRevealAll)}</button>
      <button class="wf-inline-btn primary" data-collect>${esc(COPY.packs.ui.btnCollectAll)}</button>
      <button class="wf-inline-btn" data-again>${esc(COPY.packs.ui.btnDrawAgain)}</button>
    </div>`;
}
function bindTear() {
  const pack = document.getElementById('pkPack');
  if (!pack) return;
  let startX = 0, startY = 0, t0 = 0, dragging = false, width = 1;
  const paint = () => pack.style.setProperty('--pk', String(packState.progress));
  const finish = () => { if (packState.phase === 'TEARING') packState.phase = 'SEALED'; };
  pack.addEventListener('pointerdown', (e) => {
    if (packState.phase === 'BURST' || packState.phase === 'FAN') return;
    startX = e.clientX; startY = e.clientY; t0 = performance.now();
    dragging = true; width = Math.max(1, pack.getBoundingClientRect().width);
    try { pack.setPointerCapture(e.pointerId); } catch { /* 无捕获也能用点按兜底 */ }
  });
  pack.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
    packState.phase = 'TEARING';
    packState.progress = Math.min(1, Math.max(0, dx / (width * TEAR_GOAL)));
    paint();
    if (packState.progress >= 1) burstPack();
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    const quick = performance.now() - t0 < 260;
    if (packState.phase === 'TEARING' && packState.progress < TEAR_GOAL) {
      packState.progress = Math.max(0, packState.progress);
      paint();
      finish();
    } else if (quick) {
      packState.progress = Math.min(1, packState.progress + 0.35);
      paint();
      if (packState.progress >= TEAR_GOAL) burstPack();
    }
  };
  pack.addEventListener('pointerup', release);
  pack.addEventListener('pointercancel', release);
}
function burstPack() {
  if (packState.phase === 'BURST' || packState.phase === 'FAN') return;
  packState.phase = 'BURST';
  packState.progress = 1;
  const pack = document.getElementById('pkPack');
  if (pack) pack.classList.add('is-burst');
  const best = packState.cards.reduce((a, c) => (rankOf(c.rarity) > rankOf(a) ? c.rarity : a), 'gray');
  burstParticles(best);
  setTimeout(() => {
    packState.phase = 'FAN';
    packState.revealed = packState.cards.map(() => false);
    renderPackFan();
  }, 550);
}
const rankOf = (r) => ({ gray: 0, red: 1, gold: 2, rainbow: 3 }[r] ?? 0);
function revealOne(i, silent) {
  if (packState.phase !== 'FAN' || packState.revealed[i]) return;
  packState.revealed[i] = true;
  const slot = packBox.querySelector(`[data-reveal="${i}"]`);
  if (slot) { slot.classList.remove('is-back'); slot.classList.add('is-open'); }
  if (!silent) burstParticles(packState.cards[i].rarity);
}
function revealAll() {
  packState.cards.forEach((c, i) => setTimeout(() => revealOne(i, true), i * 180));
  burstParticles(packState.cards.at(-1)?.rarity || 'gray');
}

// ---- 三种玩法 ----
async function spinPlay() {
  if (spinning || view?.busy) return;
  const q = playQuote();
  let mode = payMode === 'auto' ? q.defaultMode : payMode;
  if (mode === 'free' && !q.freeAvailable) mode = q.defaultMode;
  if (mode === 'cash' && !q.cashAvailable) mode = q.defaultMode === 'cash' ? 'points' : q.defaultMode;
  setSpinning(true);
  clearHit();
  hideResult();
  try {
    const res = await requestOp({ type: 'PLAYER_WHEEL_SPIN', mode });
    const prizeId = res?.result?.prizeId;
    const index = WHEEL_POOL.findIndex((p) => p.prizeId === prizeId);
    await animate('play', index);
    highlight('play', index, res?.result?.rarity);
    burstParticles(res?.result?.rarity);
    const prize = WHEEL_POOL[index];
    showResult(`<div class="rno">NO.${esc(prize?.no ?? '')} · ${esc(NAMES.play)}</div>
      <div class="rname">${esc(prize?.name || '')}</div>
      <div class="rtip">${esc(prize?.summary || '')}<br>「${esc(prize?.hint || '')}」</div>
      <div class="rrow"><button class="primary" data-dismiss>${esc(COPY.overlay.play.resultCollect)}</button></div>`, res?.result?.rarity);
  } catch (err) {
    toast(errorText(err?.message));
  } finally {
    setSpinning(false);
    renderSide();
  }
}

async function drawPack() {
  if (spinning || view?.busy) return;
  const q = packTier === 'low' ? lowQuote() : highQuote();
  if (!q.unlocked) { toast(COPY.packs.high.locked); return; }
  if (!q.canSpin) { toast(errorText(q.reason || 'WISH_LOCKED')); return; }
  setSpinning(true);
  clearHit();
  hideResult();
  try {
    // 先落盘后揭晓：这一发扣费与 3 张卡在这一步就已经写进状态。
    const res = await requestOp({ type: 'PLAYER_PACK_DRAW', poolTier: packTier });
    packState.poolTier = packTier;
    packState.cards = res?.result?.cards || [];
    packState.progress = 0;
    packState.revealed = packState.cards.map(() => false);
    packState.phase = 'SEALED';
    renderPackSealed();
  } catch (err) {
    toast(errorText(err?.message));
  } finally {
    setSpinning(false);
    renderSide();
  }
}

async function spinCasino() {
  if (spinning || view?.busy) return;
  if (!selectedCardId || !selectedBet) { toast(COPY.overlay.casino.goIdle); return; }
  const cardId = selectedCardId, bet = selectedBet;
  setSpinning(true);
  clearHit();
  hideResult();
  try {
    const res = await requestOp({ type: 'PLAYER_CASINO_BET', cardId, betColor: bet });
    const out = res?.result || {};
    await animate('casino', out.hitIndex || 0);
    highlight('casino', out.hitIndex || 0);
    if (out.win) {
      lastWonCardId = cardId;
      burstParticles(bet === 'green' ? 'rainbow' : 'gold');
      showResult(`<div class="rno">${esc(CASINO_BETS[bet].name)} · ${esc(CASINO_BETS[bet].multText)}</div>
        <div class="rname">${esc(bet === 'green' ? COPY.overlay.casino.winGreenTitle : COPY.overlay.casino.winTitle)}</div>
        <div class="rtip">${esc(fill(bet === 'green' ? COPY.overlay.casino.winGreen : COPY.overlay.casino.winNormal, { value: out.points ?? 0 }))}${out.capped ? `<br>${esc(COPY.overlay.casino.winCapped)}` : ''}</div>
        <div class="rrow"><button data-again>${esc(COPY.overlay.casino.btnAgain)}</button><button class="primary" data-cashout>${esc(COPY.overlay.casino.btnCashOut)}</button><button data-lockkeep>${esc(COPY.overlay.casino.btnLockKeep)}</button></div>`, bet === 'green' ? 'rainbow' : 'gold');
    } else {
      selectedCardId = '';
      lastWonCardId = '';
      showResult(`<div class="rno">${esc(CASINO_BETS[bet].name)}</div>
        <div class="rname">${esc(COPY.overlay.casino.loseTitle)}</div>
        <div class="rtip">${esc(COPY.overlay.casino.lose)}</div>
        <div class="rrow"><button class="primary" data-dismiss>${esc(COPY.overlay.casino.btnNextCard)}</button></div>`);
    }
  } catch (err) {
    toast(errorText(err?.message));
  } finally {
    setSpinning(false);
    renderSide();
  }
}

async function redeemCard(cardId) {
  try {
    const res = await requestOp({ type: 'PLAYER_CARD_REDEEM', cardId });
    toast(fill(COPY.overlay.casino.cashOutOk, { value: res?.result?.points ?? 0 }));
    hideResult();
    if (res?.view) view = res.view;
    renderSide();
  } catch (err) {
    toast(errorText(err?.message));
  }
}
async function lockCard(cardId) {
  try {
    const res = await requestOp({ type: 'PLAYER_CARD_LOCK', cardId, locked: true });
    toast(COPY.bag.binder.lockedToast);
    hideResult();
    if (res?.view) view = res.view;
    selectedCardId = '';
    renderSide();
  } catch (err) {
    toast(errorText(err?.message));
  }
}

// ---- 事件 ----
modesBox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b || spinning || b.dataset.mode === wheelType) return;
  wheelType = b.dataset.mode;
  hideResult();
  clearHit();
  packState.phase = 'IDLE';
  buildAndRender();
});
side.addEventListener('click', (e) => {
  const pay = e.target.closest('[data-pay]');
  if (pay && !spinning) { payMode = pay.dataset.pay; renderSide(); return; }
  const pool = e.target.closest('[data-pool]');
  if (pool && !spinning) { packTier = pool.dataset.pool; renderSide(); return; }
  const bet = e.target.closest('[data-bet]');
  if (bet && !spinning) { selectedBet = bet.dataset.bet; renderSide(); return; }
  const card = e.target.closest('[data-card]');
  if (card && !spinning) {
    selectedCardId = card.dataset.card;
    const low = wishCards().find((c) => c.itemId === selectedCardId)?.poolTier === 'low';
    if (low && selectedBet === 'green') selectedBet = 'red';
    renderSide();
  }
});
packBox.addEventListener('click', (e) => {
  const t = e.target.closest('[data-quicktear],[data-reveal],[data-revealall],[data-collect],[data-again]');
  if (!t) return;
  if (t.dataset.quicktear !== undefined) { packState.progress = 1; const p = document.getElementById('pkPack'); if (p) p.style.setProperty('--pk', '1'); burstPack(); return; }
  if (t.dataset.revealall !== undefined) { revealAll(); return; }
  if (t.dataset.reveal !== undefined) { revealOne(Number(t.dataset.reveal)); return; }
  if (t.dataset.collect !== undefined || t.dataset.again !== undefined) {
    if (t.dataset.again !== undefined) { packState.phase = 'IDLE'; drawPack(); return; }
    packState.phase = 'IDLE';
    packBox.innerHTML = '';
    renderSide();
    hideResult();
    return;
  }
});
resultBox.addEventListener('click', (e) => {
  const t = e.target.closest('[data-dismiss],[data-again],[data-cashout],[data-lockkeep]');
  if (!t) return;
  if (t.hasAttribute('data-dismiss')) return hideResult();
  if (t.dataset.again !== undefined) { hideResult(); return; }
  if (t.hasAttribute('data-lockkeep')) { const cardId = lastWonCardId || selectedCardId; if (cardId) lockCard(cardId); return; }
  if (t.hasAttribute('data-cashout')) {
    const cardId = lastWonCardId || selectedCardId;
    hideResult();
    if (cardId) redeemCard(cardId);
  }
});
goBtn.addEventListener('click', () => {
  if (wheelType === 'play') spinPlay();
  else if (wheelType === 'pack') drawPack();
  else spinCasino();
});
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]');
  if (!c) return;
  if (spinning) { toast(COPY.overlay.common.spinningCloseGuard); return; }
  if (packState.phase === 'SEALED' || packState.phase === 'FAN') toast(COPY.packs.ui.autoSavedToast);
  send({ type: 'WHEEL_CLOSE_REQ' });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (spinning) { toast(COPY.overlay.common.spinningCloseGuard); return; }
  if (packState.phase === 'SEALED' || packState.phase === 'FAN') toast(COPY.packs.ui.autoSavedToast);
  send({ type: 'WHEEL_CLOSE_REQ' });
});

function buildAndRender() {
  ensureBoard(wheelType);
  renderModes();
  renderSide();
  clearHit();
}

// ---- 与宿主握手 ----
window.addEventListener('message', (event) => {
  // 真酒馆里 TavernHelper 脚本活在它自己的 iframe 里：它虽然把轮盘 iframe 挂到了顶层 body，
  // 但 postMessage 的 event.source 是那个 TH iframe，而不是 window.parent（顶层窗口）。
  // 所以这里不能拿 event.source 卡死，只认 channel + 握手 nonce。
  const data = event.data;
  if (!data || data.channel !== CHANNEL) return;
  if (data.type === 'WHEEL_INIT' || data.type === 'WHEEL_OPEN') {
    if (data.type === 'WHEEL_INIT') nonce = data.nonce;
    else if (data.nonce && data.nonce !== nonce) return;
    if (data.nonce !== nonce) return;
    wheelType = data.wheelType === 'wish' ? 'pack' : (data.wheelType || 'play');
    selectedCardId = data.preselectCardId || '';
    selectedBet = '';
    lastWonCardId = '';
    payMode = 'auto';
    packState.phase = 'IDLE';
    view = data.view;
    pendingView = null;
    hideResult();
    buildAndRender();
    send({ type: 'WHEEL_BUILT', wheelType });
    return;
  }
  if (data.nonce !== nonce) return;
  if (data.type === 'WHEEL_STATE_SYNC') {
    if (spinning) { pendingView = data.view; return; }
    view = data.view;
    renderSide();
    return;
  }
  if (data.type === 'WHEEL_OP_RES') {
    const entry = inflight.get(data.reqId);
    if (data.view) { if (spinning) pendingView = data.view; else view = data.view; }
    if (!entry) return;
    clearTimeout(entry.timer);
    inflight.delete(data.reqId);
    if (data.ok) entry.resolve(data);
    else entry.reject(new Error(data.errorCode || 'OP_FAILED'));
    return;
  }
  if (data.type === 'WHEEL_CLOSE') {
    spinning = false;
    hideResult();
    clearHit();
  }
});

// 父端可能比子端更早挂好监听、也可能因为重挂载丢掉第一次 READY：
// 没建出盘面就每 1.2 秒重发一次，最多 4 次，握手绝不靠单次赌运气。
let readyAnnounces = 0;
function announceReady() {
  readyAnnounces += 1;
  window.parent.postMessage({ channel: CHANNEL, type: 'WHEEL_READY' }, '*');
  if (builtType || readyAnnounces >= 4) return;
  setTimeout(() => { if (!builtType) announceReady(); }, 1200);
}
announceReady();


