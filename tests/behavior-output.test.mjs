import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {poolParts} from '../src/core/engine.js';
import {fresh,anchor,payment} from './fixtures.mjs';
import {hostBinding,events} from './host-binding-harness.mjs';
const protocol=await fs.readFile(new URL('../src/content/protocol.txt',import.meta.url),'utf8');
const example=JSON.parse([...protocol.matchAll(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/g)].at(-1)[1]);
const pendingPatch=example.find(op=>String(op.path).endsWith('/pendingEvents'));
const body='她请北辰帮忙搬开堵住通道的花桶。北辰将花桶搬到墙边，替她腾出了通道。‘这下好走多了，谢谢你。’她说。';
const initial=()=>{const s=createSchema(z).state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));s.characters.char_a.affection=45;return s;};
function proposed(){return pendingPatch.value.map(e=>({...e,personRef:'char_a'}));}

test('the maintained mixed output example records a behavior reward and affection in one native update',async()=>{
 const h=await hostBinding({body,sourceAnchor:anchor()});h.bind();const {vars,oldVars}=await h.run(initial(),{'characters.char_a.affection':47,pendingEvents:proposed()});
 const state=vars.stat_data.shenghao;assert.deepEqual(h.diagnostics(),[]);
 assert.equal(state.characters.char_a.affection,47);assert.equal(poolParts(state,'char_a').crit,30000000);
 assert(Object.values(state.facts).some(f=>f.type==='SIGNIFICANT_BEHAVIOR_SCORE'));
 await h.bus.emit(events.VARIABLE_UPDATE_ENDED,vars,oldVars);assert.equal(poolParts(vars.stat_data.shenghao,'char_a').crit,30000000);
});
test('score below the existing award threshold records the fact and grants zero',async()=>{
 const h=await hostBinding({body,sourceAnchor:anchor()});h.bind();const queue=proposed();queue[0].score=20;
 const {vars}=await h.run(initial(),{pendingEvents:queue});assert.deepEqual(h.diagnostics(),[]);
 assert(Object.values(vars.stat_data.shenghao.facts).some(f=>f.type==='SIGNIFICANT_BEHAVIOR_SCORE'));
 assert.equal(poolParts(vars.stat_data.shenghao,'char_a').crit,0);
});
test('duplicate scoring for one person cannot add a second reward',async()=>{
 const refusal='他伸手摸她的头，她避开并说：“别摸我的头。”';
 const h=await hostBinding({body:body+refusal,sourceAnchor:anchor()});h.bind();const queue=proposed();
 queue.push({...queue[0],action:'摸头',consensual:false,evidence:refusal});
 const {vars}=await h.run(initial(),{pendingEvents:queue});assert.equal(poolParts(vars.stat_data.shenghao,'char_a').crit,30000000);
 assert.deepEqual(h.diagnostics(),[]);
});
test('payment and independent behavioral response use separate pools in the same update',async()=>{
 const h=await hostBinding({body,sourceAnchor:anchor()});h.bind();const {vars}=await h.run(initial(),{pendingEvents:[payment({evidence:body}),...proposed()]});
 assert.deepEqual(h.diagnostics(),[]);assert.deepEqual(poolParts(vars.stat_data.shenghao,'char_a'),{spend:30000,crit:30000000,total:30030000});
});
