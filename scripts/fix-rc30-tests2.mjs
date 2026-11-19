// rc.30：把 rc25/female-records 里 currentGoal 相关断言迁到三层心绪链
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const apply = (file, pairs) => {
  const p = path.join(root, file);
  let src = fs.readFileSync(p, 'utf8');
  for (const [from, to, want = 1] of pairs) {
    const count = src.split(from).length - 1;
    if (count !== want) throw Error(`${file}: expected ${want} for "${from.slice(0, 40)}", got ${count}`);
    src = src.split(from).join(to);
  }
  fs.writeFileSync(p, src, 'utf8');
  console.log('OK', file);
};

apply('tests/rc25-body-economy.test.mjs', [
  ['assert.match(cupSeeded.physiology.vaginaState,/名器级/);',
   "assert(cupSeeded.physiology.vaginaState.length>0&&!/未经人事|处子/.test(cupSeeded.physiology.vaginaState));"],
  ['assert.match(sex.state.characters.char_a.physiology.vaginaState,/刚经受强悍肉体充分开发/);',
   'assert.match(sex.state.characters.char_a.physiology.vaginaState,/刚经历亲密交欢|刚经受强悍肉体充分开发/);'],
  ["assert(score.includes('饱满馒头穴')&&score.includes('abilityComment'));",
   "assert(score.includes('abilityComment')&&score.includes('hiddenScar'));"],
  ["currentGoal:'月底要凑齐店铺续租的押金'","recentGoal:'月底要凑齐店铺续租的押金',longTermDream:'开一家自己说了算的独立工作室',hiddenScar:'早年合伙被背刺，从此不肯再轻信承诺'"],
  ["assert(expanded.includes('🎯 眼下心事：月底要凑齐店铺续租的押金')&&expanded.includes('goal-card'));",
   "assert(expanded.includes('🎯 近期目标：月底要凑齐店铺续租的押金')&&expanded.includes('goal-card'));\n  assert(!expanded.includes('早年合伙被背刺'),'暗伤伏笔不渲染');"],
]);

apply('tests/female-records.test.mjs', [
  ["['affection','aliases','corruption','currentGoal','id','name','offscreen','relationshipLabel','starred','trackingState']",
   "['affection','aliases','corruption','hiddenScar','id','name','offscreen','recentGoal','relationshipLabel','starred','trackingState']"],
]);
console.log('BATCH2_OK');
