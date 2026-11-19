import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,prepareModelCommand} from '../src/runtime/settlement.js';
import {clone,seedAnatomy,assetDescription,projection,poolParts,applyEnvelope,inferCupSize} from '../src/core/engine.js';
import {createScreens} from '../src/ui/screens.js';
import {openingPresets} from '../src/ui/opening-presets.js';
import {fresh,contact,anchor,payment,envelope} from './fixtures.mjs';

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
  assert(cupSeeded.physiology.vaginaState.length>0&&!/未经人事|处子/.test(cupSeeded.physiology.vaginaState));
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
  assert.match(sex.state.characters.char_a.physiology.vaginaState,/刚经历亲密交欢|刚经受强悍肉体充分开发/);
  const creampie=run(before,[{type:'BEHAVIOR',personRef:'char_a',mode:'INTIMATE',action:'无套内射把她灌满',score:94,tags:['无套内射']}]);
  assert.match(creampie.state.characters.char_a.physiology.vaginaState,/灌满(浓稠|滚烫)精液/);
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
  assert(before.characters.char_a.currentClothes.includes(before.characters.char_a.outfit.top),'整套行头里应含上装');
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
  assert(scene.includes('♥ 好感 90/100 · ❖ 堕落 0/100 · 🌡️ 情欲 20/100'));
  assert(scene.includes('💭 心声')===false,'没有心声时不显示空行');
  for(const label of ['🎬 此刻 · 动向','👗 行头 · 穿戴','📋 身姿 · 基础','🌹 欲念 · 私密'])assert(scene.includes(label),label);
  assert(scene.includes('查看人物档案 →'));
  const detail=screens.detail(s.characters.char_a);
  assert(detail.includes('♥ 好感度：90/100'));assert(detail.includes('❖ 堕落度：0/100'));assert(detail.includes('🌡️ 情欲值：20/100'));
  for(const label of ['📋 身姿 · 基础','🌹 欲念 · 肉体','👗 行头 · 穿搭','🔥 经历 · 尺度'])assert(detail.includes(label),label);
  assert(detail.indexOf('人物与私密档案')<detail.indexOf('消费记录'),'档案排在消费记录之前');
  assert(detail.indexOf('九大档案')<detail.indexOf('消费记录'));
  assert(detail.includes('<details class="card consumption"><summary>消费记录'),'消费记录默认折叠');
  assert(!detail.includes('这些记录来自实际接触')&&!detail.includes('档案供你查阅'),'出戏提示已删除');
  // rc.36：财富总览、持有资产与收支明细迁到独立的「财富」页，「我的」只留个人档案与异能。
  const rich=screensFor(schemas.state.parse(completeInitialState(fresh({initialAssets:[{assetId:'car_1',kind:'CAR',name:'家用轿车',bookValueCents:10000000,locationNote:'住宅车库'}]}),{startDate:'2026-01-05',startTime:'09:00'}))).screens;
  const wealth=rich.wealth();
  assert(wealth.includes('class="split-item"')&&wealth.includes('可用现金')&&wealth.includes('持有资产'));
  assert(wealth.includes('class="asset-head"')&&wealth.includes('asset-description'));
  assert.equal((wealth.match(/data-asset-tab=/g)||[]).length,8);
  const mine=rich.mine();
  assert(!mine.includes('class="split-item"'),'我的页不再塞财富总览');
  assert(!mine.includes('data-act="open-bag"'),'我的页不再挂背包入口');
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
  assert(score.includes('abilityComment')&&score.includes('hiddenScar'));
  assert(privateLife.includes('天生白虎')&&privateLife.includes('vaginaState'));
  assert(literary.entries.find(e=>e.id==='score').constant===true);
  assert(literary.entries.find(e=>e.id==='private-life').constant===true);
});

