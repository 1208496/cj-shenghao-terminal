// rc.58 B 批（4A 方案 B §7）：NO.53「终端最终愿望」许愿契约的回归。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {applyOperation,projection,clone,sanitizeInventoryAndUnlocks,tierBasis} from '../src/core/engine.js';
import {fresh,contact,anchor} from './fixtures.mjs';

const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh({contacts:[contact('char_a'),contact('char_b',{present:false})]}),{startDate:'2026-01-05',startTime:'09:00'}));
const prizeItem=(itemId,refId,extra={})=>({itemId,source:'WHEEL',category:'WHEEL_PRIZE',refId,rarity:'rainbow',obtainedDate:'2026-01-05',status:'READY',currentPoints:null,winStreak:0,scheduledAppointmentId:null,targetCharacterIds:[],assetId:null,usedDate:null,...extra});
const run=(s,extra={})=>applyOperation(s,{type:'PLAYER_USE_WHEEL_PRIZE',operationId:crypto.randomUUID(),expectedRevision:s.meta.revision,...extra},anchor());
const undo=(s,itemId)=>applyOperation(s,{type:'PLAYER_UNDO_ITEM_USE',operationId:crypto.randomUUID(),itemId,expectedRevision:s.meta.revision},anchor());
const withWish=()=>{const s=initial();s.inventory={...s.inventory,prize_wish:prizeItem('prize_wish','w53')};return s;};

test('rc.58 T-B1 许愿 ASSET：脚本当场入账顶奢资产，现金与倍率都不动',()=>{
  const s0=withWish();
  const cashBefore=s0.user.cashCents,tierBefore=tierBasis(s0);
  const s1=run(s0,{itemId:'prize_wish',immediate:true,wishKind:'ASSET',wishAssetName:'湾流G700私人专机',wishText:'拥有一架随时待命的湾流G700私人专机'});
  const asset=Object.values(s1.finance.assets).find(a=>a.assetId.startsWith('asset_wish_'));
  assert.ok(asset,'必须当场生成资产');
  assert.equal(asset.kind,'YACHT_JET');
  assert.equal(asset.bookValueCents,4800000000);
  assert.equal(asset.basisCents,0);
  assert.equal(asset.acquisitionIsInitial,true);
  assert.equal(asset.isCustom,false);
  assert.equal(s1.user.cashCents,cashBefore,'不得扣或加现金');
  assert.equal(tierBasis(s1),tierBefore,'不得稀释提现倍率');
  const wish=projection(s1).activeTerminalWish;
  assert.ok(wish,'_context 必须有 activeTerminalWish');
  assert.equal(wish.wishKind,'ASSET');
  assert.equal(wish.wishText,'拥有一架随时待命的湾流G700私人专机');
  assert.equal(wish.preGrantedAsset.alreadyInFinanceAssets,true);
  assert.ok(wish.directive.includes('强制当轮兑现'));
});

test('rc.58 T-B2 撤销许愿：资产与账本一起回退，券退回待使用',()=>{
  let s=run(withWish(),{itemId:'prize_wish',immediate:true,wishKind:'ASSET',wishAssetName:'东岸云玺湾顶层复式',wishText:'立刻拿到云玺湾顶层复式的产权'});
  const assetId=Object.values(s.finance.assets).find(a=>a.assetId.startsWith('asset_wish_')).assetId;
  const ledgerId=s.inventory.prize_wish.undoSnapshot.grantedLedgerId;
  assert.ok(s.finance.ledger[ledgerId],'入账流水要在');
  s=undo(s,'prize_wish');
  assert.equal(s.finance.assets[assetId],undefined);
  assert.equal(s.finance.ledger[ledgerId],undefined);
  assert.equal(s.inventory.prize_wish.status,'READY');
  assert.equal(s.inventory.prize_wish.wishKind,null);
  assert.equal(s.inventory.prize_wish.wishText,null);
  assert.equal(projection(s).activeTerminalWish,undefined);
});

test('rc.58 T-B3 许愿 ROMANCE：目标女性当场到场并抬升情欲，撤销原样回退',()=>{
  let s=withWish();
  s.scene.presentCharacterIds=['char_a'];
  s.characters.char_b.arousal=10;
  s=run(s,{itemId:'prize_wish',immediate:true,wishKind:'ROMANCE',participants:['char_b'],wishText:'让她今晚主动来到我的住处'});
  assert.ok(s.scene.presentCharacterIds.includes('char_b'),'必须被拉进场');
  assert.equal(s.characters.char_b.arousal,65);
  s=undo(s,'prize_wish');
  assert.ok(!s.scene.presentCharacterIds.includes('char_b'));
  assert.equal(s.characters.char_b.arousal,10);
});

test('rc.58 T-B4 w53 禁排期、必须写愿望',()=>{
  const s=withWish();
  assert.throws(()=>run(s,{itemId:'prize_wish',date:'2026-01-06',time:'10:00'}),/ITEM_NOT_READY/);
  assert.throws(()=>run(s,{itemId:'prize_wish',immediate:true,wishKind:'CUSTOM',wishText:''}),/WISH_TEXT_REQUIRED/);
  assert.throws(()=>run(s,{itemId:'prize_wish',immediate:true,wishKind:'ASSET',wishText:'要一架专机',wishAssetName:''}),/WISH_ASSET_NAME_REQUIRED/);
});

test('rc.58 T-B5 结算后许愿注入退场，许愿文本留在已核销记录里',()=>{
  let s=run(withWish(),{itemId:'prize_wish',immediate:true,wishKind:'CUSTOM',wishText:'让全城地标今晚为我亮灯'});
  assert.ok(projection(s).activeTerminalWish);
  const r=settleNative(s,clone(s),anchor(),'终端黑屏一闪，城市次第亮起。',schemas);
  assert.equal(r.state.inventory.prize_wish.pendingUndo,false);
  assert.equal(projection(r.state).activeTerminalWish,undefined);
  assert.equal(r.state.inventory.prize_wish.wishText,'让全城地标今晚为我亮灯');
});

test('rc.58 T-B6 旧存档空放的 w53 自动退回待使用，且只退一次',()=>{
  const s=initial();
  s.inventory={...s.inventory,old_w53:prizeItem('old_w53','w53',{status:'USED',usedDate:'2026-01-05',wishText:null,pendingUndo:false})};
  const first=sanitizeInventoryAndUnlocks(s);
  assert.equal(first.changed,true);
  assert.equal(s.inventory.old_w53.status,'READY');
  assert.equal(s.inventory.old_w53.usedDate,null);
  assert.ok(s.facts['legacy_w53_restored:old_w53']);
  // 新版正常核销过的券（有 wishText）不得被退回
  s.inventory.new_w53=prizeItem('new_w53','w53',{status:'USED',usedDate:'2026-01-05',wishText:'我要一栋江景别墅',pendingUndo:false});
  const second=sanitizeInventoryAndUnlocks(s);
  assert.equal(s.inventory.new_w53.status,'USED','有愿望记录的券不退');
  assert.equal(second.changed,false);
});
