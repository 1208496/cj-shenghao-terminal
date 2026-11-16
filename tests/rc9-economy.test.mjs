import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {fresh,draft,contact,payment,score,event,envelope,source,anchor,profiles} from './fixtures.mjs';
import {applyEnvelope,applyOperation,poolParts,wealthTier,beautyTier,cents,canWithdraw,withdrawalQuote,recoveryDue,assertState,clone,validateDraft} from '../src/core/engine.js';
import {consumptionHistory} from '../src/core/consumption.js';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,replayPlayerCommand} from '../src/runtime/settlement.js';
const run=(s,events,n=2,body=source)=>applyEnvelope(s,envelope(...events),anchor(n),body);
const op=(s,operationId='w',type='PLAYER_WITHDRAW',personRef='char_a')=>applyOperation(s,{operationId,type,personRef,expectedRevision:s.meta.revision},anchor(99));
const refund=(amount,extra={})=>event('TRANSACTION_REFUND',{factId:'refund_'+amount,refundOf:'pay_1',amountCents:amount,completed:true,...extra});
const schemas=createSchema(z),native=s=>schemas.state.parse(completeInitialState(s,{startDate:'2026-11-16',startTime:'09:00'}));
for(const [cash,multiplier] of [[0,10],[999999999,10],[1000000000,8],[9999999999,8],[10000000000,5],[99999999999,5],[100000000000,3],[999999999999,3],[1000000000000,1]])test('现金倍率边界 '+cash,()=>assert.equal(wealthTier(cash).multiplier,multiplier));
test('提现前锁倍率，到账跨级，历史不重算，消费可降级',()=>{
 let s=run(fresh({initialCashCents:900000000}),[score({score:100})]);s=op(s);assert.equal(s.user.cashCents,1000000000);assert.equal(s.withdrawals.w.multiplier,10);assert.equal(wealthTier(s.user.cashCents).multiplier,8);assert.equal(poolParts(s,'char_a').total,0);
 s=run(s,[payment({amountCents:100,allocations:[{personRef:'char_a',amountCents:100}]})],3);assert.equal(wealthTier(s.user.cashCents).multiplier,10);s=op(s,'w2');assert.equal(s.withdrawals.w2.multiplier,10);assert.equal(s.withdrawals.w.paidCents,100000000);
});
test('同一女性三期提款，空池不能领，事实与操作重试不重发',()=>{
 let s=fresh();assert(!canWithdraw(s,'char_a'));
 for(let i=0;i<3;i++){s=run(s,[payment({factId:'pay_'+i})],i+2);assert.equal(poolParts(s,'char_a').total,30000);s=op(s,'w'+i);const cash=s.user.cashCents;s=op(s,'w'+i);s=run(s,[payment({factId:'pay_'+i})],i+20);assert.equal(s.user.cashCents,cash);assert.equal(poolParts(s,'char_a').total,0);assert.throws(()=>op(s,'empty_'+i),/WITHDRAWAL_LOCKED/);}
 assert.equal(Object.keys(s.withdrawals).length,3);assert.equal(consumptionHistory(s,'char_a').count,3);assert.equal(s.user.cashCents,10810000);assertState(s);
});
test('单次已领消费部分退款按原倍率追索，新的低倍率提款抵扣不足继续留债',()=>{
 let s=op(run(fresh(),[payment()]));const w=clone(s.withdrawals.w);s=run(s,[refund(20000)],3);assert.equal(recoveryDue(s,'char_a'),200000);assert.deepEqual(s.withdrawals.w,w);
 s=run(s,[event('CASH_TRANSACTION',{factId:'salary',kind:'SALARY',direction:'IN',payer:'EMPLOYER',amountYuan:'1亿',completed:true})],4);
 s=run(s,[payment({factId:'pay_2',amountCents:10000,allocations:[{personRef:'char_a',amountCents:10000}]})],5);s=op(s,'w2');assert.equal(s.withdrawals.w2.multiplier,5);assert.equal(s.withdrawals.w2.paidCents,0);assert.equal(recoveryDue(s,'char_a'),150000);assert.equal(s.withdrawals.w.multiplier,10);
 s=run(s,[refund(10000,{factId:'rest'})],6);assert.equal(recoveryDue(s,'char_a'),250000);assertState(s);
});
test('未领退款与分摊累计取整，1分多次退款不留虚假奖池',()=>{
 let s=run(fresh(),[payment({amountCents:3,allocations:[{personRef:'char_a',amountCents:2}]})]);
 for(let i=0;i<3;i++)s=run(s,[refund(1,{factId:'r'+i})],3+i);
 assert.equal(poolParts(s,'char_a').total,0);assert.equal(consumptionHistory(s,'char_a').rows[0].netAllocatedCents,0);assert.equal(s.user.cashCents,10000000);
});
test('多人消费明确退款仅冲正目标人物，不影响另一人的已领历史',()=>{
 let s=run(fresh({contacts:[contact(),contact('char_b')]}),[payment({allocations:[{personRef:'char_a',amountCents:10000},{personRef:'char_b',amountCents:20000}]})]);s=op(s,'wa');s=op(s,'wb','PLAYER_WITHDRAW','char_b');
 s=run(s,[refund(10000,{refundAllocations:[{personRef:'char_a',amountYuan:'100'}]})],3);assert.equal(recoveryDue(s,'char_a'),100000);assert.equal(recoveryDue(s,'char_b'),0);assert.equal(consumptionHistory(s,'char_b').rows[0].netAllocatedCents,20000);
 assert.throws(()=>run(s,[refund(20001,{factId:'bad'})],4),/REFUND_EXCEEDS_PAYMENT/);
});
test('隐藏期现金历史可查且奖励为零，恢复不补发，简易档案无需九类',()=>{
 let s=op(fresh(),'hide','PLAYER_HIDE');s=run(s,[payment({itemName:'晚餐双人套餐',merchantOrPlace:'社区餐馆'})]);s=op(s,'restore','PLAYER_RESTORE');const h=consumptionHistory(s,'char_a');assert.equal(h.rows[0].itemName,'晚餐双人套餐');assert.equal(h.paidCents,30000);assert.equal(h.pendingSpendCents,0);assert.equal(s.characters.char_a.profileFixed,null);
});
test('现买礼物资产与已有资产转赠各只入池一次，全额退货核对产权',()=>{
 let s=run(fresh(),[payment({kind:'VEHICLE_PURCHASE',allocations:[],asset:{assetId:'car',kind:'CAR',name:'小车'}})]);
 s=run(s,[event('ASSET_TRANSFER',{factId:'transfer',assetId:'car',personRef:'char_a',completed:true})],3);const h=consumptionHistory(s,'char_a');assert.equal(h.count,1);assert.equal(h.paidCents,0);assert.equal(h.netAllocatedCents,30000);assert.equal(s.user.cashCents,9970000);
 s=op(s);assert.throws(()=>run(s,[refund(30000,{returnedAsset:true})],4),/ASSET_RETURN_NOT_OWNED/);s=run(s,[refund(30000,{returnedAsset:true,receivedBack:true})],4);assert.equal(s.finance.assets.car.status,'RETURNED');assert.equal(recoveryDue(s,'char_a'),300000);assert.equal(consumptionHistory(s,'char_a').rows[0].status,'已退款');
 let direct=run(fresh(),[payment({asset:{assetId:'watch',kind:'LUXURY',name:'腕表',ownerId:'char_a'}})]);assert.equal(consumptionHistory(direct,'char_a').paidCents,30000);assert.equal(poolParts(direct,'char_a').spend,30000);
});
for(const [v,result] of [['¥88',8800],['88.50',8850],['1万',1000000],['￥1.25亿元',12500000000]])test('元字符串 '+v,()=>assert.equal(cents(v),result));
for(const v of ['1万亿','1,000','1.001万','1e5','90071992547410'])test('拒绝歧义或溢出元金额 '+v,()=>assert.throws(()=>cents(v)));
test('金额双单位冲突、乘法和余额溢出都不半写账',()=>{
 const s=fresh(),saved=JSON.stringify(s);assert.throws(()=>run(s,[payment({amountYuan:'88'})]),/AMBIGUOUS_MONEY/);assert.equal(JSON.stringify(s),saved);
 let huge=run(fresh({initialCashCents:Number.MAX_SAFE_INTEGER}),[score({score:100})]);const before=JSON.stringify(huge);assert.throws(()=>op(huge),/MONEY_OVERFLOW/);assert.equal(JSON.stringify(huge),before);
 let max=run(fresh({initialCashCents:Number.MAX_SAFE_INTEGER}),[payment({amountCents:Number.MAX_SAFE_INTEGER,allocations:[{personRef:'char_a',amountCents:Number.MAX_SAFE_INTEGER}]})]);assert.throws(()=>op(max),/MONEY_OVERFLOW/);
});
for(const [score,modifier] of [[1,-2],[19,-2],[20,-1],[49,-1],[50,0],[69,0],[70,1],[89,1],[90,2],[100,2]])test('颜值边界 '+score,()=>assert.equal(beautyTier(score).modifier,modifier));
for(const [beauty,expected] of [[15,1],[40,2],[60,3],[80,4],[95,5]])test('前期基础+3按颜值修正 '+beauty,()=>{
 let s=run(fresh({beautyScore:beauty,contacts:[contact('char_a',{affection:35})]}),[event('AFFECTION_CHANGE',{personRef:'char_a',delta:3,meaningfulInteraction:true})]);assert.equal(s.characters.char_a.affection,35+expected);
 s=run(fresh({beautyScore:beauty,contacts:[contact('char_a',{affection:70})]}),[event('AFFECTION_CHANGE',{personRef:'char_a',delta:3,meaningfulInteraction:true})]);assert.equal(s.characters.char_a.affection,73);
});
test('低颜值不反扣、负向不额外减、无互动不加、同轮总限12',()=>{
 let s=fresh({beautyScore:15,contacts:[contact('char_a',{affection:35})]});s=run(s,[event('AFFECTION_CHANGE',{personRef:'char_a',delta:1,meaningfulInteraction:true})]);assert.equal(s.characters.char_a.affection,35);s=run(s,[event('AFFECTION_CHANGE',{personRef:'char_a',delta:-3})],3);assert.equal(s.characters.char_a.affection,32);assert.throws(()=>run(s,[event('AFFECTION_CHANGE',{personRef:'char_a',delta:1})],4),/AFFECTION_INTERACTION_MISSING/);
 s=fresh({beautyScore:100,contacts:[contact('char_a',{affection:35})]});s=run(s,[event('AFFECTION_CHANGE',{personRef:'char_a',delta:8,meaningfulInteraction:true}),event('AFFECTION_CHANGE',{ordinal:1,personRef:'char_a',delta:7,meaningfulInteraction:true})]);assert.equal(s.characters.char_a.affection,47);
});
test('重大转折统一入口上限30，短证据拒绝，原生直接值与队列不双加',()=>{
 const before=native(fresh({beautyScore:95,contacts:[contact('char_a',{affection:35})]})),candidate=clone(before),body='她认真听完了你的解释，终于放下了持续多年的误会。';
 candidate.characters.char_a.affection=55;candidate.characters.char_a.affectionEvidence=body;candidate.characters.char_a.meaningfulInteraction=true;candidate.characters.char_a.majorTurningPoint=true;
 assert.equal(settleNative(before,candidate,anchor(),body,schemas).state.characters.char_a.affection,57);
 candidate.pendingEvents=[event('AFFECTION_CHANGE',{personRef:'char_a',delta:3,meaningfulInteraction:true,evidence:body})];assert.equal(settleNative(before,candidate,anchor(),body,schemas).state.characters.char_a.affection,40);
 assert.throws(()=>run(before,[event('AFFECTION_CHANGE',{personRef:'char_a',delta:20,majorTurningPoint:true,meaningfulInteraction:true})]),/TURNING_POINT_EVIDENCE_MISSING/);
});
test('缺失好感或关系证据可观察，不静默写入；正式颜值与玩家颜值受保护',()=>{
 const before=native(fresh()),candidate=clone(before);candidate.characters.char_a.affection=95;candidate.characters.char_a.relationshipLabel='恋人';candidate.characters.char_a.beautyScore=1;candidate.user.beautyScore=100;
 const r=settleNative(before,candidate,anchor(),source,schemas);assert.equal(r.state.characters.char_a.affection,90);assert.equal(r.state.characters.char_a.beautyScore,70);assert.equal(r.state.user.beautyScore,60);assert.equal(r.diagnostics.length,2);
 candidate.characters.char_a.relationshipEvidence=source;assert.equal(settleNative(before,candidate,anchor(),source,schemas).state.characters.char_a.relationshipLabel,'恋人');
});
test('原生重解析提款同时锁定池、倍率、追回额，不能用变化后现金重算',()=>{
 const s=run(native(fresh()),[payment()]);const command={kind:'action',value:{type:'PLAYER_WITHDRAW',operationId:'w',personRef:'char_a'},expectedPoolCents:30000,expectedQuote:withdrawalQuote(s,'char_a')};const changed=run(s,[event('CASH_TRANSACTION',{factId:'income',direction:'IN',kind:'SALARY',payer:'COMPANY',amountYuan:'1000万',completed:true})],3);assert.throws(()=>replayPlayerCommand(changed,command,anchor(),schemas),/WITHDRAWAL_REVIEW_REQUIRED/);
 const result=replayPlayerCommand(s,command,anchor(),schemas);assert.deepEqual(replayPlayerCommand(result,command,anchor(),schemas),result);
});
test('自动事实ID去重，伪造领取归属或历史倍率被不变量拒绝',()=>{
 let s=run(fresh(),[payment({factId:undefined})]);s=run(s,[payment({factId:undefined,ordinal:1})]);assert.equal(Object.keys(s.finance.ledger).length,1);s=op(s);const bad=clone(s);bad.withdrawals.w.multiplier=8;assert.throws(()=>assertState(bad),/WITHDRAWAL_MISMATCH/);const bad2=clone(s);Object.values(bad2.rewardEvents)[0].claimedCents++;assert.throws(()=>assertState(bad2),/INVALID_INTEGER|REWARD_CLAIM_MISMATCH/);
});
test('200笔消费分页和100轮多女性结算保持单账一致',()=>{
 let s=fresh({contacts:[contact(),contact('char_b')]});
 for(let i=0;i<100;i++){s=run(s,[payment({factId:'p'+i,amountCents:1000,allocations:[{personRef:'char_a',amountCents:500},{personRef:'char_b',amountCents:500}]}),payment({ordinal:1,factId:'q'+i,amountCents:100,allocations:[{personRef:'char_a',amountCents:100}]})],i+2);s=op(s,'wa'+i);s=op(s,'wb'+i,'PLAYER_WITHDRAW','char_b');}
 const a=consumptionHistory(s,'char_a',{page:9}),b=consumptionHistory(s,'char_b');assert.equal(a.count,200);assert.equal(a.rows.length,20);assert.equal(a.pages,10);assert.equal(a.netAllocatedCents,60000);assert.equal(b.netAllocatedCents,50000);assert.equal(a.withdrawnCents+b.withdrawnCents,1100000);assert.equal(s.user.cashCents,10990000);assertState(s);schemas.state.parse(native(s));
});
for(const value of [0,101,1.2,null,'',undefined])test('开局颜值无效 '+String(value),()=>assert.throws(()=>validateDraft(draft({beautyScore:value}))));
