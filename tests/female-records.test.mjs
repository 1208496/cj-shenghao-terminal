import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,prepareModelCommand} from '../src/runtime/settlement.js';
import {clone,projection,applyOperation,PROFILE_LABELS,profile,corruptionStage,canWithdraw,poolParts,computeCycle,reward,wealthTier,withdrawalQuote,applyEnvelope,prowessTier} from '../src/core/engine.js';
import {contactPresets} from '../src/ui/setup-options.js';
import {createScreens} from '../src/ui/screens.js';
import {fresh,contact,anchor,profiles,payment,score,event,envelope,source,inRange} from './fixtures.mjs';
const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh({contacts:[contact(),contact('char_b',{present:false})]}),{startDate:'2026-01-05',startTime:'09:00'}));
const star=(s,personRef='char_b')=>applyOperation(s,{type:'PLAYER_STAR',operationId:crypto.randomUUID(),personRef,expectedRevision:s.meta.revision},anchor());
const screensFor=state=>{const ctx={view:{state,prefs:{},busy:false},expanded:new Set(),section:null,privateSection:null,consumptionPage:0,sceneSectionByChar:new Map()};const screens=createScreens({data:()=>ctx,esc:v=>String(v??''),yuan:v=>'¥'+v/100,image:()=>'',avatar:()=>''});return {ctx,screens};};

test('light private fields default on both the schema and engine-built records',()=>{
  const legacy=schemas.character.parse({id:'char_x',name:'沈知夏',age:27,beautyScore:72,affection:30,relationshipLabel:'客户'});
  assert.equal(legacy.cupSize,'');assert.equal(legacy.addressing,'');assert.equal(legacy.impression,'');assert.equal(legacy.starred,false);
  assert.equal(legacy.currentThought,'');assert.equal(legacy.arousal,0);assert.equal(legacy.offscreen,'');
  assert.deepEqual(legacy.physiology,{cycle:'',pregnancy:'未孕',virgin:null,hymenNote:'',chestDetail:'',vaginaLook:'',vaginaState:'',pubicHair:'',anusLook:'',anusState:'',bodyScent:'',tattooScar:'',traits:''});
  assert.deepEqual(legacy.outfit,{style:'',complexion:'',top:'',bottom:'',lingerie:'',socks:'',shoes:'',makeup:'',accessories:''});
  assert.deepEqual(legacy.intimacy,{attitude:'',abilityComment:'',partnersCount:0,sexPartnerCount:0,firstTime:'',experience:'',fetishes:'',unlockedTags:[],withUserCount:0,lastIntimate:'',lastMasturbation:''});
  assert.deepEqual(legacy.limits,{scaleLevel:0,weakness:'',worry:'',exposure:0,foreplay:0,intercourse:0,cosplay:0,creampie:0,anal:0,publicPlay:0,multi:0});
  const built=fresh().characters.char_a;
  assert.equal(built.cupSize,'');assert.equal(built.starred,false);assert.equal(built.arousal,0);assert.deepEqual(built.intimacy.unlockedTags,[]);
});

test('arousal clamps to 0–100 and unlockedTags accepts a delimited string or an array',()=>{
  assert.equal(schemas.character.parse({id:'c',name:'甲',age:24,beautyScore:60,affection:20,relationshipLabel:'熟人',arousal:180}).arousal,100);
  assert.equal(schemas.character.parse({id:'c',name:'甲',age:24,beautyScore:60,affection:20,relationshipLabel:'熟人',arousal:-9}).arousal,0);
  assert.equal(schemas.character.parse({id:'c',name:'甲',age:24,beautyScore:60,affection:20,relationshipLabel:'熟人',arousal:'42'}).arousal,42);
  assert.deepEqual(schemas.character.parse({id:'c',name:'甲',age:24,beautyScore:60,affection:20,relationshipLabel:'熟人',intimacy:{unlockedTags:'拥抱、亲吻 / 留宿'}}).intimacy.unlockedTags,['拥抱','亲吻','留宿']);
  assert.deepEqual(schemas.character.parse({id:'c',name:'甲',age:24,beautyScore:60,affection:20,relationshipLabel:'熟人',intimacy:{unlockedTags:['拥抱']}}).intimacy.unlockedTags,['拥抱']);
});

