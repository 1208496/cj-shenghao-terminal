// 把 AGY_PLAN_rc30.md 第四章的代码块按锚点应用进 engine.js（铁律：不手抄）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const md = fs.readFileSync(path.join(root, 'AGY_PLAN_rc30.md'), 'utf8');
const enginePath = path.join(root, 'src/core/engine.js');
let src = fs.readFileSync(enginePath, 'utf8');
const backup = path.join(root, '.work/engine.rc29.bak.js');
fs.writeFileSync(backup, src, 'utf8');

function fence(startMarker, endMarker) {
  const a = md.indexOf(startMarker);
  if (a < 0) throw Error('missing start ' + startMarker);
  const b = md.indexOf(endMarker, a + startMarker.length);
  if (b < 0) throw Error('missing end ' + endMarker);
  const m = md.slice(a, b).match(/```javascript\r?\n([\s\S]*?)\r?\n```/);
  if (!m) throw Error('no js fence in ' + startMarker);
  return m[1];
}
function cut(fromAnchor, toAnchor, replacement, label) {
  const a = src.indexOf(fromAnchor);
  if (a < 0) throw Error('anchor not found: ' + fromAnchor + ' (' + label + ')');
  const b = src.indexOf(toAnchor, a + fromAnchor.length);
  if (b < 0) throw Error('end anchor not found: ' + toAnchor + ' (' + label + ')');
  src = src.slice(0, a) + replacement + src.slice(b);
  console.log('APPLIED', label);
}

// 4.7.1 seedAnatomy 整块（含 formatYuanReadable / archetypeOf / seedInnerLife）
cut(
  '// rc.25 铁律 1：女性私密肉体档案由脚本确定性播种',
  'export function basicProfile(c) {',
  fence('#### 4.7.1 ', '#### 4.7.2 ') + '\n',
  '4.7.1 seedAnatomy'
);

// 4.7.2 character(c)
cut(
  'function character(c) {',
  'export function validateDraft(d) {',
  fence('#### 4.7.2 ', '#### 4.7.3 ') + '\n',
  '4.7.2 character'
);

// 4.7.3 validateDraft contacts 映射
cut(
  '  const contacts = d.contacts.map(',
  '  requireRule(new Set(assets.map(',
  fence('#### 4.7.3 ', '#### 4.7.4 ') + '\n',
  '4.7.3 validateDraft'
);

// 4.7.4 tierBasis
cut(
  'export function tierBasis(s){',
  'export function withdrawalQuote(s,cid){',
  fence('#### 4.7.4 ', '#### 4.7.5 ') + '\n',
  '4.7.4 tierBasis'
);

// 4.7.5 AFFECTION_CHANGE
cut(
  "    case 'AFFECTION_CHANGE': {",
  "    case 'RELATIONSHIP_CHANGE': {",
  fence('#### 4.7.5 ', '#### 4.7.6 ') + '\n',
  '4.7.5 AFFECTION_CHANGE'
);

// 4.7.6 第一段：SIGNIFICANT_BEHAVIOR_SCORE
cut(
  "    case 'SIGNIFICANT_BEHAVIOR_SCORE': {",
  "    default: throw new RuleError('UNKNOWN_EVENT');",
  fence('#### 4.7.6 ', '在 `applyOperation` 的 `PLAYER_BUILD_PROFILE`') + '\n',
  '4.7.6a SIGNIFICANT_BEHAVIOR_SCORE'
);

// 4.7.6 第二段：PLAYER_BUILD_PROFILE 伏笔补齐
cut(
  "    } else if(op.type==='PLAYER_BUILD_PROFILE') {",
  "    } else if(op.type==='PLAYER_LOCK_PROFILE') {",
  fence('在 `applyOperation` 的 `PLAYER_BUILD_PROFILE`', '#### 4.7.7 ') + '\n',
  '4.7.6b PLAYER_BUILD_PROFILE'
);

// 4.7.7 projection（到文件尾）
const projFence = fence('#### 4.7.7 ', '\n### 4.8 ');
const projAt = src.indexOf('export function projection(s) {');
if (projAt < 0) throw Error('projection anchor missing');
src = src.slice(0, projAt) + projFence + '\n';
console.log('APPLIED 4.7.7 projection');

fs.writeFileSync(enginePath, src, 'utf8');
console.log('ENGINE_WRITTEN', src.length, 'chars');
