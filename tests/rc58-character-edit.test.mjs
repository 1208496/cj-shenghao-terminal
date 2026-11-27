// rc.58 A 批（4A 方案 A §7）：玩家侧资料纠错通道 PLAYER_EDIT_CHARACTER 的回归。
// 年龄收敛表（T-A5…T-A8）待方案 A §6.1 的匹配正则获批后补入本文件。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,replayPlayerCommand} from '../src/runtime/settlement.js';
import {applyOperation,clone,PROFILE_KEYS,reconcileCharacterAge,matchAgeBand,sanitizeInventoryAndUnlocks} from '../src/core/engine.js';
import {fresh,contact,anchor} from './fixtures.mjs';

const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh({contacts:[contact()]}),{startDate:'2026-01-05',startTime:'09:00'}));
const edit=(s,patch,personRef='char_a')=>applyOperation(s,{operationId:crypto.randomUUID(),type:'PLAYER_EDIT_CHARACTER',personRef,patch,expectedRevision:s.meta.revision},anchor());
const fullPatch=(extra={})=>({age:18,occupation:'高三艺考生',relationshipLabel:'邻家妹妹',addressing:'哥哥',beautyScore:82,cupSize:'D',heightCm:165,weightKg:48,bustCm:88,waistCm:58,hipCm:89,shoeSizeEu:37,personalityTags:['乖巧','害羞'],appearance:'黑长直齐刘海',body:'纤细饱满',recentGoal:'备战省联考',longTermDream:'考入云澜美院',...extra});

test('rc.58 T-A1 玩家编辑全字段落库，且模型后续改不动',()=>{
  let s=initial();
  s=edit(s,fullPatch());
  const c=s.characters.char_a;
  assert.equal(c.age,18);assert.equal(c.occupation,'高三艺考生');assert.equal(c.relationshipLabel,'邻家妹妹');
  assert.equal(c.addressing,'哥哥');assert.equal(c.beautyScore,82);assert.equal(c.cupSize,'D');
  assert.equal(c.heightCm,165);assert.equal(c.weightKg,48);assert.equal(c.bustCm,88);assert.equal(c.waistCm,58);assert.equal(c.hipCm,89);assert.equal(c.shoeSizeEu,37);
  assert.deepEqual(c.personalityTags,['乖巧','害羞']);
  assert.equal(c.appearance,'黑长直齐刘海');assert.equal(c.body,'纤细饱满');
  assert.equal(c.recentGoal,'备战省联考');assert.equal(c.longTermDream,'考入云澜美院');
  assert.ok(s.facts['profile_edited:char_a'],'写入玩家拍板标记');
  // 下一轮模型提案改年龄与身高 → prior-wins 必须拦回
  const candidate=clone(s);
  candidate.characters.char_a.age=26;candidate.characters.char_a.heightCm=172;
  const r=settleNative(s,candidate,anchor(),'她说自己其实二十六。',schemas);
  assert.equal(r.state.characters.char_a.age,18);
  assert.equal(r.state.characters.char_a.heightCm,165);
});

test('rc.58 T-A2 越界与空值一律拦下，revision 不变',()=>{
  const s=initial();
  const before=s.meta.revision;
  assert.throws(()=>edit(s,fullPatch({age:17})),/INVALID_INTEGER/);
  assert.throws(()=>edit(s,fullPatch({age:85})),/INVALID_INTEGER/);
  assert.throws(()=>edit(s,fullPatch({heightCm:90})),/INVALID_BASIC_PROFILE/);
  assert.throws(()=>edit(s,fullPatch({relationshipLabel:''})),/INVALID_TEXT/);
  assert.throws(()=>edit(s,fullPatch({personalityTags:['一','二','三','四','五','六','七']})),/INVALID_BASIC_PROFILE/);
  assert.equal(s.meta.revision,before);
});

test('rc.58 T-A3 九大档案 identity 里的旧年龄与旧职业同步替换',()=>{
  let s=initial();
  s.characters.char_a.age=25;s.characters.char_a.occupation='高二学生';
  s.characters.char_a.profileFixed={...Object.fromEntries(PROFILE_KEYS.map(k=>[k,'档案'+k])),identity:'林小雨，25岁，现职高二学生。'};
  s.characters.char_a.profileLocked=false;
  s=edit(s,fullPatch({age:18,occupation:'大一新生'}));
  assert.equal(s.characters.char_a.profileFixed.identity,'林小雨，18岁，现职大一新生。');
});

test('rc.58 T-A4 删楼/换 swipe 后重放同一操作幂等',()=>{
  const s=initial();
  const command={kind:'action',value:{operationId:crypto.randomUUID(),type:'PLAYER_EDIT_CHARACTER',personRef:'char_a',patch:fullPatch({age:19}),expectedRevision:s.meta.revision}};
  const once=applyOperation(s,command.value,anchor());
  const replayed=replayPlayerCommand(once,command,anchor(),schemas);
  assert.equal(replayed.characters.char_a.age,19);
  assert.equal(replayed.meta.revision,once.meta.revision,'重放不得再自增版本');
});

