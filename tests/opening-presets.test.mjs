import test from 'node:test';
import assert from 'node:assert/strict';
import {applyOpeningPreset,cashOptions,openingPresets} from '../src/ui/opening-presets.js';
import {initialize} from '../src/core/engine.js';
import {draft} from './fixtures.mjs';
test('four complete openings map to the four cash choices and preserve name and age',()=>{
 assert.deepEqual(openingPresets.map(p=>p.cashYuan),cashOptions);assert.equal(openingPresets.length,4);
 let counter=0;
 for(const p of openingPresets){const old=draft({name:'自定义姓名',age:38}),snapshot=JSON.stringify(old);const next=applyOpeningPreset(old,p.id,()=>String(++counter));assert.equal(next.name,old.name);assert.equal(next.age,38);assert.equal(next.initialCashCents,p.cashYuan*100);assert.equal(JSON.stringify(old),snapshot);assert.equal(next.housingMode,undefined);assert.equal(next.residenceDescription,undefined);
  for(const key of ['gender','appearance','body','occupation','background','city','currentLocation','workLifeDescription','startDate','startTime','weather'])assert(next[key],p.id+':'+key);
  const state=initialize(next,Object.fromEntries(next.contacts.map(c=>[c.id,c])),'opening_init','test');assert.equal(state.user.cashCents,p.cashYuan*100);assert.equal(Object.keys(state.finance.ledger).length,0);assert(Object.values(state.characters).every(c=>c.profileFixed===null));
 }
});
test('switching openings replaces lists instead of accumulating assets and acquaintances',()=>{
 let n=0;const rich=applyOpeningPreset(draft(),'wealthy',()=>String(++n));const poor=applyOpeningPreset(rich,'broke',()=>String(++n));assert.equal(poor.initialAssets.length,0);assert.equal(poor.contacts.length,1);assert.equal(poor.initialCashCents,0);assert.notEqual(poor.contacts[0].id,rich.contacts[0].id);assert.equal(rich.initialAssets.length,3);assert.throws(()=>applyOpeningPreset(rich,'missing'));
});
