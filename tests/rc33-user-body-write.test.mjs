import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,allowModelCommand} from '../src/runtime/settlement.js';
import {clone} from '../src/core/engine.js';
import {fresh,anchor} from './fixtures.mjs';
const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));

// rc.33：身高/体重/鞋码是「开局可留空、由模型首轮补」的字段，写入闸门必须放行这三项；
// 其余 user 字段（现金、姓名等）仍由结算独占，模型改不动。
test('rc.33 model may fill the three optional body fields but not other user data',()=>{
  const s=initial();
  for(const [path,value] of [['shenghao.user.heightCm','178'],['shenghao.user.weightKg','70'],['shenghao.user.shoeSizeEu','42']]){
    assert.equal(allowModelCommand({type:'set',args:[path,value]},s),true,path);
  }
  for(const path of ['shenghao.user.cashCents','shenghao.user.name','shenghao.user.genitals.length','shenghao.user.prowessScore','shenghao.user.state']){
    assert.equal(allowModelCommand({type:'set',args:[path,'1']},s),false,path);
  }
});

test('rc.33 blank body fields are filled once and a filled value is never overwritten',()=>{
  let s=initial();
  assert.equal(s.user.heightCm,null);
  const p=clone(s);
  p.user.heightCm=178;p.user.weightKg=70;p.user.shoeSizeEu=42;
  s=settleNative(s,p,anchor(2),'',schemas).state;
  assert.equal(s.user.heightCm,178);
  assert.equal(s.user.weightKg,70);
  assert.equal(s.user.shoeSizeEu,42);

  const q=clone(s);
  q.user.heightCm=190;q.user.weightKg=95;q.user.shoeSizeEu=46;
  s=settleNative(s,q,anchor(3),'',schemas).state;
  assert.equal(s.user.heightCm,178,'已填值不被模型覆盖');
  assert.equal(s.user.weightKg,70);
  assert.equal(s.user.shoeSizeEu,42);
});

test('rc.33 out-of-range body values are rejected and the stored value survives',()=>{
  let s=initial();
  const p=clone(s);
  p.user.heightCm=999;p.user.weightKg=1;p.user.shoeSizeEu=7;
  s=settleNative(s,p,anchor(2),'',schemas).state;
  assert.equal(s.user.heightCm,null);
  assert.equal(s.user.weightKg,null);
  assert.equal(s.user.shoeSizeEu,null);
});
