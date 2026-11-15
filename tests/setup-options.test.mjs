import test from 'node:test';
import assert from 'node:assert/strict';
import {contactPresets,contactPresetValues,fieldOptions} from '../src/ui/setup-options.js';
import {completeBasicProfile,initialize} from '../src/core/engine.js';
import {draft} from './fixtures.mjs';
test('every editable opening, asset and acquaintance field has bounded preset values',()=>{
 const keys=['name','age','gender','occupation','appearance','body','background','city','currentLocation','residenceDescription','workLifeDescription','weather','cashYuan','startDate','startTime','a_name','a_value','a_owner','a_note','c_name','c_age','c_relation','c_aff','c_job','c_personalityTags','c_appearance','c_body','c_notes','c_heightCm','c_weightKg','c_bustCm','c_waistCm','c_hipCm','c_shoeSizeEu'];
 for(const key of keys){const options=fieldOptions(key);assert(options.length>=3,key);assert(options.every(s=>typeof s==='string'&&s.length>0&&s.length<=500),key);}
});
test('all six optional acquaintances are adult women with valid simple records and no dossier',()=>{
 assert.equal(contactPresets.length,6);assert.equal(new Set(contactPresets.map(p=>p.presetId)).size,6);
 for(const p of contactPresets){assert.equal(p.gender,'女');assert(p.age>=18);assert.equal(p.present,false);assert.equal(p.profileFixed,undefined);completeBasicProfile(p);const state=initialize(draft({contacts:[{...p,id:'test_preset'}]}),{test_preset:p},'init','test');assert.equal(state.characters.test_preset.profileFixed,null);assert.equal(state.characters.test_preset.rewardBaseCents,1000000);assert.equal(contactPresetValues(p).c_weightKg,p.weightKg);}
});
