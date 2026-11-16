import test from 'node:test';import assert from 'node:assert/strict';import {compareVersion} from '../src/core/update.js';
for(const [a,b,result] of [['2.0.0-alpha.2','2.0.0-alpha.1',1],['2.0.0-rc.1','2.0.0-alpha.2',1],['2.0.0','2.0.0-rc.1',1],['2.0.0-alpha.10','2.0.0-alpha.2',1],['1.9.9','2.0.0',-1],['2.0.0','2.0.0',0]])test('更新版本比较 '+a+' / '+b,()=>assert.equal(compareVersion(a,b),result));
test('拒绝伪造版本字符串',()=>assert.throws(()=>compareVersion('2.0.0/evil','2.0.0')));