test('the projection sends private records only for present women and one off-stage line for starred ones',()=>{
  let s=initial();
  Object.assign(s.characters.char_a,{cupSize:'C',addressing:'哥哥',impression:'谈吐不急不缓，值得来往',currentThought:'他刚才那句话，是不是在试探我',arousal:35});
  s.characters.char_a.physiology={cycle:'安全期',pregnancy:'未孕',virgin:null,traits:'耳后敏感'};
  s.characters.char_a.intimacy={attitude:'外冷内热',experience:'谈过一段校园恋',fetishes:'喜欢被夸奖',unlockedTags:['拥抱'],withUserCount:1,lastIntimate:'2026-01-05 · 花店门口的拥抱'};
  let view=projection(s).characters.char_a;
  assert.equal(view.cupSize,'C');assert.equal(view.addressing,'哥哥');assert.equal(view.impression,'谈吐不急不缓，值得来往');
  assert.equal(view.currentThought,'他刚才那句话，是不是在试探我');assert.equal(view.arousal,35);
  assert.equal(view.physiology.traits,'耳后敏感');assert.deepEqual(view.intimacy.unlockedTags,['拥抱']);
  assert.equal(projection(s).characters.char_b.currentThought,undefined);
  s=star(s);
  s.characters.char_b.offscreen='城南美术馆 · 正在布展';
  view=projection(s).characters.char_b;
  assert.deepEqual(Object.keys(view).sort(),['affection','aliases','corruption','currentGoal','id','name','offscreen','relationshipLabel','starred','trackingState']);
  assert.equal(view.offscreen,'城南美术馆 · 正在布展');assert.equal(view.starred,true);
  assert.equal(projection(s).characters.char_b.physiology,undefined);
  assert.equal(star(s).characters.char_b.starred,false);
});

test('starred is player-owned: a model proposal cannot flip it, and new people survive missing body data',()=>{
  const before=star(initial()),candidate=clone(before);
  candidate.characters.char_b.starred=false;candidate.characters.char_b.currentThought='本轮心声';
  const settled=settleNative(before,candidate,anchor(),'本轮正文',schemas).state;
  assert.equal(settled.characters.char_b.starred,true);assert.equal(settled.characters.char_b.currentThought,'本轮心声');

  const sparse=clone(before);
  sparse.characters.char_c={id:'char_c',name:'林听白',age:23,affection:22,relationshipLabel:'邻居',firstContactEvidence:'未逐字出现的一句话',heightCm:900,personalityTags:['安静']};
  const kept=settleNative(before,sparse,anchor(),'本轮正文',schemas);
  const person=kept.state.characters.char_c;
  assert(person,'a new person is kept even without a verbatim quote or valid body numbers');
  assert.equal(person.name,'林听白');assert.equal(person.heightCm,null);
  assert.equal(person.cupSize,'');assert.equal(person.starred,false);
  assert(!kept.diagnostics.some(d=>['CONTACT_NOT_CONFIRMED','PROFILE_INCOMPLETE'].includes(d.code)));
  assert(projection(kept.state).pendingBasicProfiles.some(p=>p.id==='char_c'&&p.missing.includes('heightCm')));

  const nameless=clone(before);nameless.characters.char_d={id:'char_d',age:30};
  assert.equal(settleNative(before,nameless,anchor(),'本轮正文',schemas).state.characters.char_d,undefined);
});

test('nested physiology and intimacy paths pass the model command guard',()=>{
  const before=initial();
  const command=(path,value,type='set')=>({type,args:[path,JSON.stringify(value)]});
  const cycle=command('shenghao.characters.char_a.physiology.cycle','经期第二天');
  assert.equal(prepareModelCommand(cycle,before,schemas),true);
  assert.equal(JSON.parse(cycle.args.at(-1)),'经期第二天');
  const tags=command('shenghao.characters.char_a.intimacy.unlockedTags','拥抱、亲吻');
  assert.equal(prepareModelCommand(tags,before,schemas),true);
  assert.deepEqual(JSON.parse(tags.args.at(-1)),['拥抱','亲吻']);
  const virgin=command('shenghao.characters.char_a.physiology.virgin','也许');
  assert.equal(prepareModelCommand(virgin,before,schemas),false);
  const tooDeep=command('shenghao.characters.char_a.physiology.traits.extra','x');
  assert.equal(prepareModelCommand(tooDeep,before,schemas),false);
  before.characters.char_a.physiology={cycle:'安全期',pregnancy:'未孕',virgin:null,traits:'耳后敏感'};
  const object=command('shenghao.characters.char_a.physiology',{cycle:'危险期'});
  assert.equal(prepareModelCommand(object,before,schemas),true);
  const merged=JSON.parse(object.args.at(-1));assert.equal(merged.cycle,'危险期');assert.equal(merged.traits,'耳后敏感');assert.equal(merged.chestDetail,'');assert.equal(merged.vaginaState,'');
});

