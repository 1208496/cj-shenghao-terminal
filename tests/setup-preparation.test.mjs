import test from 'node:test';
import assert from 'node:assert/strict';
import {generationWithTimeout} from '../src/runtime/setup-profiles.js';
import {setupStatus} from '../src/ui/setup-status.js';
test('timeout stops the specific generation and rejects, successful request leaves no stop timer',async()=>{
 let stopped=0;
 await assert.rejects(generationWithTimeout(()=>new Promise(()=>{}),{timeoutMs:10,stop:()=>stopped++}),/MODEL_TIMEOUT/);assert.equal(stopped,1);
 assert.equal(await generationWithTimeout(()=>Promise.resolve('ok'),{timeoutMs:10,stop:()=>stopped++}),'ok');
 assert.equal(stopped,1);
});
test('setup status distinguishes profile requests, saves and unrelated busy work',()=>{
 assert(setupStatus({setupProgress:{phase:'initializing'}}).includes('创建开局'));
 assert(setupStatus({setupProgress:{phase:'saving'}}).includes('MVU'));
 assert(setupStatus({}).includes('当前生成'));
});
