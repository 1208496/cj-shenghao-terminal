// rc.50：把方案 §7 的 `"toylink"` 键块 + §6 的注入模板逐字抠进 wheel-ui-copy.js。
// 源：RC50总方案/03_4N-跳蛋轻量前端与实现方案.md（4N 定稿，conversation_id 5c2689de-…）
// 只做「文本切片 + 原样插入」，不做任何改写或润色；已存在则报错退出，避免二次插入。
import fs from 'node:fs/promises';

const MD = 'E:/SHZDCHOSSS/RC50总方案/03_4N-跳蛋轻量前端与实现方案.md';
const OUT = 'E:/SHZDCHOSSS/src/core/wheel-ui-copy.js';
const ANCHOR = '      "removeOkToast": "已摘下【{name}】的誓约项圈，穿搭档案已同步更新。"\n    }\n  },';

const md = await fs.readFile(MD, 'utf8');

// 1. 抠 §7 的 json 代码块里 `"toylink": {` 到配平结尾
const sec7 = md.slice(md.indexOf('## 7. 文案键表'));
const fence = sec7.indexOf('```json');
if (fence < 0) throw new Error('§7 未找到 json 代码块');
const blockStart = sec7.indexOf('"toylink": {', fence);
if (blockStart < 0) throw new Error('§7 未找到 "toylink": {');
let i = blockStart + '"toylink": '.length;
let depth = 0;
let end = -1;
for (; i < sec7.length; i++) {
  const ch = sec7[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) throw new Error('toylink 块花括号未配平');
const toyBlock = sec7.slice(blockStart, end);

// 2. 抠 §6 的注入模板（```text … ```），转义成单行 JS 字符串
const sec6 = md.slice(md.indexOf('## 6. 提示词注入策略'), md.indexOf('## 7. 文案键表'));
const t0 = sec6.indexOf('```text');
const t1 = sec6.indexOf('```', t0 + 7);
if (t0 < 0 || t1 < 0) throw new Error('§6 未找到 text 代码块');
const promptRaw = sec6.slice(t0 + 7, t1).replace(/^\n+|\n+$/g, '');
const promptEsc = promptRaw.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

// 3. promptBlock 追加到 toylink 块末尾（最后一行 `}` 之前）
const withPrompt = toyBlock.replace(/\n\}\s*$/, `,\n  "promptBlock": "${promptEsc}"\n}`);

// 4. 缩进：首末行 +4 空格（落到 workshop 第 3 层），中间行 +2 空格
const lines = withPrompt.split('\n');
for (let k = 0; k < lines.length; k++) {
  lines[k] = (k === 0 || k === lines.length - 1 ? '    ' : '  ') + lines[k];
}
const body = lines.join('\n');

const src = await fs.readFile(OUT, 'utf8');
if (src.includes('"promptBlock"')) throw new Error('wheel-ui-copy.js 已存在 workshop.toylink 节点，先还原再跑');
if (!src.includes(ANCHOR)) throw new Error('wheel-ui-copy.js 锚点未命中');
// 插在 choker 块的 `    }` 之后、workshop 闭合的 `  },` 之前
const head = ANCHOR.slice(0, ANCHOR.lastIndexOf('\n  },'));
if (!head.endsWith('    }')) throw new Error('锚点切分异常');
const next = src.replace(ANCHOR, head + ',\n' + body + '\n  },');
await fs.writeFile(OUT, next, 'utf8');

console.log(JSON.stringify({toyKeys: (toyBlock.match(/"[a-zA-Z0-9]+":/g) || []).length, promptChars: promptRaw.length, outBytes: next.length}));
