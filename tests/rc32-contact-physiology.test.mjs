import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDraft, initialize} from '../src/core/engine.js';
import {draft, contact} from './fixtures.mjs';

test('rc.32 开局草稿不再保留住所两项（居住方式 / 住所描述）', () => {
  const user = validateDraft(draft()).user;
  assert.equal('housingMode' in user, false, 'user.housingMode 应已移除');
  assert.equal('residenceDescription' in user, false, 'user.residenceDescription 应已移除');
  assert.equal(draft().housingMode, undefined, '默认草稿不应再有 housingMode');
});

test('rc.32 熟人女体档案先落位，seedAnatomy 只补空字段', () => {
  const filled = {
    ...contact('char_filled'),
    physiology: {
      virgin: false,
      chestDetail: '定制胸型描述',
      vaginaLook: '定制户型描述',
      pubicHair: '定制阴毛描述',
      bodyScent: '定制体香描述',
      traits: '定制敏感带描述',
    },
  };
  const state = initialize(draft({contacts: [filled]}), {char_filled: filled}, 'init', 'test:branch');
  const got = state.characters.char_filled.physiology;
  assert.equal(got.chestDetail, '定制胸型描述', '已给的胸部详情不得被默认词库覆盖');
  assert.equal(got.vaginaLook, '定制户型描述');
  assert.equal(got.pubicHair, '定制阴毛描述');
  assert.equal(got.bodyScent, '定制体香描述');
  assert.equal(got.traits, '定制敏感带描述');
  assert.equal(got.virgin, false, '显式非处女要保留');
  assert.ok(state.characters.char_filled.intimacy.sexPartnerCount >= 1, '既定过往要计入性伴侣数');
  assert.ok(got.anusLook, '未填项仍由 seedAnatomy 自动补齐');
});

test('rc.32 熟人留空女体档案时仍由脚本兜底生成', () => {
  const empty = contact('char_empty');
  const state = initialize(draft({contacts: [empty]}), {char_empty: empty}, 'init', 'test:branch');
  const got = state.characters.char_empty.physiology;
  for (const key of ['chestDetail', 'vaginaLook', 'pubicHair', 'bodyScent', 'traits']) {
    assert.ok(got[key] && got[key].length > 0, key + ' 应自动生成');
  }
});
