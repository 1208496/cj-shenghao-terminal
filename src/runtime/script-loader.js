import {assertPublicConfig,assertRelease,publicHeaders,cdnUrl,CDN_HOSTS,isCommit} from '../update/release-contract.js';
const C=assertPublicConfig(__RELEASE_CONFIG__),ROOT=window.parent,SLOT='__CJ_SHENGHAO_SCRIPT_LOADER__';
const CONTRACT=__BOOK_HASH__,NAME='神豪终端';let disposed=false,running=null,lastPointer=null;
const log=m=>console.log('['+NAME+' 加载器] '+m);
const escape=s=>String(s).replace(/[&<>"']/g,c=>String.fromCharCode(38)+({'&':'amp;','<':'lt;','>':'gt;','"':'quot;',"'":'#39;'}[c]));
function say(kind,message){log(message);try{toastr[kind](escape(message),NAME,{timeOut:kind==='info'?0:15000});}catch{}}
async function get(url,timeout,headers){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal,headers});const text=await response.text();if(text.length>3000000)throw Error('RESPONSE_TOO_LARGE');return{ok:response.ok,status:response.status,text};}finally{clearTimeout(timer);}}
const PTR_CACHE_KEY='cj-shenghao:ptr-cache:v1',PTR_TTL=10*60*1000,PTR_FAIL_TTL=5*60*1000;
// rc.38 A-8：国内访问 Supabase 常年超时，原先 6 秒超时等于每次打开角色卡都白等 6 秒。
// 改成 2.5 秒超时，并把指针结果（成功 10 分钟 / 失败 5 分钟）缓存在 sessionStorage 里，
// 同一浏览器会话内刷新、切聊天都可直接走缓存，不再反复罚站。
function readPtrCache(){try{const raw=window.sessionStorage.getItem(PTR_CACHE_KEY);if(!raw)return null;const v=JSON.parse(raw);if(!v||typeof v.at!=='number'||Date.now()-v.at>(v.fail?PTR_FAIL_TTL:PTR_TTL))return null;return v;}catch{return null;}}
function writePtrCache(value,fail){try{window.sessionStorage.setItem(PTR_CACHE_KEY,JSON.stringify({ref:value?.ref||'',off:value?.off||'',at:Date.now(),fail:!!fail}));}catch{}}
async function pointer(){
  const cached=readPtrCache();
  if(cached){if(cached.fail)throw Error('POINTER_CACHED_UNAVAILABLE');return lastPointer={ref:cached.ref||'',off:cached.off||''};}
  let r;
  try{r=await get(C.supabaseUrl+'/rest/v1/'+C.table+'?key=in.('+C.refKey+','+C.offKey+')&select=key,value',2500,publicHeaders(C.publishableKey));}
  catch(e){writePtrCache(null,true);throw e;}
  if(!r.ok){writePtrCache(null,true);throw Error('POINTER_HTTP_'+r.status);}const rows=JSON.parse(r.text);if(!Array.isArray(rows)||rows.length>10)throw Error('POINTER_RESPONSE_INVALID');
  let ref='',off='';for(const row of rows){const value=String(row.value||'').trim();if(row.key===C.refKey)ref=value;if(row.key===C.offKey)off=value.slice(0,2000);}
  if(!off&&ref&&!isCommit(ref))throw Error('DIRTY_POINTER');
  if(off)ref='';
  writePtrCache({ref,off},false);
  return lastPointer={ref,off};
}
async function metadata(ref){
  let last;for(const host of CDN_HOSTS){try{const r=await get(cdnUrl(C,host,ref,C.metadataFile),12000);if(!r.ok)throw Error('HTTP_'+r.status);const text=r.text;if(text.length>30000)throw Error('METADATA_TOO_LARGE');return assertRelease(JSON.parse(text),C);}catch(e){last=e;log(host+' 元数据失败：'+e.message);}}
  throw last||Error('METADATA_UNAVAILABLE');
}
async function codeAt(ref,meta){
  for(const host of CDN_HOSTS){try{const r=await get(cdnUrl(C,host,ref),12000);if(!r.ok)throw Error('HTTP_'+r.status);const code=r.text;if(code.length>3000000||!code.startsWith('// '+C.mark))throw Error('CORE_MARK_INVALID');const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))].map(n=>n.toString(16).padStart(2,'0')).join('');if(sha!==meta.sha256)throw Error('CORE_HASH_MISMATCH');return {code,host};}catch(e){log(host+' 本体失败：'+e.message);}}
  throw Error('CORE_DOWNLOAD_FAILED');
}
const bridge={
  inspect:()=>({runningRef:running?.ref||'',version:running?.metadata.version||'',fallback:running?.fallback??false,pointerAvailable:!!lastPointer,off:lastPointer?.off||''}),
  async check(){const p=await pointer();if(p.off)return {off:p.off,ref:p.ref,metadata:null};const ref=p.ref||C.fallbackRef;return{ref,off:'',metadata:await metadata(ref)};},
  async reload(){if(disposed)throw Error('LOADER_DISPOSED');reloadIframe();}
};
ROOT[SLOT]=bridge;window.addEventListener('pagehide',()=>{disposed=true;if(ROOT[SLOT]===bridge)delete ROOT[SLOT];},{once:true});
let preferred='';try{const p=await pointer();if(p.off){say('info',p.off);ROOT.__CJ_SHENGHAO_V2__?.destroy?.();}else preferred=p.ref;}catch(e){log('指针读取失败：'+e.message+'，尝试保底提交');}
if(!lastPointer?.off){
  const refs=preferred&&preferred!==C.fallbackRef?[preferred,C.fallbackRef]:[C.fallbackRef];let loaded=false;
  for(const ref of refs){try{const m=await metadata(ref);if(m.worldbookHash!==CONTRACT){say('info','新版本包含世界书、开场白、正则或结构变化，请导入新版整卡；本次尝试保底版本。');continue;}const result=await codeAt(ref,m);if(disposed)break;log('用的是 @'+ref.slice(0,9)+' via '+result.host+'，'+result.code.length+' 字');await eval(result.code);running={ref,metadata:m,fallback:ref!==preferred};loaded=true;break;}catch(e){log('@'+ref.slice(0,9)+' 加载失败：'+e.message);}}
  if(!loaded&&!disposed)say('error','脚本没有下载或启动成功，请在网络恢复后重新打开角色卡；持续失败请联系作者。');
}
