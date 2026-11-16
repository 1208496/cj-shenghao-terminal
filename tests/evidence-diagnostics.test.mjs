import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {clone,hasEvidence} from '../src/core/engine.js';
import {diagnosticMessage} from '../src/runtime/diagnostics.js';
import {fresh,anchor} from './fixtures.mjs';
// Minimal verbatim excerpts supplied by the user; no private full conversation.
const quote='北辰跟在她身后两三步的距离，迈过木质台阶走进了这家熟悉的社区咖啡馆。';
const body=quote+'\n乔沐端着盛满热咖啡的陶杯走过来，将其中一只轻轻放在北辰面前的木桌上。';
const summary='应邀进店坐下喝咖啡，自然地与乔沐闲聊找工作的事';
const schemas=createSchema(z);
function settle(evidence){
 // Use an existing test character with ordinary early-stage affection.
 const withPerson=schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
 withPerson.characters.char_a.affection=35;
 const candidate=clone(withPerson);candidate.world.time='09:08';candidate.scene.location='江城区·社区咖啡馆';
 candidate.characters.char_a.affection=37;candidate.pendingEvents=[{type:'AFFECTION_CHANGE',personRef:'char_a',delta:2,meaningfulInteraction:true,evidence}];
 return {before:withPerson,...settleNative(withPerson,candidate,anchor(6),body,schemas)};
}
test('reported affection paraphrase no longer blocks the direct value, scene or clock',()=>{
 assert.equal(hasEvidence(body,summary),false);
 const result=settle(summary);assert.equal(result.state.characters.char_a.affection,37);
 assert.equal(result.state.world.time,'09:08');assert.equal(result.state.scene.location,'江城区·社区咖啡馆');
 assert.deepEqual(result.diagnostics,[]);
});
test('direct quote permits the same affection event without changing money',()=>{
 const result=settle(quote);assert.deepEqual(result.diagnostics,[]);assert.equal(result.state.characters.char_a.affection,37);
 assert.equal(result.state.user.cashCents,result.before.user.cashCents);
 assert.equal(hasEvidence(body,quote.replace('咖啡馆','银行')),false);
});
test('diagnostic text explains evidence failure and keeps mixed failures visible',()=>{
 assert.equal(diagnosticMessage([]),'');
 assert(diagnosticMessage([{eventType:'CASH_TRANSACTION',code:'EVIDENCE_NOT_IN_SOURCE'}]).includes('直接摘录'));
 const mixed=diagnosticMessage([{eventType:'CASH_TRANSACTION',code:'EVIDENCE_NOT_IN_SOURCE'},{eventType:'CASH_TRANSACTION',code:'INVALID_MONEY'}]);
 assert(mixed.includes('EVIDENCE_NOT_IN_SOURCE'));assert(mixed.includes('INVALID_MONEY'));
});
