// rc.37 全屏轮盘：命运轮盘 / 星愿卡包 / 暗夜赌场三块共用一层全屏 iframe。
// 由 host.js 托管在酒馆页面顶层，position:fixed 覆盖 100vw×100dvh，彻底脱离小手机与底部状态栏。
// 性能铁律：扇区合并 path、符号走 <symbol>/<use>、零 SVG filter、粒子 1.6s 后停帧；
// 卡面只播一次扫光，收藏册与背包内零常驻动画。

import { WHEEL_GLYPHS } from './wheel-glyphs.js';
import { WHEEL_POOL } from '../core/wheel-pool.js';
import { CASINO_BETS, WISH_CARDS } from '../core/casino-catalog.js';
import { WHEEL_COPY, fill } from '../core/wheel-ui-copy.js';
import { playWheelQuote, POINTS_PER_SPIN } from '../core/wheel.js';
import { wishWheelQuote, lowPackQuote } from '../core/casino.js';
import { CARD_CODES } from './card-art.js';
import { renderCardFace, resolveCardTitle } from './card-face.js';

const CHANNEL = 'CJ_SHENGHAO_WHEEL_V1';
const OP_TIMEOUT_MS = 12000;
const C = 320;
const SLOTS = 37;
const COPY = WHEEL_COPY;
const NAMES = COPY.wheels.names;
const TEAR_GOAL = 0.72;

// rc.39 修正：三环半径/符号位置一律照 `reports/rc34-prototype` 与 `.work/wheel-proto-v2.html` 原型取数，
// 不再整体内缩 6px（内缩会让装饰带压掉环边、尖拱只剩一半高度，看起来就是"圈里的形状被压扁"）。
const RINGS = [
  { from: 0, to: 30, r1: 212, r2: 298, symR: 256, size: 21 },
  { from: 30, to: 46, r1: 136, r2: 200, symR: 168, size: 24 },
  { from: 46, to: 52, r1: 74, r2: 124, symR: 99, size: 27 },
];
const CORE = { r1: 56, r2: 70 };
// rc.39 问题 1：三环配色改由 CSS 变量按画质档位切换，节点数恒 251。
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
<radialGradient id="sheen" cx="30%" cy="22%" r="72%"><stop offset="0%" stop-color="rgba(255,255,255,.16)"/><stop offset="55%" stop-color="rgba(255,255,255,.03)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
<radialGradient id="coreGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,246,216,.95)"/><stop offset="45%" stop-color="rgba(224,179,255,.55)"/><stop offset="100%" stop-color="rgba(224,179,255,0)"/></radialGradient>
${WHEEL_POOL.map((p) => `<symbol id="g${p.no}" viewBox="0 0 24 24"><path d="${WHEEL_GLYPHS[Number(p.no)] || ''}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>`).join('')}
</defs>`;

// 扇区按深浅交替合并成 2 条 path，分隔线合并成 1 条 —— 一圈只有 3 个渲染节点。
function mergedRing(r1, r2, n, ringClass, offsetDeg = 0) {
  const step = 360 / n;
  let a = '', b = '', sep = '';
  for (let i = 0; i < n; i++) {
    const seg = sector(r1, r2, offsetDeg + i * step, offsetDeg + (i + 1) * step);
    if (i % 2 === 0) a += seg; else b += seg;
    const [x0, y0] = polar(r1, offsetDeg + i * step);
    const [x1, y1] = polar(r2, offsetDeg + i * step);
    sep += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `<path class="${ringClass}-a" d="${a}"/><path class="${ringClass}-b" d="${b}"/><path class="wf-sep" d="${sep}" fill="none" stroke-width=".9"/>`;
}

// 落点高亮挂进每个环自己的组里：环转多少度，黄框就跟多少度，连抽多少把都不会歪。
const wedge = (fillColor) => `<path class="hit-wedge" d="" fill="${fillColor}" stroke="#f6e3b0" stroke-width="1.2"/>`;

// rc.39 追加：按 wheel-proto-v2 原型复刻盘面（双层金环 + 符文带 + 尖拱/玫瑰窗/齿环 + 三环径向渐变 + 暗角高光）
// 结构全部是合并 path，节点约 308；滤镜只挂在小范围流光上，三档用 CSS 变量做减法。
function boardDefs() {
  return `<defs>
  <radialGradient id="gOuterA" cx="${C}" cy="${C}" r="310" gradientUnits="userSpaceOnUse"><stop offset="62%" stop-color="#1f232c"/><stop offset="76%" stop-color="#303542"/><stop offset="89%" stop-color="#252934"/><stop offset="98%" stop-color="#171a22"/></radialGradient>
  <radialGradient id="gOuterB" cx="${C}" cy="${C}" r="310" gradientUnits="userSpaceOnUse"><stop offset="62%" stop-color="#2a2f3b"/><stop offset="76%" stop-color="#3e4454"/><stop offset="89%" stop-color="#2f3442"/><stop offset="98%" stop-color="#1d202a"/></radialGradient>
  <radialGradient id="gMidA" cx="${C}" cy="${C}" r="310" gradientUnits="userSpaceOnUse"><stop offset="40%" stop-color="#440f1c"/><stop offset="52%" stop-color="#6c1a2e"/><stop offset="62%" stop-color="#501222"/><stop offset="68%" stop-color="#330b15"/></radialGradient>
  <radialGradient id="gMidB" cx="${C}" cy="${C}" r="310" gradientUnits="userSpaceOnUse"><stop offset="40%" stop-color="#591525"/><stop offset="52%" stop-color="#8b223b"/><stop offset="62%" stop-color="#66182c"/><stop offset="68%" stop-color="#410e1b"/></radialGradient>
  <radialGradient id="gInA" cx="${C}" cy="${C}" r="310" gradientUnits="userSpaceOnUse"><stop offset="22%" stop-color="#5a3d10"/><stop offset="31%" stop-color="#986c22"/><stop offset="38%" stop-color="#704e16"/><stop offset="42%" stop-color="#452d0a"/></radialGradient>
  <radialGradient id="gInB" cx="${C}" cy="${C}" r="310" gradientUnits="userSpaceOnUse"><stop offset="22%" stop-color="#765317"/><stop offset="31%" stop-color="#c18e32"/><stop offset="38%" stop-color="#8d631e"/><stop offset="42%" stop-color="#573b0f"/></radialGradient>
  <radialGradient id="gBezel" cx="${C}" cy="${C}" r="335" gradientUnits="userSpaceOnUse"><stop offset="88%" stop-color="#16121a"/><stop offset="93%" stop-color="#3b2f21"/><stop offset="96%" stop-color="#70562f"/><stop offset="98.5%" stop-color="#d8b572"/><stop offset="100%" stop-color="#3d2c14"/></radialGradient>
  <radialGradient id="gVignette" cx="50%" cy="50%" r="50%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="84%" stop-color="#000" stop-opacity=".22"/><stop offset="100%" stop-color="#000" stop-opacity=".56"/></radialGradient>
  <radialGradient id="gSheen" cx="30%" cy="24%" r="58%"><stop offset="0%" stop-color="#fff6d6" stop-opacity=".22"/><stop offset="42%" stop-color="#fff2c2" stop-opacity=".06"/><stop offset="100%" stop-color="#fff2c2" stop-opacity="0"/></radialGradient>
  <linearGradient id="gRainbow" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9c6bff"/><stop offset="24%" stop-color="#3ad8e8"/><stop offset="50%" stop-color="#fff0b8"/><stop offset="76%" stop-color="#ff89c4"/><stop offset="100%" stop-color="#9c6bff"/></linearGradient>
  ${WHEEL_POOL.map((p) => `<symbol id="g${p.no}" viewBox="0 0 24 24"><path d="${WHEEL_GLYPHS[Number(p.no)] || ''}" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></symbol>`).join('')}
</defs>`;
}

// 72 枚符文铭文合并成 2 条 path（60 枚刻痕 + 12 宫菱形星标）
function mergedRuneOrbit(R = 314) {
  let runeD = '', starD = '';
  for (let i = 0; i < 72; i++) {
    const deg = i * 5, rad = ((deg - 90) * Math.PI) / 180;
    const [cx, cy] = polar(R, deg);
    const cos = Math.cos(rad + Math.PI / 2), sin = Math.sin(rad + Math.PI / 2);
    const rot = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
    if (i % 6 === 0) {
      const p = [[0, -3.4], [2.4, 0], [0, 3.4], [-2.4, 0]].map(([x, y]) => rot(x, y));
      starD += `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}L${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}L${p[2][0].toFixed(1)} ${p[2][1].toFixed(1)}L${p[3][0].toFixed(1)} ${p[3][1].toFixed(1)}Z`;
    } else {
      const [x1, y1] = rot(0, -3.2), [x2, y2] = rot(0, 3.2);
      const [x3, y3] = rot(-1.8, i % 2 ? -1.4 : 1.4), [x4, y4] = rot(1.8, i % 2 ? -1.4 : 1.4);
      runeD += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}M${x3.toFixed(1)} ${y3.toFixed(1)}L${x4.toFixed(1)} ${y4.toFixed(1)}`;
    }
  }
  return `<g class="rune-orbit" data-gothic-deco>
    <circle cx="${C}" cy="${C}" r="321.5" fill="none" stroke="rgba(217,184,120,.26)" stroke-width=".7"/>
    <circle cx="${C}" cy="${C}" r="306.5" fill="none" stroke="rgba(217,184,120,.26)" stroke-width=".7"/>
    <path d="${runeD}" fill="none" stroke="rgba(232,199,130,.66)" stroke-width=".9" stroke-linecap="round"/>
    <path d="${starD}" fill="rgba(246,222,158,.78)"/>
  </g>`;
}

