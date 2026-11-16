import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative,prepareModelCommand} from '../src/runtime/settlement.js';
import {clone,projection,applyOperation,PROFILE_LABELS,profile} from '../src/core/engine.js';
import {createScreens} from '../src/ui/screens.js';
import {fresh,contact,anchor,profiles} from './fixtures.mjs';
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
  assert.deepEqual(Object.keys(view).sort(),['affection','aliases','id','name','offscreen','relationshipLabel','starred','trackingState']);
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
