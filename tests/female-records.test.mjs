import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,prepareModelCommand} from '../src/runtime/settlement.js';
import {clone,projection,applyOperation,PROFILE_LABELS,profile,corruptionStage,canWithdraw,poolParts,computeCycle} from '../src/core/engine.js';
import {createScreens} from '../src/ui/screens.js';
import {fresh,contact,anchor,profiles,payment} from './fixtures.mjs';
const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh({contacts:[contact(),contact('char_b',{present:false})]}),{startDate:'2026-01-05',startTime:'09:00'}));
const star=(s,personRef='char_b')=>applyOperation(s,{type:'PLAYER_STAR',operationId:crypto.randomUUID(),personRef,expectedRevision:s.meta.revision},anchor());
const screensFor=state=>{const ctx={view:{state,prefs:{},busy:false},expanded:new Set(),section:null,consumptionPage:0};const screens=createScreens({data:()=>ctx,esc:v=>String(v??''),yuan:v=>'¥'+v/100,image:()=>'',avatar:()=>''});return {ctx,screens};};

test('light private fields default on both the schema and engine-built records',()=>{
  const legacy=schemas.character.parse({id:'char_x',name:'沈知夏',age:27,beautyScore:72,affection:30,relationshipLabel:'客户'});
  assert.equal(legacy.cupSize,'');assert.equal(legacy.addressing,'');assert.equal(legacy.impression,'');assert.equal(legacy.starred,false);
  assert.equal(legacy.currentThought,'');assert.equal(legacy.arousal,0);assert.equal(legacy.offscreen,'');
  assert.deepEqual(legacy.physiology,{cycle:'',pregnancy:'未孕',virgin:null,traits:''});
  assert.deepEqual(legacy.intimacy,{attitude:'',experience:'',fetishes:'',unlockedTags:[],withUserCount:0,lastIntimate:''});
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
  assert.deepEqual(Object.keys(view).sort(),['affection','aliases','corruption','id','name','offscreen','relationshipLabel','starred','trackingState']);
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
  assert.deepEqual(JSON.parse(object.args.at(-1)),{cycle:'危险期',pregnancy:'未孕',virgin:null,traits:'耳后敏感'});
});

test('the dossier build seeds empty private records without overwriting known ones',()=>{
  let s=initial();
  s=applyOperation(s,{type:'PLAYER_BUILD_PROFILE',operationId:'build_seed',personRef:'char_a',expectedRevision:s.meta.revision,
    profileFixed:profiles(),physiology:{traits:'耳后敏感、有旧疤'},intimacy:{attitude:'保守慢热',experience:'无恋爱经验',fetishes:'喜欢被夸奖',withUserCount:9}},anchor());
  assert.deepEqual(profile(s.characters.char_a.profileFixed),profiles());
  assert.equal(s.characters.char_a.physiology.traits,'耳后敏感、有旧疤');assert.equal(s.characters.char_a.physiology.pregnancy,'未孕');
  assert.equal(s.characters.char_a.intimacy.attitude,'保守慢热');assert.equal(s.characters.char_a.intimacy.experience,'无恋爱经验');
  assert.equal(s.characters.char_a.intimacy.withUserCount,0);
  assert.equal(PROFILE_LABELS[0],'基础身份与学历籍贯');assert.equal(PROFILE_LABELS[7],'事业现状与短期目标');assert.equal(PROFILE_LABELS.length,9);
});

test('the phone renders the inner voice, arousal, star switch, off-stage line and private card',()=>{
  let s=initial();
  Object.assign(s.characters.char_a,{cupSize:'C',addressing:'哥哥',impression:'觉得你比传闻里好相处',currentThought:'他记得我不吃香菜',arousal:0});
  let {ctx,screens}=screensFor(s);
  assert(!screens.scene().includes('他记得我不吃香菜'));
  ctx.expanded.add('char_a');
  assert(screens.scene().includes('💭 心声：<i>他记得我不吃香菜</i>'));
  assert(!screens.scene().includes('🌡️ 情动'));
  assert(screens.scene().includes('（C 罩杯）'));
  assert(screens.detail(s.characters.char_a).includes('对你的印象：觉得你比传闻里好相处'));
  s.characters.char_a.arousal=48;
  ({ctx,screens}=screensFor(s));ctx.expanded.add('char_a');
  assert(screens.scene().includes('🌡️ 情动：48 / 100'));
  s.characters.char_a.currentThought='';
  s.characters.char_a.intimacy={attitude:'外冷内热',experience:'',fetishes:'',unlockedTags:['拥抱','留宿'],withUserCount:2,lastIntimate:'2026-01-05 · 玄关'};
  s.characters.char_a.physiology={cycle:'安全期',pregnancy:'未孕',virgin:false,traits:'耳后敏感'};
  const detail=screens.detail(s.characters.char_a);
  assert(detail.includes('私密与亲密记录'));assert(detail.includes('生理周期：安全期'));assert(detail.includes('处子状态：非处'));
  assert(detail.includes('敏感带与私密特征：耳后敏感'));assert(detail.includes('亲密观念：外冷内热'));
  assert(detail.includes('与你亲密次数：2 次'));assert(detail.includes('最近一次：2026-01-05 · 玄关'));
  assert(detail.includes('拥抱')&&detail.includes('留宿'));
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

test('the phone shows both axes and the new withdraw wording',()=>{
  const s=initial();
  s.characters.char_a.affection=40;s.characters.char_a.corruption=35;
  const {ctx,screens}=screensFor(s);
  const detail=screens.detail(s.characters.char_a);
  assert(detail.includes('❖ 35'));assert(detail.includes('堕落度 · 芳心暗摇'));
  assert(detail.includes('♥ 好感达70 或 ❖ 堕落达60 解锁提现'));
  ctx.expanded.add('char_a');
  const scene=screens.scene();
  assert(scene.includes('♥ 好感 40/100 · ❖ 堕落 35/100'));
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
  assert.equal(before.characters.char_a.physiology.virgin,null);
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
