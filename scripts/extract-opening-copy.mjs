// 从 4N 方案 Markdown 里「整块抠取」玩家可见文案与 CSS，写进源码。
// 铁律：卡内文案不许手写，只能由本脚本从方案代码块抠取；本脚本可重复执行（幂等）。
// 用法：node scripts/extract-opening-copy.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const PLAN = path.join(root, 'reports', 'rc56-开局表单方案-4N-20261124.md');
const OUT_JS = path.join(root, 'src', 'ui', 'opening-copy.generated.js');
const STYLE = path.join(root, 'src', 'ui', 'style.css');
const CSS_SENTINEL = '/* rc.56-formA: opening form limits & error states (generated from 4N plan, do not hand-edit) */';

const text = fs.readFileSync(PLAN, 'utf8');
const lines = text.split(/\r?\n/);

// 取出某个二级小节范围内、语言为 lang 的第 n 个代码块（1-based），返回 {body, startLine, endLine}
function block(sectionHead, lang, nth = 1) {
  const start = lines.findIndex((l) => l.startsWith(sectionHead));
  if (start < 0) throw Error('section not found: ' + sectionHead);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###? /.test(lines[i]) && !lines[i].startsWith(sectionHead)) { end = i; break; }
  }
  const found = [];
  for (let i = start + 1; i < end; i++) {
    if (lines[i].trim() === '```' + lang) {
      for (let j = i + 1; j < end; j++) {
        if (lines[j].trim() === '```') { found.push({ body: lines.slice(i + 1, j), startLine: i + 2, endLine: j }); i = j; break; }
      }
    }
  }
  const hit = found[nth - 1];
  if (!hit) throw Error(`code block ${lang} #${nth} not found in ${sectionHead}`);
  return hit;
}

const hintsBlk = block('### 4.1', 'json', 1);
const errorsBlk = block('### 4.3', 'json', 1);
const beautyBlk = block('### 4.2', 'text', 1);
const prowessBlk = block('### 4.2', 'text', 2);
const bannerBlk = block('### 4.4', 'text', 1);
const jumpBlk = block('### 4.4', 'text', 2);
const bodyEmptyBlk = block('### 4.5', 'text', 1);
const bodyMissingBlk = block('### 4.5', 'text', 2);
const cssBlk = block('### 2.6', 'css', 1);

const hintsRaw = hintsBlk.body.join('\n');
const errorsRaw = errorsBlk.body.join('\n');
const hints = JSON.parse(hintsRaw);   // 仅做一次合法性校验，输出仍用原文逐字
const errors = JSON.parse(errorsRaw);
const one = (b) => b.body.join('\n');   // text 块可能多行：逐字保留换行

const src = `// 本文件由 scripts/extract-opening-copy.mjs 从 4N 方案自动抠取，禁止手改。
// 源：reports/rc56-开局表单方案-4N-20261124.md
//   SETUP_FIELD_HINTS  ← L${hintsBlk.startLine}-${hintsBlk.endLine}
//   SETUP_FIELD_ERRORS ← L${errorsBlk.startLine}-${errorsBlk.endLine}
//   BEAUTY_HINT        ← L${beautyBlk.startLine}-${beautyBlk.endLine}
//   PROWESS_HINT       ← L${prowessBlk.startLine}-${prowessBlk.endLine}
//   DRAFT_WARN_TEXT    ← L${bannerBlk.startLine}-${bannerBlk.endLine}
//   DRAFT_WARN_BTN     ← L${jumpBlk.startLine}-${jumpBlk.endLine}
//   BODY_EMPTY_TEXT    ← L${bodyEmptyBlk.startLine}-${bodyEmptyBlk.endLine}
//   BODY_MISSING_TPL   ← L${bodyMissingBlk.startLine}-${bodyMissingBlk.endLine}

export const SETUP_FIELD_HINTS = ${hintsRaw};

export const SETUP_FIELD_ERRORS = ${errorsRaw};

export const BEAUTY_HINT = ${JSON.stringify(one(beautyBlk))};

export const PROWESS_HINT = ${JSON.stringify(one(prowessBlk))};

export const DRAFT_WARN_TEXT = ${JSON.stringify(one(bannerBlk))};

export const DRAFT_WARN_BTN = ${JSON.stringify(one(jumpBlk))};

export const BODY_EMPTY_TEXT = ${JSON.stringify(one(bodyEmptyBlk))};

export const BODY_MISSING_TPL = ${JSON.stringify(one(bodyMissingBlk))};
`;

fs.writeFileSync(OUT_JS, src, 'utf8');

// ---- CSS：整块追加到 style.css 末尾（幂等，靠 sentinel 判断） ----
const css = one(cssBlk).replace(/\r\n/g, '\n');
let style = fs.readFileSync(STYLE, 'utf8');
const hadCss = style.includes(CSS_SENTINEL);
if (!hadCss) {
  style = style.replace(/\s*$/, '\n') + '\n' + CSS_SENTINEL + '\n' + css + '\n';
  fs.writeFileSync(STYLE, style, 'utf8');
}

// ---- 字面比对输出（交给自检表用） ----
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const report = {
  plan: path.relative(root, PLAN).replaceAll('\\', '/'),
  outputs: {
    js: {
      file: 'src/ui/opening-copy.generated.js',
      hints: { count: Object.keys(hints).length, sha: sha(hintsRaw), lines: `L${hintsBlk.startLine}-${hintsBlk.endLine}` },
      errors: { count: Object.keys(errors).length, sha: sha(errorsRaw), lines: `L${errorsBlk.startLine}-${errorsBlk.endLine}` },
      texts: {
        beauty: sha(one(beautyBlk)), prowess: sha(one(prowessBlk)),
        banner: sha(one(bannerBlk)), jump: sha(one(jumpBlk)),
        bodyEmpty: sha(one(bodyEmptyBlk)), bodyMissing: sha(one(bodyMissingBlk)),
      },
    },
    css: { file: 'src/ui/style.css', sha: sha(css), appendedNow: !hadCss, alreadyPresent: hadCss, lines: `L${cssBlk.startLine}-${cssBlk.endLine}` },
  },
};
const repPath = path.join(root, '.work', 'rc56-formA-copy-compare.json');
fs.writeFileSync(repPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