// 外-中 30 瓣尖拱带 + 中-内 16 瓣玫瑰窗 + 内-核 24 齿环，全部合并成 path。
// rc.39 修正：半径与瓣高照原型（拱顶 210.5 / 拱脚 201.5 / 控制点 207），原来 200→205 只有一半高度，看着就是被压扁。
function gothicBands() {
  let archD = '', archDots = '';
  for (let i = 0; i < 30; i++) {
    const a0 = i * 12, aMid = a0 + 6, a1 = a0 + 12;
    const [x0, y0] = polar(201.5, a0), [xm, ym] = polar(210.5, aMid), [x1, y1] = polar(201.5, a1);
    const [cx1, cy1] = polar(207, a0 + 2), [cx2, cy2] = polar(207, a1 - 2);
    archD += `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${cx1.toFixed(1)} ${cy1.toFixed(1)} ${xm.toFixed(1)} ${ym.toFixed(1)}Q${cx2.toFixed(1)} ${cy2.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    const [bx, by] = polar(205.5, aMid);
    archDots += `M${bx.toFixed(1)} ${by.toFixed(1)}h.01`;
  }
  let roseD = '', roseInner = '', roseDots = '';
  const diamond = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
  for (let i = 0; i < 16; i++) {
    const deg = i * 22.5 + 11.25, rad = ((deg - 90) * Math.PI) / 180, [cx, cy] = polar(130, deg);
    const cos = Math.cos(rad + Math.PI / 2), sin = Math.sin(rad + Math.PI / 2);
    const rot = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
    roseD += diamond([[-6.2, 0], [0, -4.2], [6.2, 0], [0, 4.2]].map(([x, y]) => rot(x, y)));
    roseInner += diamond([[-2.2, 0], [0, -1.6], [2.2, 0], [0, 1.6]].map(([x, y]) => rot(x, y)));
    const [qx, qy] = polar(130, i * 22.5);
    roseDots += `M${qx.toFixed(1)} ${qy.toFixed(1)}h.01`;
  }
  let teethEven = '', teethOdd = '';
  for (let i = 0; i < 24; i++) {
    const [x1, y1] = polar(67, i * 15), [x2, y2] = polar(73, i * 15);
    const seg = `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    if (i % 2) teethOdd += seg; else teethEven += seg;
  }
  return `<g data-gothic-deco>
    <circle cx="${C}" cy="${C}" r="206" fill="none" stroke="#130e17" stroke-width="12"/>
    <circle cx="${C}" cy="${C}" r="212" fill="none" stroke="rgba(246,215,134,.72)" stroke-width="1.3"/>
    <circle cx="${C}" cy="${C}" r="200" fill="none" stroke="rgba(246,215,134,.68)" stroke-width="1.3"/>
    <path d="${archD}" fill="none" stroke="rgba(226,190,118,.72)" stroke-width="1.05"/>
    <path d="${archDots}" fill="none" stroke="rgba(246,215,134,.8)" stroke-width="2.5" stroke-linecap="round"/>

    <circle cx="${C}" cy="${C}" r="130" fill="none" stroke="#150e18" stroke-width="12"/>
    <circle cx="${C}" cy="${C}" r="136" fill="none" stroke="rgba(246,215,134,.75)" stroke-width="1.3"/>
    <circle cx="${C}" cy="${C}" r="124" fill="none" stroke="rgba(246,215,134,.78)" stroke-width="1.3"/>
    <path d="${roseD}" fill="rgba(140,34,58,.45)" stroke="rgba(246,215,134,.78)" stroke-width=".9"/>
    <path d="${roseInner}" fill="none" stroke="rgba(246,215,134,.6)" stroke-width=".8"/>
    <path d="${roseDots}" fill="none" stroke="rgba(255,236,184,.88)" stroke-width="3.2" stroke-linecap="round"/>

    <path d="${teethEven}" fill="none" stroke="rgba(246,215,134,.72)" stroke-width="1.4"/>
    <path d="${teethOdd}" fill="none" stroke="rgba(246,215,134,.5)" stroke-width=".8"/>
  </g>`;
}

function playBoard() {
  const grads = [['url(#gOuterA)', 'url(#gOuterB)'], ['url(#gMidA)', 'url(#gMidB)'], ['url(#gInA)', 'url(#gInB)']];
  let ringsHtml = '';
  RINGS.forEach((cfg, ri) => {
    const n = cfg.to - cfg.from, step = 360 / n;
    let a = '', b = '', sep = '', syms = '', badge = '';
    for (let i = 0; i < n; i++) {
      const a0 = i * step, a1 = a0 + step, mid = a0 + step / 2;
      const seg = sector(cfg.r1, cfg.r2, a0, a1);
      if (i % 2 === 0) a += seg; else b += seg;
      const [sx1, sy1] = polar(cfg.r1, a0), [sx2, sy2] = polar(cfg.r2, a0);
      sep += `M${sx1.toFixed(1)} ${sy1.toFixed(1)}L${sx2.toFixed(1)} ${sy2.toFixed(1)}`;
      const p = WHEEL_POOL[cfg.from + i];
      const [x, y] = polar(cfg.symR, mid);
      // rc.39 修正：符号外加一圈虚线徽章托环（原型有，之前漏了），合并成每环 1 条 path。
      const br = (cfg.size * 0.62).toFixed(1);
      badge += `M${(x - br).toFixed(1)} ${y.toFixed(1)}a${br} ${br} 0 1 0 ${(br * 2).toFixed(1)} 0a${br} ${br} 0 1 0 ${(-br * 2).toFixed(1)} 0`;
      syms += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${mid.toFixed(1)})" style="color:${SYM_COLOR[p.rarity]}"><use href="#g${p.no}" width="24" height="24" x="-12" y="-12" transform="scale(${(cfg.size / 24).toFixed(3)})"/></g>`;
    }
    ringsHtml += `<g class="ring" data-ring="${ri}">
      <path d="${a}" fill="${grads[ri][0]}"/>
      <path d="${b}" fill="${grads[ri][1]}"/>
      <path d="${sep}" fill="none" stroke="rgba(8,6,12,.75)" stroke-width="1.8"/>
      <path d="${sep}" fill="none" stroke="rgba(232,199,130,.46)" stroke-width=".7"/>
      <path d="${badge}" fill="none" stroke="rgba(246,215,134,.2)" stroke-width=".65" stroke-dasharray="2 2.4"/>
      ${syms}
      ${wedge('rgba(246,227,176,.3)')}
    </g>`;
  });
  return boardDefs() + `
  <circle cx="${C}" cy="${C}" r="332" fill="url(#gBezel)" stroke="rgba(246,215,134,.55)" stroke-width="1.5"/>
  <circle cx="${C}" cy="${C}" r="325" fill="#120f17" stroke="rgba(217,184,120,.38)" stroke-width="1"/>
  <circle cx="${C}" cy="${C}" r="303" fill="#0e0b12" stroke="rgba(217,184,120,.55)" stroke-width="1.2"/>
  ${mergedRuneOrbit(314)}
  ${ringsHtml}
  ${gothicBands()}
  <circle cx="${C}" cy="${C}" r="70" fill="none" stroke="#150e18" stroke-width="8"/>
  <circle cx="${C}" cy="${C}" r="74" fill="none" stroke="rgba(255,232,168,.8)" stroke-width="1.3"/>
  <circle cx="${C}" cy="${C}" r="66" fill="none" stroke="rgba(255,232,168,.65)" stroke-width="1.1"/>
  <circle cx="${C}" cy="${C}" r="59" fill="none" stroke="url(#gRainbow)" stroke-width="13" opacity=".85"/>
  <circle cx="${C}" cy="${C}" r="52" fill="none" stroke="rgba(255,240,196,.55)" stroke-width="1"/>
  <circle class="core-glow" cx="${C}" cy="${C}" r="${CORE.r2 + 34}" fill="url(#coreGlow)" style="pointer-events:none"/>
  <circle class="wf-vig" cx="${C}" cy="${C}" r="300" fill="url(#gVignette)" pointer-events="none"/>
  <circle class="wf-sheen" cx="${C}" cy="${C}" r="300" fill="url(#gSheen)" pointer-events="none"/>`;
}

