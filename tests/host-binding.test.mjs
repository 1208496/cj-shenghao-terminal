import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {poolParts} from '../src/core/engine.js';
import {fresh,anchor,source,score,inRange} from './fixtures.mjs';
import {hostBinding,eventBus,events} from './host-binding-harness.mjs';
const initial=()=>{const s=createSchema(z).state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));s.characters.char_a.affection=50;return s;};
const affection={type:'AFFECTION_CHANGE',personRef:'char_a',delta:3,meaningfulInteraction:true,evidence:source};
const options={sourceAnchor:anchor(4),body:source};

test('replacing the native API object does not register duplicate global event listeners or roll back settled affection',async()=>{
 const h=await hostBinding(options);h.bind();h.replaceNative();h.bind();
 assert.equal(h.bus.count(events.VARIABLE_UPDATE_ENDED),1);
 const {vars}=await h.run(initial(),{'characters.char_a.affection':53,pendingEvents:[affection]});
 assert.equal(vars.stat_data.shenghao.characters.char_a.affection,53);assert.equal(Object.keys(vars.stat_data.shenghao.facts).length,1);assert.deepEqual(h.diagnostics(),[]);
});
test('a repeated ended notification cannot erase already settled affection or behavior rewards',async()=>{
 const h=await hostBinding(options);h.bind();const {vars,oldVars}=await h.run(initial(),{'characters.char_a.affection':53,pendingEvents:[affection,score()]});
 assert(inRange(poolParts(vars.stat_data.shenghao,'char_a').crit,3500000,9800000));
 const snapshot=JSON.stringify(vars);await h.bus.emit(events.VARIABLE_UPDATE_ENDED,vars,oldVars);
 assert.equal(JSON.stringify(vars),snapshot);assert.deepEqual(h.diagnostics(),[]);
});
test('restarting the terminal leaves only its live callbacks even when the helper stop handle is ineffective',async()=>{
 const bus=eventBus({brokenStop:true}),old=await hostBinding({...options,bus});old.bind();old.dispose();
 const live=await hostBinding({...options,bus});live.bind();
 assert.equal(bus.count(events.COMMAND_PARSED),1);assert.equal(bus.count(events.VARIABLE_UPDATE_ENDED),1);
 const {vars}=await live.run(initial(),{'characters.char_a.affection':53,pendingEvents:[affection,score()]});
 assert.equal(vars.stat_data.shenghao.characters.char_a.affection,53);assert(inRange(poolParts(vars.stat_data.shenghao,'char_a').crit,3500000,9800000));assert.deepEqual(live.diagnostics(),[]);
});
test('a new native transaction after an ended notification still processes new events',async()=>{
 const h=await hostBinding(options);h.bind();const first=await h.run(initial(),{'characters.char_a.affection':53,pendingEvents:[affection]});
 const second=await h.run(first.vars.stat_data.shenghao,{pendingEvents:[score()]});
 assert.equal(second.vars.stat_data.shenghao.characters.char_a.affection,53);assert(inRange(poolParts(second.vars.stat_data.shenghao,'char_a').crit,3500000,9800000));assert.deepEqual(h.diagnostics(),[]);
});