// ----- 9. rc.26：prepareModelCommand 全路径归一化（根除 MVU 红字） -----
test('rc.26 an add/insert on an existing character is normalized to set without losing stored fields',()=>{
  const before=schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
  for(const type of ['add','insert','set']){
    const command={type,args:['shenghao.characters.char_a',JSON.stringify({id:'char_a',name:'顾青禾',affection:65})]};
    assert.equal(prepareModelCommand(command,before,schemas),true,type);
    assert.equal(command.type,'set',type);
    const merged=JSON.parse(command.args.at(-1));
    assert.equal(merged.affection,65);
    assert.equal(merged.age,26,'原有年龄不能被半截对象冲掉');
    assert(merged.physiology.chestDetail.length>0,'播种的胸型档案要保留');
    assert(merged.outfit.top.length>0,'开局穿搭要保留');
    assert.equal(merged.trackingState,'RECORDED');
    assert.doesNotThrow(()=>schemas.character.parse(merged),'归一化后必须能过 Zod');
  }
});
test('rc.26 an insert on the characters root is turned into a per-character set',()=>{
  const before=schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
  const command={type:'insert',args:['shenghao.characters','char_a',JSON.stringify({name:'顾青禾',affection:70})]};
  assert.equal(prepareModelCommand(command,before,schemas),true);
  assert.equal(command.type,'set');
  assert.equal(command.args[0],'shenghao.characters.char_a');
  const merged=JSON.parse(command.args.at(-1));
  assert.equal(merged.affection,70);assert.equal(merged.age,26);
  assert.doesNotThrow(()=>schemas.character.parse(merged));
});
test('rc.26 a brand-new character missing required fields is completed instead of rejected',()=>{
  const before=schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
  const command={type:'insert',args:['shenghao.characters.char_new',JSON.stringify({id:'char_new',name:'苏晚'})]};
  assert.equal(prepareModelCommand(command,before,schemas),true);
  assert.equal(command.type,'set');
  const created=JSON.parse(command.args.at(-1));
  assert.equal(created.id,'char_new');assert.equal(created.name,'苏晚');
  assert.equal(created.affection,20);assert.equal(created.arousal,0);assert.equal(created.trackingState,'RECORDED');
  assert.doesNotThrow(()=>schemas.character.parse(created));
});

// ----- 10. rc.26：顶栏神豪徽章与提现倍率对齐 -----
test('rc.26 the tier badge follows tierBasis so buying a house never drops it back to ten-x',()=>{
  let s=schemas.state.parse(completeInitialState(fresh({initialCashCents:2000000000,contacts:[contact('char_a',{affection:80})]}),{startDate:'2026-01-05',startTime:'09:00'}));
  assert.equal(s.user.cashCents,2000000000);
  s=applyEnvelope(s,envelope(payment({factId:'house_pay',kind:'PROPERTY_PURCHASE',amountCents:1500000000,allocations:[],asset:{assetId:'house_new',kind:'HOUSE',name:'云玺湾临江大平层',ownerId:'USER'}})),anchor(9),'确实已经发生');
  assert.equal(s.user.cashCents,500000000);
  const {screens}=screensFor(s);
  const scene=screens.scene();
  assert(scene.includes('豪门新贵·八倍'),'徽章按计级身家算，仍是八倍');
  assert(!scene.includes('新晋神豪·十倍'));
  assert(screens.detail(s.characters.char_a).includes('豪门新贵·八倍'));
  assert(screens.mine().includes('豪门新贵·八倍'));
});

// ----- 11. rc.26：行头面板不再重影 -----
test('rc.26 the outfit panel never repeats currentClothes as the top item',()=>{
  const s=schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
  s.characters.char_a.currentClothes='白色真丝衬衫';
  s.characters.char_a.outfit={...s.characters.char_a.outfit,top:'白色真丝衬衫'};
  const {ctx,screens}=screensFor(s,{privateSection:2});
  const html=screens.detail(s.characters.char_a),flat=html.replace(/<[^>]*>/g,'');
  assert.equal(html.split('白色真丝衬衫').length-1,1,'同一句穿着只渲染一次');
  assert(flat.includes('此刻穿着：白色真丝衬衫'));
  assert(!html.includes('上装：白色真丝衬衫'));
  ctx.sceneSectionByChar.set('char_a',1);
  ctx.expanded.add('char_a');
  const scene=screens.scene();
  assert.equal(scene.split('白色真丝衬衫').length-1,1,'此刻页行头方块同样不重影');
});

