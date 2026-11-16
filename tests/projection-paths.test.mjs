import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {projection,clone} from '../src/core/engine.js';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,refreshContext,settleNative} from '../src/runtime/settlement.js';
import {fresh,contact,anchor} from './fixtures.mjs';
import {hostBinding} from './host-binding-harness.mjs';

test('projected character IDs and displayed field names resolve against the real variable tree',()=>{
 const s=createSchema(z).state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'})),p=projection(s);assert.equal(p.people,undefined);assert(!Array.isArray(p.characters));
 for(const [cid,c] of Object.entries(p.characters)){
  assert.equal(cid,c.id);assert.deepEqual(Object.keys(c).filter(k=>!(k in s.characters[cid])),[]);
  assert.equal(c.relationship,undefined);assert.equal(c.hidden,undefined);
 }
});
test('copying a displayed character path updates pose, action, expression and mood alongside rewards',async()=>{
 const s=createSchema(z).state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
 const [cid]=Object.keys(JSON.parse(refreshContext(s)._context).characters);
 const h=await hostBinding({sourceAnchor:anchor(),body:'她站在门边笑着挥手，声音轻快。'});h.bind();
 const fields={currentPose:'站在门边',currentAction:'挥手',currentExpression:'笑着',currentMood:'轻快'};
 const patches=Object.fromEntries(Object.entries(fields).map(([k,v])=>['characters.'+cid+'.'+k,v]));
 patches['characters.'+cid+'.affection']=92;patches.pendingEvents=[{type:'AFFECTION_CHANGE',personRef:cid,delta:2,meaningfulInteraction:true,evidence:'她站在门边笑着挥手，声音轻快。'}];
 const {vars}=await h.run(s,patches);assert.deepEqual(h.diagnostics(),[]);
 for(const [k,v] of Object.entries(fields))assert.equal(vars.stat_data.shenghao.characters[cid][k],v);
 assert.equal(vars.stat_data.shenghao.characters[cid].affection,92);
});
test('scene ordering cannot change a projected character identity',()=>{
 const s=fresh({contacts:[contact('char_a'),contact('char_b')]});
 s.scene.presentCharacterIds.reverse();const p=projection(s);
 assert.equal(p.characters.char_a.name,s.characters.char_a.name);assert.equal(p.characters.char_b.name,s.characters.char_b.name);
});
test('refund context identifies the car payment instead of an unrelated small meal fact',()=>{
 const schemas=createSchema(z),s=schemas.state.parse(completeInitialState(fresh({initialCashCents:30000000}),{startDate:'2026-01-05',startTime:'09:00'})),p=clone(s);
 p.pendingEvents=[{type:'CASH_TRANSACTION',kind:'DINING',direction:'OUT',payer:'USER',completed:true,amountYuan:'80',itemName:'午餐',evidence:'支付成功'},
 {type:'CASH_TRANSACTION',kind:'VEHICLE_PURCHASE',direction:'OUT',payer:'USER',completed:true,amountYuan:'200000',itemName:'代步轿车',asset:{assetId:'car_new',kind:'CAR',name:'代步轿车'},evidence:'支付成功'}];
 const bought=settleNative(s,p,anchor(),'支付成功',schemas).state,context=projection(bought);
 const car=context.recentFacts.find(f=>f.assetId==='car_new');assert.equal(car.amountCents,20000000);assert.equal(car.itemName,'代步轿车');assert.equal(car.type,'CASH_TRANSACTION');
 const refund=clone(bought);refund.pendingEvents=[{type:'TRANSACTION_REFUND',refundOf:car.factId,amountYuan:'200000',completed:true,returnedAsset:true,evidence:'退款到账'}];
 const r=settleNative(bought,refund,anchor(3),'退款到账',schemas);assert.deepEqual(r.diagnostics,[]);assert.equal(r.state.user.cashCents,29992000);assert.equal(r.state.finance.assets.car_new.status,'RETURNED');
 assert(context.recentFacts.length<=60);
});
