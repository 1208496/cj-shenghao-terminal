import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('rc.33 修复：expandContact 必须有忙碌互斥、分支校验与取消接口', () => {
  const host = read('src/runtime/host.js');
  const at = host.indexOf('async function expandContact(');
  assert(at >= 0, 'expandContact 应存在');
  const body = host.slice(at, host.indexOf('async function submit(', at));
  assert(body.includes("requireRule(!busy(),'GENERATION_BUSY')"), '入口必须拒绝并发生成');
  assert(body.includes('const born=branch(),generation=epoch'), '必须记录发起时的分支与 epoch');
  assert(body.includes("requireRule(branch()===born&&epoch===generation,'STALE_CHAT')"), '返回后必须校验分支未切换');
  assert(body.includes("requireRule(!cancelled,'BUILD_CANCELLED')"), '被取消的请求不得回填');
  assert(body.includes('setupBusy=true'), '请求期间必须占住生成通道');
  assert(host.includes('cancelExpandContact()'), '必须暴露取消接口');
});

test('rc.33 修复：熟人弹窗必须用会话令牌丢弃迟到的 AI 回填', () => {
  const app = read('src/ui/app.js');
  assert(app.includes('let contactToken=0'), '需要有单调递增的弹窗令牌');
  assert(/function closeModal\(\)\{contactToken\+=1;/.test(app), '关弹窗要作废在途请求');
  assert(/function contactForm\(presetId='',contactId=null\)\{contactToken\+=1;/.test(app), '开弹窗要换新令牌');
  assert(app.includes('const myToken=contactToken'), 'AI 补全要捕获发起时的令牌');
  assert(app.includes('if(myToken!==contactToken||!$(\'f_c_brief\'))return;'), '令牌不符必须丢弃结果且不写 DOM');
  assert(app.includes('api?.cancelExpandContact?.()'), '关弹窗要顺手中止在途生成');
});