test('rc.58 C-007 罩杯留空时按新三围重算，不保留旧字母',()=>{
  let s=initial();
  s.characters.char_a.cupSize='A';
  s=edit(s,fullPatch({cupSize:'',bustCm:96,waistCm:60,heightCm:165,body:'丰盈饱满'}));
  assert.notEqual(s.characters.char_a.cupSize,'A','应重算罩杯');
  assert.ok(s.characters.char_a.cupSize.length<=8);
});

test('rc.58 C-006 颜值允许清空；身体数据允许留空',()=>{
  let s=initial();
  s=edit(s,fullPatch({beautyScore:null,heightCm:null,weightKg:null,bustCm:null,waistCm:null,hipCm:null,shoeSizeEu:null}));
  const c=s.characters.char_a;
  assert.equal(c.beautyScore,null);
  assert.equal(c.heightCm,null);assert.equal(c.weightKg,null);assert.equal(c.bustCm,null);
});

// ---------- C-001…C-004 / C-008 / C-009：年龄收敛表（YG 2026-11-27 选 A：正则收窄） ----------
const addPerson=(before,id,value)=>{
  const candidate=clone(before);candidate.characters[id]=value;
  return settleNative(before,candidate,anchor(),'她推门进来，站在玄关没有动。',schemas).state.characters[id];
};

test('rc.58 T-A5 新登场人物年龄按身份确定性收敛',()=>{
  const s=initial();
  assert.equal(addPerson(s,'char_stu',{id:'char_stu',name:'苏浅',age:25,occupation:'高二学生',relationshipLabel:'熟人'}).age,18);
  // 方案 T-A5 期望 19；按方案 §6.1 算法「越界钳到 band.max」应为 20（26岁 > 大一上限 20）。
  // 这里按算法断言 20，差异已在清单 C-024 记录，待 YG 确认期望值。
  assert.equal(addPerson(s,'char_uni',{id:'char_uni',name:'周沫',age:'二十六岁',occupation:'大一新生',relationshipLabel:'学妹'}).age,20);
  assert.equal(addPerson(s,'char_doc',{id:'char_doc',name:'秦岚',age:19,occupation:'心外科主任医师',relationshipLabel:'医生'}).age,26);
});

test('rc.58 T-A6 玩家显式年龄优先；未成年输入钳到 18',()=>{
  assert.equal(reconcileCharacterAge({age:25,occupation:'高三复读生'},{briefText:'22岁高三复读生'}),22);
  assert.equal(reconcileCharacterAge({age:25,occupation:'高二学生'},{briefText:'16岁高二学生'}),18);
});

test('rc.58 T-A7 旧存档 25 岁高二学生读档自愈，且幂等',()=>{
  const s=initial();
  s.characters.char_girl={...clone(s.characters.char_a),id:'char_girl',name:'林小雨',age:25,occupation:'高二学生',relationshipLabel:'女儿'};
  delete s.facts['profile_edited:char_girl'];
  const first=sanitizeInventoryAndUnlocks(s);
  assert.equal(first.changed,true);
  assert.equal(s.characters.char_girl.age,18);
  assert.ok(s.facts['legacy_age_reconciled:char_girl']);
  const second=sanitizeInventoryAndUnlocks(s);
  assert.equal(second.changed,false,'第二次不得再动');
});

test('rc.58 T-A8 旧存档 25 岁职场女性不被误伤',()=>{
  const s=initial();
  s.characters.char_office={...clone(s.characters.char_a),id:'char_office',name:'沈知夏',age:25,occupation:'平面设计师',relationshipLabel:'邻居'};
  sanitizeInventoryAndUnlocks(s);
  assert.equal(s.characters.char_office.age,25);
});

test('rc.58 收窄验证：高中老师与「学姐」不被当成学生档',()=>{
  const s=initial();
  assert.equal(matchAgeBand({occupation:'高中语文教师',relationshipLabel:'邻居'}),null);
  assert.equal(matchAgeBand({occupation:'高中部年级主任',relationshipLabel:'熟人'}),null);
  assert.equal(reconcileCharacterAge({age:25,occupation:'高中语文教师'}),25);
  assert.equal(matchAgeBand({occupation:'建筑设计师',relationshipLabel:'学姐'}),null,'裸「学姐」不再强行 19–23');
  // 旧档自愈同样不吃教职工
  s.characters.char_teacher={...clone(s.characters.char_a),id:'char_teacher',name:'陈老师',age:25,occupation:'高中语文教师',relationshipLabel:'班主任'};
  sanitizeInventoryAndUnlocks(s);
  assert.equal(s.characters.char_teacher.age,25);
});
