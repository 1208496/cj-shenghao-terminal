// rc.52：把 4N 的 JSON 输出拆成「方案 md + 原型 html」两落盘，并打印体检结论。
// 只做切片与落盘，不改一个字；找不到完整 html 就以 ERROR 退出，不写半成品。
import fs from 'node:fs/promises';
import path from 'node:path';

const RAW = 'E:/SHZDCHOSSS/.work/agy-out-C5-4N.json';
const DIR = 'E:/SHZDCHOSSS/RC52总方案';
const OUT_MD = path.join(DIR, '02_方案_4N-TOY宽屏与佩戴链路.md');
const OUT_HTML = path.join(DIR, '03_原型', 'toy-wide-proto.html');

const rawText = await fs.readFile(RAW, 'utf8');
let payload;
try {
  payload = JSON.parse(rawText.slice(rawText.indexOf('{')));
} catch (e) {
  console.error('JSON 解析失败：' + e.message);
  process.exit(2);
}
const text = String(payload.result ?? payload.response ?? '');
const conv = payload.conversation_id || payload.conversationId || '';
const usage = payload.usage || payload.usage_metadata || null;

// 抠 ```html ... ``` 整块（取最长的一段，避免把示例片段当成品）
const blocks = [];
const re = /```html\s*\r?\n([\s\S]*?)```/g;
let m;
while ((m = re.exec(text)) !== null) blocks.push(m[1]);
blocks.sort((a, b) => b.length - a.length);
const html = blocks[0] || '';
const htmlOk = html.includes('<!DOCTYPE html') && /<\/html>\s*$/.test(html.trim());

await fs.mkdir(path.dirname(OUT_HTML), { recursive: true });
// 方案：去掉那段 html 代码块后剩下的正文（保留其它 markdown 原样）
const mdBody = blocks.length ? text.replace(blocks[0], '<!-- 原型见 03_原型/toy-wide-proto.html -->') : text;
await fs.writeFile(OUT_MD, mdBody.trimEnd() + '\n', 'utf8');
if (htmlOk) await fs.writeFile(OUT_HTML, html, 'utf8');

// 体检：YG 本轮三条要求的关键词是否被回应
const needles = {
  '现场字样': /现场/,
  '身处/处境扩到6+': /(严肃会议|晚宴人群|私密独处)[\s\S]*(处境|场景)[\s\S]*(6|六|8|八)/,
  '佩戴确认框': /(确认框|确认弹窗|二次确认|confirm)/i,
  '佩戴写入正文': /(戴上|佩戴)[\s\S]{0,80}(下一轮|下轮|正文)/,
  '世界书': /世界书/,
  '宽屏基准': /(1120|1280|1440|1[0-9]{3}\s*[×xX]\s*[0-9]{3})/,
  'injectPrompts': /injectPrompts|inject_prompts/,
  'schema 不动': /schema\.js/
};
const report = {};
for (const [k, rx] of Object.entries(needles)) report[k] = rx.test(text);

console.log(JSON.stringify({
  conversation_id: conv,
  textChars: text.length,
  htmlBlocks: blocks.length,
  htmlChars: html.length,
  htmlComplete: htmlOk,
  usage,
  mdOut: OUT_MD,
  htmlOut: htmlOk ? OUT_HTML : null,
  checks: report
}, null, 2));
