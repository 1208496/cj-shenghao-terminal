import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {clone,seedAnatomy,archetypeOf,formatYuanReadable,tierBasis,projection,poolParts,wealthTier,applyOperation} from '../src/core/engine.js';
import {fresh,contact,anchor,source,payment} from './fixtures.mjs';

const schemas=createSchema(z);
const base=(extra={},contacts=[contact('char_a',{affection:90})])=>schemas.state.parse(completeInitialState(fresh({contacts,...extra}),{startDate:'2026-01-05',startTime:'09:00'}));
const score=(extra={})=>({type:'SIGNIFICANT_BEHAVIOR_SCORE',personRef:'char_a',action:'主卧深拥与交欢',score:92,mode:'INTIMATE',...extra});
const runOnce=(suit,pending,msg=3)=>{
  const before=clone(suit),candidate=clone(suit);
  candidate.pendingEvents=pending;
  return settleNative(before,candidate,anchor(msg),'本轮正文',schemas).state;
};

// ----- 7. 旧存档：currentGoal 被 strip，三层链补空后由脚本播种 -----
test('rc.30 旧状态的 currentGoal 被剥离，三层心绪链可被脚本补齐',()=>{
  const legacy=base();
  delete legacy.characters.char_a.recentGoal;
  delete legacy.characters.char_a.longTermDream;
  delete legacy.characters.char_a.hiddenScar;
  legacy.characters.char_a.currentGoal='月底要凑齐店铺续租的押金';
  const parsed=schemas.state.parse(legacy);
  const c=parsed.characters.char_a;
  assert.equal(Object.prototype.hasOwnProperty.call(c,'currentGoal'),false,'旧字段应被 strip');
  assert.equal(c.recentGoal,'');
  assert.equal(c.longTermDream,'');
  assert.equal(c.hiddenScar,'');
  const seeded=seedAnatomy(clone(c));
  for(const k of ['recentGoal','longTermDream','hiddenScar'])assert(seeded[k].length>10,k);
});

// ----- 8. 建档时允许补齐伏笔，但不覆盖已有内容 -----
test('rc.30 PLAYER_BUILD_PROFILE 只在空缺时补三层链',()=>{
  const s=base();
  s.characters.char_a.recentGoal='';
  s.characters.char_a.hiddenScar='';
  s.characters.char_a.longTermDream='已经在推进的梦想';
  const op={type:'PLAYER_BUILD_PROFILE',operationId:'op_build_30',personRef:'char_a',expectedRevision:s.meta.revision,
    profileFixed:Object.fromEntries(['identity','appearance','body','personality','habits','style','family','career','social'].map((k)=>[k,'档案'+k])),
    physiology:{},outfit:{},intimacy:{},limits:{},
    recentGoal:'新的近期目标',longTermDream:'不该覆盖的梦想',hiddenScar:'新的暗伤伏笔'};
  const out=applyOperation(clone(s),op,anchor(3));
  assert.equal(out.characters.char_a.recentGoal,'新的近期目标');
  assert.equal(out.characters.char_a.longTermDream,'已经在推进的梦想','已有梦想不被覆盖');
  assert.equal(out.characters.char_a.hiddenScar,'新的暗伤伏笔');
});

test('rc.30 三层心绪链由脚本播种，UI 不渲染 hiddenScar',()=>{
  const c=seedAnatomy({id:'char_seed_life',name:'测试',personalityTags:['高冷','严谨'],occupation:'审计师',appearance:'冷色西装'});
  for(const k of ['recentGoal','longTermDream','hiddenScar'])assert(typeof c[k]==='string'&&c[k].length>20,k);
  assert.equal(archetypeOf(c),'cool');
  const s=base();
  s.characters.char_a.recentGoal=contact('char_a').recentGoal||'正在筹备独立策展';
  s.characters.char_a.longTermDream='在临海开一间自己的工作室';
  s.characters.char_a.hiddenScar='三年前的雨夜错过了母亲的最后一面';
  const p=projection(s).characters.char_a;
  assert.equal(p.hiddenScar,'三年前的雨夜错过了母亲的最后一面');
  assert.equal(p.recentGoal,'正在筹备独立策展');
  assert.equal(p.longTermDream,'在临海开一间自己的工作室');
});

