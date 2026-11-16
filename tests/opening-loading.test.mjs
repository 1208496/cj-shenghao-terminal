import test from 'node:test';
import assert from 'node:assert/strict';
import {openingMarker,openingDisplayRegexes} from '../src/runtime/opening-display.js';
import {setupDraftStore} from '../src/ui/setup-draft.js';
const apply=(s,r)=>{const m=r.findRegex.match(/^\/([\s\S]*)\/([a-z]*)$/);return s.replace(new RegExp(m[1],m[2]),()=>r.replaceString);};
test('opening display preserves literal replacement tokens and surrounding prose',()=>{
 const html='<script>const s=`${value}`;const literal="$& $` $\' $$";</script>';
 const [display,prompt]=openingDisplayRegexes(html),message='前文\n'+openingMarker+'\n后文';
 assert.equal(apply(message,display),'前文\n```html\n'+html+'\n```\n后文');
 assert.equal(apply(message,prompt),'前文\n\n后文');
 assert.equal(display.markdownOnly,true);assert.equal(display.promptOnly,false);assert.equal(prompt.promptOnly,true);
 assert.throws(()=>openingDisplayRegexes('<script>"$1"</script>'),/replacement tokens/);
});
test('local setup draft restores per chat and merges unrelated UI preferences',()=>{
 let chat='a';const data=new Map();const host={SillyTavern:{getContext:()=>({characterId:0,getCurrentChatId:()=>chat})},localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};
 const store=setupDraftStore(host),key=store.chatKey();assert.equal(key,'0:a');
 store.write(key,{theme:'purple'});store.write(key,{setupDraft:{name:'甲'},setupStep:2});
 assert.deepEqual(store.read(),{theme:'purple',setupDraft:{name:'甲'},setupStep:2});
 chat='b';assert.equal(store.write(key,{setupDraft:{name:'串档'}}),false);assert.deepEqual(store.read(),{});
 chat='a';assert.equal(store.read().setupDraft.name,'甲');
});
test('missing chat identity or unavailable storage never blocks local form',()=>{
 const store=setupDraftStore({SillyTavern:{getContext:()=>({})}});
 assert.equal(store.chatKey(),'');assert.deepEqual(store.read(),{});assert.equal(store.write('',{}),false);
});