// ----- 12. rc.26：诊断文案说人话但保留错误码 -----
test('rc.26 diagnostics translate common codes while keeping the raw code',async()=>{
  const {diagnosticMessage}=await import('../src/runtime/diagnostics.js');
  const text=diagnosticMessage([{eventType:'CASH_TRANSACTION',code:'INSUFFICIENT_CASH',ordinal:0}]);
  assert(text.includes('可用现金不足'));
  assert(text.includes('INSUFFICIENT_CASH'));
});

// ----- 13. rc.27：真实下胸围罩杯公式，六位预设各归其位 -----
test('rc.27 the underbust cup formula matches all six preset women instead of giving everyone D',async()=>{
  const {contactPresets}=await import('../src/ui/setup-options.js');
  const expected={cafe_neighbor:'B',design_colleague:'B',florist_friend:'C',startup_partner:'C',uni_alumni:'D',gym_coach:'E'};
  assert.equal(contactPresets.length,6);
  for(const p of contactPresets){
    assert.equal(p.cupSize,expected[p.presetId],p.presetId+' 预设罩杯定稿');
    assert.equal(inferCupSize(p.bustCm,p.waistCm,p.heightCm),p.cupSize,p.presetId+' 公式与预设一致');
  }
  assert.equal(new Set(contactPresets.map(p=>p.cupSize)).size,4,'不再全员同一罩杯');
  // 档位边界与身高修正：腰围只决定下胸围的基数，身高越高下胸围越大。
  assert.equal(inferCupSize(80,59,163),'B');assert.equal(inferCupSize(84,60,166),'C');
  assert.equal(inferCupSize(92,62,172),'E');assert.equal(inferCupSize(96,62,172),'F');
  assert.equal(inferCupSize(74,62,172),'A');assert.equal(inferCupSize(80,62),inferCupSize(80,62,165),'不传身高默认 165');assert.equal(inferCupSize(80,62),'A');
  assert(['B','C','C','D','D','E','F'].includes(inferCupSize(0,0,165)),'没有三围时按哈希分布抽杯型');
  assert.equal(inferCupSize(0,0,165,0),inferCupSize(0,0,165,0),'同一哈希每次都一样');
  assert.equal(inferCupSize(0,0,165,5),inferCupSize(0,0,165,5));
  // 播种时反推出来的罩杯会回填给人物，界面才有「（C 罩杯）」。
  const seeded=seedAnatomy({id:'char_cup_only',heightCm:168,bustCm:86,waistCm:62,intimacy:{},limits:{}});
  assert.equal(seeded.cupSize,inferCupSize(86,62,168));
});

