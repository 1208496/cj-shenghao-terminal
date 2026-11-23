import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,prepareModelCommand,allowModelCommand,replayPlayerCommand} from '../src/runtime/settlement.js';
import {clone,projection} from '../src/core/engine.js';
import {diagnosticMessage} from '../src/runtime/diagnostics.js';
import {fresh,anchor} from './fixtures.mjs';

const schemas=createSchema(z);
const ready=(extra={})=>{
  const state=schemas.state.parse(completeInitialState(fresh(extra),{startDate:'2026-01-05',startTime:'09:00'}));
  return state;
};
// 造三人同场
function threePresent(){
  const s=ready();
  s.characters.char_b={...clone(s.characters.char_a),id:'char_b',name:'林夕',aliases:['小夕']};
  s.characters.char_c={...clone(s.characters.char_a),id:'char_c',name:'苏晚',aliases:[]};
  s.scene.presentCharacterIds=['char_a','char_b','char_c'];
  return s;
}

test('rc56b PLAYER_SET_ADDRESSING 写入称呼并进 operationHistory 可重放',()=>{
  const before=ready();
  const op={operationId:'op_addr_1',type:'PLAYER_SET_ADDRESSING',personRef:'char_a',addressing:'哥',expectedRevision:before.meta.revision};
  const cmd={kind:'action',value:op};
  const next=replayPlayerCommand(clone(before),cmd,anchor(3),schemas);
  assert.equal(next.characters.char_a.addressing,'哥');
  assert.ok(next.operationHistory.op_addr_1,'操作应留痕');
  // 删楼/换 swipe 后重放同样要能还原
  const again=replayPlayerCommand(clone(before),cmd,anchor(3),schemas);
  assert.equal(again.characters.char_a.addressing,'哥');
});

test('rc56b PLAYER_SET_ADDRESSING 拒绝空值与超长',()=>{
  const before=ready();
  for(const bad of ['', '   ', '一二三四五六七八九十一二三四五六七八九十一']){
    assert.throws(()=>replayPlayerCommand(clone(before),{kind:'action',value:{operationId:'op_bad',type:'PLAYER_SET_ADDRESSING',personRef:'char_a',addressing:bad,expectedRevision:before.meta.revision}},anchor(3),schemas),/INVALID_TEXT/);
  }
});

test('rc56b 多人同场时 _context 带 presentThoughtIds，单人时省略',()=>{
  const three=threePresent();
  const ctx=projection(three);
  assert.deepEqual(ctx.presentThoughtIds,['char_a','char_b','char_c']);
  const one=ready();
  assert.equal(projection(one).presentThoughtIds,undefined);
});

test('rc56b 中文名单字段路径按姓名纠正到既有角色（不再生成假 ID 后被丢弃）',()=>{
  const before=threePresent();
  // 模型写 /shenghao/characters/林夕/currentThought
  const command={type:'set',args:['shenghao.characters.林夕.currentThought',JSON.stringify('她在旁听着，心里打着算盘')]};
  assert.equal(allowModelCommand(command,before),true);
  assert.equal(prepareModelCommand(command,before,schemas),true);
  assert.equal(command.args[0],'shenghao.characters.char_b.currentThought','路径应被改写成真实 id');
  const candidate=clone(before);
  candidate.characters.char_b.currentThought='她在旁听着，心里打着算盘';
  const result=settleNative(before,candidate,anchor(7),'正文摘录随便写',schemas,{receivedPaths:['characters.char_b.currentThought'],droppedCommands:[]});
  assert.equal(result.state.characters.char_b.currentThought,'她在旁听着，心里打着算盘');
  assert.equal(result.audit.perChar.char_b.thoughtStatus,'UPDATED');
});

test('rc56b ROUND_FIELD_AUDIT 四态判定 + 不进玩家红字',()=>{
  const before=threePresent();
  before.characters.char_a.currentThought='旧的A心声';
  const candidate=clone(before);
  candidate.characters.char_a.currentThought='新的A心声';           // UPDATED
  candidate.characters.char_b.currentThought=before.characters.char_b.currentThought; // SAME_VALUE
  // char_c 完全没收到补丁 → MISSING
  const result=settleNative(before,candidate,anchor(8),'正文',schemas,{
    receivedPaths:['characters.char_a.currentThought','characters.char_b.currentThought'],
    droppedCommands:[],
  });
  assert.equal(result.audit.code,'ROUND_FIELD_AUDIT');
  assert.equal(result.audit.presentCount,3);
  assert.equal(result.audit.perChar.char_a.thoughtStatus,'UPDATED');
  assert.equal(result.audit.perChar.char_b.thoughtStatus,'SAME_VALUE');
  assert.equal(result.audit.perChar.char_c.thoughtStatus,'MISSING');
  // 审计与丢弃留痕不得触发玩家可见红字
  assert.equal(diagnosticMessage(result.diagnostics),'');
});

test('rc56b 被拒补丁在审计里标 DROPPED',()=>{
  const before=threePresent();
  const candidate=clone(before);
  const result=settleNative(before,candidate,anchor(9),'正文',schemas,{
    receivedPaths:[],
    droppedCommands:[{rawPath:'characters.char_c.currentThought',reason:'PREPARE_REJECTED'}],
  });
  assert.equal(result.audit.perChar.char_c.thoughtStatus,'DROPPED');
  assert.equal(result.audit.droppedCount,1);
  assert.equal(result.diagnostics.length,0,'审计与丢弃留痕由 host 挂到自己的 diagnostics，settlement 的诊断保持干净');
  assert.equal(diagnosticMessage(result.diagnostics),'');
});

test('rc56b 称呼变化在审计里标 UPDATED 并带 prior/next',()=>{
  const before=threePresent();
  before.characters.char_a.addressing='陆总';
  const candidate=clone(before);
  candidate.characters.char_a.addressing='阿澈';
  const result=settleNative(before,candidate,anchor(10),'正文',schemas,{receivedPaths:['characters.char_a.addressing'],droppedCommands:[]});
  const entry=result.audit.perChar.char_a;
  assert.equal(entry.addressingStatus,'UPDATED');
  assert.equal(entry.prior,'陆总');
  assert.equal(entry.next,'阿澈');
});

test('rc56b 旧存档（无新字段）全链路仍通过，无需重开聊天',()=>{
  const before=ready();
  const candidate=clone(before);
  const result=settleNative(before,candidate,anchor(11),'正文',schemas,{receivedPaths:[],droppedCommands:[]});
  assert.ok(result.state.characters.char_a);
  assert.equal(result.audit.perChar.char_a.thoughtStatus,'MISSING');
  assert.equal(diagnosticMessage(result.diagnostics),'');
});
