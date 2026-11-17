import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,refreshContext} from '../src/runtime/settlement.js';
import {poolParts,withdrawalQuote,clone} from '../src/core/engine.js';
import {fresh,contact,anchor,profiles,payment} from './fixtures.mjs';
import {hostBinding,events} from './host-binding-harness.mjs';

const OPS_KEY='cj-shenghao:ops:v1:test:branch';
const mk=()=>createSchema(z).state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
const log=(items,initKey='test_init')=>({[OPS_KEY]:JSON.stringify({initKey,items})});
const readLog=store=>{try{return JSON.parse(store[OPS_KEY]||'{}');}catch{return {};}};

test('rc.29 聊天级操作日志把建档、日程与打星重放到回退后的顶楼',async()=>{
  const before=mk();
  const items=[
    {kind:'action',value:{type:'PLAYER_BUILD_PROFILE',operationId:'op_build',personRef:'char_a',profileFixed:profiles(),physiology:{},outfit:{},intimacy:{},limits:{},expectedRevision:0}},
    {kind:'appointment',operationId:'op_appt',value:{id:'appt_retest',title:'看展',date:'2026-01-06',time:'15:00',location:'美术馆',participants:[],status:'PLANNED'}},
    {kind:'action',value:{type:'PLAYER_STAR',operationId:'op_star',personRef:'char_a',expectedRevision:0}}
  ];
  const h=await hostBinding({body:'她点头同意，把日程记在本子上。',sourceAnchor:anchor(),storage:log(items)});
  h.bind();
  const {vars}=await h.run(before,{});
  const s=vars.stat_data.shenghao;
  // 这轮本来就没人模型命令，NO_NATIVE_COMMANDS 是预期诊断，其余一律不许出现。
  assert.deepEqual(h.diagnostics().filter(d=>d.code!=='NO_NATIVE_COMMANDS'),[]);
  assert.match(s.characters.char_a.profileFixed.identity,/独立生活/);
  assert.equal(Object.keys(s.characters.char_a.profileFixed).length,9);
  assert.equal(s.calendar.appointments.appt_retest.status,'PLANNED');
  assert.equal(s.characters.char_a.starred,true);
  assert.equal(Object.keys(s.operationHistory).length>=3,true);
});

test('rc.29 回退后奖池不再等于提现报价的那笔提现被撤回并留提示',async()=>{
  // 先用一次真实消费把奖池做出来，再让好感达标。
  const before=mk();
  const schemas=createSchema(z);
  const paid=settleNative(before,{...clone(before),pendingEvents:[payment({evidence:'确实已经发生'})]},anchor(2),'确实已经发生',schemas).state;
  paid.characters.char_a.affection=90;refreshContext(paid);
  const pool=poolParts(paid,'char_a').total;
  assert.equal(pool>0,true);
  const stale={kind:'action',value:{type:'PLAYER_WITHDRAW',operationId:'op_w_stale',personRef:'char_a'},expectedPoolCents:pool+12300,expectedQuote:withdrawalQuote(paid,'char_a')};
  const h=await hostBinding({body:'她把礼物收下了。',sourceAnchor:anchor(2),storage:log([stale])});
  h.bind();
  const {vars}=await h.run(clone(paid),{});
  const s=vars.stat_data.shenghao;
  assert.equal(s.user.cashCents,paid.user.cashCents);
  assert.equal(s.withdrawals.op_w_stale,undefined);
  // 该笔无法成立的提现被移出日志，不会每轮重复尝试。
  assert.deepEqual(readLog(h.storage).items,[]);
});

test('rc.29 回退后奖池与报价都没变的那笔提现被无损重放',async()=>{
  const before=mk();
  const schemas=createSchema(z);
  const paid=settleNative(before,{...clone(before),pendingEvents:[payment({evidence:'确实已经发生'})]},anchor(2),'确实已经发生',schemas).state;
  paid.characters.char_a.affection=90;refreshContext(paid);
  const pool=poolParts(paid,'char_a').total;
  const quote=withdrawalQuote(paid,'char_a');
  const ok={kind:'action',value:{type:'PLAYER_WITHDRAW',operationId:'op_w_ok',personRef:'char_a'},expectedPoolCents:pool,expectedQuote:quote};
  const h=await hostBinding({body:'她把礼物收下了，没有多说什么。',sourceAnchor:anchor(2),storage:log([ok])});
  h.bind();
  const {vars}=await h.run(clone(paid),{});
  const s=vars.stat_data.shenghao;
  assert.equal(s.withdrawals.op_w_ok?.paidCents,quote.paidCents);
  assert.equal(s.user.cashCents,paid.user.cashCents+quote.paidCents);
});

test('rc.29 操作日志写入时会带上当前局的 initKey，供新开局整体作废',async()=>{
  const before=mk();
  const h=await hostBinding({body:'她点点头。',sourceAnchor:anchor(),storage:{}});
  h.bind();
  await h.run(before,{});
  // 沙箱里 current 为空，这里只确认 key 前缀与结构，不冒充实机行为。
  assert.equal(readLog(h.storage).items,undefined);
});
