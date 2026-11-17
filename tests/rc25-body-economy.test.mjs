import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {clone,seedAnatomy,assetDescription,projection,poolParts} from '../src/core/engine.js';
import {createScreens} from '../src/ui/screens.js';
import {openingPresets} from '../src/ui/opening-presets.js';
import {fresh,contact,anchor} from './fixtures.mjs';

const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
const run=(before,pendingEvents,body='本轮正文')=>{const candidate=clone(before);candidate.pendingEvents=pendingEvents;return settleNative(before,candidate,anchor(),body,schemas);};
const screensFor=(state,ctx={})=>{const data={view:{state,prefs:{},busy:false},expanded:new Set(),section:null,privateSection:null,consumptionPage:0,sceneSectionByChar:new Map(),assetTab:'ALL',mineExpanded:new Set(),...ctx};const screens=createScreens({data:()=>data,esc:v=>String(v??''),yuan:v=>'¥'+v/100,image:()=>'',avatar:()=>''});return {ctx:data,screens};};

// ----- 1. seedAnatomy：确定性播种，开局不留空白 -----
test('rc.25 seedAnatomy seeds a complete, deterministic body record',()=>{
  const a=initial().characters.char_a,b=initial().characters.char_a;
  const p=a.physiology;
  for(const key of ['chestDetail','vaginaLook','vaginaState','pubicHair','anusLook','anusState','bodyScent','traits','hymenNote'])assert(p[key]&&p[key].length>0,key);
  assert(p.chestDetail.includes('罩杯'));
  assert.equal(p.chestDetail,b.physiology.chestDetail,'同一人物同一 ID 播种结果恒定');
  assert.equal(p.vaginaLook,b.physiology.vaginaLook);
  assert.equal(a.intimacy.attitude.length>0,true);
  assert.equal(a.intimacy.firstTime.length>0,true);
  assert.equal(a.intimacy.fetishes.length>0,true);
  assert.equal(a.limits.worry.length>0,true);
  assert.equal(p.virgin,true);
  // 显式给出罩杯就以罩杯为准；处女状态决定乳晕/色泽/紧致度措辞。
  const cupSeeded=seedAnatomy({id:'char_cup',cupSize:'A',intimacy:{withUserCount:2,sexPartnerCount:2,unlockedTags:[]},physiology:{virgin:false}});
  assert(cupSeeded.physiology.chestDetail.startsWith('A罩杯'));
  assert.match(cupSeeded.physiology.vaginaState,/名器级/);
  // 已有内容永远优先。
  const kept=seedAnatomy({id:'char_keep',cupSize:'C',physiology:{chestDetail:'自定义胸型',virgin:true},intimacy:{},limits:{}});
  assert.equal(kept.physiology.chestDetail,'自定义胸型');
});

// ----- 2. vaginaState 随情动与实战演进 -----
test('rc.25 vaginaState evolves from arousal, real sex and creampie tags',()=>{
  const before=initial();
  const low=clone(before);low.characters.char_a.arousal=45;
  const lowOut=settleNative(before,low,anchor(),'本轮正文',schemas).state.characters.char_a.physiology.vaginaState;
  assert.match(lowOut,/芳心微乱/);
  const hot=clone(before);hot.characters.char_a.arousal=70;
  assert.match(settleNative(before,hot,anchor(),'本轮正文',schemas).state.characters.char_a.physiology.vaginaState,/情动难耐/);
  const sex=run(before,[{type:'BEHAVIOR',personRef:'char_a',mode:'INTIMATE',action:'主卧深吻并发生首次亲密交欢',score:92}]);
  assert.match(sex.state.characters.char_a.physiology.vaginaState,/刚经受强悍肉体充分开发/);
  const creampie=run(before,[{type:'BEHAVIOR',personRef:'char_a',mode:'INTIMATE',action:'无套内射把她灌满',score:94,tags:['无套内射']}]);
  assert.match(creampie.state.characters.char_a.physiology.vaginaState,/灌满浓稠精液/);
  const wrote=clone(before);wrote.characters.char_a.physiology.vaginaState='她亲手写的状态';
  assert.equal(settleNative(before,wrote,anchor(),'本轮正文',schemas).state.characters.char_a.physiology.vaginaState,'她亲手写的状态');
});

// ----- 3. Bug #1：type:"ASSET" 也要入账 -----
test('rc.25 a model shortcut type:"ASSET" still pays, books and registers the asset',()=>{
  const before=schemas.state.parse(completeInitialState(fresh({initialCashCents:2000000000}),{startDate:'2026-01-05',startTime:'09:00'}));
  const body='你当场刷卡全款一千两百万元签下东岸云玺湾临江大平层。';
  const r=run(before,[{type:'ASSET',name:'云玺湾临江大平层',kind:'HOUSE',amountYuan:'1200万',evidence:body}],body);
  assert.deepEqual(r.diagnostics,[]);
  assert.equal(r.state.user.cashCents,2000000000-1200000000);
  const asset=Object.values(r.state.finance.assets)[0];
  assert.equal(asset.kind,'HOUSE');assert.equal(asset.status,'OWNED');
  assert.equal(asset.basisCents,1200000000);
  assert(asset.description.length<=50);
  assert.equal(Object.values(r.state.finance.ledger).length,1);
});

