// rc.52：从 4N 原型逐字抽出 `toylink.css` 与 `toylink.template.html`（照抄律）。
// 规则：CSS 只剔除 `.proto-*` 演示块；模板删掉演示条与写入正文抽屉、清空演示值、留 __TOYLINK_CSS__ / __TOYLINK_JS__ 占位。
import fs from 'node:fs/promises';

const SRC = 'E:/SHZDCHOSSS/RC52总方案/03_原型/toy-wide-proto.html';
const OUT_CSS = 'E:/SHZDCHOSSS/src/ui/toylink.css';
const OUT_TPL = 'E:/SHZDCHOSSS/src/ui/toylink.template.html';

const html = await fs.readFile(SRC, 'utf8');

// ---------- CSS ----------
const styleM = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
if (!styleM) throw new Error('找不到 <style>');
let css = styleM[1];
// 逐条规则扫描，丢掉选择器里含 .proto 的块（含其注释行）
const kept = [];
let i = 0;
let dropped = 0;
while (i < css.length) {
  const open = css.indexOf('{', i);
  if (open < 0) { kept.push(css.slice(i)); break; }
  const close = css.indexOf('}', open);
  if (close < 0) { kept.push(css.slice(i)); break; }
  const selector = css.slice(i, open);
  const body = css.slice(open, close + 1);
  if (/\.proto[-]/.test(selector)) { dropped++; } else { kept.push(selector + body); }
  i = close + 1;
}
const cssOut = [
  '/* rc.52：TOY·LINK 独立宽屏样式。逐字取自 4N 原型 `RC52总方案/03_原型/toy-wide-proto.html` 的 <style> 块，',
  ' * 只剔除 `.proto-*` 原型演示件（' + dropped + ' 条选择器）。由 scripts/extract-rc52-toywide.mjs 生成。 */',
  kept.join('').trim(),
  ''
].join('\n');
await fs.mkdir('E:/SHZDCHOSSS/src/ui', { recursive: true });
await fs.writeFile(OUT_CSS, cssOut, 'utf8');

// ---------- 模板 ----------
const bodyM = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyM) throw new Error('找不到 <body>');
let body = bodyM[1];

// 1) 删演示条
body = body.replace(/\n?<!-- 仅原型演示控制条（不进卡） -->\s*<div class="proto-bar"[\s\S]*?<\/div>\s*(?=\n)/, '\n');
// 2) 删写入正文抽屉
body = body.replace(/\n?<!-- 原型专属：模拟酒馆输入框与注入块预览 -->\s*<div class="proto-io-drawer"[\s\S]*?<\/div>\s*(?=\n)/, '\n');
// 3) script 换成占位
body = body.replace(/<script>[\s\S]*?<\/script>/, '<script>__TOYLINK_JS__</script>');
// 4) 清演示值（模板只留空态；JS 在 INIT 后用真实快照重绘）
const blanks = [
  [/<div class="tl-wear-av" id="tlWearAv">[^<]*<\/div>/, '<div class="tl-wear-av" id="tlWearAv"></div>'],
  [/<div class="tl-wear-name" id="tlWearName">[^<]*<\/div>/, '<div class="tl-wear-name" id="tlWearName">—</div>'],
  [/<div class="tl-wear-nums" id="tlWearNums">[^<]*<\/div>/, '<div class="tl-wear-nums" id="tlWearNums"></div>'],
  [/<div class="tl-wear-tag" id="tlWearTag">[^<]*<\/div>/, '<div class="tl-wear-tag" id="tlWearTag">—</div>'],
  [/<div class="tl-stage-meta" id="tlStageMeta">[^<]*<\/div>/, '<div class="tl-stage-meta" id="tlStageMeta">待机</div>'],
  [/<div class="tl-feed-line" id="tlFeedLine">[^<]*<\/div>/, '<div class="tl-feed-line" id="tlFeedLine"></div>'],
  [/<div class="tl-trace-val[^"]*" id="tlTraceVal">[^<]*<\/div>/, '<div class="tl-trace-val is-empty" id="tlTraceVal"></div>'],
  [/<div class="tl-scene-desc" id="tlSceneDesc">[^<]*<\/div>/, '<div class="tl-scene-desc" id="tlSceneDesc"></div>'],
  [/<div class="tl-modal-body" id="tlModalBody">[\s\S]*?<\/div>/, '<div class="tl-modal-body" id="tlModalBody"></div>']
];
for (const [rx, rep] of blanks) body = body.replace(rx, rep);
// 进度条/数值归零
body = body.replace(/(<i id="tlPowBar" style="width:)[\d.]+%/, '$155%');
body = body.replace(/(<i id="tlFreqBar" style="width:)[\d.]+%/, '$140%');
body = body.replace(/(<b class="tl-param-val" id="tlPowVal">)[^<]*/, '$155%');
body = body.replace(/(<b class="tl-param-val" id="tlFreqVal">)[^<]*/, '$12.4Hz');

const tplOut = [
  '<!DOCTYPE html>',
  '<html lang="zh-CN">',
  '<head>',
  '<meta charset="utf-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  '<title>神豪终端 · TOY·LINK 遥控终端</title>',
  '<style>__TOYLINK_CSS__</style>',
  '</head>',
  '<body>',
  body.trim(),
  '</body>',
  '</html>',
  ''
].join('\n');
await fs.writeFile(OUT_TPL, tplOut, 'utf8');

// 残留体检：模板里还有哪些中文可见文本（帮助确认没有演示值漏网）
const visible = [...tplOut.matchAll(/>([^<>{}\n]{2,40})</g)].map((m) => m[1].trim()).filter((s) => /[\u4e00-\u9fa5]/.test(s));
console.log(JSON.stringify({
  cssChars: cssOut.length, cssDroppedRules: dropped,
  tplChars: tplOut.length,
  hasCssSlot: tplOut.includes('__TOYLINK_CSS__'),
  hasJsSlot: tplOut.includes('__TOYLINK_JS__'),
  leftoverProto: /\.proto-|protoIODrawer|proto-bar/.test(tplOut),
  visibleSample: [...new Set(visible)].slice(0, 60)
}, null, 1));
