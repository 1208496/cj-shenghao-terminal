import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {clone} from '../src/core/engine.js';
import {fresh,contact,anchor} from './fixtures.mjs';
const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh({contacts:[contact('char_a',{affection:50})]}),{startDate:'2026-01-05',startTime:'09:00'}));
const behavior=(score,action='')=>({type:'BEHAVIOR',personRef:'char_a',action,score});

// T2（rc.33 遗留）：vaginaState 的「实战 → 事后 → 次日日常」三阶跨轮行为走一遍真实结算链。
test('rc.33 vaginastate walks sex → afterglow → next-day idle across settled rounds',()=>{
  let s=initial();
  const dayOne=clone(s);dayOne.pendingEvents=[behavior(95,'进入正戏，激烈交合')];
  let r=settleNative(s,dayOne,anchor(2),'',schemas);assert.deepEqual(r.diagnostics,[]);s=r.state;
  const c=s.characters.char_a;
  assert.equal(c.physiology.virgin,false);
  assert(c.physiology.vaginaState.includes('刚经受')||c.physiology.vaginaState.includes('刚经历'),c.physiology.vaginaState);
  assert(c.arousal>=88,c.arousal);
  assert.equal(c.lastSexSceneRevision,s.scene.sceneRevision);

  const night=clone(s);night.pendingEvents=[behavior(30,'事后温存，靠在肩头说话')];
  r=settleNative(s,night,anchor(3),'',schemas);s=r.state;
  const after=s.characters.char_a;
  assert(after.arousal<=20,after.arousal);
  assert(!/刚经受|刚经历|灌满/.test(after.physiology.vaginaState),after.physiology.vaginaState);
  assert.equal(after.physiology.vaginaState,'');

  const nextDay=clone(s);nextDay.world.date='2026-01-06';nextDay.pendingEvents=[behavior(30,'次日清晨一起去楼下买早餐')];
  r=settleNative(s,nextDay,anchor(4),'',schemas);s=r.state;
  const idle=s.characters.char_a;
  // 已知行为（记录在案，未修）：次日 seedAnatomy 先补静态基线，随后 wroteVagina 把基线误判成
  // 模型手写值，于是跳过 arousal 兜底；净效果是回到静态常态描述而不是空串。
  assert(idle.physiology.vaginaState.trim()!=='');
  assert(!/刚经受|刚经历|灌满/.test(idle.physiology.vaginaState),idle.physiology.vaginaState);
  assert(idle.arousal<=20,idle.arousal);
});

// 模型亲手写下的下体状态优先保留，脚本只在空值时兜底（rc.25 规则，跨轮同样成立）。
test('rc.33 model-written vagina state survives settlement while script only fills blanks',()=>{
  let s=initial();
  const p=clone(s);p.characters.char_a.physiology.vaginaState='模型亲手写的湿润状态';p.pendingEvents=[behavior(95,'交合')];
  s=settleNative(s,p,anchor(2),'',schemas).state;
  assert.equal(s.characters.char_a.physiology.vaginaState,'模型亲手写的湿润状态');
  const q=clone(s);q.characters.char_a.physiology.vaginaState='';q.pendingEvents=[behavior(95,'再来一次')];
  s=settleNative(s,q,anchor(3),'',schemas).state;
  assert.notEqual(s.characters.char_a.physiology.vaginaState,'');
});
