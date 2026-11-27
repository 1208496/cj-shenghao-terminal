// rc.58 玩家反馈三条（2026-11-27）：
// ① 女性「长期梦想」等档案在几轮后被脚本池里的默认值换掉；
// ② 私密档案（身材/胸型/体香…）整对象提交时未写到的子项被清零、再被脚本重播；
// ③ 新登场人物年龄写坏（含 <18）时被静默落成骨架默认 25 岁，出现「25 岁的高二学生」。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {clone} from '../src/core/engine.js';
import {fresh,contact,anchor} from './fixtures.mjs';
const schemas=createSchema(z);
const initial=()=>schemas.state.parse(completeInitialState(fresh({contacts:[contact()]}),{startDate:'2026-01-05',startTime:'09:00'}));

test('rc.58 空串提交不得抹掉玩家/作者写好的三层心绪与职业',()=>{
  const before=initial();
  Object.assign(before.characters.char_a,{
    occupation:'建筑设计师',
    recentGoal:'月底凑齐工作室续租的押金',
    longTermDream:'开一间自己说了算的独立工作室',
    hiddenScar:'【家道】早年合伙被背刺，从此不肯轻信承诺',
  });
  const candidate=clone(before);
  Object.assign(candidate.characters.char_a,{occupation:'',recentGoal:'',longTermDream:'',hiddenScar:''});
  const r=settleNative(before,candidate,anchor(),'她低头搅着咖啡，什么也没说。',schemas);
  const c=r.state.characters.char_a;
  assert.equal(c.longTermDream,'开一间自己说了算的独立工作室');
  assert.equal(c.recentGoal,'月底凑齐工作室续租的押金');
  assert.equal(c.hiddenScar,'【家道】早年合伙被背刺，从此不肯轻信承诺');
  assert.equal(c.occupation,'建筑设计师');
});

test('rc.58 模型写的新内容照样采纳（空串保护不是把档案锁死）',()=>{
  const before=initial();
  Object.assign(before.characters.char_a,{longTermDream:'开一间自己说了算的独立工作室'});
  const candidate=clone(before);
  candidate.characters.char_a.longTermDream='在临海拥有一间自己的画廊';
  const r=settleNative(before,candidate,anchor(),'她说起新租下的画廊。',schemas);
  assert.equal(r.state.characters.char_a.longTermDream,'在临海拥有一间自己的画廊');
});

test('rc.58 整对象提交只改写到的子项，私密档案的兄弟字段不被清零重播',()=>{
  const before=initial();
  Object.assign(before.characters.char_a.physiology,{chestDetail:'C罩杯丰盈圆润型，浅粉娇嫩乳晕',vaginaLook:'微绽蝴蝶唇，花瓣柔嫩饱满',pubicHair:'稀疏浅色软毛',bodyScent:'淡奶香混着雪松味',traits:'后颈与腰窝'});
  before.characters.char_a.outfit={style:'清冷通勤',complexion:'冷白皮',top:'象牙白真丝衬衫',bottom:'炭灰铅笔裙',lingerie:'冷灰真丝三角杯',socks:'0D黑丝',shoes:'细高跟',makeup:'淡妆',accessories:'珍珠耳坠'};
  before.characters.char_a.intimacy={...before.characters.char_a.intimacy,attitude:'矜持克制',fetishes:'耳边低语',withUserCount:2,lastIntimate:'2026-01-03 · 江畔公寓'};
  const candidate=clone(before);
  candidate.characters.char_a.physiology={chestDetail:'改写的胸部详情'};
  candidate.characters.char_a.outfit={top:'新换的雾霾蓝衬衫'};
  candidate.characters.char_a.intimacy={attitude:'开始放开'};
  const r=settleNative(before,candidate,anchor(),'她换了件衬衫。',schemas);
  const c=r.state.characters.char_a;
  assert.equal(c.physiology.chestDetail,'改写的胸部详情','写到的子项要采纳');
  assert.equal(c.physiology.vaginaLook,'微绽蝴蝶唇，花瓣柔嫩饱满');
  assert.equal(c.physiology.pubicHair,'稀疏浅色软毛');
  assert.equal(c.physiology.bodyScent,'淡奶香混着雪松味');
  assert.equal(c.physiology.traits,'后颈与腰窝');
  assert.equal(c.outfit.top,'新换的雾霾蓝衬衫');
  assert.equal(c.outfit.bottom,'炭灰铅笔裙');
  assert.equal(c.outfit.socks,'0D黑丝');
  assert.equal(c.intimacy.attitude,'开始放开');
  assert.equal(c.intimacy.withUserCount,2);
  assert.equal(c.intimacy.lastIntimate,'2026-01-03 · 江畔公寓');
});

test('rc.58 新登场人物年龄写坏时钳到合法边界，不再静默落成 25 岁',()=>{
  const before=initial();
  const candidate=clone(before);
  candidate.characters.char_girl={id:'char_girl',name:'林小雨',age:17,occupation:'高二学生',relationshipLabel:'邻居家女儿',beautyScore:72,affection:50};
  const r=settleNative(before,candidate,anchor(),'隔壁的女儿抱着作业本敲门。',schemas);
  assert.ok(r.state.characters.char_girl,'人物要落库');
  assert.equal(r.state.characters.char_girl.age,18);
  assert.equal(r.state.characters.char_girl.occupation,'高二学生');
});

test('rc.58 年龄写成字符串数字也能救回来，仍按边界钳位',()=>{
  const before=initial();
  const candidate=clone(before);
  candidate.characters.char_woman={id:'char_woman',name:'沈闻笙',age:'96',occupation:'董事',relationshipLabel:'旧识',beautyScore:80,affection:40};
  const r=settleNative(before,candidate,anchor(),'她推门进来。',schemas);
  assert.equal(r.state.characters.char_woman.age,80);
});