// ----- 14. rc.27：365px 窄屏分层（胶囊/左键右值/句首染色/隔衣未知/底线变色格） -----
test('rc.27 the narrow-screen panels render chips, kv rows, lead highlights, lock chips and limit cells',()=>{
  const s=initial();
  Object.assign(s.characters.char_a,{currentThought:'他刚才是不是在试探我',recentGoal:'月底要凑齐店铺续租的押金',longTermDream:'开一家自己说了算的独立工作室',hiddenScar:'早年合伙被背刺，从此不肯再轻信承诺',currentExpression:'眼角弯出浅浅的弧度',currentMood:'心情不错',currentAction:'半靠在窗边'});
  s.characters.char_a.physiology.chestDetail='C罩杯丰盈圆润型，浅粉娇嫩乳晕，掌感极佳';
  s.characters.char_a.physiology.vaginaLook='微绽蝴蝶唇 · 花瓣柔嫩饱满';
  s.characters.char_a.outfit={...s.characters.char_a.outfit,lingerie:'未知',socks:'尚未记录'};
  s.characters.char_a.limits={...s.characters.char_a.limits,scaleLevel:3,exposure:0,foreplay:2,intercourse:3};
  const {ctx,screens}=screensFor(s,{privateSection:3});
  const scene=screens.scene();
  assert(!scene.includes('class="chips"'),'折叠态不铺开面板');
  ctx.expanded.add('char_a');ctx.sceneSectionByChar.set('char_a',0);
  const expanded=screens.scene();
  assert(expanded.includes('class="chips"')&&expanded.includes('chip-tag'),'胶囊横条');
  assert(expanded.includes('💭 心声：<i>他刚才是不是在试探我</i>')&&expanded.includes('thought-card'));
  assert(expanded.includes('🎯 近期目标：月底要凑齐店铺续租的押金')&&expanded.includes('goal-card'));
  assert(!expanded.includes('早年合伙被背刺'),'暗伤伏笔不渲染');
  assert(expanded.includes('class="kv"')&&expanded.includes('kv-k')&&expanded.includes('kv-v'),'左键右值行');
  assert(expanded.includes('神情：眼角弯出浅浅的弧度'),'神情进胶囊');
  ctx.sceneSectionByChar.set('char_a',2);
  const basic=screens.scene();
  assert(basic.includes('class="mini-stats"')&&basic.includes('身高：'),'三格微型数字卡');
  assert(basic.includes('hl-pink'),'三围高亮');
  ctx.sceneSectionByChar.set('char_a',3);
  const secret=screens.scene();
  assert(secret.includes('<b class="hl-pink">微绽蝴蝶唇</b>'),'句首核心词染色');
  assert(secret.includes('阴部户型与色泽'),'左栏保留四字检索词');
  ctx.privateSection=1;
  const flesh=screens.detail(s.characters.char_a);
  assert(flesh.includes('<b class="hl-pink">C罩杯丰盈圆润型</b>'),'胸部详情句首染色');
  ctx.privateSection=3;
  const detail=screens.detail(s.characters.char_a);
  assert(detail.includes('class="limit-grid"')&&(detail.match(/limit-cell/g)||[]).length===8,'八大底线 2×4 格');
  assert(detail.includes('limit-cell locked'),'0 档弱化');
  assert(detail.includes('chip-amber')&&detail.includes('chip-pink'),'2/3 档变色');
  ctx.privateSection=2;
  const outfit=screens.detail(s.characters.char_a);
  assert(outfit.includes('🔒 隔衣未知'),'未知内衣转小锁标');
  assert.equal((outfit.match(/🔒 隔衣未知/g)||[]).length,2,'内衣与丝袜两处都转锁标');
  assert(!scene.includes('class="kv"'),'折叠态不铺 kv 行');
});

// ----- 15. rc.27：设置页新增「显示位置」双模式开关 -----
test('rc.27 the settings screen offers float and bottom dock choices',()=>{
  const {ctx,screens}=screensFor(initial());
  const html=screens.settings();
  assert(html.includes('data-display-dock="float"')&&html.includes('悬浮小手机'));
  assert(html.includes('data-display-dock="bottom"')&&html.includes('固定正文底部'));
  assert(html.includes('显示位置'));
  assert(html.indexOf('显示位置')<html.indexOf('手机尺寸'),'显示位置排在手机尺寸之前');
  ctx.view.prefs.displayDock='bottom';
  const bottom=screens.settings();
  assert(bottom.includes('data-display-dock="bottom" aria-pressed="true"'),'当前档位高亮');
  assert(!bottom.includes('data-display-dock="float" aria-pressed="true"'));
});

// ----- 16. rc.28：三层反差罩杯（文字优先 → 双向骨架 → 无三围哈希） -----
test('rc.28 the cup formula reads text hints and lets petite waists reach E/F',async()=>{
  const {contactPresets}=await import('../src/ui/setup-options.js');
  // 预设六人不受影响。
  const expected={cafe_neighbor:'B',design_colleague:'B',florist_friend:'C',startup_partner:'C',uni_alumni:'D',gym_coach:'E'};
  for(const p of contactPresets)assert.equal(inferCupSize(p.bustCm,p.waistCm,p.heightCm),expected[p.presetId],p.presetId);
  // 151/55/83 娇小细腰：骨架修正（h−160 变负）把她推到 F。
  assert.equal(inferCupSize(83,55,150),'F','150cm 娇小细腰算出来是 F 罩杯');
  assert.equal(inferCupSize(84,55,150),'F');
  assert.notEqual(inferCupSize(83,55,150),inferCupSize(83,55,170),'身高必须参与骨架修正');
  // 第一层：文字描述优先于数字。
  assert.equal(inferCupSize(0,0,150,'身材娇小却有着惊人的巨乳',6),'E');
  assert.equal(inferCupSize(0,0,150,'身材娇小却有着惊人的巨乳',7),'F');
  assert.equal(inferCupSize(80,60,165,'平胸少女，瘦得干净'),'A');
  assert.equal(inferCupSize(80,60,165,'她分明是 D杯 的丰满'),'D','明确字母最优先');
  assert.equal(inferCupSize(80,60,165,'童颜巨乳，反差极大'),'E','同义巨乳词同样命中');
  // 第二层仍按差值分档。
  assert.equal(inferCupSize(96,62,172),'F');
  assert.equal(inferCupSize(74,62,172),'A');
  // 第三层：没有三围时按 hash 分布，不再固定 C。
  const pool=['B','C','C','D','D','E','F'];
  for(let seed=0;seed<7;seed+=1)assert.equal(inferCupSize(0,0,165,'',seed),pool[seed%7]);
  // 播种：body/appearance 里的反差描述能改判，显式 cupSize 永远优先。
  assert(['E','F'].includes(seedAnatomy({id:'char_busty',body:'身材娇小却有着惊人的巨乳'}).cupSize));
  assert.equal(seedAnatomy({id:'char_flat',appearance:'平胸少女，清瘦利落'}).cupSize,'A');
  assert.equal(seedAnatomy({id:'char_explicit',cupSize:'B',body:'惊人的巨乳'}).cupSize,'B');
});

