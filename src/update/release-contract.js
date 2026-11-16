export const CDN_HOSTS=['testingcf.jsdelivr.net','fastly.jsdelivr.net','cdn.jsdelivr.net'];
export const isCommit=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export function assertPublicConfig(c,{requireFallback=true}={}){
  const allowed=new Set(['projectId','repository','file','metadataFile','mark','supabaseUrl','table','publishableKey','refKey','offKey','fallbackRef']);
  if(!c||Object.keys(c).some(k=>!allowed.has(k)))throw Error('UNKNOWN_LOADER_CONFIG_FIELD');
  if(c?.projectId!=='cj-shenghao-terminal-v2'||c.repository!=='1208496/cj-shenghao-terminal'||c.file!=='dist/terminal.js'||c.metadataFile!=='dist/release.json'||c.mark!=='CJ_SHENGHAO_TERMINAL_CORE')throw Error('LOADER_PROJECT_INVALID');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl))throw Error('SUPABASE_URL_NOT_CONFIGURED');
  if(!/^[a-z_][a-z0-9_]*$/.test(c.table)||![c.refKey,c.offKey].every(k=>/^[a-zA-Z0-9_-]{1,100}$/.test(k))||c.refKey===c.offKey)throw Error('POINTER_NAMESPACE_INVALID');
  const key=c.publishableKey;
  if(typeof key!=='string'||key.length<20||key.length>4096||/\s/.test(key)||key.startsWith('sb_secret_'))throw Error('PUBLIC_KEY_REQUIRED');
  if(!key.startsWith('sb_publishable_')){
    try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw Error('role');}catch{throw Error('ONLY_PUBLISHABLE_OR_ANON_KEY_ALLOWED');}
  }
  if(requireFallback&&!isCommit(c.fallbackRef))throw Error('FALLBACK_COMMIT_NOT_CONFIGURED');
  return c;
}
export function publicHeaders(key){return key.startsWith('sb_publishable_')?{apikey:key}:{apikey:key,Authorization:'Bearer '+key};}
export function assertRelease(m,c){
  if(m?.schemaVersion!==2||m.projectId!==c.projectId||m.repository!==c.repository||m.runtimeFile!==c.file||m.mark!==c.mark||!/^[a-f0-9]{64}$/.test(m.sha256)||!/^[a-f0-9]{64}$/.test(m.worldbookHash)||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(m.version))throw Error('RELEASE_METADATA_INVALID');
  return m;
}
export function cdnUrl(c,host,ref,file=c.file){if(!CDN_HOSTS.includes(host)||!isCommit(ref)||![c.file,c.metadataFile].includes(file))throw Error('CDN_TARGET_INVALID');return 'https://'+host+'/gh/'+c.repository+'@'+ref+'/'+file;}
