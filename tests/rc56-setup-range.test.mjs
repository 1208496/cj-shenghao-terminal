import test from 'node:test';
import assert from 'node:assert/strict';
import {blameIntegerField,SETUP_INTEGER_RANGES} from '../src/ui/setup-required.js';
import {validateDraft} from '../src/core/engine.js';
import {draft} from './fixtures.mjs';

// rc.56 修复：开局草稿里越界的整数项要让界面能点名，而不是只回一句「请检查年龄、好感及金额。」
test('rc.56 blameIntegerField leaves a normal draft alone',()=>{
  assert.equal(blameIntegerField(draft()),'');
  assert.equal(blameIntegerField({...draft(),heightCm:183,weightKg:75,shoeSizeEu:43}),'');
  assert.equal(blameIntegerField({...draft(),heightCm:null,weightKg:undefined,shoeSizeEu:''}),'');
});

test('rc.56 blameIntegerField names the first out-of-range field',()=>{
  assert.equal(blameIntegerField({...draft(),age:17}),'age');
  assert.equal(blameIntegerField({...draft(),age:90}),'age');
  assert.equal(blameIntegerField({...draft(),age:'17'}),'age');
  assert.equal(blameIntegerField({...draft(),heightCm:1.75}),'heightCm');
  assert.equal(blameIntegerField({...draft(),weightKg:300}),'weightKg');
  assert.equal(blameIntegerField({...draft(),shoeSizeEu:60}),'shoeSizeEu');
  // 年龄优先：多项越界时先报年龄，和界面从上往下的填写顺序一致。
  assert.equal(blameIntegerField({...draft(),age:17,heightCm:1.75}),'age');
});

test('rc.56 boundaries are inclusive and match validateDraft exactly',()=>{
  const cases={age:[18,80],heightCm:[140,230],weightKg:[35,200],shoeSizeEu:[34,52]};
  for(const [field,[min,max]] of Object.entries(cases)){
    for(const v of [min-1,min,min+0.5,max,max+1]){
      const d={...draft(),[field]:v};
      const blamed=blameIntegerField(d);
      let engineOk=true;
      try{validateDraft(d);}catch{engineOk=false;}
      assert.equal(blamed==='',engineOk,`${field}=${v} 判定与 engine 不一致（blame=${blamed||'—'}）`);
    }
  }
  assert.deepEqual(Object.keys(SETUP_INTEGER_RANGES),Object.keys(cases));
});

test('rc.56 颜值/性能力不进范围表（它们由 collect 当场拦，不存进草稿）',()=>{
  assert.equal(blameIntegerField({...draft(),beautyScore:150}),'');
  assert.equal(blameIntegerField({...draft(),prowessScore:0}),'');
  assert(!Object.hasOwn(SETUP_INTEGER_RANGES,'beautyScore'));
  assert(!Object.hasOwn(SETUP_INTEGER_RANGES,'prowessScore'));
});

test('rc.56 blank optional numbers never blame the player',()=>{
  for(const v of [null,undefined,'']){
    assert.equal(blameIntegerField({...draft(),heightCm:v,weightKg:v,shoeSizeEu:v}),'');
  }
  // 年龄没有留空这回事：清空后按 0 处理，必须点名。
  assert.equal(blameIntegerField({...draft(),age:Number('')}),'age');
});
