import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,allowModelCommand,commandPath,replayPlayerCommand} from '../src/runtime/settlement.js';
import {clone,poolParts,applyOperation,hasEvidence,applyEnvelope} from '../src/core/engine.js';
import {fresh,profiles,anchor,payment,score,source} from './fixtures.mjs';
const schemas=createSchema(z),initial=()=>schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
test('verbatim evidence permits paragraph formatting and explicit omissions, never rewritten words',()=>{const body='花材整理完成，水桶放回原位。\n\n“给你买的点心。”刚才扫码支付了三百元。';assert(hasEvidence(body,'花材整理完成，水桶放回原位。“给你买的点心。”刚才扫码支付了三百元。'));assert(hasEvidence(body,'花材整理完成，水桶放回原位。……刚才扫码支付了三百元。'));assert(!hasEvidence(body,'花材整理完成，水桶放回原位。……刚才扫码支付了五百元。'));});
test('native JSONPatch bracket paths are accepted while money, root and executable literals are rejected',()=>{
 const before=initial(),cmd=(path,value,type='set')=>({type,args:[path,JSON.stringify(value)]});
 assert.equal(commandPath(cmd('["shenghao"]["world"]["time"]','10:00')),'shenghao.world.time');
 assert(allowModelCommand(cmd('["shenghao"]["world"]["time"]','10:00'),before));
 assert(allowModelCommand({type:'insert',args:['["shenghao"]["characters"]','"char_new"','{}']},before));
 for(const path of ['shenghao.user.cashCents','shenghao.finance','shenghao','other','["shenghao"]["__proto__"]'])assert.equal(allowModelCommand(cmd(path,5),before),false,path);
 assert.equal(allowModelCommand({type:'set',args:['shenghao.world','(()=>{throw 1})()']},before),false);
});
test('scene, clock and current clothes update through native settlement; finances remain script owned',()=>{
 const before=initial(),next=clone(before);next.world.time='09:12';next.scene.location='花店';next.user.currentClothes='浅灰衬衫';next.characters.char_a.affection=94;next.characters.char_a.affectionEvidence=source;next.characters.char_a.meaningfulInteraction=true;
 next.user.cashCents=999999999;next.characters.char_a.withdrawal={status:'COMMITTED'};
 const result=settleNative(before,next,anchor(),source,schemas).state;
 assert.equal(result.world.time,'09:12');assert.equal(result.scene.timeHint,'2026-01-05 09:12');assert.equal(result.user.location,'花店');assert.equal(result.user.currentClothes,'浅灰衬衫');assert.equal(result.characters.char_a.affection,94);assert.equal(result.user.cashCents,before.user.cashCents);assert.equal(result.characters.char_a.withdrawal,undefined);
});
test('valid economic candidates settle once, invalid candidates do not erase scene changes',()=>{
 const before=initial(),next=clone(before);next.world.time='10:30';next.pendingEvents=[payment(),score(),payment({factId:'bad',amountCents:-1})];
 const result=settleNative(before,next,anchor(),source,schemas);
 assert.equal(result.state.user.cashCents,before.user.cashCents-30000);assert.equal(poolParts(result.state,'char_a').total,830000);assert.equal(result.state.world.time,'10:30');assert.equal(result.diagnostics.length,1);
 const again=clone(result.state);again.pendingEvents=[payment(),score()];const replay=settleNative(result.state,again,anchor(3),source,schemas).state;assert.equal(replay.user.cashCents,result.state.user.cashCents);assert.equal(poolParts(replay,'char_a').total,830000);
});
test('formal archive requires real contact and full profile; hidden identities stay frozen',()=>{
 const before=initial(),next=clone(before);next.characters.char_b=schemas.character.parse({id:'char_b',name:'许栀',age:24,beautyScore:75,affection:25,relationshipLabel:'新识',personalityTags:['温和'],appearance:'黑色长发',body:'匀称',heightCm:168,weightKg:52,bustCm:86,waistCm:62,hipCm:89,shoeSizeEu:38,profileFixed:null,contactConfirmed:true,firstContactEvidence:source});next.scene.presentCharacterIds.push('char_b');
 const result=settleNative(before,next,anchor(),source,schemas).state;assert(result.characters.char_b);assert.equal(poolParts(result,'char_b').total,0);
 const hidden=applyOperation(result,{operationId:'hide',type:'PLAYER_HIDE',personRef:'char_b',expectedRevision:result.meta.revision},anchor());const modified=clone(hidden);modified.characters.char_b.affection=100;modified.scene.presentCharacterIds.push('char_b');const out=settleNative(hidden,modified,anchor(4),source,schemas).state;assert.equal(out.characters.char_b.affection,25);assert(!out.scene.presentCharacterIds.includes('char_b'));
 const bad=clone(before);bad.characters.char_b={...next.characters.char_b,firstContactEvidence:'未发生的相识'};assert.equal(settleNative(before,bad,anchor(),source,schemas).state.characters.char_b,undefined);
});
test('real dates, leap days and appointments are validated',()=>{
 assert(schemas.world.safeParse({date:'2028-02-29',time:'23:59'}).success);
 assert(!schemas.world.safeParse({date:'2026-02-29',time:'23:59'}).success);
 assert(!schemas.world.safeParse({date:'2026-04-31',time:'24:00'}).success);
 const s=initial();s.calendar.appointments.appt_a={id:'appt_a',title:'看展',date:'2026-01-06',time:'14:00',location:'美术馆',participants:['char_a'],status:'PLANNED',notes:''};assert.equal(schemas.state.parse(s).calendar.appointments.appt_a.title,'看展');
});
test('confirmed manual withdrawals survive native reprocessing exactly once and reject changed payout',()=>{const s=applyEnvelope(initial(),{schemaVersion:2,events:[payment()]},anchor(),source),command={kind:'action',value:{operationId:'withdraw_native',type:'PLAYER_WITHDRAW',personRef:'char_a'},expectedPoolCents:30000};const saved=replayPlayerCommand(s,command,anchor(),schemas);assert.equal(saved.user.cashCents,s.user.cashCents+300000);assert.equal(replayPlayerCommand(saved,command,anchor(),schemas).user.cashCents,saved.user.cashCents);const changed=clone(s);changed.pendingEvents=[payment({factId:'pay_2',amountCents:40000})];const settled=settleNative(s,changed,anchor(3),source,schemas).state;assert.throws(()=>replayPlayerCommand(settled,command,anchor(),schemas),/WITHDRAWAL_REVIEW_REQUIRED/);});
test('native settlement cannot bypass the three-critical-event limit by processing candidates individually',()=>{const s=initial(),next=clone(s);next.pendingEvents=Array.from({length:4},(_,i)=>score({factId:'limit_'+i}));const result=settleNative(s,next,anchor(),source,schemas);assert.equal(Object.keys(result.state.rewardEvents).length,0);assert.equal(result.diagnostics.length,4);});
