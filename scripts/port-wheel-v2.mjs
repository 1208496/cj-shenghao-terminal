// rc.39：把原型 v2「三环同心哥特星盘」移植进 wheel-frame.js 的 playBoard()
import fs from 'node:fs';

const FILE = 'E:/SHZDCHOSSS/src/ui/wheel-frame.js';
let src = fs.readFileSync(FILE, 'utf8');

const start = src.indexOf('function playBoard() {');
if (start < 0) throw new Error('playBoard not found');
const end = src.indexOf('\n}\n', start);
if (end < 0) throw new Error('playBoard end not found');

const NEW = String.raw`// rc.39 追加：按 wheel-proto-v2 原型复刻盘面（双层金环 + 符文带 + 尖拱/玫瑰窗/齿环 + 三环径向渐变 + 暗角高光）
// 结构全部是合并 path，节点约 308；滤镜只挂在小范围流光上，三档用 CSS 变量做减法。
const BOARD_DEFS = () => `<defs>
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

// 外-中 30 瓣尖拱带 + 中-内 16 瓣玫瑰窗 + 内-核 24 齿环，全部合并成 path
function gothicBands() {
  let archD = '', archDots = '';
  for (let i = 0; i < 30; i++) {
    const a0 = i * 12, aMid = a0 + 6, a1 = a0 + 12;
    const [x0, y0] = polar(200, a0), [xm, ym] = polar(205, aMid), [x1, y1] = polar(200, a1);
    const [cx1, cy1] = polar(203, a0 + 2), [cx2, cy2] = polar(203, a1 - 2);
    archD += `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${cx1.toFixed(1)} ${cy1.toFixed(1)} ${xm.toFixed(1)} ${ym.toFixed(1)}Q${cx2.toFixed(1)} ${cy2.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    const [bx, by] = polar(202.5, aMid);
    archDots += `M${bx.toFixed(1)} ${by.toFixed(1)}h.01`;
  }
  let roseD = '', roseDots = '';
  for (let i = 0; i < 16; i++) {
    const deg = i * 22.5 + 11.25, rad = ((deg - 90) * Math.PI) / 180, [cx, cy] = polar(129, deg);
    const cos = Math.cos(rad + Math.PI / 2), sin = Math.sin(rad + Math.PI / 2);
    const rot = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
    const p = [[-4.6, 0], [0, -3.2], [4.6, 0], [0, 3.2]].map(([x, y]) => rot(x, y));
    roseD += `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}L${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}L${p[2][0].toFixed(1)} ${p[2][1].toFixed(1)}L${p[3][0].toFixed(1)} ${p[3][1].toFixed(1)}Z`;
    const [qx, qy] = polar(129, i * 22.5);
    roseDots += `M${qx.toFixed(1)} ${qy.toFixed(1)}h.01`;
  }
  let teethD = '';
  for (let i = 0; i < 24; i++) {
    const [x1, y1] = polar(71, i * 15), [x2, y2] = polar(76, i * 15);
    teethD += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return `<g data-gothic-deco>
    <circle cx="${C}" cy="${C}" r="203" fill="none" stroke="#130e17" stroke-width="9"/>
    <path d="${archD}" fill="none" stroke="rgba(226,190,118,.72)" stroke-width="1.05"/>
    <path d="${archDots}" fill="none" stroke="rgba(246,215,134,.8)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="${C}" cy="${C}" r="199" fill="none" stroke="rgba(246,215,134,.55)" stroke-width="1.1"/>
    <circle cx="${C}" cy="${C}" r="131" fill="none" stroke="#150e18" stroke-width="7"/>
    <path d="${roseD}" fill="rgba(140,34,58,.45)" stroke="rgba(246,215,134,.78)" stroke-width=".9"/>
    <path d="${roseDots}" fill="none" stroke="rgba(255,236,184,.88)" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="${C}" cy="${C}" r="127" fill="none" stroke="rgba(246,215,134,.6)" stroke-width="1.1"/>
    <path d="${teethD}" fill="none" stroke="rgba(246,215,134,.66)" stroke-width=".9"/>
  </g>`;
}

function playBoard() {
  const grads = [['url(#gOuterA)', 'url(#gOuterB)'], ['url(#gMidA)', 'url(#gMidB)'], ['url(#gInA)', 'url(#gInB)']];
  let ringsHtml = '';
  RINGS.forEach((cfg, ri) => {
    const n = cfg.to - cfg.from, step = 360 / n;
    let a = '', b = '', sep = '', syms = '';
    for (let i = 0; i < n; i++) {
      const a0 = i * step, a1 = a0 + step, mid = a0 + step / 2;
      const seg = sector(cfg.r1, cfg.r2, a0, a1);
      if (i % 2 === 0) a += seg; else b += seg;
      const [sx1, sy1] = polar(cfg.r1, a0), [sx2, sy2] = polar(cfg.r2, a0);
      sep += `M${sx1.toFixed(1)} ${sy1.toFixed(1)}L${sx2.toFixed(1)} ${sy2.toFixed(1)}`;
      const p = WHEEL_POOL[cfg.from + i];
      const [x, y] = polar(cfg.symR, mid);
      syms += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${mid.toFixed(1)})" style="color:${SYM_COLOR[p.rarity]}"><use href="#g${p.no}" width="24" height="24" x="-12" y="-12" transform="scale(${(cfg.size / 24).toFixed(3)})"/></g>`;
    }
    ringsHtml += `<g class="ring" data-ring="${ri}">
      <path d="${a}" fill="${grads[ri][0]}"/>
      <path d="${b}" fill="${grads[ri][1]}"/>
      <path d="${sep}" fill="none" stroke="rgba(8,6,12,.75)" stroke-width="1.8"/>
      <path d="${sep}" fill="none" stroke="rgba(232,199,130,.46)" stroke-width=".7"/>
      ${syms}
      ${wedge('rgba(246,227,176,.3)')}
    </g>`;
  });
  return BOARD_DEFS() + `
  <circle cx="${C}" cy="${C}" r="332" fill="url(#gBezel)" stroke="rgba(246,215,134,.55)" stroke-width="1.5"/>
  <circle cx="${C}" cy="${C}" r="325" fill="#120f17" stroke="rgba(217,184,120,.38)" stroke-width="1"/>
  <circle cx="${C}" cy="${C}" r="303" fill="#0e0b12" stroke="rgba(217,184,120,.55)" stroke-width="1.2"/>
  ${mergedRuneOrbit(314)}
  ${ringsHtml}
  ${gothicBands()}
  <circle cx="${C}" cy="${C}" r="64" fill="#0d0a12" stroke="rgba(246,215,134,.6)" stroke-width="1.4"/>
  <circle cx="${C}" cy="${C}" r="${(CORE.r1 + CORE.r2) / 2}" fill="none" stroke="url(#gRainbow)" stroke-width="${CORE.r2 - CORE.r1}" opacity=".55"/>
  <circle class="core-glow" cx="${C}" cy="${C}" r="${CORE.r2 + 34}" fill="url(#coreGlow)" style="pointer-events:none"/>
  <circle class="wf-vig" cx="${C}" cy="${C}" r="300" fill="url(#gVignette)" pointer-events="none"/>
  <circle class="wf-sheen" cx="${C}" cy="${C}" r="300" fill="url(#gSheen)" pointer-events="none"/>`;
}`;

src = src.slice(0, start) + NEW + src.slice(end + 3);
fs.writeFileSync(FILE, src, 'utf8');
console.log('PLAYBOARD_V2_OK');
