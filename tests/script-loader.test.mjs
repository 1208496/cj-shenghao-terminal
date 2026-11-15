import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {build} from 'esbuild';
import {assertPublicConfig,assertRelease,publicHeaders,cdnUrl} from '../src/update/release-contract.js';

const latest='a'.repeat(40),fallback='b'.repeat(40),contract='c'.repeat(64);
const config={projectId:'cj-shenghao-terminal-v2',repository:'1208496/cj-shenghao-terminal',file:'dist/terminal.js',metadataFile:'dist/release.json',mark:'CJ_SHENGHAO_TERMINAL_CORE',supabaseUrl:'https://fixture.supabase.co',table:'cj_shenghao_script_config',publishableKey:'sb_publishable_'+'x'.repeat(24),refKey:'fixture_ref',offKey:'fixture_off',fallbackRef:fallback};
const core=ref=>'// CJ_SHENGHAO_TERMINAL_CORE\n(async()=>{boots.push('+JSON.stringify(ref)+')})()';
const metadata=(ref,code=core(ref))=>({schemaVersion:2,projectId:config.projectId,repository:config.repository,version:ref===latest?'2.0.0-rc.6':'2.0.0-rc.5',runtimeFile:config.file,mark:config.mark,sha256:crypto.createHash('sha256').update(code).digest('hex'),worldbookHash:contract});
const compiled=await build({entryPoints:[new URL('../src/runtime/script-loader.js',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],bundle:true,write:false,format:'esm',target:'es2022',define:{__RELEASE_CONFIG__:JSON.stringify(config),__BOOK_HASH__:JSON.stringify(contract)}});
async function run({rows=[{key:config.refKey,value:latest}],pointerError=false,reply,code=core}={}){
  const requests=[],messages=[],boots=[],handlers={},root={};let reloaded=0,destroyed=0;
  root.__CJ_SHENGHAO_V2__={destroy(){destroyed++;}};
  const response=(value,status=200)=>({ok:status===200,status,text:async()=>typeof value==='string'?value:JSON.stringify(value)});
  const context=vm.createContext({window:{parent:root,addEventListener:(name,fn)=>handlers[name]=fn},console:{log(){}},crypto:crypto.webcrypto,TextEncoder,AbortController,setTimeout,clearTimeout,boots,toastr:Object.fromEntries(['info','error'].map(kind=>[kind,text=>messages.push({kind,text})])),reloadIframe(){reloaded++;},atob,
    fetch:async(url,options)=>{requests.push({url,headers:options.headers});if(url.startsWith(config.supabaseUrl)){if(pointerError)throw Error('offline');return response(rows);}
      const ref=url.match(/@([a-f0-9]{40})\//)?.[1];const custom=reply?.({url,ref,response});if(custom)return custom;
      return response(url.endsWith('release.json')?metadata(ref,code(ref)):code(ref));}});
  await vm.runInContext('(async()=>{'+compiled.outputFiles[0].text+'})()',context);
  return {root,boots,requests,messages,handlers,get reloaded(){return reloaded;},get destroyed(){return destroyed;}};
}
test('固定加载器按完整提交下载并核对本体，桥接显示实际版本',async()=>{const r=await run();assert.deepEqual(r.boots,[latest]);assert.equal(r.root.__CJ_SHENGHAO_SCRIPT_LOADER__.inspect().runningRef,latest);assert.equal(r.requests[0].headers.Authorization,undefined);assert.ok(r.requests.slice(1).every(x=>x.url.includes('@'+latest+'/')));await r.root.__CJ_SHENGHAO_SCRIPT_LOADER__.reload();assert.equal(r.reloaded,1);});
for(const [name,options] of [['指针断网',{pointerError:true}],['缺行',{rows:[]}],['脏指针',{rows:[{key:config.refKey,value:'../main'}]}]])test(name+'使用内嵌保底提交',async()=>{const r=await run(options);assert.deepEqual(r.boots,[fallback]);assert.equal(r.root.__CJ_SHENGHAO_SCRIPT_LOADER__.inspect().fallback,true);});
test('停用优先于脏指针，绝不请求CDN或运行本体，并转义提示',async()=>{const r=await run({rows:[{key:config.refKey,value:'../main'},{key:config.offKey,value:'<img src=x onerror=alert(1)>'}]});assert.equal(r.requests.length,1);assert.deepEqual(r.boots,[]);assert.equal(r.destroyed,1);assert.match(r.messages[0].text,/&lt;img/);});
test('指向旧提交时允许回退，不强制升版',async()=>{const r=await run({rows:[{key:config.refKey,value:fallback}]});assert.deepEqual(r.boots,[fallback]);assert.equal(r.root.__CJ_SHENGHAO_SCRIPT_LOADER__.inspect().fallback,false);});
test('主CDN不可用时依次尝试第二条线路',async()=>{const r=await run({reply:({url,response})=>url.includes('testingcf')?response('unavailable',503):null});assert.deepEqual(r.boots,[latest]);assert.ok(r.requests.some(x=>x.url.includes('fastly')));});
for(const kind of ['http','html','hash','contract','metadata'])test('候选'+kind+'错误不会执行，使用兼容保底',async()=>{const r=await run({reply:({url,ref,response})=>{if(ref!==latest)return null;if(kind==='http')return response('error',503);if(kind==='metadata'&&url.endsWith('.json'))return response({schemaVersion:99});if(kind==='contract'&&url.endsWith('.json'))return response({...metadata(ref),worldbookHash:'d'.repeat(64)});if(!url.endsWith('.json')&&kind==='html')return response('<html>CDN error</html>');if(!url.endsWith('.json')&&kind==='hash')return response(core(ref)+'\n// corrupt');return null;}});assert.deepEqual(r.boots,[fallback]);});
test('全部CDN失败只报告错误，不启动任何本体',async()=>{const r=await run({reply:({response})=>response('offline',503)});assert.deepEqual(r.boots,[]);assert.equal(r.root.__CJ_SHENGHAO_SCRIPT_LOADER__.inspect().runningRef,'');assert.ok(r.messages.some(x=>x.kind==='error'));});
test('本体异步启动抛错后可回保底，全部启动失败不能标成正在运行',async()=>{const r=await run({code:ref=>'// CJ_SHENGHAO_TERMINAL_CORE\n(async()=>{throw Error("startup failed")})()'});assert.deepEqual(r.boots,[]);assert.equal(r.root.__CJ_SHENGHAO_SCRIPT_LOADER__.inspect().runningRef,'');});
test('关闭加载器清理桥接，旧实例不得清理新实例',async()=>{const r=await run();r.handlers.pagehide();assert.equal(r.root.__CJ_SHENGHAO_SCRIPT_LOADER__,undefined);const another=await run();another.root.__CJ_SHENGHAO_SCRIPT_LOADER__={newer:true};another.handlers.pagehide();assert.equal(another.root.__CJ_SHENGHAO_SCRIPT_LOADER__.newer,true);});
test('桥接检测重新读指针，紧急停用不再取元数据',async()=>{const rows=[{key:config.refKey,value:latest}],r=await run({rows});rows.push({key:config.offKey,value:'maintenance'});const p=await r.root.__CJ_SHENGHAO_SCRIPT_LOADER__.check();assert.equal(p.off,'maintenance');assert.equal(p.metadata,null);});
test('公开配置拒绝服务密钥、额外字段、短提交及注入路径',()=>{assert.equal(assertPublicConfig(config),config);for(const change of [{publishableKey:'sb_secret_'+'x'.repeat(30)},{serviceKey:'secret'},{fallbackRef:'main'},{table:'x?select=*'},{repository:'other/repo'}])assert.throws(()=>assertPublicConfig({...config,...change}));const jwt='e30.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';assert.throws(()=>assertPublicConfig({...config,publishableKey:jwt}));assert.deepEqual(publicHeaders(config.publishableKey),{apikey:config.publishableKey});assert.throws(()=>cdnUrl(config,'evil.example',latest));assert.throws(()=>cdnUrl(config,'cdn.jsdelivr.net','main'));assert.throws(()=>assertRelease({...metadata(latest),sha256:'bad'},config));});
