import test from 'node:test';
import assert from 'node:assert/strict';
import {missingInStep,STEP_REQUIRED} from '../src/ui/setup-required.js';
import {applyOpeningPreset,openingPresets} from '../src/ui/opening-presets.js';
import {draft} from './fixtures.mjs';

// 想法池 07：除资产与熟人外，这些字段不填就走不到下一步；拦截走应用内 INVALID_TEXT 提示。
test('rc.33 setup blocks next while the required identity fields are empty',()=>{
  const empty=draft({name:'',age:0,gender:'',occupation:'',appearance:'',body:'',background:'',currentLocation:'',startDate:'',startTime:''});
  assert.deepEqual(missingInStep(empty,0),['age','name','gender','occupation','appearance','body','background']);
  assert.deepEqual(missingInStep(empty,1),['currentLocation','startDate','startTime']);
  assert.deepEqual(missingInStep(draft(),0),['appearance','body','background']);
  assert.deepEqual(missingInStep(draft(),1),['startDate','startTime']);
});

test('rc.33 required list keeps optional fields out and age must stay a whole number',()=>{
  assert(!STEP_REQUIRED[0].includes('weather')&&!STEP_REQUIRED[0].includes('workLifeDescription')&&!STEP_REQUIRED[0].includes('heightCm'));
  assert(missingInStep(draft({age:25.5}),0).includes('age'));
  assert(missingInStep(draft({age:'   '}),0).includes('age'));
  assert(!missingInStep(draft({age:25}),0).includes('age'));
});

test('rc.33 every opening preset fills all required steps without hand editing',()=>{
  let n=0;
  for(const p of openingPresets){
    const d=applyOpeningPreset(draft({name:'',gender:'',occupation:'',appearance:'',body:'',background:'',currentLocation:'',startDate:'',startTime:''}),p.id,()=>String(++n));
    const filled={...d,name:'陆时行',age:24};
    assert.deepEqual(missingInStep(filled,0),[],p.id);
    assert.deepEqual(missingInStep(filled,1),[],p.id);
  }
});