test('the dossier build fills blank private records only and keeps the seeded anatomy',()=>{
  let s=initial();
  // 老存档可能还是四项全空：建档只补空白，脚本播种与已有内容都优先。
  s.characters.char_a.physiology={cycle:'安全期',pregnancy:'未孕',virgin:null,hymenNote:'',chestDetail:'',vaginaLook:'',vaginaState:'',pubicHair:'',anusLook:'',anusState:'',bodyScent:'',tattooScar:'',traits:''};
  s.characters.char_a.intimacy={attitude:'',abilityComment:'',partnersCount:0,sexPartnerCount:0,firstTime:'',experience:'',fetishes:'',unlockedTags:[],withUserCount:0,lastIntimate:'',lastMasturbation:''};
  s.characters.char_a.outfit={style:'',complexion:'',top:'',bottom:'',lingerie:'',socks:'',shoes:'',makeup:'',accessories:''};
  s=applyOperation(s,{type:'PLAYER_BUILD_PROFILE',operationId:'build_seed',personRef:'char_a',expectedRevision:s.meta.revision,
    profileFixed:profiles(),physiology:{traits:'耳后敏感、有旧疤'},intimacy:{attitude:'保守慢热',experience:'无恋爱经验',fetishes:'喜欢被夸奖',withUserCount:9}},anchor());
  assert.deepEqual(profile(s.characters.char_a.profileFixed),profiles());
  assert.equal(s.characters.char_a.physiology.traits,'耳后敏感、有旧疤');assert.equal(s.characters.char_a.physiology.pregnancy,'未孕');
  assert.equal(s.characters.char_a.intimacy.attitude,'保守慢热');assert.equal(s.characters.char_a.intimacy.experience,'无恋爱经验');
  assert.equal(s.characters.char_a.intimacy.withUserCount,0);
  const seeded=initial().characters.char_a.physiology;
  assert(seeded.chestDetail.length>0&&seeded.vaginaLook.length>0&&seeded.vaginaState.length>0);
  assert(seeded.pubicHair.length>0&&seeded.anusLook.length>0&&seeded.bodyScent.length>0&&seeded.traits.length>0);
  assert.equal(initial().characters.char_a.physiology.virgin,true);
  assert.equal(PROFILE_LABELS[0],'基础身份与学历籍贯');assert.equal(PROFILE_LABELS[7],'事业现状与短期目标');assert.equal(PROFILE_LABELS.length,9);
});

