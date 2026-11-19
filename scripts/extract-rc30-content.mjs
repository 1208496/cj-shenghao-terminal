// 从 AGY_PLAN_rc30.md 抠出定稿文本写盘（铁律 3：不靠手抄）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const md = fs.readFileSync(path.join(root, 'AGY_PLAN_rc30.md'), 'utf8');

function slice(startMarker, endMarker) {
  const a = md.indexOf(startMarker);
  if (a < 0) throw Error('missing marker ' + startMarker);
  const b = endMarker ? md.indexOf(endMarker, a + startMarker.length) : md.length;
  if (b < 0) throw Error('missing end ' + endMarker);
  return md.slice(a, b);
}
function fenced(text, lang) {
  const re = new RegExp('```' + lang + '\\r?\\n([\\s\\S]*?)\\r?\\n```');
  const m = text.match(re);
  if (!m) throw Error('no ' + lang + ' fence in ' + text.slice(0, 40));
  return m[1];
}

// 4.1 project.json
const projectText = fenced(slice('### 4.1 ', '### 4.2 '), 'json').trim() + '\n';
JSON.parse(projectText);
fs.writeFileSync(path.join(root, 'project.json'), projectText, 'utf8');
console.log('PROJECT_OK', projectText.length);

// 4.2 / 4.3 纯文本
const stateText = fenced(slice('### 4.2 ', '### 4.3 '), 'text').trim() + '\n';
fs.writeFileSync(path.join(root, 'src/content/state-context.txt'), stateText, 'utf8');
console.log('STATE_OK', stateText.trim().split('\n').length, 'lines');

const protocolText = fenced(slice('### 4.3 ', '### 4.4 '), 'text').trim() + '\n';
fs.writeFileSync(path.join(root, 'src/content/protocol.txt'), protocolText, 'utf8');
console.log('PROTOCOL_OK', protocolText.trim().split('\n').length, 'lines');

// 4.4 九条 literary 条目
const literaryPath = path.join(root, 'src/content/literary.json');
let literary = fs.readFileSync(literaryPath, 'utf8');
const litSection = slice('### 4.4 ', '### 4.5 ');
const parts = litSection.split(/^#### 4\.4\.\d+ /m).slice(1);
console.log('LITERARY_PARTS', parts.length);
for (const part of parts) {
  const idm = part.match(/`id: "([^"]+)"`/);
  if (!idm) throw Error('no id in part ' + part.slice(0, 40));
  const id = idm[1];
  let body = fenced(part, 'json').trim().replace(/,\s*$/, '');
  const parsed = JSON.parse(body);
  if (parsed.id !== id) throw Error('id mismatch ' + parsed.id + ' vs ' + id);
  const re = new RegExp('    \\{\\r?\\n      "id": "' + id + '",[\\s\\S]*?\\n    \\}', 'm');
  if (!re.test(literary)) throw Error('literary id not found ' + id);
  literary = literary.replace(re, body);
  console.log('  replaced', id, parsed.title);
}
JSON.parse(literary);
fs.writeFileSync(literaryPath, literary, 'utf8');
console.log('LITERARY_OK', literary.length);

// 4.5 setup-presets.json 的 contacts 数组
const presetsPath = path.join(root, 'src/ui/setup-presets.json');
const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
const contactsText = fenced(slice('### 4.5 ', '### 4.6 '), 'json').trim();
const contacts = JSON.parse('{' + contactsText + '}').contacts;
if (!Array.isArray(contacts) || contacts.length !== 6) throw Error('contacts parse fail ' + (contacts && contacts.length));
presets.contacts = contacts;
fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2) + '\n', 'utf8');
console.log('PRESETS_OK', contacts.map((c) => c.name + ':' + (c.recentGoal ? 'R' : '-') + (c.longTermDream ? 'D' : '-') + (c.hiddenScar ? 'S' : '-')).join(' '));
console.log('EXTRACT_OK');
