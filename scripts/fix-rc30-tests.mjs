// rc.30：按新规则（普通外貌熟识后 +1 真心补偿、单日 45 万软上限）同步既有断言
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const edits = [
  ['tests/interaction-simplification.test.mjs', 'assert.equal(s.characters.char_a.affection,56);', 'assert.equal(s.characters.char_a.affection,58);'],
  ['tests/interaction-simplification.test.mjs',
    "assert(inRange(poolParts(r.state,'char_a').crit,50000000,120000000));",
    "const capped=poolParts(r.state,'char_a').crit;assert(capped>0&&capped<=45000000,capped);"],
  ['tests/interaction-simplification.test.mjs', 'assert.equal(c.affection,60);', 'assert.equal(c.affection,61);'],
  ['tests/interaction-simplification.test.mjs', 'assert.equal(r.state.characters.char_a.affection,55);', 'assert.equal(r.state.characters.char_a.affection,56);'],
  ['tests/host-binding.test.mjs', 'assert.equal(vars.stat_data.shenghao.characters.char_a.affection,53);', 'assert.equal(vars.stat_data.shenghao.characters.char_a.affection,54);', 2],
  ['tests/host-binding.test.mjs', 'assert.equal(second.vars.stat_data.shenghao.characters.char_a.affection,53);', 'assert.equal(second.vars.stat_data.shenghao.characters.char_a.affection,54);'],
];

for (const [file, from, to, expectCount] of edits) {
  const p = path.join(root, file);
  let src = fs.readFileSync(p, 'utf8');
  const count = src.split(from).length - 1;
  const want = expectCount ?? 1;
  if (count !== want) throw Error(`${file}: expected ${want} match for "${from.slice(0, 50)}", got ${count}`);
  src = src.split(from).join(to);
  fs.writeFileSync(p, src, 'utf8');
  console.log('OK', file, '->', to.slice(0, 60));
}
console.log('BATCH_OK');
