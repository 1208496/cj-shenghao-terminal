import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {clone,poolParts} from '../src/core/engine.js';
import {diagnosticMessage} from '../src/runtime/diagnostics.js';
import {fresh,contact,anchor,payment,source} from './fixtures.mjs';
import {hostBinding,events} from './host-binding-harness.mjs';
const schemas=createSchema(z);
const initial=(contacts=[contact('char_a',{affection:50})])=>schemas.state.parse(completeInitialState(fresh({contacts}),{startDate:'2026-01-05',startTime:'09:00'}));
const behavior=(personRef='char_a',score=50)=>({type:'BEHAVIOR',personRef,action:'实际帮助',score});

test('four-field behavior accepts help and gift response across rounds without evidence or flags',()=>{
 let s=initial();
 for(const n of [2,3]){const p=clone(s);p.characters.char_a.affection=s.characters.char_a.affection+3;p.pendingEvents=[behavior()];const r=settleNative(s,p,anchor(n),'',schemas);assert.deepEqual(r.diagnostics,[]);s=r.state;}
 assert.equal(s.characters.char_a.affection,56);assert.equal(poolParts(s,'char_a').crit,100000);assert.equal(s.user.cashCents,10000000);
});
test('first three distinct people retain awards, repeated person cannot use new ID or score to award twice',()=>{
 const s=initial(['a','b','c','d'].map(x=>contact('char_'+x))),p=clone(s);
 p.pendingEvents=[behavior(),behavior('char_a',100),...['b','c','d'].map(x=>behavior('char_'+x))];
 const r=settleNative(s,p,anchor(),'',schemas);assert.deepEqual(r.diagnostics,[]);
 for(const cid of ['char_a','char_b','char_c'])assert.equal(poolParts(r.state,cid).crit,50000);assert.equal(poolParts(r.state,'char_d').crit,0);
 const retry=clone(r.state);retry.pendingEvents=[{...behavior('char_a',100),factId:'new_fact'}];
 assert.deepEqual(settleNative(r.state,retry,anchor(),'',schemas).state.rewardEvents,r.state.rewardEvents);
});
test('score clamps and optional long text truncates while malformed extras are ignored',()=>{
 const s=initial(),p=clone(s);p.pendingEvents=[{...behavior('char_a',180),action:'字'.repeat(100),reason:'字'.repeat(500),allocations:{bad:true}}];
 const r=settleNative(s,p,anchor(),'',schemas);assert.deepEqual(r.diagnostics,[]);assert.equal(poolParts(r.state,'char_a').crit,10000000);
 assert.equal(Object.values(r.state.rewardEvents)[0].title.length,80);
 const low=clone(s);low.pendingEvents=[behavior('char_a',-10)];assert.equal(poolParts(settleNative(s,low,anchor(),'',schemas).state,'char_a').crit,0);
});
test('knownFacts arrays pass schema transport and invalid current state silently retains its old value in real host callbacks',async()=>{
 const h=await hostBinding({sourceAnchor:anchor(),body:source});h.bind();const s=initial();
 const {vars,oldVars}=await h.run(s,{'characters.char_a.knownFacts':['已知经历','本轮帮助'],'characters.char_a.currentMood':{bad:true},'characters.char_a.relationshipLabel':'熟悉的朋友','characters.char_a.affection':60,pendingEvents:[{type:'AFFECTION_CHANGE',personRef:'char_a',delta:5,auto:true},behavior()]});
 const c=vars.stat_data.shenghao.characters.char_a;assert.equal(c.knownFacts,'已知经历；本轮帮助');assert.equal(c.currentMood,'');assert.equal(c.relationshipLabel,'熟悉的朋友');assert.equal(c.affection,60);assert.deepEqual(h.diagnostics(),[]);
 const snapshot=JSON.stringify(vars);await h.bus.emit(events.VARIABLE_UPDATE_ENDED,vars,oldVars);assert.equal(JSON.stringify(vars),snapshot);
 assert.equal(schemas.character.parse({...c,knownFacts:['a','b']}).knownFacts,'a；b');
});
test('bad money evidence remains visible while direct affection and behavior commit',()=>{
 const s=initial(),p=clone(s);p.characters.char_a.affection=55;p.pendingEvents=[payment({evidence:'正文没有这句话'}),behavior()];
 const r=settleNative(s,p,anchor(),source,schemas);assert.equal(r.state.user.cashCents,s.user.cashCents);assert.equal(r.state.characters.char_a.affection,55);assert.equal(poolParts(r.state,'char_a').crit,50000);
 assert(diagnosticMessage(r.diagnostics).includes('直接摘录'));assert.equal(diagnosticMessage([{code:'INVALID_FIELD',field:'characters.char_a.currentMood'}]),'');
});
test('same-round direct affection reprocessing does not add a second beauty adjustment',()=>{
 const s=initial(),p=clone(s);s.user.beautyScore=95;p.user.beautyScore=95;p.characters.char_a.affection=53;
 const first=settleNative(s,p,anchor(),'',schemas).state,next=clone(first);next.characters.char_a.affection=58;
 assert.equal(first.characters.char_a.affection,55);assert.equal(settleNative(first,next,anchor(),'',schemas).state.characters.char_a.affection,55);
});
