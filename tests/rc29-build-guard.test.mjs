import test from 'node:test';
import assert from 'node:assert/strict';
import {generationWithTimeout} from '../src/runtime/setup-profiles.js';

test('rc.29 建档请求超时会抛出 MODEL_TIMEOUT 并主动停止生成', async () => {
  let stopped = false;
  await assert.rejects(
    () => generationWithTimeout(() => new Promise(() => {}), {timeoutMs: 50, stop: () => { stopped = true; }}),
    (error) => error.message === 'MODEL_TIMEOUT'
  );
  assert.equal(stopped, true);
});

test('rc.29 建档按时返回时不会触发停止', async () => {
  const result = await generationWithTimeout(async () => 'ok', {timeoutMs: 1000, stop: () => { throw Error('SHOULD_NOT_STOP'); }});
  assert.equal(result, 'ok');
});