test('the phone renders three axes, click blocks, star switch, off-stage line and the private dossier',()=>{
  let s=initial();
  Object.assign(s.characters.char_a,{cupSize:'C',addressing:'哥哥',impression:'觉得你比传闻里好相处',currentThought:'他记得我不吃香菜',arousal:0});
  let {ctx,screens}=screensFor(s);
  assert(!screens.scene().includes('他记得我不吃香菜'));
  ctx.expanded.add('char_a');
  const scene0=screens.scene();
  assert(scene0.includes('💭 心声：<i>他记得我不吃香菜</i>'));
  assert(scene0.includes('♥ 好感 90/100 · ❖ 堕落 0/100 · 🌡️ 情动 0/100'));
  assert(scene0.includes('🌡️ 情动度：0/100'));
  for(const label of ['🎬 此刻 · 动向','👗 行头 · 穿戴','📋 身姿 · 基础','🌹 欲念 · 私密'])assert(scene0.includes(label),label);
  assert(scene0.includes('data-scene-section="char_a:0"')&&scene0.includes('data-scene-section="char_a:3"'));
  assert(!scene0.includes('阴部户型与色泽'),'折叠时不再平铺 20 行文字');
  ctx.sceneSectionByChar.set('char_a',3);
  assert(screens.scene().includes('阴部户型与色泽'));
  assert(screens.scene().includes('阴毛类型'));
  ctx.sceneSectionByChar.set('char_a',2);
  assert(screens.scene().includes('（C 罩杯）'));
  s.characters.char_a.arousal=48;
  ({ctx,screens}=screensFor(s));ctx.expanded.add('char_a');
  assert(screens.scene().includes('🌡️ 情动 48/100'));
  s.characters.char_a.currentThought='';
  s.characters.char_a.intimacy={attitude:'外冷内热',experience:'',fetishes:'',unlockedTags:['拥抱','留宿'],withUserCount:2,lastIntimate:'2026-01-05 · 玄关'};
  s.characters.char_a.physiology={cycle:'安全期',pregnancy:'未孕',virgin:false,hymenNote:'已有过往经历',chestDetail:'C罩杯饱满水滴型',vaginaLook:'饱满馒头穴，外唇丰润紧拢',vaginaState:'内壁温热紧箍',pubicHair:'天生白虎，耻骨光洁无毛',anusLook:'浅粉菊蕾紧缩',anusState:'紧致闭合',bodyScent:'清冽白茶',tattooScar:'',traits:'耳后敏感'};
  s.characters.char_a.outfit={style:'极简通勤',complexion:'',top:'白色真丝衬衫',bottom:'',lingerie:'黑色蕾丝',socks:'薄款黑丝',shoes:'细高跟',makeup:'',accessories:''};
  const detail0=screens.detail(s.characters.char_a);
  for(const label of ['人物与私密档案','身姿 · 基础','欲念 · 肉体','行头 · 穿搭','经历 · 尺度'])assert(detail0.includes(label),label);
  assert(detail0.includes('data-private-section="0"')&&detail0.includes('data-private-section="3"'));
  assert(!detail0.includes('这些记录来自实际接触')&&!detail0.includes('档案供你查阅'));
  assert(!detail0.includes('阴部户型与色泽'));
  ctx.privateSection=0;
  assert(screens.detail(s.characters.char_a).includes('对你的印象：觉得你比传闻里好相处'));
  ctx.privateSection=1;
  const flesh=screens.detail(s.characters.char_a);
  assert(flesh.includes('生理周期：安全期'));assert(flesh.includes('处子状态：非处女'));assert(flesh.includes('阴部户型与色泽：饱满馒头穴'));assert(flesh.includes('敏感带详情：耳后敏感'));
  ctx.privateSection=2;
  const outfitPanel=screens.detail(s.characters.char_a);
  assert(outfitPanel.includes('穿搭风格：极简通勤'));assert(outfitPanel.includes('上装：白色真丝衬衫'));assert(outfitPanel.includes('袜子／丝袜：薄款黑丝'));assert(outfitPanel.includes('鞋履：细高跟'));
  ctx.privateSection=3;
  const expPanel=screens.detail(s.characters.char_a);
  assert(expPanel.includes('性观念：外冷内热'));assert(expPanel.includes('与你亲密次数：2'));assert(expPanel.includes('最近一次性行为：2026-01-05 · 玄关'));
  assert(expPanel.includes('拥抱')&&expPanel.includes('留宿'));
  assert(expPanel.includes('当前开放档位：L'));assert(expPanel.includes('手口侍奉：'));assert(expPanel.includes('多人同欢：'));
  ctx.privateSection=null;
  const detail=screens.detail(s.characters.char_a);
  assert(detail.includes('data-star="char_a"')&&detail.includes('☆ 特别关注'));
  assert(screens.women().includes('称呼「哥哥」'));
  s=star(s,'char_a');
  ctx.view.state=s;
  assert(screens.detail(s.characters.char_a).includes('★ 已关注'));
  assert(screens.women().includes('★'));
  s.characters.char_a.offscreen='设计院 · 正在改第三版图纸';
  ctx.view.state=s;
  // A starred woman who is present has no off-stage line; the absent one does.
  assert(!screens.scene().includes('★ 特别关注 · 异地实况'));
  s=star(star(s,'char_b'),'char_a');
  s.characters.char_b.offscreen='城南美术馆 · 正在布展';
  ctx.view.state=s;
  assert(screens.scene().includes('★ 特别关注 · 异地实况'));
  assert(screens.scene().includes('城南美术馆 · 正在布展'));
  assert(!screens.scene().includes('设计院 · 正在改第三版图纸'));
});

test('corruption is a second axis: 0–100, +-12 per round, never a beauty modifier',()=>{
  const before=initial();
  assert.equal(before.characters.char_a.corruption,0);
  assert.equal(corruptionStage(0),'矜持自守');assert.equal(corruptionStage(59),'半推半就');assert.equal(corruptionStage(60),'底线失守');assert.equal(corruptionStage(74),'底线失守');
  assert.equal(corruptionStage(75),'予取予求');assert.equal(corruptionStage(90),'彻底沉沦');
  const candidate=clone(before);candidate.characters.char_a.corruption=9;
  const once=settleNative(before,candidate,anchor(),'本轮正文',schemas).state;
  assert.equal(once.characters.char_a.corruption,9);
  assert(Object.values(once.facts).some(f=>f.type==='CORRUPTION_CHANGE'&&f.finalDelta===9));
  const jump=clone(before);jump.characters.char_a.corruption=80;
  const capped=settleNative(before,jump,anchor(3),'本轮正文',schemas).state;
  assert.equal(capped.characters.char_a.corruption,12);
  const down=clone(capped);down.characters.char_a.corruption=0;
  assert.equal(settleNative(capped,down,anchor(4),'本轮正文',schemas).state.characters.char_a.corruption,0);
  const schemaScore=schemas.character.parse({id:'c',name:'甲',age:24,beautyScore:60,affection:20,relationshipLabel:'熟人',corruption:250});
  assert.equal(schemaScore.corruption,100);
});

