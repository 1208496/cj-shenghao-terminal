import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {clone,poolParts,assertState} from '../src/core/engine.js';
import {diagnosticMessage} from '../src/runtime/diagnostics.js';
import {fresh,anchor,payment,score,source} from './fixtures.mjs';
const schemas=createSchema(z);
const initial=()=>{const s=schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));s.characters.char_a.affection=40;return s;};
const affection=(extra={})=>({type:'AFFECTION_CHANGE',personRef:'char_a',delta:5,meaningfulInteraction:true,evidence:source,...extra});
const settle=(before,candidate)=>settleNative(before,candidate,anchor(),source,schemas);

test('one native batch commits valid affection/payment/score with one revision and does not mutate inputs',()=>{
 const before=initial(),candidate=clone(before);candidate.characters.char_a.affection=45;candidate.pendingEvents=[affection(),payment(),score()];
 const snapshot=clone(candidate),r=settle(before,candidate);
 assert.deepEqual(r.diagnostics,[]);assert.equal(r.state.meta.revision,before.meta.revision+1);
 assert.equal(r.state.characters.char_a.affection,45);assert.equal(poolParts(r.state,'char_a').total,830000);
 assert(Object.values(r.state.operationHistory).every(op=>op.revision===r.state.meta.revision));
 assert.deepEqual(candidate,snapshot);assert.equal(before.characters.char_a.affection,40);assertState(r.state);
 const retry=clone(r.state);retry.pendingEvents=clone(candidate.pendingEvents);
 const repeated=settle(r.state,retry).state;
 assert.equal(repeated.characters.char_a.affection,45);assert.deepEqual(repeated.finance,r.state.finance);assert.deepEqual(repeated.rewardEvents,r.state.rewardEvents);
});
test('bad narrative fields retain their own prior values without cancelling affection, scene or time',()=>{
 const before=initial();before.characters.char_a.appearance='';
 const candidate=clone(before);candidate.characters.char_a.appearance='字'.repeat(501);candidate.characters.char_a.currentMood={bad:true};
 candidate.world.time='09:10';candidate.scene.location='楼梯间';candidate.characters.char_a.affection=45;candidate.pendingEvents=[affection()];
 const r=settle(before,candidate);
 assert.equal(r.state.characters.char_a.affection,45);assert.equal(r.state.characters.char_a.appearance,'');assert.equal(r.state.characters.char_a.currentMood,'');
 assert.equal(r.state.world.time,'09:10');assert.equal(r.state.scene.location,'楼梯间');
 assert.deepEqual(r.diagnostics.map(d=>d.field),['characters.char_a.appearance','characters.char_a.currentMood']);
 assert(r.diagnostics.every(d=>d.code==='INVALID_FIELD'));assertState(r.state);
});
test('transport accepts mixed proposals and only invalid events are rejected by settlement',()=>{
 const before=initial(),candidate=clone(before);
 candidate.characters.char_a.affection=45;candidate.pendingEvents=[affection(),null,score({reason:''}),affection({delta:3}),{type:'SCENE_REPLACE',evidence:source}];
 const r=settle(before,schemas.state.parse(candidate));
 assert.equal(r.state.characters.char_a.affection,45);assert.equal(poolParts(r.state,'char_a').total,800000);
 assert.deepEqual(r.diagnostics.map(d=>[d.ordinal,d.code,d.field]),[[1,'INVALID_EVENT',undefined],[4,'UNKNOWN_EVENT',undefined]]);
 assert.equal(r.state.pendingEvents.length,0);assert.equal(diagnosticMessage(r.diagnostics),'');
});
test('economic event failure after tentative writes rolls back cash, ledger, facts and rewards only for that event',()=>{
 const before=initial(),candidate=clone(before);
 // Invalid ledger memo fails after the payment has tentatively debited cash.
 candidate.characters.char_a.affection=45;candidate.pendingEvents=[payment({memo:'字'.repeat(361)}),affection(),score()];
 const r=settle(before,candidate);
 assert.equal(r.diagnostics.length,1);assert.equal(r.state.user.cashCents,before.user.cashCents);
 assert.deepEqual(r.state.finance.ledger,{});assert.equal(r.state.facts.pay_1,undefined);
 assert.equal(r.state.characters.char_a.affection,45);assert.equal(poolParts(r.state,'char_a').total,800000);assertState(r.state);
});
test('invalid money evidence reports the field while direct affection still settles',()=>{
 const before=initial(),candidate=clone(before);candidate.characters.char_a.affection=43;candidate.pendingEvents=[payment({evidence:13})];
 const r=settle(before,schemas.state.parse(candidate));assert.equal(r.state.characters.char_a.affection,43);
 assert.equal(r.diagnostics[0].field,'evidence');assert.equal(r.diagnostics[0].ordinal,0);assert(diagnosticMessage(r.diagnostics).includes('evidence'));
});
test('schema and engine agree on profile limits; removed alternate affection fields are absent',()=>{
 const s=initial();s.characters.char_a.appearance='字'.repeat(500);s.characters.char_a.personalityTags=['温和'];
 assertState(schemas.state.parse(s));s.characters.char_a.appearance+='字';assert.equal(schemas.state.safeParse(s).success,false);
 assert.equal(schemas.character.shape.affectionEvidence,undefined);assert.equal(schemas.character.shape.meaningfulInteraction,undefined);assert.equal(schemas.character.shape.majorTurningPoint,undefined);
});