test('rc.25 selling something never registered is booked as other income',()=>{
  const before=initial();
  const body='画廊把一千五百万打到我卡上了。';
  const r=run(before,[{type:'CASH_TRANSACTION',direction:'IN',payer:'EXTERNAL',kind:'ASSET_SALE',completed:true,amountYuan:'1500万',memo:'转手卖画',evidence:body}],body);
  assert.deepEqual(r.diagnostics,[]);
  assert.equal(r.state.user.cashCents,before.user.cashCents+1500000000);
  assert.equal(Object.values(r.state.finance.ledger)[0].kind,'OTHER_INCOME');
});

test('rc.25 shopping with an unnamed asset id auto-registers under the right kind',()=>{
  const before=schemas.state.parse(completeInitialState(fresh({initialCashCents:2000000000}),{startDate:'2026-01-05',startTime:'09:00'}));
  const body='你刷卡八十八万买下那枚百达翡丽腕表。';
  const r=run(before,[{type:'CASH_TRANSACTION',direction:'OUT',payer:'USER',kind:'SHOPPING',completed:true,amountYuan:'88万',memo:'买表',
    asset:{name:'百达翡丽腕表',kind:'腕表',ownerId:'USER'},evidence:body}],body);
  assert.deepEqual(r.diagnostics,[]);
  const asset=Object.values(r.state.finance.assets)[0];
  assert.equal(asset.kind,'LUXURY');assert.equal(asset.ownerId,'USER');
  assert(asset.assetId.startsWith('asset_'));
  assert.equal(r.state.user.cashCents,before.user.cashCents-88000000);
});

// ----- 4. evidence 兜底，同时不放行哨兵与未付款 -----
test('rc.25 a paraphrased evidence falls back to the first real sentence instead of dropping the payment',()=>{
  const before=initial();
  const body='你刷卡付了两万八，把那件丝巾买了下来。她把丝巾仔细收进纸袋。';
  const r=run(before,[{type:'CASH_TRANSACTION',direction:'OUT',payer:'USER',kind:'GIFT',completed:true,amountYuan:'2.8万',memo:'丝巾',
    itemName:'丝巾',allocations:[{personRef:'char_a',amountYuan:'2.8万'}],evidence:'我前几天把手头那幅一直收着的画卖给画廊了'}],body);
  assert.deepEqual(r.diagnostics,[]);
  assert.equal(r.state.user.cashCents,before.user.cashCents-2800000);
  assert.equal(poolParts(r.state,'char_a').spend,2800000);
});
test('rc.25 sentinel words and unpaid wording are still refused',()=>{
  const before=initial();
  const body='你刷卡付了两万八，把那件丝巾买了下来。';
  for(const evidence of ['没有发生','正文没有这句话','还没付款']){
    const r=run(before,[{type:'CASH_TRANSACTION',direction:'OUT',payer:'USER',kind:'GIFT',completed:true,amountYuan:'2.8万',evidence}],body);
    assert.deepEqual(r.diagnostics.map(d=>d.code),['EVIDENCE_NOT_IN_SOURCE'],evidence);
    assert.equal(r.state.user.cashCents,before.user.cashCents);
  }
});

// ----- 5. Bug #3 / #4：开局穿搭与亲密回合不倒扣 -----
test('rc.25 the opening fills outfit and currentClothes from her look or job',()=>{
  const before=initial();
  assert(before.characters.char_a.outfit.top.length>0);
  assert.equal(before.characters.char_a.currentClothes,before.characters.char_a.outfit.top);
  for(const c of Object.values(before.characters))assert(c.outfit.top.length>0&&c.currentClothes.length>0);
});
test('rc.25 a 60+ round cannot push affection down',()=>{
  const before=initial();
  const intimate=clone(before);intimate.characters.char_a.affection=80;
  intimate.pendingEvents=[{type:'BEHAVIOR',personRef:'char_a',mode:'INTIMATE',action:'主卧深吻',score:70}];
  assert.equal(settleNative(before,intimate,anchor(),'本轮正文',schemas).state.characters.char_a.affection,90,'亲密回合拒绝倒扣');
  const scored=clone(before);scored.characters.char_a.affection=80;
  scored.pendingEvents=[{type:'BEHAVIOR',personRef:'char_a',mode:'BREAKTHROUGH',action:'替她摆平房东',score:68}];
  assert.equal(settleNative(before,scored,anchor(),'本轮正文',schemas).state.characters.char_a.affection,90);
  const plain=clone(before);plain.characters.char_a.affection=80;
  assert.equal(settleNative(before,plain,anchor(),'本轮正文',schemas).state.characters.char_a.affection,80,'普通回合仍可下降');
});