test('withdrawing unlocks on affection 70 or corruption 60 and keeps the ledger formulas intact',()=>{
  const paid=s=>applyOperation(s,{operationId:crypto.randomUUID(),type:'PLAYER_WITHDRAW',personRef:'char_a',expectedRevision:s.meta.revision},anchor());
  const runPayment=s=>settleNative(s,(()=>{const c=clone(s);c.pendingEvents=[payment()];return c;})(),anchor(),'确实已经发生',schemas).state;
  const lowAffection=runPayment(schemas.state.parse(completeInitialState(fresh({contacts:[contact('char_a',{affection:40,corruption:60})]}),{startDate:'2026-01-05',startTime:'09:00'})));
  assert.equal(poolParts(lowAffection,'char_a').total,30000);assert.equal(canWithdraw(lowAffection,'char_a'),true);
  const result=paid(lowAffection);
  assert.equal(result.withdrawals[Object.keys(result.withdrawals)[0]].paidCents,300000);
  const blocked=settleNative(lowAffection,(()=>{const c=clone(lowAffection);c.characters.char_a.corruption=59;c.characters.char_a.affection=69;return c;})(),anchor(5),'本轮正文',schemas).state;
  assert.equal(canWithdraw(blocked,'char_a'),false);
});

test('the phone shows three axes and the new withdraw wording',()=>{
  const s=initial();
  s.characters.char_a.affection=40;s.characters.char_a.corruption=35;s.characters.char_a.arousal=12;
  const {ctx,screens}=screensFor(s);
  const detail=screens.detail(s.characters.char_a);
  assert(detail.includes('♥ 好感度：40/100 · 朋友与信任'));assert(detail.includes('❖ 堕落度：35/100 · 芳心暗摇'));
  assert(detail.includes('🌡️ 情动度：12/100'));
  assert(detail.includes('♥ 好感达70 或 ❖ 堕落达60 解锁提现'));
  ctx.expanded.add('char_a');
  const scene=screens.scene();
  assert(scene.includes('♥ 好感 40/100 · ❖ 堕落 35/100 · 🌡️ 情动 12/100'));
  assert(scene.includes('❖ 堕落度：35/100 · 芳心暗摇'));
  assert(screens.women().includes('♥ 40 · ❖ 35'));
  s.characters.char_a.corruption=60;
  ctx.view.state=s;
  assert(screens.detail(s.characters.char_a).includes('✦ 领取本期全部奖励')===false);
});

test('cycle is derived from story date and stable id, and an explicit value survives the same day',()=>{
  const start=initial();
  assert(start.characters.char_a.physiology.cycle.length>0,'initial cycle is filled by the script');
  const stages=new Set();
  for(let d=1;d<=28;d+=1)stages.add(computeCycle('char_a','2026-02-'+String(d).padStart(2,'0')));
  assert(stages.size>=4,'cycle actually varies across a month');
  assert.equal(computeCycle('char_a','2026-01-05','怀孕两个月'),'妊娠期');
  const sameDay=clone(start);
  sameDay.characters.char_a.physiology={...sameDay.characters.char_a.physiology,cycle:'经期第二天'};
  assert.equal(settleNative(start,sameDay,anchor(),'本轮正文',schemas).state.characters.char_a.physiology.cycle,'经期第二天');
  const nextDay=clone(start);
  nextDay.world.date='2026-03-01';
  assert.equal(settleNative(start,nextDay,anchor(3),'本轮正文',schemas).state.characters.char_a.physiology.cycle,computeCycle('char_a','2026-03-01','未孕'));
});

test('a 90+ intimate behavior back-fills virgin, tags and count without the model writing those paths',()=>{
  const before=initial();
  assert.equal(before.characters.char_a.physiology.virgin,true,'脚本开局即播种处女状态');
  const candidate=clone(before);
  candidate.pendingEvents=[{type:'BEHAVIOR',personRef:'char_a',action:'主卧深吻并发生首次亲密交欢',score:92}];
  const out=settleNative(before,candidate,anchor(),'本轮正文',schemas).state;
  assert.equal(out.characters.char_a.physiology.virgin,false);
  assert(out.characters.char_a.intimacy.withUserCount>=1);
  for(const tag of ['初夜夺取','深情热吻','鱼水之欢'])assert(out.characters.char_a.intimacy.unlockedTags.includes(tag),tag);
  assert(out.characters.char_a.intimacy.unlockedTags.length<=24);
});

