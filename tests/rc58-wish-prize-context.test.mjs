// rc.58（玩家反馈）：使用「终端最终愿望」等玩法券后，注入给模型的效果口径必须是这张券实际给到什么，
// 而不是登场旁白的悬念句。旧口径优先 hint（w53 的 hint 是「说吧，你想要什么」），模型照抄就只写到发问为止。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation, projection} from '../src/core/engine.js';
import {WHEEL_POOL_BY_ID} from '../src/core/wheel-pool.js';
import {fresh, anchor} from './fixtures.mjs';

const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
const run=(s,type,extra={})=>applyOperation(s,{type,operationId:crypto.randomUUID(),expectedRevision:s.meta.revision,...extra},anchor());
const prizeItem=(itemId,refId)=>({itemId,source:'WHEEL',category:'WHEEL_PRIZE',refId,rarity:'rainbow',obtainedDate:'2026-01-05',status:'READY',currentPoints:null,winStreak:0,scheduledAppointmentId:null,targetCharacterIds:[],assetId:null,usedDate:null});

test('rc.58 玩法券注入的是奖品给到什么（summary），不是登场悬念句（hint）',()=>{
  let s=initial();
  s.inventory={...s.inventory,prize_wish:prizeItem('prize_wish','w53')};
  s=run(s,'PLAYER_USE_WHEEL_PRIZE',{itemId:'prize_wish',immediate:true,wishKind:'CUSTOM',wishText:'我要一栋江景别墅'});
  const [item]=projection(s).mustDepictUsedItems||[];
  assert.ok(item,'使用后必须进入 mustDepictUsedItems');
  assert.equal(item.name,'终端最终愿望');
  assert.equal(item.effectOrHint,WHEEL_POOL_BY_ID.w53.summary);
  assert.ok(!item.effectOrHint.includes('说吧，你想要什么'),'不得把悬念旁白当效果口径喂给模型');
});

test('rc.58 普通玩法券同样按 summary 注入，奇物维持 effect 口径',()=>{
  let s=initial();
  s.inventory={...s.inventory,prize_w50:prizeItem('prize_w50','w50')};
  s=run(s,'PLAYER_USE_WHEEL_PRIZE',{itemId:'prize_w50',immediate:true});
  assert.equal(projection(s).mustDepictUsedItems[0].effectOrHint,WHEEL_POOL_BY_ID.w50.summary);
});
