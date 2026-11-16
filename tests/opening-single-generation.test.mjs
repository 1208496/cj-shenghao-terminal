import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {z} from 'zod';
import {initialize,projection,clone,assertState} from '../src/core/engine.js';
import {completeInitialState,settleNative} from '../src/runtime/settlement.js';
import {createSchema} from '../src/runtime/schema.js';
import {draft,contact,anchor} from './fixtures.mjs';
const schemas=createSchema(z);
const sparse=()=>schemas.state.parse(completeInitialState(initialize(draft({contacts:[contact('char_a',{present:false,beautyScore:undefined,appearance:'',body:'',personalityTags:[],heightCm:null})]}),{},'init','test:branch'),{startDate:'2026-01-05',startTime:'09:00'}));
test('incomplete initial acquaintance saves immediately and is supplied to opening even when absent',()=>{
 const s=sparse();assertState(s);assert.equal(s.characters.char_a.heightCm,null);assert.equal(s.characters.char_a.beautyScore,null);
 const pending=projection(s).pendingBasicProfiles;assert.equal(pending.length,1);assert(pending[0].missing.includes('heightCm'));assert.equal(pending[0].occupation,'建筑师');assert.equal(s.scene.presentCharacterIds.length,0);
});
test('normal opening fills missing basics once and preserves known values, finances and absence',()=>{
 const before=sparse(),candidate=clone(before);Object.assign(candidate.characters.char_a,{heightCm:170,weightKg:99,beautyScore:80,appearance:'黑发，目光明亮',body:'身形匀称',personalityTags:['开朗']});candidate.world.time='09:05';
 const out=settleNative(before,candidate,anchor(2),'正常开场正文',schemas).state;
 assert.equal(out.characters.char_a.heightCm,170);assert.equal(out.characters.char_a.weightKg,52);assert.equal(out.characters.char_a.beautyScore,80);
 assert.equal(out.characters.char_a.profileFixed,null);assert.equal(out.user.cashCents,before.user.cashCents);assert.equal(out.characters.char_a.affection,before.characters.char_a.affection);assert.deepEqual(out.scene.presentCharacterIds,[]);assert.deepEqual(projection(out).pendingBasicProfiles,[]);
 const modified=clone(out);modified.characters.char_a.heightCm=180;modified.characters.char_a.beautyScore=90;
 const later=settleNative(out,modified,anchor(4),'后续正文',schemas).state;assert.equal(later.characters.char_a.heightCm,170);assert.equal(later.characters.char_a.beautyScore,80);
});
test('submit has exactly one normal trigger and no model preparation or generateRaw call',async()=>{
 const host=await fs.readFile(new URL('../src/runtime/host.js',import.meta.url),'utf8');
 const submit=host.slice(host.indexOf('async function submit('),host.indexOf('async function mutateState('));
 assert(!/generateRaw|generateProfile|prepareSetupProfiles/.test(submit));
 assert.equal((submit.match(/H\.triggerSlash\('\/trigger'\)/g)||[]).length,1);
 assert(submit.indexOf('H.createChatMessages')<submit.indexOf('H.triggerSlash'));
});