test('behaviour tags accept an array or a delimited string and stay de-duplicated',()=>{
  const before=initial();
  const candidate=clone(before);
  candidate.pendingEvents=[
    {type:'BEHAVIOR',personRef:'char_a',action:'办公室里的丝袜制服亲昵',score:78,tags:'丝袜制服、背德偷欢'},
    {type:'BEHAVIOR',personRef:'char_b',action:'车内留宿',score:80,tags:['背德偷欢']}
  ];
  const out=settleNative(before,candidate,anchor(),'本轮正文',schemas).state;
  const tags=out.characters.char_a.intimacy.unlockedTags;
  assert(tags.includes('丝袜制服'));assert(tags.includes('背德偷欢'));
  assert.equal(tags.filter(t=>t==='背德偷欢').length,1);
  assert(out.characters.char_b.intimacy.unlockedTags.includes('背德偷欢'));
});

test('starred off-stage women surface as a top-level todo list',()=>{
  let s=initial();
  assert.deepEqual(projection(s).starredOffscreenIds,[]);
  s=star(s,'char_b');
  assert.deepEqual(projection(s).starredOffscreenIds,['char_b']);
  s=star(s,'char_a');
  assert.deepEqual(projection(s).starredOffscreenIds,['char_b']);
});

// ----- rc.24: 双模式随机暴击、总身家倍率、付款证据、眼下心事 -----
test('rc.24 crits: seeded whole-yuan amount inside the tier, stable on replay, intimate labels',()=>{
  const base=()=>fresh({contacts:[contact('char_a',{affection:60})]});
  const a=applyEnvelope(base(),envelope(score({factId:'b1',action:'替她还清花店押金'})),anchor(2),source);
  const b=applyEnvelope(base(),envelope(score({factId:'b2',action:'替她还清花店押金'})),anchor(3),source);
  const ca=poolParts(a,'char_a').crit,cb=poolParts(b,'char_a').crit;
  assert(inRange(ca,3500000,9800000));assert(inRange(cb,3500000,9800000));
  assert.notEqual(ca,cb);
  assert.equal(poolParts(applyEnvelope(base(),envelope(score({factId:'b1',action:'替她还清花店押金'})),anchor(2),source),'char_a').crit,ca);
  assert.equal(poolParts(applyEnvelope(a,envelope(score({factId:'b1',action:'替她还清花店押金'})),anchor(2),source),'char_a').crit,ca);
  const intimate=reward(92,'seed','INTIMATE');
  assert.equal(intimate.mode,'INTIMATE');assert.equal(intimate.label,'绝顶征服');assert(inRange(intimate.amountCents,12000000,38000000));
  const other=applyEnvelope(base(),envelope(score({factId:'b3',score:78,mode:'INTIMATE',action:'丝袜制服下的深吻'})),anchor(4),source);
  const rec=Object.values(other.rewardEvents)[0];
  assert.equal(rec.mode,'INTIMATE');assert(inRange(rec.cashbackCents,3500000,9800000));assert(['欲海沉沦'].includes(rec.label));
});
test('rc.24 有效身家连同游戏内购入资产计价，买房花光现金也卡不住十倍',()=>{
  let s=fresh({initialCashCents:2000000000,contacts:[contact('char_a',{affection:80})]});
  assert.equal(wealthTier(s.user.cashCents).multiplier,8);
  s=applyEnvelope(s,envelope(payment({factId:'house_pay',kind:'PROPERTY_PURCHASE',amountCents:1500000000,allocations:[],asset:{assetId:'house_new',kind:'HOUSE',name:'云玺湾临江大平层',ownerId:'USER'}})),anchor(2),source);
  assert.equal(s.user.cashCents,500000000);
  assert.equal(wealthTier(s.user.cashCents).multiplier,10);
  s=applyEnvelope(s,envelope(payment({factId:'gift_pay'})),anchor(3),source);
  assert.equal(withdrawalQuote(s,'char_a').tier.multiplier,8);
  const out=applyOperation(s,{operationId:'w_house',type:'PLAYER_WITHDRAW',personRef:'char_a',expectedRevision:s.meta.revision},anchor());
  const w=out.withdrawals.w_house;
  assert.equal(w.multiplier,8);assert.equal(w.preCashCents,1999970000);assert.equal(w.paidCents,240000);
});
test('rc.24 付款证据不再误杀“准备好礼盒时她还没回过神”这类真实刷卡',()=>{
  const body='你刷卡付了两万八。导购准备好礼盒时，她还没回过神来。';
  const before=initial(),candidate=clone(before);
  candidate.pendingEvents=[{type:'CASH_TRANSACTION',factId:'pay_card',direction:'OUT',amountYuan:'2.8万',payer:'USER',kind:'GIFT',completed:true,memo:'礼物',itemName:'丝巾',allocations:[{personRef:'char_a',amountYuan:'2.8万'}],evidence:body}];
  const r=settleNative(before,candidate,anchor(),body,schemas);
  assert.deepEqual(r.diagnostics,[]);
  assert.equal(r.state.user.cashCents,before.user.cashCents-2800000);
  assert.equal(poolParts(r.state,'char_a').spend,2800000);
});
test('rc.24 六位预设自带眼下心事，并进入投影与手机界面',()=>{
  for(const p of contactPresets)assert(typeof p.currentGoal==='string'&&p.currentGoal.length>0&&p.currentGoal.length<=200,p.presetId);
  let s=initial();
  s.characters.char_a.currentGoal=contactPresets[0].currentGoal;
  s.characters.char_b.currentGoal=contactPresets[1].currentGoal;
  s=star(s,'char_b');
  assert.equal(projection(s).characters.char_a.currentGoal,contactPresets[0].currentGoal);
  assert.equal(projection(s).characters.char_b.currentGoal,contactPresets[1].currentGoal);
  const {ctx,screens}=screensFor(s);
  assert(!screens.scene().includes('眼下心事'));
  ctx.expanded.add('char_a');
  ctx.sceneSectionByChar.set('char_a',0);
  assert(screens.scene().includes('🎯 眼下心事：'+contactPresets[0].currentGoal));
  assert(screens.detail(s.characters.char_a).includes('🎯 眼下心事：'+contactPresets[0].currentGoal));
});