// ----- 17. rc.28：性器尺寸/特征下拉预设 -----
test('rc.28 the setup form offers genital size and trait presets',async()=>{
  const {fieldOptions}=await import('../src/ui/setup-options.js');
  assert.deepEqual(fieldOptions('_gen_length'),['16cm','18cm','20cm','22cm','24cm']);
  assert.deepEqual(fieldOptions('_gen_girth'),['4.2cm','4.8cm','5.2cm','5.6cm','6.0cm']);
  const traits=fieldOptions('_gen_traits');
  assert.equal(traits.length,6);
  assert(traits.includes('形态饱满挺拔，青筋分明，热度惊人'));
  assert(traits.every(t=>t.length>=8));
  assert.deepEqual(fieldOptions('name'),[],'姓名不给候选');
});

// ----- 18. rc.28：资产可编辑标记 + 宽屏底部面板接线 -----
test('rc.28 assets are editable and the bottom dock renders a full-width panel',async()=>{
  const fs=await import('node:fs/promises');
  const app=await fs.readFile(new URL('../src/ui/app.js',import.meta.url),'utf8');
  assert(app.includes('let editingContactId=null,editingAssetId=null'));
  assert(app.includes('data-edit-asset="${esc(a.assetId)}"')&&app.includes('data-remove-asset="${esc(a.assetId)}"'),'资产卡片同时有编辑与移除');
  assert(app.includes('if(d.editAsset){collect();assetForm(d.editAsset);}'));
  assert(app.includes('编辑已有资产')&&app.includes('保存修改'),'assetForm 支持编辑模式');
  assert(app.includes("editingAssetId?draft.initialAssets.map(old=>old.assetId===editingAssetId?item:old)"),'编辑时原位替换并保留 assetId');
  assert(app.includes("document.body.classList.toggle('is-bottom-dock',isBottom)"));
  assert(app.includes('function syncBottomHeight()')&&app.includes("api?.geometry?.({width:365,height:h,wide:true})"));
  assert(app.includes('class="wide-nav"')&&app.includes('wide-tab'),'顶栏一体化导航');
  const host=await fs.readFile(new URL('../src/runtime/host.js',import.meta.url),'utf8');
  assert(host.includes("width:'100%'"),'底部模式 iframe 满宽');
  assert(host.includes('Math.max(260,Math.min(height,2400))'),'高度跟随内容并限幅');
  const css=await fs.readFile(new URL('../src/ui/style.css',import.meta.url),'utf8');
  assert(css.includes('.phone.is-bottom-dock'));
  assert(css.includes('.phone.is-bottom-dock::before{display:none!important}'),'去掉刘海');
  assert(css.includes('.phone.is-bottom-dock .bottom{display:none!important}'),'底部导航让位给顶栏');
  assert(css.includes('.phone.is-bottom-dock .women-grid{grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert(css.includes('.phone.is-bottom-dock .dossier-grid{grid-template-columns:repeat(4,minmax(0,1fr))}'));
});

