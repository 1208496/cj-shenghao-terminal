// 按原型补齐金色细线（每道暗槽两侧各一条 golden hairline）+ 核心层
import fs from 'node:fs';

const FILE = 'E:/SHZDCHOSSS/src/ui/wheel-frame.js';
let src = fs.readFileSync(FILE, 'utf8');

// 1) gothicBands 的三道暗槽两侧补金色细线
src = src.replace(
  `<circle cx="\${C}" cy="\${C}" r="203" fill="none" stroke="#130e17" stroke-width="9"/>`,
  `<circle cx="\${C}" cy="\${C}" r="206" fill="none" stroke="#130e17" stroke-width="12"/>
    <circle cx="\${C}" cy="\${C}" r="212" fill="none" stroke="rgba(246,215,134,.72)" stroke-width="1.3"/>
    <circle cx="\${C}" cy="\${C}" r="200" fill="none" stroke="rgba(246,215,134,.68)" stroke-width="1.3"/>`
);
src = src.replace(
  `<circle cx="\${C}" cy="\${C}" r="199" fill="none" stroke="rgba(246,215,134,.55)" stroke-width="1.1"/>`,
  ``
);
src = src.replace(
  `<circle cx="\${C}" cy="\${C}" r="131" fill="none" stroke="#150e18" stroke-width="7"/>`,
  `<circle cx="\${C}" cy="\${C}" r="130" fill="none" stroke="#150e18" stroke-width="12"/>
    <circle cx="\${C}" cy="\${C}" r="136" fill="none" stroke="rgba(246,215,134,.75)" stroke-width="1.3"/>
    <circle cx="\${C}" cy="\${C}" r="124" fill="none" stroke="rgba(246,215,134,.78)" stroke-width="1.3"/>`
);
src = src.replace(
  `<circle cx="\${C}" cy="\${C}" r="127" fill="none" stroke="rgba(246,215,134,.6)" stroke-width="1.1"/>`,
  ``
);

// 2) 核心层按原型：暗槽 r=70(w8) + 金线 r=74 / r=66 + 彩虹环 r=59(w13) + 细线 r=52
src = src.replace(
  `  <circle cx="\${C}" cy="\${C}" r="64" fill="#0d0a12" stroke="rgba(246,215,134,.6)" stroke-width="1.4"/>
  <circle cx="\${C}" cy="\${C}" r="\${(CORE.r1 + CORE.r2) / 2}" fill="none" stroke="url(#gRainbow)" stroke-width="\${CORE.r2 - CORE.r1}" opacity=".55"/>`,
  `  <circle cx="\${C}" cy="\${C}" r="70" fill="none" stroke="#150e18" stroke-width="8"/>
  <circle cx="\${C}" cy="\${C}" r="74" fill="none" stroke="rgba(255,232,168,.8)" stroke-width="1.3"/>
  <circle cx="\${C}" cy="\${C}" r="66" fill="none" stroke="rgba(255,232,168,.65)" stroke-width="1.1"/>
  <circle cx="\${C}" cy="\${C}" r="59" fill="none" stroke="url(#gRainbow)" stroke-width="13" opacity=".85"/>
  <circle cx="\${C}" cy="\${C}" r="52" fill="none" stroke="rgba(255,240,196,.55)" stroke-width="1"/>`
);

fs.writeFileSync(FILE, src, 'utf8');
console.log('GOLD_HAIRLINES_OK');