// ----- rc.24 plan2: 男主性能力 / 四宫格底线 / 穿搭同步 / 实战兜底 -----
test('rc.24 prowess mirrors beauty and only the second axis answers to it',()=>{
  for(const [score,modifier] of [[1,-1],[24,-1],[25,0],[49,0],[50,1],[74,1],[75,2],[89,2],[90,3],[100,3]])assert.equal(prowessTier(score).modifier,modifier,String(score));
  assert.equal(prowessTier(90).label,'极乐神躯，人间打桩机');
  const s=fresh({prowessScore:88});
  assert.equal(s.user.prowessScore,88);assert.equal(s.user.sexualAbility.technique,88);assert.equal(s.user.genitals.length,'18cm');assert.equal(s.user.genitals.girth,'4.8cm');
  assert.throws(()=>fresh({prowessScore:0}));
});
test('rc.24 only a physical round unlocks the prowess bonus on corruption',()=>{
  const before=()=>schemas.state.parse(completeInitialState(fresh({prowessScore:95,contacts:[contact('char_a',{corruption:10})]}),{startDate:'2026-01-05',startTime:'09:00'}));
  const runOne=mutate=>{const b=before(),c=clone(b);c.characters.char_a.corruption=15;mutate(c);return settleNative(b,c,anchor(),'本轮正文',schemas).state.characters.char_a.corruption;};
  assert.equal(runOne(()=>{}),15);
  assert.equal(runOne(c=>{c.characters.char_a.arousal=40;}),18);
  assert.equal(runOne(c=>{c.pendingEvents=[{type:'BEHAVIOR',personRef:'char_a',action:'主卧深吻',score:72}];}),18);
  const low=schemas.state.parse(completeInitialState(fresh({prowessScore:10,contacts:[contact('char_a',{corruption:10})]}),{startDate:'2026-01-05',startTime:'09:00'}));
  const c=clone(low);c.characters.char_a.corruption=15;c.characters.char_a.arousal=45;
  assert.equal(settleNative(low,c,anchor(),'本轮正文',schemas).state.characters.char_a.corruption,14);
});
test('rc.24 limits derive from the two axes and unlocked tags jump to three',()=>{
  const b=schemas.state.parse(completeInitialState(fresh({contacts:[contact('char_a',{affection:80})]}),{startDate:'2026-01-05',startTime:'09:00'}));
  const out=settleNative(b,clone(b),anchor(),'本轮正文',schemas).state.characters.char_a.limits;
  assert.equal(out.scaleLevel,5);assert.equal(out.cosplay,3);assert.equal(out.creampie,1);assert.equal(out.publicPlay,1);assert.equal(out.anal,0);assert.equal(out.multi,0);
  const c=clone(b);c.characters.char_a.intimacy={...c.characters.char_a.intimacy,unlockedTags:['后庭开发']};
  assert.equal(settleNative(b,c,anchor(),'本轮正文',schemas).state.characters.char_a.limits.anal,3);
});
test('rc.25 开局就有默认穿搭，outfit 与 currentClothes 双向补齐，情动补面色',()=>{
  const b=schemas.state.parse(completeInitialState(fresh(),{startDate:'2026-01-05',startTime:'09:00'}));
  assert(b.characters.char_a.outfit.top.length>0,'开局 outfit.top 不再为空');
  assert.equal(b.characters.char_a.currentClothes,b.characters.char_a.outfit.top);
  // 模型改写 currentClothes 后，outfit 里已有明确单品时以 outfit 为准。
  const c=clone(b);c.characters.char_a.outfit={...c.characters.char_a.outfit,top:'白衬衫',bottom:'包臀裙',socks:'黑丝',shoes:'细高跟'};c.characters.char_a.currentClothes='';
  const out=settleNative(b,c,anchor(),'本轮正文',schemas).state.characters.char_a;
  assert.equal(out.currentClothes,'白衬衫；包臀裙；黑丝；细高跟');
  // 两边都空时才用外貌/职业兜底。
  const e=clone(b);e.characters.char_a.currentClothes='';e.characters.char_a.outfit={style:'',complexion:'',top:'',bottom:'',lingerie:'',socks:'',shoes:'',makeup:'',accessories:''};
  const filled=settleNative(b,e,anchor(),'本轮正文',schemas).state.characters.char_a;
  assert(filled.outfit.top.length>0);assert.equal(filled.currentClothes,filled.outfit.top);
  const d=clone(b);d.characters.char_a.arousal=52;
  assert.equal(settleNative(b,d,anchor(),'本轮正文',schemas).state.characters.char_a.outfit.complexion,'雙頰緋紅，眼波含春，呼吸微促');
});
test('rc.24 the first real night backfills private state and his review',()=>{
  const b=schemas.state.parse(completeInitialState(fresh({prowessScore:90}),{startDate:'2026-01-05',startTime:'09:00'}));
  const c=clone(b);c.pendingEvents=[{type:'BEHAVIOR',personRef:'char_a',action:'主卧深吻并发生首次亲密交欢',score:92}];
  const out=settleNative(b,c,anchor(),'本轮正文',schemas).state.characters.char_a;
  assert.equal(out.physiology.hymenNote,'初夜已由你夺取');
  assert.equal(out.physiology.vaginaState,'刚经受强悍肉体充分开发，内壁温热紧箍、春水泥泞泛红，余韵微颤');
  assert.equal(out.intimacy.sexPartnerCount,1);
  assert.equal(out.intimacy.abilityComment,'尺寸惊人且持久滚烫，每次深入都让她食髓知味、难以招架');
});
test('rc.24 the phone shows his prowess and the dossier build seeds four panels',()=>{
  let s=initial();
  const {screens}=screensFor(s);
  const mine=screens.mine();
  assert(mine.includes('性能力：70/100'));assert(mine.includes('堕落加成 +1'));assert(mine.includes('性器：18cm / 粗 4.8cm'));
  // rc.25：四宫格已由脚本预播种，建档只补空白字段，不覆盖已有值。
  s.characters.char_a.physiology={cycle:'安全期',pregnancy:'未孕',virgin:null,hymenNote:'',chestDetail:'',vaginaLook:'',vaginaState:'',pubicHair:'',anusLook:'',anusState:'',bodyScent:'',tattooScar:'',traits:''};
  s.characters.char_a.intimacy={attitude:'',abilityComment:'',partnersCount:0,sexPartnerCount:0,firstTime:'',experience:'',fetishes:'',unlockedTags:[],withUserCount:0,lastIntimate:'',lastMasturbation:''};
  s.characters.char_a.outfit={style:'',complexion:'',top:'',bottom:'',lingerie:'',socks:'',shoes:'',makeup:'',accessories:''};
  s.characters.char_a.limits={scaleLevel:0,weakness:'',worry:'',exposure:0,foreplay:0,intercourse:0,cosplay:0,creampie:0,anal:0,publicPlay:0,multi:0};
  s=applyOperation(s,{type:'PLAYER_BUILD_PROFILE',operationId:'build4',personRef:'char_a',expectedRevision:s.meta.revision,profileFixed:profiles(),
    physiology:{chestDetail:'C杯饱满圆润',bodyScent:'体带淡冷香'},outfit:{top:'白衬衫',socks:'黑丝'},intimacy:{firstTime:'大学时代'},limits:{weakness:'怕被忽视',worry:'怕失去',scaleLevel:4,anal:2}},anchor());
  const c=s.characters.char_a;
  assert.equal(c.physiology.chestDetail,'C杯饱满圆润');assert.equal(c.physiology.bodyScent,'体带淡冷香');
  assert.equal(c.outfit.top,'白衬衫');assert.equal(c.outfit.socks,'黑丝');assert.equal(c.intimacy.firstTime,'大学时代');
  assert.equal(c.limits.weakness,'怕被忽视');assert.equal(c.limits.worry,'怕失去');assert.equal(c.limits.scaleLevel,4);assert.equal(c.limits.anal,2);
  const seeded=initial().characters.char_a;
  assert(seeded.physiology.vaginaLook.length>0&&seeded.physiology.pubicHair.length>0&&seeded.intimacy.attitude.length>0);
  assert.equal(seeded.limits.worry.length>0,true);
});