// ----- 6. 七大资产分类与 50 字描述 -----
test('rc.25 seven asset classes map Chinese wording and keep descriptions within 50 characters',()=>{
  const kinds=['HOUSE','CAR','BUSINESS','YACHT_JET','LUXURY','COLLECTIBLE','OTHER'];
  const aliases={HOUSE:'临江大平层',CAR:'奔驰S级',BUSINESS:'会所股权',YACHT_JET:'湾流专机',LUXURY:'百达翡丽腕表',COLLECTIBLE:'字画古董',OTHER:'日用品'};
  const before=schemas.state.parse(completeInitialState(fresh({initialCashCents:2000000000}),{startDate:'2026-01-05',startTime:'09:00'}));
  for(const kind of kinds){
    const body=`你当场刷卡买下了${aliases[kind]}。`;
    const r=run(before,[{type:'ASSET',name:aliases[kind],kind,amountYuan:'50万',evidence:body}],body);
    assert.deepEqual(r.diagnostics,[],kind);
    const asset=Object.values(r.state.finance.assets)[0];
    assert.equal(asset.kind,kind);
    assert(asset.description.length>20&&asset.description.length<=50,kind+' '+asset.description.length);
  }
  // 中文别名与旧枚举都自动归到七类。
  const r=run(before,[{type:'ASSET',name:'湾流G650专机',kind:'游艇专机',amountYuan:'50万',evidence:'你当场刷卡买下了湾流G650专机。'}],'你当场刷卡买下了湾流G650专机。');
  assert.equal(Object.values(r.state.finance.assets)[0].kind,'YACHT_JET');
  // 开局资产描述同样收紧到 50 字内。
  for(const preset of openingPresets)for(const a of preset.assets){
    assert(a.description.length>=20&&a.description.length<=50,preset.id+' '+a.description.length);
    assert.equal(assetDescription({...a}),a.description);
  }
});

// ----- 7. UI：三轴、四方块、顺序与折叠 -----
test('rc.25 the phone shows three axes, 2x2 blocks and folds the history cards',()=>{
  const s=initial();
  s.characters.char_a.arousal=20;
  const {ctx,screens}=screensFor(s);
  ctx.expanded.add('char_a');
  const scene=screens.scene();
  assert(scene.includes('♥ 好感 90/100 · ❖ 堕落 0/100 · 🌡️ 情动 20/100'));
  assert(scene.includes('💭 心声')===false,'没有心声时不显示空行');
  for(const label of ['🎬 此刻 · 动向','👗 行头 · 穿戴','📋 身姿 · 基础','🌹 欲念 · 私密'])assert(scene.includes(label),label);
  assert(scene.includes('查看人物档案 →'));
  const detail=screens.detail(s.characters.char_a);
  assert(detail.includes('♥ 好感度：90/100'));assert(detail.includes('❖ 堕落度：0/100'));assert(detail.includes('🌡️ 情动度：20/100'));
  for(const label of ['📋 身姿 · 基础','🌹 欲念 · 肉体','👗 行头 · 穿搭','🔥 经历 · 尺度'])assert(detail.includes(label),label);
  assert(detail.indexOf('人物与私密档案')<detail.indexOf('消费记录'),'档案排在消费记录之前');
  assert(detail.indexOf('九大档案')<detail.indexOf('消费记录'));
  assert(detail.includes('<details class="card consumption"><summary>消费记录'),'消费记录默认折叠');
  assert(!detail.includes('这些记录来自实际接触')&&!detail.includes('档案供你查阅'),'出戏提示已删除');
  const mine=screensFor(schemas.state.parse(completeInitialState(fresh({initialAssets:[{assetId:'car_1',kind:'CAR',name:'家用轿车',bookValueCents:10000000,locationNote:'住宅车库'}]}),{startDate:'2026-01-05',startTime:'09:00'}))).screens.mine();
  assert(mine.includes('class="split-item"')&&mine.includes('可用现金')&&mine.includes('持有资产'));
  assert(mine.includes('class="asset-head"')&&mine.includes('asset-description'));
  assert.equal((mine.match(/data-asset-tab=/g)||[]).length,8);
});

// ----- 8. 世界书与协议定稿关键词 -----
test('rc.25 the protocol and worldbook carry the seven asset classes and the body feedback rules',async()=>{
  const fs=await import('node:fs/promises');
  const protocol=await fs.readFile(new URL('../src/content/protocol.txt',import.meta.url),'utf8');
  assert(protocol.includes('HOUSE|CAR|BUSINESS|YACHT_JET|LUXURY|COLLECTIBLE|OTHER'));
  assert(protocol.includes('20至45字内'));
  const literary=JSON.parse(await fs.readFile(new URL('../src/content/literary.json',import.meta.url),'utf8'));
  const score=literary.entries.find(e=>e.id==='score').body;
  const privateLife=literary.entries.find(e=>e.id==='private-life').body;
  assert(score.includes('饱满馒头穴')&&score.includes('abilityComment'));
  assert(privateLife.includes('天生白虎')&&privateLife.includes('vaginaState'));
  assert(literary.entries.find(e=>e.id==='score').constant===true);
  assert(literary.entries.find(e=>e.id==='private-life').constant===true);
});
