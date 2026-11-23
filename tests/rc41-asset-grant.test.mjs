// rc.41：ASSET_GRANT 非现金入账 + presentCharacterIds 归一化回归。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,prepareModelCommand} from '../src/runtime/settlement.js';
import {tierBasis,clone} from '../src/core/engine.js';
import {fresh,anchor} from './fixtures.mjs';

const mk=()=>createSchema(z).state.parse(completeInitialState(fresh(),{startDate:'2026-02-10',startTime:'20:00'}));

test('rc.41 非现金过户的实物走 ASSET_GRANT 入账：扣零现金、basis 为 0、计级身家不变',()=>{
  const schemas=createSchema(z),before=mk(),candidate=clone(before);
  const body='合作方办完手续，把这辆车正式过户到你名下。';
  candidate.pendingEvents=[{type:'ASSET_GRANT',completed:true,evidence:body,
    asset:{assetId:'asset_gift_sf90',kind:'CAR',name:'法拉利 SF90 Stradale',ownerId:'USER',bookValueYuan:'500万',locationNote:'临江大平层地下车库',description:'合作方正式过户赠予的混动旗舰超跑，红黑碳纤维内饰，已办齐个人名下牌照。'}}];
  const {state,diagnostics}=settleNative(before,candidate,anchor(3),body,schemas);
  assert.deepEqual(diagnostics,[]);
  const asset=state.finance.assets.asset_gift_sf90;
  assert.ok(asset,'资产必须入账');
  assert.equal(asset.kind,'CAR');
  assert.equal(asset.basisCents,0,'非现金资产不得有成本基数');
  assert.equal(asset.acquisitionIsInitial,true,'必须标记为初始/非购入，避免抬高计级身家');
  assert.equal(state.user.cashCents,before.user.cashCents,'不得扣现金');
  assert.equal(tierBasis(state),tierBasis(before),'不得抬高神豪计级身家');
  const entry=Object.values(state.finance.ledger).find(l=>l.kind==='ASSET_GRANT');
  assert.ok(entry,'零现金台账必须留痕');
  assert.equal(entry.direction,'NONE');
  assert.equal(entry.amountCents,0);
});

test('rc.41 同名/中文 ID 写进 presentCharacterIds 会被归一去重，不会整组回滚',()=>{
  const before=mk();
  const command={type:'replace',args:['shenghao.scene.presentCharacterIds',JSON.stringify(['顾青禾','char_a'])]};
  assert.equal(prepareModelCommand(command,before,createSchema(z)),true);
  assert.deepEqual(JSON.parse(command.args[1]),['char_a'],'姓名要折回已有 ID 并去重');
  const bad={type:'replace',args:['shenghao.scene.presentCharacterIds',JSON.stringify(['char_a','苏晚'])]};
  assert.equal(prepareModelCommand(bad,before,createSchema(z)),true);
  const ids=JSON.parse(bad.args[1]);
  assert.equal(ids[0],'char_a');
  assert.match(ids[1],/^char_/,'非法 ID 必须归一成合法 ASCII 键');
  assert.equal(ids.length,2,'两个人必须都留在名单里');
});
