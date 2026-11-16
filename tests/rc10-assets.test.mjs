import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {assetDescription,validateDraft,projection,applyEnvelope} from '../src/core/engine.js';
import {completeInitialState,refreshContext} from '../src/runtime/settlement.js';
import {createSchema} from '../src/runtime/schema.js';
import {draft,fresh,payment,event,envelope,anchor,source} from './fixtures.mjs';
import {openingPresets,applyOpeningPreset} from '../src/ui/opening-presets.js';

test('新开局始终在云澜，外地旧草稿不改变开局城市',()=>assert.equal(validateDraft(draft({city:'其他城市'})).user.city,'云澜市'));
for(const kind of ['HOUSE','CAR','LUXURY','OTHER'])test('未填资产描述生成稳定具体设定：'+kind,()=>{
 const a={assetId:'owned',kind,name:kind==='LUXURY'?'机械腕表':'自有资产',bookValueCents:10000000,locationNote:'江城区'};
 const s=fresh({initialAssets:[a]}),description=s.finance.assets.owned.description;
 assert(description.length>30);assert(!/未知|待补充/.test(description));assert.equal(assetDescription(a),description);assert.equal(s.user.cashCents,10000000);assert.equal(Object.keys(s.finance.ledger).length,0);
});
test('资产正文上下文包含描述、位置与估值，赠出后从玩家持有列表移除',()=>{
 let s=fresh({initialAssets:[{assetId:'home',kind:'HOUSE',name:'家',bookValueCents:150000000,description:'江城区92平方米两居室，朝南阳台，浅木色家具。',locationNote:'翠湖公寓'}]});
 const described=projection(s).assets[0];assert.equal(described.description,s.finance.assets.home.description);assert.equal(described.bookValueCents,150000000);assert.equal(described.locationNote,'翠湖公寓');
 s=refreshContext(completeInitialState(s,{startDate:'2026-11-16',startTime:'09:00'}));assert(JSON.parse(s._context).assets[0].description.includes('92平方米'));
 s=applyEnvelope(s,envelope(event('ASSET_TRANSFER',{factId:'give_home',personRef:'char_a',assetId:'home',completed:true})),anchor(),source);
 assert.equal(projection(s).assets.length,0);assert.equal(s.finance.assets.home.description,described.description);assert.equal(s.user.cashCents,10000000);
});
test('新购入资产按模型描述保存，退价不重新抽取外观或尺寸',()=>{
 const description='银灰色行政轿车，黑色真皮内饰，平稳舒适。';
 let s=applyEnvelope(fresh(),envelope(payment({kind:'VEHICLE_PURCHASE',allocations:[],asset:{assetId:'car',kind:'CAR',name:'轿车',description,locationNote:'住所地下车库'}})),anchor(),source);
 s=applyEnvelope(s,envelope(event('TRANSACTION_REFUND',{factId:'discount',refundOf:'pay_1',amountCents:1000,completed:true})),anchor(3),source);
 assert.equal(s.finance.assets.car.description,description);assert.equal(s.finance.assets.car.basisCents,29000);assert.equal(projection(s).assets[0].description,description);
});
test('全部预设资产有简述，结构注册保留同一描述',()=>{
 const schemas=createSchema(z);let id=0;
 for(const preset of openingPresets){const d=applyOpeningPreset(draft(),preset.id,()=>String(++id));for(const a of d.initialAssets)assert(a.description?.length>30);
  const s=fresh(d);const parsed=schemas.state.parse(completeInitialState(s,{startDate:'2026-11-16',startTime:'09:00'}));
  for(const a of Object.values(s.finance.assets))assert.equal(parsed.finance.assets[a.assetId].description,a.description);
 }
});