// ----- 2. 五大原型分流 + 违禁套话清零 -----
test('rc.30 五大原型分流且清零「羞于启齿却身体诚实」',()=>{
  const samples=[
    ['cool',{personalityTags:['清冷','严谨'],occupation:'审计师'}],
    ['proud',{personalityTags:['强势','野心'],occupation:'公司创始人'}],
    ['sunny',{personalityTags:['开朗','元气'],occupation:'健身教练'}],
    ['pure',{personalityTags:['青涩','内敛'],occupation:'实习助教'}],
    ['warm',{personalityTags:['温柔','细腻'],occupation:'花艺师'}],
  ];
  const seen=new Set();
  for(const [tag,shape] of samples){
    const c=seedAnatomy({id:'char_'+tag,name:tag,...shape});
    assert.equal(archetypeOf(c),tag,JSON.stringify(shape));
    const text=JSON.stringify([c.physiology.bodyScent,c.physiology.traits,c.intimacy.attitude,c.intimacy.fetishes,c.limits.weakness,c.limits.worry]);
    assert(!text.includes('羞于启齿却身体诚实'),tag);
    seen.add(c.intimacy.attitude);
  }
  assert(seen.size>=4,'不同原型的性观念应互不雷同');
});

// ----- 3. 同人同日阶梯衰减 + 单日 45 万软上限 -----
test('rc.30 同人同日暴击阶梯衰减且单日不超过 45 万',()=>{
  let s=base();
  const amounts=[];
  for(let i=0;i<5;i+=1){
    s=runOnce(s,[score({action:'同一晚第'+i+'轮温存',tags:['深情热吻']})],3+i);
    const ev=Object.values(s.rewardEvents).sort((a,b)=>(a.createdRevision??0)-(b.createdRevision??0)).at(-1);
    amounts.push(ev.cashbackCents);
  }
  assert(amounts[0]>amounts[1],'第二笔应低于首笔：'+amounts.join(','));
  assert(amounts[1]>=amounts[2],'第三笔应继续走低：'+amounts.join(','));
  assert(amounts[3]<=688800&&amounts[4]<=688800,'第四笔起封顶 6888 元：'+amounts.join(','));
  const total=Object.values(s.rewardEvents).reduce((n,r)=>n+(r.cashbackCents||0),0);
  assert(total<=45000000,'当日累计不超过 45 万：'+total);
});

// ----- 4. 旧标签复刷降档折半 -----
test('rc.30 INTIMATE 旧玩法复刷会降档并折半',()=>{
  let s=base();
  s=runOnce(s,[score({action:'主卧深吻并发生首次交欢',tags:['深情热吻','鱼水之欢']})],3);
  const first=Object.values(s.rewardEvents).at(-1).cashbackCents;
  const before=Object.values(s.rewardEvents).length;
  s=runOnce(s,[score({action:'又一次浓情热吻后交欢',tags:['深情热吻','鱼水之欢']})],4);
  const events=Object.values(s.rewardEvents);
  assert.equal(events.length,before+1);
  const second=events.at(-1);
  assert(second.effectiveScore<=80,'复刷有效分应降档：'+second.effectiveScore);
  assert(second.cashbackCents<first,`复刷金额应低于首爆：${second.cashbackCents} vs ${first}`);
});

// ----- 5. limits 越级强推压分 -----
test('rc.30 openness 不足时的越级强推被压到微光档',()=>{
  const shy=base({},[contact('char_a',{affection:20,corruption:0})]);
  const s=runOnce(shy,[score({action:'强势按在落地窗边深深插入',score:90,tags:['背德偷欢']})],3);
  const ev=Object.values(s.rewardEvents)[0];
  assert(ev,'应仍入账但压档');
  assert.equal(ev.effectiveScore,55);
  assert(ev.cashbackCents<=688800);
});

// ----- 6. cashYuan 派生 + 转赠资产计入计级身家 -----
test('rc.30 投影给可读金额，转赠资产不再洗回十倍身家',()=>{
  assert.equal(formatYuanReadable(100000000),'100万元（¥1,000,000）');
  const s=base();
  s.user.cashCents=3000000000;s.user.initialCashCents=3000000000;
  const p=projection(s);
  assert.equal(p.user.cashYuan,formatYuanReadable(3000000000));
  const paid=runOnce(s,[payment({amountCents:1500000000,kind:'PROPERTY_PURCHASE',allocations:[],asset:{assetId:'asset_home_1',kind:'HOUSE',name:'江景大平层',ownerId:'USER',bookValueCents:1500000000}})],4);
  assert.equal(tierBasis(paid),paid.user.cashCents+1500000000);
  const tierBefore=wealthTier(tierBasis(paid));
  const gifted=clone(paid);
  gifted.finance.assets.asset_home_1.ownerId='char_a';
  gifted.finance.assets.asset_home_1.status='TRANSFERRED';
  assert.equal(tierBasis(gifted),tierBasis(paid),'转赠后计级身家不变');
  assert.equal(wealthTier(tierBasis(gifted)).id,tierBefore.id);
});