// rc.39 追加：暗夜赌场盘面按 casino-proto 复刻——胡桃木外框 + 鎏金金属边 + 8 颗菱形挡钉 + 37 格圆点（不是符号）+ 钢珠外轨。
function casinoDefs() {
  return `<defs>
    <radialGradient id="casWood" cx="35%" cy="28%"><stop offset="0%" stop-color="#3a2926"/><stop offset="55%" stop-color="#1b141a"/><stop offset="100%" stop-color="#0b090e"/></radialGradient>
    <radialGradient id="casTrack" cx="50%" cy="50%"><stop offset="72%" stop-color="#18121b"/><stop offset="88%" stop-color="#2b212a"/><stop offset="100%" stop-color="#110d14"/></radialGradient>
    <linearGradient id="casGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff4cc"/><stop offset="45%" stop-color="#d8ad56"/><stop offset="100%" stop-color="#6d4b14"/></linearGradient>
    <radialGradient id="casRed" cx="50%" cy="30%"><stop offset="0%" stop-color="#a8203c"/><stop offset="100%" stop-color="#4e0c1a"/></radialGradient>
    <radialGradient id="casBlack" cx="50%" cy="30%"><stop offset="0%" stop-color="#2c303c"/><stop offset="100%" stop-color="#101218"/></radialGradient>
    <radialGradient id="casGreen" cx="50%" cy="30%"><stop offset="0%" stop-color="#219665"/><stop offset="100%" stop-color="#0a422a"/></radialGradient>
    <radialGradient id="beadGrad" cx="32%" cy="28%"><stop offset="0%" stop-color="#fff"/><stop offset="30%" stop-color="#dce4f0"/><stop offset="70%" stop-color="#7c8799"/><stop offset="100%" stop-color="#272c36"/></radialGradient>
    <radialGradient id="sheen" cx="30%" cy="22%" r="72%"><stop offset="0%" stop-color="rgba(255,255,255,.16)"/><stop offset="55%" stop-color="rgba(255,255,255,.03)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
  </defs>`;
}
const ringDot = (x, y, r) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${(r * 2).toFixed(1)} 0a${r} ${r} 0 1 0 ${(-r * 2).toFixed(1)} 0`;
function casinoBoard() {
  const rIn = 158, rOut = 250, step = 360 / SLOTS;
  let out = casinoDefs();
  // 胡桃木外框 + 金丝虚线圈 + 钢珠轨道 + 内金环
  out += `<circle cx="${C}" cy="${C}" r="326" fill="url(#casWood)" stroke="rgba(246,215,134,.55)" stroke-width="5"/>
    <circle cx="${C}" cy="${C}" r="312" fill="none" stroke="rgba(246,215,134,.3)" stroke-width="1.2" stroke-dasharray="3 5"/>
    <circle cx="${C}" cy="${C}" r="298" fill="url(#casTrack)" stroke="#6d501d" stroke-width="2"/>
    <circle cx="${C}" cy="${C}" r="260" fill="none" stroke="rgba(246,215,134,.42)" stroke-width="1.5"/>`;
  // 8 颗菱形挡钉
  let pins = '';
  for (let i = 0; i < 8; i++) {
    const [dx, dy] = polar(288, i * 45);
    const x = dx.toFixed(1), y = dy.toFixed(1);
    pins += `<path d="M${x} ${(dy - 7).toFixed(1)}L${(dx + 4).toFixed(1)} ${y}L${x} ${(dy + 7).toFixed(1)}L${(dx - 4).toFixed(1)} ${y}Z" fill="url(#casGold)" stroke="#241708" stroke-width=".8" transform="rotate(${(i * 45).toFixed(1)} ${x} ${y})"/>`;
  }
  out += `<g data-gothic-deco>${pins}</g>`;
  // 37 格：扇区 → 内暗带 → 命中黄框 → 空心圆点（黄框压在圆点下面，不盖住落点）
  out += `<g class="ring" data-ring="0">`;
  const dotLayers = [];
  for (const [color, fill, dotCol] of [['green', 'url(#casGreen)', '#82f5be'], ['red', 'url(#casRed)', '#e89aa8'], ['black', 'url(#casBlack)', '#7c8498']]) {
    let d = '', dark = '', dots = '';
    for (let i = 0; i < SLOTS; i++) {
      const slotColor = i === 0 ? 'green' : i % 2 === 1 ? 'red' : 'black';
      if (slotColor !== color) continue;
      d += sector(rIn, rOut, i * step, (i + 1) * step);
      dark += sector(rIn, 174, i * step, (i + 1) * step);
      const [gx, gy] = polar(214, i * step + step / 2);
      dots += ringDot(gx, gy, 3.2);
    }
    out += `<path d="${d}" fill="${fill}" stroke="#d9b878" stroke-width=".9"/>
      <path d="${dark}" fill="rgba(0,0,0,.38)" stroke="rgba(217,184,120,.38)" stroke-width=".6"/>`;
    dotLayers.push(`<path class="cas-dots" d="${dots}" fill="none" stroke="${dotCol}" stroke-width="1.3"/>`);
  }
  out += `${wedge('rgba(246,227,176,.26)')}${dotLayers.join('')}</g>`;
  // 中心台：暗盘 + 虚线环 + 十字鎏金轮毂 + 轮毂圆
  out += `<circle cx="${C}" cy="${C}" r="158" fill="#17121b" stroke="url(#casGold)" stroke-width="2.6"/>
    <circle cx="${C}" cy="${C}" r="128" fill="none" stroke="rgba(246,215,134,.3)" stroke-width="1" stroke-dasharray="4 4"/>
    <path d="M${C - 152} ${C}h304M${C} ${C - 152}v304" stroke="url(#casGold)" stroke-width="3" opacity=".82" fill="none"/>
    <circle cx="${C}" cy="${C}" r="88" fill="#1b1420" stroke="url(#casGold)" stroke-width="2"/>`;
  out += `<g id="casinoTrail" pointer-events="none"></g>`;
  out += `<g class="bead" id="casinoBead" transform="translate(${C},${C - 274})" data-r="274" data-deg="0">
    <circle r="11" cx="1.8" cy="2.6" fill="rgba(0,0,0,.45)"/>
    <circle r="9.6" fill="url(#beadGrad)" stroke="#eef4ff" stroke-width=".7"/>
    <circle r="2.6" cx="-3" cy="-3.2" fill="#fff" opacity=".9"/>
  </g>`;
  out += `<circle cx="${C}" cy="${C}" r="300" fill="url(#sheen)" pointer-events="none"/>`;
  return out;
}

// rc.40 粒子池：支持单卡位置爆彩与连点叠加，1.15s 后无活跃粒子自动停帧（空闲 0 CPU）。
let fxLoopId = 0;
const fxParticles = [];
// rc.43：延迟任务统一登记，切盘/关盘时一次收干净（原来散落的 setTimeout 会跨盘改状态）。
const activeTimers = new Set();
function later(fn, ms) {
  const id = setTimeout(() => { activeTimers.delete(id); fn(); }, ms);
  activeTimers.add(id);
  return id;
}
function stopFxLoop() {
  if (fxLoopId) { cancelAnimationFrame(fxLoopId); fxLoopId = 0; }
  fxParticles.length = 0;
}

function startFxLoop() {
  if (fxLoopId) return;
  const canvas = document.getElementById('wfFx');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tick = (now) => {
    ctx.clearRect(0, 0, 640, 640);
    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const p = fxParticles[i];
      const life = 1 - (now - p.t0) / p.dur;
      if (life <= 0) { fxParticles.splice(i, 1); continue; }
      if (p.inward) {
        p.r -= p.sp;
        if (p.r < 24) p.r = 300;
        p.x = 320 + Math.cos(p.a) * p.r;
        p.y = 320 + Math.sin(p.a) * p.r;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
      }
      ctx.globalAlpha = life * 0.95;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.rSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (fxParticles.length) fxLoopId = requestAnimationFrame(tick);
    else fxLoopId = 0;
  };
  fxLoopId = requestAnimationFrame(tick);
}

function canvasPointOf(el) {
  const canvas = document.getElementById('wfFx');
  if (!canvas || !el) return [320, 320];
  const cr = canvas.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (!cr.width || !cr.height) return [320, 320];
  return [
    Math.max(40, Math.min(600, ((er.left + er.width / 2 - cr.left) / cr.width) * 640)),
    Math.max(40, Math.min(600, ((er.top + er.height / 2 - cr.top) / cr.height) * 640)),
  ];
}

function burstParticles(rarity, originEl = null) {
  const baseCount = { gray: 14, red: 22, gold: 32, rainbow: 42 }[rarity] || 18;
  const count = fxQuality === 'low' ? 0 : fxQuality === 'medium' ? Math.round(baseCount * 0.55) : baseCount;
  if (!count) return;
  const palette = {
    gray: ['#d4dae6', '#9aa3b5'],
    red: ['#ff8fa3', '#ffd1d8', '#f6e3b0'],
    gold: ['#fff0be', '#f6e3b0', '#d9b878'],
    rainbow: ['#fff0be', '#e0b3ff', '#8ef6e4', '#ff9ebc'],
  }[rarity] || ['#f6e3b0'];
  const [ox, oy] = canvasPointOf(originEl);
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + (i % 3) * 0.14;
    const v = 2.4 + (i % 5) * 1.05;
    fxParticles.push({
      inward: false, x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      rSize: 2 + (i % 3), c: palette[i % palette.length], t0: now, dur: 1150,
    });
  }
  startFxLoop();
}

function convergeParticles() {
  const count = { high: 34, medium: 16, low: 0 }[fxQuality] ?? 16;
  if (!count) return;
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    fxParticles.push({
      inward: true, a: Math.random() * Math.PI * 2, r: 240 + Math.random() * 75,
      sp: 4 + Math.random() * 3, rSize: 1.6 + Math.random() * 1.6, c: '#f6e3b0', t0: now, dur: 1250,
    });
  }
  startFxLoop();
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
// rc.42：赌桌三种赌注 —— 星愿卡 / 现金 / 名下资产，各自独立的选择状态。
let stakeKind = 'card';
let cashStakeCents = 0;
let selectedAssetId = '';
const CASH_CHIP_CENTS = [1000000, 5000000, 10000000, 50000000, 100000000];
function selectableAssets() {
  return (view?.ownedAssets || []).filter((a) => a && a.ownerId === 'USER' && a.status === 'OWNED' && a.valuationPending !== true && (a.bookValueCents || 0) >= 100000);
}
let casinoOutcome = null;
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
// ---- rc.38 想法 16：三盘共用确认弹窗（#wfConfirm）----
const confirmBox = document.getElementById('wfConfirm');
let confirmResolver = null;
function closeWheelConfirm(result = false) {
  if (!confirmBox) return;
  confirmBox.classList.remove('on');
  confirmBox.style.opacity = '';
  confirmBox.hidden = true;
  confirmBox.innerHTML = '';
  if (confirmResolver) { const r = confirmResolver; confirmResolver = null; r(result); }
}
function openWheelConfirm({ title, costBadge, detailText, warnText = '', confirmText, cancelText }) {
  if (!confirmBox) return Promise.resolve(true);
  if (confirmResolver) closeWheelConfirm(false);
  return new Promise((resolve) => {
    confirmResolver = resolve;
    confirmBox.innerHTML = `<div class="wf-confirm-box">
      <h4>${esc(title)}</h4>
      <div class="wf-confirm-cost">${esc(costBadge)}</div>
      <div class="wf-confirm-meta">${esc(detailText || '')}</div>
      ${warnText ? `<div class="wf-confirm-warn">${esc(warnText)}</div>` : ''}
      <div class="wf-confirm-acts">
        <button type="button" data-wf-confirm="cancel">${esc(cancelText || COPY.overlay.confirm.btnCancel)}</button>
        <button type="button" class="primary" data-wf-confirm="ok">${esc(confirmText || COPY.overlay.confirm.btnOk)}</button>
      </div>
    </div>`;
    confirmBox.hidden = false;
    // rc.39 修正：过渡在部分路径下不会启动，导致弹窗带 .on 却始终 opacity:0；这里直接写死不透明。
    confirmBox.style.opacity = '1';
    void confirmBox.offsetWidth;
    confirmBox.classList.add('on');
    confirmBox.querySelector('[data-wf-confirm="ok"]')?.focus();
  });
}
confirmBox?.addEventListener('click', (e) => {
  if (e.target === confirmBox) { closeWheelConfirm(false); return; }
  const btn = e.target.closest('[data-wf-confirm]');
  if (btn) closeWheelConfirm(btn.dataset.wfConfirm === 'ok');
});
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
// rc.39 追加：赌桌卡面统一取名——有图鉴编号用图鉴名，没有就退到稀有度档名（不再露出 gray/red 这类内部键）。
function cardName(c) {
  const n = cardCopy(c?.cardCode, c?.rarity).name;
  return c?.cardCode && n ? n : (WISH_CARDS[c?.rarity]?.name || n);
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
  // rc.38 修正：这里必须用"累计角原值"当起点，不能用取模后的正角。
  // 中环反向转（dir=-1）后累计角是负数，取模会让环在每次开转前瞬移回 +x 度，
  // 看起来就像"只有外环在转、中环跳一下"。原值落位则无跳变。
  const cur = ringAngles[ri];
  g.style.transition = 'none';
  g.style.transformOrigin = `${C}px ${C}px`;
  g.style.transform = `rotate(${cur}deg)`;
  void g.offsetWidth;
  const delta = targetCenter === null ? 0 : ((((360 - targetCenter) - cur) % 360) + 360) % 360;
  // rc.38 想法 17：中环反向旋转，与内外环形成机械咬合感；落点公式不变，仍然精确停在 12 点钟。
  const dir = ri === 1 ? -1 : 1;
  const goal = ringAngles[ri] + turns * 360 * dir + delta;
  g.style.transition = `transform ${duration}s cubic-bezier(.12,.78,.04,1) ${delay}s`;
  g.style.transform = `rotate(${goal}deg)`;
  ringAngles[ri] = goal;
}
// 铁球绕盘心滚动的累计角度（与环角分开记，互不干扰）。
let beadAngle = 0;
// rc.40：钢珠从外轨减速下沉、弹跳若干次后落进色格（r=204），并留一小段拖尾。
const CASINO_ANIM = {
  high:   { dur: 4200, rotorTurns: 4, ballTurns: 5, trailMax: 6 },
  medium: { dur: 3000, rotorTurns: 3, ballTurns: 4, trailMax: 3 },
  low:    { dur: 900,  rotorTurns: 1, ballTurns: 2, trailMax: 0 },
};

function animateCasino(hitIndex) {
  const cfg = CASINO_ANIM[fxQuality] || CASINO_ANIM.medium;
  const ring = ringOf(0);
  const bead = svg.querySelector('#casinoBead');
  const trailEl = svg.querySelector('#casinoTrail');
  if (!ring || !bead) return Promise.resolve();

  const step = 360 / SLOTS;
  const startR = ((ringAngles[0] % 360) + 360) % 360;
  // 盘面顺时针转整圈，结束角保持与起始角同余（0°），保证落点角计算精确且不漂移
  const endR = startR + 360 * cfg.rotorTurns;
  const targetDeg = ((endR + hitIndex * step + step / 2) % 360 + 360) % 360;
  const startB = ((beadAngle % 360) + 360) % 360;
  const backDelta = (((startB - targetDeg) % 360) + 360) % 360;
  const endB = startB - backDelta - 360 * cfg.ballTurns;

  ring.style.transition = 'none';
  ring.style.transformOrigin = `${C}px ${C}px`;
  const t0 = performance.now();
  const trail = [];

  return new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / cfg.dur);
      const rDeg = startR + (endR - startR) * (1 - Math.pow(1 - t, 2.2));
      ring.style.transform = `rotate(${rDeg.toFixed(2)}deg)`;

      const bDeg = startB + (endB - startB) * (1 - Math.pow(1 - t, 3.6));
      let r = 274;
      if (t > 0.56 && t < 0.9) {
        const dt = (t - 0.56) / 0.34;
        const drop = 70 * (1 - Math.pow(1 - dt, 2));
        const bounce = Math.abs(Math.sin(dt * Math.PI * 3.5)) * (1 - dt) * 14;
        r = 274 - drop + bounce;
      } else if (t >= 0.9) {
        r = 204;
      }

      const [bx, by] = polar(r, bDeg);
      bead.setAttribute('transform', `translate(${bx.toFixed(1)},${by.toFixed(1)})`);
      bead.dataset.r = r.toFixed(1);
      bead.dataset.deg = (((bDeg % 360) + 360) % 360).toFixed(2);

      if (trailEl) {
        if (cfg.trailMax > 0 && t < 0.94) {
          trail.push([bx, by]);
          if (trail.length > cfg.trailMax) trail.shift();
          trailEl.innerHTML = trail.map((pt, i) =>
            `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="${(4 + i * 0.75).toFixed(1)}" fill="#e6f0ff" opacity="${(((i + 1) / (trail.length + 1)) * 0.35).toFixed(2)}"/>`
          ).join('');
        } else if (trailEl.innerHTML) {
          trailEl.innerHTML = '';
        }
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        ringAngles[0] = ((endR % 360) + 360) % 360;
        beadAngle = targetDeg;
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
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
    w.setAttribute('d', sector(158, 250, index * step, (index + 1) * step));
    w.classList.add('on');
  }
}
// 中奖扇区一律转到 12 点钟落定；黄框是该环的子节点，因此永远压在同一个扇区上。
// rc.39 问题 1：旋转时长按画质档缩放（璀璨 1.0 / 均衡 0.75 / 极速 0.25）。
const FX_T = { high: 1, medium: 0.75, low: 0.25 };
function animate(type, index) {
  // rc.40：赌场走钢珠落格动画（盘面转整圈 + 外轨飞驰 → 下沉 → 回弹 → 落格）。
  if (type !== 'play') return animateCasino(index);
  const k = FX_T[fxQuality] ?? 0.75;
  return new Promise((resolve) => {
    {
      if (index >= 52) {
        const dur = 4.4 * k;
        [0, 1, 2].forEach((ri) => spinRing(ri, 3 + ri, null, dur + ri * 0.3 * k, 0));
        setTimeout(resolve, Math.round((dur + 2 * 0.3 * k) * 1000 + 200));
        return;
      }
      const owner = index >= 46 ? 2 : index >= 30 ? 1 : 0;
      const cfg = RINGS[owner];
      const step = 360 / (cfg.to - cfg.from);
      const target = (index - cfg.from) * step + step / 2;
      const dur = 4.8 * k;
      [0, 1, 2].forEach((ri) => spinRing(ri, 4 + ri, ri === owner ? target : null, dur + ri * 0.3 * k, ri * 0.05));
      setTimeout(resolve, Math.round((dur + 2 * 0.3 * k) * 1000 + 250));
      return;
    }
  });
}

// ---- 侧栏 ----
// rc.38 想法 17：三档画质（璀璨 / 均衡 / 极速）。只改粒子数量与开卡动效时长，不动盘面结构。
// rc.39 修订：按钮点一下不再循环换档，改为展开三档下拉，由玩家自己选。
const FX_ORDER = ['high', 'medium', 'low'];
let fxQuality = (() => { try { return sessionStorage.getItem('cj-sgh:fxq') || 'medium'; } catch { return 'medium'; } })();
let fxMenuOpen = false;
function fxLabel(q = fxQuality) { const f = COPY.overlay.fx; return q === 'high' ? f.qualityHigh : q === 'low' ? f.qualityLow : f.qualityMed; }
function applyFxQuality() {
  const root = document.getElementById('wfRoot');
  if (root) root.dataset.fxq = fxQuality;
  const btn = modesBox.querySelector('[data-fxq-btn]');
  if (btn) btn.textContent = fxLabel();
  modesBox.querySelectorAll('[data-fxq-opt]').forEach((el) => {
    const on = el.dataset.fxqOpt === fxQuality;
    el.classList.toggle('on', on);
    el.setAttribute('aria-selected', String(on));
  });
}
function setFxQuality(q, persist = true) {
  fxQuality = ['high', 'medium', 'low'].includes(q) ? q : 'medium';
  try { sessionStorage.setItem('cj-sgh:fxq', fxQuality); } catch {}
  applyFxQuality();
  if (persist) send({ type: 'WHEEL_PREF_SET', wheelFxQuality: fxQuality });
}
function setFxMenu(open) {
  fxMenuOpen = !!open;
  const wrap = modesBox.querySelector('.wf-fxq-wrap');
  const menu = modesBox.querySelector('[data-fxq-menu]');
  const btn = modesBox.querySelector('[data-fxq-btn]');
  if (wrap) wrap.classList.toggle('is-open', fxMenuOpen);
  if (menu) menu.hidden = !fxMenuOpen;
  if (btn) btn.setAttribute('aria-expanded', String(fxMenuOpen));
}
// rc.40：卡面画质（与轮盘画质独立）——同一份卡面组件在卡包/赌场/卡册三处同时生效。
let cardFxQuality = (() => { try { return sessionStorage.getItem('cj-sgh:cfxq') || 'medium'; } catch { return 'medium'; } })();
function cardFxLabel(q = cardFxQuality) {
  const cf = COPY.cardFace;
  return q === 'high' ? cf.menuHigh : q === 'low' ? cf.menuLow : cf.menuMed;
}
function applyCardFxQuality() {
  document.documentElement.dataset.cfxq = cardFxQuality;
  modesBox.querySelectorAll('[data-cfxq-opt]').forEach((el) => {
    const on = el.dataset.cfxqOpt === cardFxQuality;
    el.classList.toggle('on', on);
    el.setAttribute('aria-selected', String(on));
  });
}
function setCardFxQuality(q, persist = true) {
  cardFxQuality = ['high', 'medium', 'low'].includes(q) ? q : 'medium';
  try { sessionStorage.setItem('cj-sgh:cfxq', cardFxQuality); } catch {}
  applyCardFxQuality();
  if (persist) send({ type: 'WHEEL_PREF_SET', cardFxQuality });
}
function renderModes() {
  const wheelOpts = FX_ORDER.map((q) =>
    `<button role="option" type="button" data-fxq-opt="${q}" class="${q === fxQuality ? 'on' : ''}" aria-selected="${q === fxQuality}">${esc(fxLabel(q))}</button>`
  ).join('');
  const cardOpts = FX_ORDER.map((q) =>
    `<button role="option" type="button" data-cfxq-opt="${q}" class="${q === cardFxQuality ? 'on' : ''}" aria-selected="${q === cardFxQuality}">${esc(cardFxLabel(q))}</button>`
  ).join('');
  modesBox.innerHTML = [['play', NAMES.play], ['pack', NAMES.wish], ['casino', NAMES.casino]]
    .map(([id, name]) => `<button data-mode="${id}" class="${wheelType === id ? 'on' : ''}">${id === 'play' ? '✦' : id === 'pack' ? '✧' : '❖'} ${esc(name)}</button>`)
    .join('') + `<span class="wf-fxq-wrap${fxMenuOpen ? ' is-open' : ''}">
      <button class="wf-fxq" data-fxq-btn type="button" aria-haspopup="listbox" aria-expanded="${fxMenuOpen}">${esc(fxLabel())}</button>
      <div class="wf-fxq-menu" data-fxq-menu role="listbox"${fxMenuOpen ? '' : ' hidden'}>
        <div class="wf-fxq-sec">${esc(COPY.cardFace.menuWheelGroup)}</div>
        ${wheelOpts}
        <div class="wf-fxq-div" aria-hidden="true"></div>
        <div class="wf-fxq-sec">${esc(COPY.cardFace.menuCardGroup)}</div>
        ${cardOpts}
      </div>
    </span>`;
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
    const sel = cards.find((c) => c.itemId === selectedCardId) || null;
    const assets = selectableAssets();
    const asset = assets.find((a2) => a2.assetId === selectedAssetId) || null;
    const emptyHint = COPY.overlay.casino.stakeEmptyHint;
    const tableHtml = stakeKind === "card"
      ? (sel ? stakeFace(sel) : `<span class="stake-hint">${esc(COPY.overlay.casino.stakePlaceholder)}</span>`)
      : stakeKind === "cash"
        ? `<span class="stake-hint">${esc(cashStakeCents ? yuan(cashStakeCents) : COPY.overlay.casino.cashEmptyHint)}</span>`
        : asset
          ? `<span class="stake-hint"><b>${esc(asset.name)}</b> · ${esc(yuan(asset.bookValueCents))}</span>`
          : `<span class="stake-hint">${esc(COPY.overlay.casino.assetPlaceholder)}</span>`;
    const stakeValueText = stakeKind === "card"
      ? (sel ? `${sel.currentPoints ?? 0} ${COPY.wheels.hub.pointsLabel}` : emptyHint)
      : stakeKind === "cash"
        ? (cashStakeCents ? yuan(cashStakeCents) : emptyHint)
        : (asset ? yuan(asset.bookValueCents) : emptyHint);
    const tray = stakeKind === "card"
      ? `<div class="hand-hd">${esc(COPY.overlay.casino.handTrayTitle)}</div>
        <div class="hand-tray">${cards.length ? cards.map((c) => {
          const on = selectedCardId === c.itemId;
          return `<button type="button" class="bh-card${on ? " in-slot" : ""}" data-card="${esc(c.itemId)}" draggable="true" style="--wc-w:66px">
            ${renderCardFace({ rarity: c.rarity, cardCode: c.cardCode, points: c.currentPoints ?? 0, poolTier: c.poolTier, size: "xs" })}
          </button>`;
        }).join("") : `<div class="wf-step">${esc(COPY.overlay.casino.noCardHint)}</div>`}</div>`
      : stakeKind === "cash"
        ? `<div class="hand-hd">${esc(fill(COPY.overlay.casino.cashAvailLabel, { cash: yuan(view?.cashCents ?? 0) }))}</div>
          <div class="cash-chips">${CASH_CHIP_CENTS.map((c2) => `<button type="button" data-cash-chip="${c2}" class="${cashStakeCents === c2 ? "on" : ""}">${esc(yuan(c2))}</button>`).join("")}<button type="button" data-cash-chip="pct">${esc(COPY.overlay.casino.cashChipTenPct)}</button></div>
          <div class="cash-input-row"><input type="number" data-cash-input min="1000" step="100" inputmode="numeric" placeholder="${esc(COPY.overlay.casino.cashCustomPlaceholder)}" value="${cashStakeCents ? Math.round(cashStakeCents / 100) : ""}"></div>`
        : `<p class="asset-warn-bar">${esc(COPY.overlay.casino.assetWarnBanner)}</p>
          <div class="hand-hd">${esc(COPY.overlay.casino.assetTrayTitle)}</div>
          <div class="asset-tray">${assets.length ? assets.map((a2) => `<button type="button" class="asset-chip${selectedAssetId === a2.assetId ? " in-slot" : ""}" data-asset="${esc(a2.assetId)}"><b>${esc(a2.name)}</b><small>${esc(yuan(a2.bookValueCents))}</small></button>`).join("") : `<div class="wf-step">${esc(COPY.overlay.casino.assetEmptyHint)}</div>`}</div>`;
    side.innerHTML = `<div class="bet-console">
      <div class="console-hd"><b>${esc(COPY.overlay.casino.consoleTitle)}</b><span class="bc-points">✦ ${wheel().starPoints || 0}</span></div>
      <div class="stake-tabs">${[["card", COPY.overlay.casino.tabCard], ["cash", COPY.overlay.casino.tabCash], ["asset", COPY.overlay.casino.tabAsset]].map(([k, label]) => `<button type="button" data-stake-kind="${k}" class="${stakeKind === k ? "on" : ""}">${esc(label)}</button>`).join("")}</div>
      <div class="stake-zone${stakeValueText === emptyHint ? "" : " has-card"}" data-stake-zone>
        <div class="stake-face">${tableHtml}</div>
        <div class="stake-meta">
          <small class="stake-lbl">${esc(COPY.overlay.casino.stakeValueLabel)}</small>
          <div class="stake-val-big" data-stake-val>${esc(stakeValueText)}</div>
          ${stakeKind === "card" && sel?.winStreak ? `<span class="streak-badge">${esc(fill(COPY.packs.ui.streakBadge, { n: sel.winStreak }))}</span>` : ""}
          <div class="stake-btns">
            ${stakeKind === "card" ? `<button type="button" class="c-btn primary" data-cashout-now ${sel ? "" : "disabled"}>${esc(COPY.overlay.casino.btnCashOut)}</button>` : ""}
            <button type="button" class="c-btn" data-return-card ${sel || cashStakeCents || asset ? "" : "disabled"}>${esc(COPY.overlay.casino.btnReturnCard)}</button>
          </div>
        </div>
      </div>
      <div class="bet-choices">${Object.entries(CASINO_BETS).map(([k, v]) => `<button type="button" data-bet="${k}" class="bet-box ${k} ${selectedBet === k ? "selected" : ""}"><b>${esc(v.name)}</b></button>`).join("")}</div>
      ${casinoOutcome ? `<div class="outcome-banner ${casinoOutcome.kind}">${esc(casinoOutcome.text)}</div>` : ""}
      ${tray}
      <p class="bc-rule">${esc(COPY.overlay.casino.ruleText)}</p>
    </div>`;
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
    const stakeReady = stakeKind === 'card' ? !!selectedCardId : stakeKind === 'cash' ? cashStakeCents > 0 : !!selectedAssetId;
    const armed = ready && stakeReady && !!selectedBet;
    goBtn.disabled = !armed;
    const idle = stakeKind === 'cash' ? COPY.overlay.casino.goIdleCash : stakeKind === 'asset' ? COPY.overlay.casino.goIdleAsset : COPY.overlay.casino.goIdle;
    goBtn.textContent = spinning ? common.goSpinning : view?.busy ? common.goBusy : armed ? common.goReady : idle;
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
// rc.39 追加：赌注槽里的大卡面（84px 宽），只留纹样 + 档名 + 当前价值，避免整卡缩到看不清。
function stakeFace(c) {
  return `<div class="stake-card-wrap" draggable="true" data-stake-card="${esc(c.itemId)}" style="--wc-w:84px">
    ${renderCardFace({
      rarity: c.rarity,
      cardCode: c.cardCode,
      points: c.currentPoints ?? 0,
      poolTier: c.poolTier,
      winStreak: c.winStreak,
      size: 'sm',
      showCrack: true,
    })}
  </div>`;
}
function cardFace(card) {
  return renderCardFace({
    rarity: card.rarity,
    cardCode: card.cardCode,
    points: card.points ?? card.currentPoints ?? 0,
    poolTier: card.poolTier,
    serialNo: card.serialNo,
    winStreak: card.winStreak,
    locked: !!card.locked,
    size: 'lg',
  });
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
// rc.38 想法 15：开卡页待机阵——四档稀有度代表卡 + 中心【星愿秘印】母卡，共五张弧形悬浮。
const FIVE_SHOWCASE_CARDS = [
  { rarity: 'gray', code: 'gray_1', tag: '灰阶 · I', points: '10–20' },
  { rarity: 'red', code: 'red_1', tag: '红阶 · II', points: '30–60' },
  { rarity: 'mystery', code: 'rainbow_3', tag: '星愿秘印', points: '???', isEmblem: true },
  { rarity: 'gold', code: 'gold_1', tag: '金阶 · III', points: '200' },
  { rarity: 'rainbow', code: 'rainbow_1', tag: '虹阶 · IV', points: '800' }
];
let skipOrbit = null;
function renderPackStage() {
  if (!packBox) return;
  const q = packTier === 'low' ? lowQuote() : highQuote();
  const poolName = packTier === 'low' ? COPY.packs.low.name : COPY.packs.high.name;
  const cardsHtml = FIVE_SHOWCASE_CARDS.map((item, idx) => {
    // rc.40：星尘池暗锁金/虹，圣典池暗锁灰阶（圣典已不出灰卡）。
    const dimmed = (packTier === 'low' && (item.rarity === 'gold' || item.rarity === 'rainbow'))
      || (packTier === 'high' && item.rarity === 'gray');
    const off = idx - 2;
    return `<div class="pk-float-slot ${dimmed ? 'is-high-only' : ''}" data-float-card="${idx}" style="--fi:${idx};--fy:${Math.abs(off) * 8}px;--rot:${off * 6.5}deg;--wc-w:100%">
      ${renderCardFace({
        rarity: item.rarity,
        cardCode: item.code,
        tierLabel: item.tag,
        name: item.isEmblem ? COPY.packs.stage.emblemName : undefined,
        points: item.points,
        size: 'sm',
      })}
    </div>`;
  }).join('');
  packBox.innerHTML = `<div class="pk-idle-stage" data-pack-phase="IDLE">
    <div class="pk-stage-head"><b>✧ ${esc(poolName)} · ${esc(COPY.packs.stage.arcTitle)}</b><small>${esc(packCostText(packTier, q))}</small></div>
    <div class="pk-float-arc" id="pkFloatArc">${cardsHtml}<div class="pk-charge-ring" aria-hidden="true"></div></div>
    <p class="pk-stage-hint">${esc(COPY.packs.stage.arcHint)}</p>
    <button class="wf-inline-btn pk-skip" data-skipspin>${esc(COPY.packs.stage.btnSkipSpin)}</button>
  </div>`;
}
// rc.42（YG 拍板方案一）：五卡向心聚拢重合 → 三段渐强抖动 → 破封爆彩；点「跳过动画」即时切入揭晓。
function bestRarityOf(cards = []) {
  const order = ['gray', 'red', 'gold', 'rainbow'];
  return cards.reduce((best, c) => (order.indexOf(c?.rarity) > order.indexOf(best) ? c.rarity : best), 'gray');
}
function playPackConverge() {
  const arc = document.getElementById('pkFloatArc');
  if (!arc) return Promise.resolve();
  const slots = [...arc.querySelectorAll('.pk-float-slot')];
  if (slots.length) {
    // 每张卡相对圆心的水平位移写进 --dx，窄屏与桌面都严格重合到同一点。
    const box = arc.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    for (const slot of slots) {
      const r = slot.getBoundingClientRect();
      slot.style.setProperty('--dx', `${Math.round(cx - (r.left + r.width / 2))}px`);
    }
  }
  const ms = { high: 1160, medium: 870, low: 0 }[fxQuality] ?? 870;
  arc.style.setProperty('--pk-dur', `${ms}ms`);
  arc.classList.add('is-converging');
  convergeParticles();
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    let burstTimer = null;
    const finish = () => {
      if (done) return;
      done = true;
      skipOrbit = null;
      if (timer) clearTimeout(timer);
      if (burstTimer) clearTimeout(burstTimer);
      resolve();
    };
    if (!ms) { finish(); return; }
    // 破封那一刻按本包最高稀有度爆彩——出了金/虹，破封瞬间就能把期待拉满。
    burstTimer = setTimeout(() => { burstParticles(bestRarityOf(packState.cards), arc); }, Math.round(ms * 940 / 1160));
    timer = setTimeout(finish, ms + 60);
    skipOrbit = finish;
  });
}
// rc.39 追加：三张卡背依次落台 → 点一张翻一张（3D rotateY）→ 全翻后收束成扇形 → 收入卡册。
const FAN_ROT = [-8, 0, 8];
function renderPackFan() {
  const cards = packState.cards;
  packBox.innerHTML = `<div class="pk-fan" data-fan>${cards.map((c, i) => `
    <button class="pk-slot ${packState.revealed[i] ? 'is-open' : 'is-back'} rar-${esc(c.rarity)}" data-reveal="${i}" style="--i:${i};--fan:${FAN_ROT[i] ?? 0}deg">
      <span class="pk-inner">
        <span class="pk-back" aria-hidden="true"></span>
        <span class="pk-face">${cardFace(c)}</span>
      </span>
      <span class="pk-halo" aria-hidden="true"></span>
    </button>`).join('')}</div>
    <p class="pk-settled-hint" hidden>${esc(COPY.packs.stage.settledHint)}</p>
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
  later(() => {
    packState.phase = 'FAN';
    packState.revealed = packState.cards.map(() => false);
    renderPackFan();
  }, 550);
}
const rankOf = (r) => ({ gray: 0, red: 1, gold: 2, rainbow: 3 }[r] ?? 0);
function shakeFan(rarity) {
  if (rarity !== 'gold' && rarity !== 'rainbow') return;
  const fan = packBox.querySelector('[data-fan]');
  if (!fan) return;
  const cls = rarity === 'rainbow' ? 'shake-prism' : 'shake-gold';
  fan.classList.remove('shake-gold', 'shake-prism');
  void fan.offsetWidth;
  fan.classList.add(cls);
  setTimeout(() => fan.classList.remove(cls), 760);
}
function settlePack() {
  const fan = packBox.querySelector('[data-fan]');
  if (fan) fan.classList.add('is-settled');
  const hint = packBox.querySelector('.pk-settled-hint');
  if (hint) hint.hidden = false;
}
function revealOne(i, silent) {
  if (packState.phase !== 'FAN' || packState.revealed[i]) return;
  packState.revealed[i] = true;
  const slot = packBox.querySelector(`[data-reveal="${i}"]`);
  if (slot) { slot.classList.remove('is-back'); slot.classList.add('is-open'); }
  if (!silent) {
    burstParticles(packState.cards[i].rarity, slot);
    if (fxQuality !== 'low') shakeFan(packState.cards[i].rarity);
  }
  if (packState.revealed.length && packState.revealed.every(Boolean)) settlePack();
}
function revealAll() {
  packState.cards.forEach((c, i) => later(() => revealOne(i, false), i * 180));
}
// 五阶段的最后一幕：三张卡各自飞向右上角（卡册方向），璀璨 380ms / 均衡 260ms / 极速瞬切。
let collecting = false;
async function collectPack() {
  if (collecting) return;
  collecting = true;
  const slots = [...packBox.querySelectorAll('.pk-slot')];
  const ms = { high: 380, medium: 260, low: 0 }[fxQuality] ?? 260;
  if (ms && slots.length) {
    const tx = window.innerWidth - 44, ty = 44;
    slots.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const dx = tx - (r.left + r.width / 2), dy = ty - (r.top + r.height / 2);
      s.animate(
        [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.16)`, opacity: 0 }],
        { duration: ms, delay: i * 60, easing: 'cubic-bezier(.4,0,.62,1)', fill: 'forwards' },
      );
    });
    await new Promise((resolve) => setTimeout(resolve, ms + 60 * slots.length + 60));
  }
  collecting = false;
  packState.phase = 'IDLE';
  renderPackStage();
  renderSide();
  hideResult();
}

// ---- 三种玩法 ----
async function spinPlay() {
  if (spinning || view?.busy) return;
  const q = playQuote();
  let mode = payMode === 'auto' ? q.defaultMode : payMode;
  if (mode === 'free' && !q.freeAvailable) mode = q.defaultMode;
  if (mode === 'cash' && !q.cashAvailable) mode = q.defaultMode === 'cash' ? 'points' : q.defaultMode;
  // rc.38 想法 16：花钱/花积分的转动必须先确认，防误点。
  {
    const c = COPY.overlay.confirm, w = wheel();
    const costText = mode === 'free'
      ? c.playCostFree
      : mode === 'points'
        ? fill(c.playCostPoints, { points: q.costPoints })
        : fill(c.playCostCash, { price: yuan(q.costCents), next: (Number(q.paidToday) || 0) + 1, limit: q.paidLimit });
    const detailText = fill(c.playDetail, { pRed: w.pityRed || 0, pGold: w.pityGold || 0, pRainbow: w.pityRainbow || 0 });
    if (!(await openWheelConfirm({ title: c.playTitle, costBadge: costText, detailText }))) return;
  }
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
  // rc.38 想法 16 + 15：启封卡包一律先确认（免费档也保留仪式感）。
  {
    const c = COPY.overlay.confirm, w = wheel();
    const badge = q.mode === 'free' ? c.packCostFree : fill(c.packCostCash, { price: yuan(q.costCents) });
    const detail = packTier === 'low'
      ? fill(c.packLowDetail, { leftRed: Math.max(0, 5 - (Number(w.lowPackPityRed) || 0)) })
      : fill(c.packHighDetail, { pGold: w.cardPityGold || 0 });
    if (!(await openWheelConfirm({ title: packTier === 'low' ? c.packLowTitle : c.packHighTitle, costBadge: badge, detailText: detail }))) return;
  }
  setSpinning(true);
  clearHit();
  hideResult();
  try {
    // rc.42：五卡聚拢 → 抖动 → 破封（可跳过），扣费与三张卡同步先落盘。
    const orbit = playPackConverge();
    const res = await requestOp({ type: 'PLAYER_PACK_DRAW', poolTier: packTier });
    packState.poolTier = packTier;
    packState.cards = res?.result?.cards || [];
    packState.progress = 0;
    packState.revealed = packState.cards.map(() => false);
    packState.phase = 'SEALED';
    await orbit;
    renderPackSealed();
  } catch (err) {
    // rc.43：抽包失败必须把待机五卡阵恢复回来 —— 聚拢动画会把卡留在 opacity:0，不恢复就是空屏。
    skipOrbit?.();
    packState.phase = 'IDLE';
    renderPackStage();
    toast(errorText(err?.message));
  } finally {
    setSpinning(false);
    renderSide();
  }
}

async function spinCasino() {
  if (spinning || view?.busy) return;
  const bet = selectedBet;
  const kind = stakeKind;
  const cardSel = kind === 'card' ? (view?.wishCards || []).find((x) => x.itemId === selectedCardId) : null;
  const assetSel = kind === 'asset' ? selectableAssets().find((a) => a.assetId === selectedAssetId) : null;
  const stakeReady = kind === 'card' ? !!cardSel : kind === 'cash' ? cashStakeCents > 0 : !!assetSel;
  if (!bet || !stakeReady) {
    toast(kind === 'cash' ? COPY.overlay.casino.goIdleCash : kind === 'asset' ? COPY.overlay.casino.goIdleAsset : COPY.overlay.casino.goIdle);
    return;
  }
  const betDef = CASINO_BETS[bet] || {};
  const mult = bet === 'green' ? 36 : 2;
  // rc.42：三种赌注都必须先确认 —— 现金押错是真扣，资产押错是直接从档案里删掉。
  {
    const c = COPY.overlay.confirm;
    if (kind === 'cash') {
      if (!(await openWheelConfirm({
        title: c.casinoTitle,
        costBadge: fill(c.casinoCashCost, { stake: yuan(cashStakeCents), betName: betDef.name || bet }),
        detailText: fill(c.casinoCashDetail, { mult: betDef.multText || '×' + mult, payout: yuan(cashStakeCents * mult), profit: yuan(cashStakeCents * (mult - 1)) }),
        warnText: c.casinoCashWarn,
      }))) return;
    } else if (kind === 'asset') {
      if (!(await openWheelConfirm({
        title: c.casinoTitle,
        costBadge: fill(c.casinoAssetCost, { assetName: assetSel.name, value: yuan(assetSel.bookValueCents) }),
        detailText: fill(c.casinoAssetDetail, { betName: betDef.name || bet, mult: betDef.multText || '×' + mult, profit: yuan(assetSel.bookValueCents * (mult - 1)) }),
        warnText: c.casinoAssetWarn,
      }))) return;
    } else {
      const points = Number(cardSel.currentPoints) || 0;
      if (!(await openWheelConfirm({
        title: c.casinoTitle,
        costBadge: fill(c.casinoCost, { cardName: cardName(cardSel), points }),
        detailText: fill(c.casinoDetail, { betName: betDef.name || bet, mult: betDef.multText || '×' + mult, winPoints: points * mult }),
        warnText: c.casinoWarn,
      }))) return;
    }
  }
  setSpinning(true);
  clearHit();
  hideResult();
  try {
    const op = kind === 'card' ? { type: 'PLAYER_CASINO_BET', stakeKind: 'card', cardId: selectedCardId, betColor: bet }
      : kind === 'cash' ? { type: 'PLAYER_CASINO_BET', stakeKind: 'cash', stakeCents: cashStakeCents, betColor: bet }
        : { type: 'PLAYER_CASINO_BET', stakeKind: 'asset', assetId: selectedAssetId, betColor: bet };
    const res = await requestOp(op);
    const out = res?.result || {};
    await animate('casino', out.hitIndex || 0);
    highlight('casino', out.hitIndex || 0);
    const c = COPY.overlay.casino;
    if (out.win) {
      lastWonCardId = selectedCardId;
      const text = kind === 'card'
        ? fill(bet === 'green' ? c.winGreen : c.winNormal, { value: out.points ?? 0 })
        : kind === 'cash'
          ? fill(bet === 'green' ? c.winCashGreen : c.winCashNormal, { payout: yuan(out.payoutCents ?? 0), profit: yuan(out.profitCents ?? 0) })
          : fill(bet === 'green' ? c.winAssetGreen : c.winAssetNormal, { assetName: out.assetName || '', profit: yuan(out.profitCents ?? 0) });
      casinoOutcome = { kind: 'win', text };
      burstParticles(bet === 'green' ? 'rainbow' : 'gold');
      const keep = kind === 'card'
        ? `<button class="primary" data-cashout>${esc(c.btnCashOut)}</button><button data-lockkeep>${esc(c.btnLockKeep)}</button>`
        : `<button class="primary" data-dismiss>${esc(c.btnNextCard)}</button>`;
      showResult(`<div class="rno">${esc(betDef.name || bet)} · ${esc(betDef.multText || "")}</div>
        <div class="rname">${esc(bet === "green" ? c.winGreenTitle : c.winTitle)}</div>
        <div class="rtip">${esc(text)}</div>
        <div class="rrow"><button data-again>${esc(kind === "card" ? c.btnAgain : c.btnAgainStake)}</button>${keep}</div>`, bet === "green" ? "rainbow" : "gold");
    } else {
      selectedCardId = '';
      lastWonCardId = '';
      const loseText = kind === 'cash'
        ? fill(c.loseCash, { stake: yuan(out.stakeCents ?? cashStakeCents) })
        : kind === 'asset'
          ? fill(c.loseAsset, { assetName: out.assetName || "", value: yuan(out.valueCents ?? 0) })
          : c.lose;
      if (kind === 'cash') cashStakeCents = 0;
      if (kind === 'asset') selectedAssetId = '';
      casinoOutcome = { kind: 'lose', text: loseText };
      showResult(`<div class="rno">${esc(betDef.name || bet)}</div>
        <div class="rname">${esc(c.loseTitle)}</div>
        <div class="rtip">${esc(loseText)}</div>
        <div class="rrow"><button class="primary" data-dismiss>${esc(kind === "card" ? c.btnNextCard : c.btnAgainStake)}</button></div>`);
    }
  } catch (err) {
    toast(errorText(err?.message));
  } finally {
    setSpinning(false);
    renderSide();
    if (casinoOutcome && fxQuality === 'high') {
      const cls = casinoOutcome.kind === 'win' ? 'shake-win' : 'shake-lose';
      boardBox.classList.remove('shake-win', 'shake-lose');
      void boardBox.offsetWidth;
      boardBox.classList.add(cls);
      setTimeout(() => boardBox.classList.remove(cls), 700);
    }
    if (casinoOutcome?.kind === 'win') flashStake();
  }
}
// rc.42：收手兑换一旦提交就不可撤回（胜局横幅上误点一下卡就没了），统一先过一次 #wfConfirm。
async function confirmAndRedeemCard(cardId) {
  const card = (view?.wishCards || []).find((c) => c.itemId === cardId) || {};
  const ok = await openWheelConfirm({
    title: COPY.overlay.confirm.cashOutTitle,
    costBadge: fill(COPY.overlay.confirm.cashOutCost, { cardName: resolveCardTitle(card) || card.cardCode || '星愿卡', points: card.currentPoints ?? 0 }),
    detailText: COPY.overlay.confirm.cashOutDetail,
    warnText: COPY.overlay.confirm.cashOutWarn,
    confirmText: COPY.overlay.confirm.cashOutOkBtn,
    cancelText: COPY.overlay.confirm.btnCancel,
  });
  if (!ok) return false;
  await redeemCard(cardId);
  return true;
}
async function redeemCard(cardId) {
  if (spinning) return;
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
  if (spinning) return;
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
  const q = e.target.closest('[data-fxq-btn]');
  if (q) { setFxMenu(!fxMenuOpen); return; }
  const opt = e.target.closest('[data-fxq-opt]');
  if (opt) {
    const next = opt.dataset.fxqOpt;
    setFxMenu(false);
    if (next !== fxQuality) setFxQuality(next);
    return;
  }
  const copt = e.target.closest('[data-cfxq-opt]');
  if (copt) {
    const next = copt.dataset.cfxqOpt;
    setFxMenu(false);
    if (next !== cardFxQuality) setCardFxQuality(next);
    return;
  }
  setFxMenu(false);
  const b = e.target.closest('[data-mode]');
  if (!b || spinning || b.dataset.mode === wheelType) return;
  wheelType = b.dataset.mode;
  hideResult();
  clearHit();
  packState.phase = 'IDLE';
  buildAndRender();
});
// rc.39 追加：赌桌下注台——点击上桌与拖拽上桌两条通道共用同一个选卡动作。
function pickCasinoCard(itemId) {
  if (spinning) return;
  const c = wishCards().find((x) => x.itemId === itemId);
  if (!c) return;
  // rc.42：取消低阶卡封顶与禁绿，任何卡都能上桌、押任何色区。
  selectedCardId = itemId;
  casinoOutcome = null;
  renderSide();
}
function flashStake() {
  const el = side.querySelector('[data-stake-val]');
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
side.addEventListener('click', (e) => {
  const pay = e.target.closest('[data-pay]');
  if (pay && !spinning) { payMode = pay.dataset.pay; renderSide(); return; }
  const pool = e.target.closest('[data-pool]');
  if (pool && !spinning) { packTier = pool.dataset.pool; renderSide(); return; }
  const bet = e.target.closest('[data-bet]');
  if (bet && !spinning) { selectedBet = bet.dataset.bet; casinoOutcome = null; renderSide(); return; }
  const cash = e.target.closest('[data-cashout-now]');
  if (cash && !spinning && selectedCardId) { confirmAndRedeemCard(selectedCardId); return; }
  const kindBtn = e.target.closest('[data-stake-kind]');
  if (kindBtn && !spinning) { stakeKind = kindBtn.dataset.stakeKind; renderSide(); return; }
  const chip = e.target.closest('[data-cash-chip]');
  if (chip && !spinning) {
    cashStakeCents = chip.dataset.cashChip === 'pct'
      ? Math.floor(((Number(view?.cashCents) || 0) * 0.1) / 100) * 100
      : Number(chip.dataset.cashChip);
    renderSide(); return;
  }
  const assetBtn = e.target.closest('[data-asset]');
  if (assetBtn && !spinning) { selectedAssetId = assetBtn.dataset.asset; renderSide(); return; }
  const back = e.target.closest('[data-return-card]');
  if (back && !spinning) {
    if (stakeKind === 'card') selectedCardId = '';
    else if (stakeKind === 'cash') cashStakeCents = 0;
    else selectedAssetId = '';
    casinoOutcome = null; renderSide(); return;
  }
  const card = e.target.closest('[data-card]');
  if (card && !spinning) { pickCasinoCard(card.dataset.card); return; }
});
side.addEventListener('change', (e) => {
  const input = e.target.closest('[data-cash-input]');
  if (!input || spinning) return;
  const n = Number(input.value);
  // rc.43：输入框按「元」计，这里换算成分并对齐整元 + 不超可用现金（引擎要求 ≥ ¥1,000）。
  const rawCents = Number.isFinite(n) && n >= 1000 ? Math.round(n) * 100 : 0;
  const cap = Math.max(0, Number(view?.cashCents) || 0);
  cashStakeCents = rawCents ? Math.min(Math.round(rawCents / 100) * 100, Math.floor(cap / 100) * 100) : 0;
  renderSide();
});
side.addEventListener('dragstart', (e) => {
  const c = e.target.closest('[data-card]');
  if (!c) return;
  try { e.dataTransfer.setData('text/plain', c.dataset.card); e.dataTransfer.effectAllowed = 'move'; } catch {}
  side.querySelector('[data-stake-zone]')?.classList.add('drag-over');
});
side.addEventListener('dragend', () => side.querySelector('[data-stake-zone]')?.classList.remove('drag-over'));
side.addEventListener('dragover', (e) => {
  const z = e.target.closest('[data-stake-zone]');
  if (!z) return;
  e.preventDefault();
  z.classList.add('drag-over');
});
side.addEventListener('dragleave', (e) => {
  const z = e.target.closest('[data-stake-zone]');
  if (z) z.classList.remove('drag-over');
});
side.addEventListener('drop', (e) => {
  const z = e.target.closest('[data-stake-zone]');
  if (!z) return;
  e.preventDefault();
  z.classList.remove('drag-over');
  let id = '';
  try { id = e.dataTransfer?.getData('text/plain') || ''; } catch {}
  if (id) pickCasinoCard(id);
});
packBox.addEventListener('click', (e) => {
  const t = e.target.closest('[data-quicktear],[data-skipspin],[data-reveal],[data-revealall],[data-collect],[data-again]');
  if (!t) return;
  if (t.dataset.quicktear !== undefined) { packState.progress = 1; const p = document.getElementById('pkPack'); if (p) p.style.setProperty('--pk', '1'); burstPack(); return; }
  if (t.dataset.skipspin !== undefined) { if (skipOrbit) skipOrbit(); return; }
  if (t.dataset.revealall !== undefined) { revealAll(); return; }
  if (t.dataset.reveal !== undefined) { revealOne(Number(t.dataset.reveal)); return; }
  if (t.dataset.collect !== undefined || t.dataset.again !== undefined) {
    if (t.dataset.again !== undefined) { packState.phase = 'IDLE'; drawPack(); return; }
    if (t.dataset.collect !== undefined) { collectPack(); return; }
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
    // 取消时保持胜局横幅原样；确认并兑换成功后由 redeemCard 自己收掉结果层。
    if (cardId) confirmAndRedeemCard(cardId);
  }
});
goBtn.addEventListener('click', () => {
  if (wheelType === 'play') spinPlay();
  else if (wheelType === 'pack') drawPack();
  else spinCasino();
});
document.addEventListener('click', (e) => {
  if (!fxMenuOpen) return;
  if (e.target.closest('.wf-fxq-wrap')) return;
  setFxMenu(false);
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
  // rc.43：Esc 只关最上面那一层 —— 确认弹窗优先，关弹窗不再连带把整个轮盘关掉。
  if (confirmResolver) { closeWheelConfirm(false); return; }
  if (fxMenuOpen) { setFxMenu(false); return; }
  if (spinning) { toast(COPY.overlay.common.spinningCloseGuard); return; }
  if (packState.phase === 'SEALED' || packState.phase === 'FAN') toast(COPY.packs.ui.autoSavedToast);
  send({ type: 'WHEEL_CLOSE_REQ' });
});

function buildAndRender() {
  ensureBoard(wheelType);
  const rootEl = document.getElementById('wfRoot');
  if (rootEl) rootEl.dataset.mode = wheelType;
  renderModes();
  renderSide();
  clearHit();
  applyFxQuality();
  applyCardFxQuality();
  // rc.38 想法 15：进卡包页且处于待机态时，铺开五卡悬浮阵。
  if (wheelType === 'pack' && packState.phase === 'IDLE') renderPackStage();
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
    clearTransitions();
    wheelType = data.wheelType === 'wish' ? 'pack' : (data.wheelType || 'play');
    selectedCardId = data.preselectCardId || '';
    selectedBet = '';
    stakeKind = 'card';
    cashStakeCents = 0;
    selectedAssetId = '';
    lastWonCardId = '';
    payMode = 'auto';
    packState.phase = 'IDLE';
    view = data.view;
    pendingView = null;
    const nextFx = data.view?.fxQuality || data.fxQuality;
    const nextCardFx = data.view?.cardFxQuality || data.cardFxQuality;
    if (nextFx) setFxQuality(nextFx, false);
    if (nextCardFx) setCardFxQuality(nextCardFx, false);
    hideResult();
    buildAndRender();
    // rc.41：从入口徽章 FLIP 展开（high 档才做位移，其余档退化为轻缩放或直接显现）。
    playOpenTransition(data.originRect || data.view?.originRect);
    send({ type: 'WHEEL_BUILT', wheelType });
    return;
  }
  if (data.nonce !== nonce) return;
  if (data.type === 'WHEEL_STATE_SYNC') {
    if (data.view?.fxQuality && data.view.fxQuality !== fxQuality) setFxQuality(data.view.fxQuality, false);
    if (data.view?.cardFxQuality && data.view.cardFxQuality !== cardFxQuality) setCardFxQuality(data.view.cardFxQuality, false);
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
    clearTransitions();
    spinning = false;
    hideResult();
    clearHit();
    return;
  }
  // rc.41：关闭时先播缩回动画，播完（或 380ms 兜底）回调 host 收口。绝不阻塞点击。
  if (data.type === 'WHEEL_CLOSE_ANIMATE') {
    playCloseTransition(data.originRect || lastOriginRect);
    return;
  }
});

// rc.41：三重盘台入口 → 全屏轮盘的跨 iframe FLIP 展开 / 缩回。
// high 档做位移+缩放+旋转；medium 档退化为中心轻缩放；low 档与减少动效直接不动画。
let lastOriginRect = null;
function stageEls() {
  return { stage: document.querySelector('.wf-stage'), bg: document.querySelector('.wf-backdrop') };
}
// rc.42：展开/关闭动画句柄统一托管。跨次调用先清干净，避免上一次动画的终帧污染这一次。
let transitionAnims = [];
let closeGuardTimer = null;
function clearTransitions() {
  if (closeGuardTimer) { clearTimeout(closeGuardTimer); closeGuardTimer = null; }
  for (const a of transitionAnims) { try { a.cancel(); } catch {} }
  transitionAnims = [];
  // rc.43：切盘/关盘时一并收掉确认弹窗、延迟定时器与粒子循环，避免跨盘残留改状态。
  for (const t of activeTimers) clearTimeout(t);
  activeTimers.clear();
  stopFxLoop();
  if (confirmResolver) closeWheelConfirm(false);
  const root = document.getElementById('wfRoot');
  if (root) root.classList.remove('is-closing');
  const { stage, bg } = stageEls();
  if (stage) stage.style.visibility = '';
  if (bg) bg.style.visibility = '';
}
function playOpenTransition(originRect) {
  lastOriginRect = originRect || null;
  clearTransitions();
  const { stage, bg } = stageEls();
  if (!stage || !bg) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduced || fxQuality === 'low' || typeof stage.animate !== 'function') return;
  if (fxQuality === 'high' && originRect && originRect.width > 0) {
    const tr = stage.getBoundingClientRect();
    const dx = (originRect.left + originRect.width / 2) - (tr.left + tr.width / 2);
    const dy = (originRect.top + originRect.height / 2) - (tr.top + tr.height / 2);
    const sx = Math.max(0.1, originRect.width / Math.max(1, tr.width));
    const sy = Math.max(0.1, originRect.height / Math.max(1, tr.height));
    transitionAnims = [
      bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' }),
      // 只动 transform：舞台自身的 opacity 交给样式表，动画结束后不会把它留在 0。
      stage.animate(
        [{ transform: `translate(${dx}px,${dy}px) scale(${sx},${sy}) rotate(-18deg)` }, { transform: 'translate(0,0) scale(1,1) rotate(0deg)' }],
        { duration: 420, easing: 'cubic-bezier(0.22,1.18,0.36,1)' }
      ),
    ];
    return;
  }
  transitionAnims = [
    bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }),
    stage.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }),
  ];
}
function playCloseTransition(originRect) {
  clearTransitions();
  const { stage, bg } = stageEls();
  let finished = false;
  // rc.42：收口前先把 stage/bg 冻结成空帧，再发 WHEEL_CLOSE_DONE。
  // postMessage 是异步的，宿主 display:none 要晚 1~2 帧才生效；不冻结就会露出回弹画面。
  const finish = () => {
    if (finished) return;
    finished = true;
    if (closeGuardTimer) { clearTimeout(closeGuardTimer); closeGuardTimer = null; }
    if (stage) stage.style.visibility = 'hidden';
    if (bg) bg.style.visibility = 'hidden';
    send({ type: 'WHEEL_CLOSE_DONE', wheelType });
  };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (!stage || !bg || reduced || fxQuality === 'low' || typeof stage.animate !== 'function') { finish(); return; }
  const root = document.getElementById('wfRoot');
  if (root) root.classList.add('is-closing');
  // 硬熔断：动画最长 260ms，340ms 一定收口，绝不让「关不掉」出现。
  closeGuardTimer = setTimeout(finish, 340);
  try {
    if (fxQuality === 'high' && originRect && originRect.width > 0) {
      const tr = stage.getBoundingClientRect();
      const dx = (originRect.left + originRect.width / 2) - (tr.left + tr.width / 2);
      const dy = (originRect.top + originRect.height / 2) - (tr.top + tr.height / 2);
      const sx = Math.max(0.08, originRect.width / Math.max(1, tr.width));
      const sy = Math.max(0.08, originRect.height / Math.max(1, tr.height));
      transitionAnims = [
        bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }),
        stage.animate(
          [{ transform: 'translate(0,0) scale(1,1) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy}) rotate(12deg)`, opacity: 0 }],
          { duration: 260, easing: 'cubic-bezier(0.5,0,0.75,0)', fill: 'forwards' }
        ),
      ];
      const anim = transitionAnims[1];
      if (anim?.finished) anim.finished.then(finish, finish);
      return;
    }
    transitionAnims = [
      bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
      stage.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
    ];
    const anim = transitionAnims[1];
    if (anim?.finished) anim.finished.then(finish, finish);
  } catch { finish(); }
}
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



