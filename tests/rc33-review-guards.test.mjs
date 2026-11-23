import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDraft,initialize} from '../src/core/engine.js';
import {draft,contact} from './fixtures.mjs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('rc.33 H1：取消不再提前解锁，收尾只由任务自己释放', ()=>{
  const host=read('src/runtime/host.js');
  const at=host.indexOf('cancelExpandContact(');const cancel=host.slice(at, host.indexOf('},',at)+2);
  assert(!/setupBusy=false/.test(cancel),'cancelExpandContact 不得直接释放 setupBusy');
  assert(host.includes('if(activeExpandKey===requestKey){activeExpandKey=null;setupBusy=false;publish();}'),'finally 必须校验所有权');
});

test('rc.33 M7/L6：resize 只在有保存坐标时写死，拖拽中断也要落盘', ()=>{
  const host=read('src/runtime/host.js');
  assert(host.includes("const saved=layout.width<=100?prefs.miniPosition:prefs.phonePosition;"),'resize 必须先看有没有保存坐标');
  assert(host.includes("if(moved){const end=phone.getBoundingClientRect();prefs={...prefs,[mini?'miniPosition':'phonePosition']"),'拖拽被中断也要保存坐标');
  assert(host.includes("if(activeExpandKey){cancelledExpands.add(activeExpandKey);"),'切换聊天分支要中止在途 expandContact');
});

test('rc.33 M5/M6/H3：头像标记、签名、暗伤与亲密字段都不再丢', ()=>{
  const app=read('src/ui/app.js');
  assert(app.includes('data-rand-avatar='),'随机头像 img 需要标记');
  assert(app.includes("img[data-media],img[data-rand-avatar]"),'wireImages 要接管随机头像');
  assert(app.includes('v.prefs.displayDock,v.prefs.randomAvatar,v.prefs.wheelFxQuality,v.prefs.cardFxQuality,v.notice]'),'signature 必须含 randomAvatar');
  assert(app.includes("pendingHiddenScar=typeof v.hiddenScar==='string'"),'AI 补全的 hiddenScar 要暂存');
  assert(app.includes('hiddenScar:pendingHiddenScar||'),'保存时优先用暂存的 hiddenScar');
  assert(app.includes('intimacy:{attitude:val(\'c_attitude\').trim(),fetishes:val(\'c_fetishes\').trim()}'),'attitude/fetishes 要进草稿');
  assert(app.includes('contactToken+=1;api?.cancelExpandContact?.();'),'切预设要作废在途 AI 请求');
});

test('rc.33 熟人 intimacy/outfit 先落位，seed 只补空', ()=>{
  const c={...contact('char_keep'),intimacy:{attitude:'重情慢热',fetishes:'偏爱耳语'},outfit:{style:'通勤',top:'白衬衫',bottom:'包臀裙',socks:'黑丝',shoes:'细高跟',lingerie:'黑色蕾丝',makeup:'淡妆',accessories:'腕表',complexion:'素颜'}};
  const state=initialize(draft({contacts:[c]}),{char_keep:c},'init','test:branch');
  const it=state.characters.char_keep;
  assert.equal(it.intimacy.attitude,'重情慢热');
  assert.equal(it.intimacy.fetishes,'偏爱耳语');
  assert.equal(it.outfit.top,'白衬衫');
  assert.equal(it.outfit.lingerie,'黑色蕾丝');
});

test('rc.33 熟人颜值留空不再报错，交给开局补全', ()=>{
  const c={...contact('char_nb'),beautyScore:undefined};
  const out=validateDraft(draft({contacts:[c]}));
  assert.equal(out.contacts[0].beautyScore,undefined);
});
