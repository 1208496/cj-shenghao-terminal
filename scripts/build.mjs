import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {build} from 'esbuild';
import {nativeDisplayRegexes} from '../src/runtime/native-display.js';
import {assertPublicConfig} from '../src/update/release-contract.js';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const cfg=await read('project.json');
const releaseConfig=await read('release/loader.config.json'),coreOnly=process.argv.includes('--core-only');
if(!coreOnly&&!process.argv.includes('--dry-run'))assertPublicConfig(releaseConfig);
const checkpoint=process.argv.includes('--checkpoint');
const output=path.join(root,'dist',cfg.version+(checkpoint?'-checkpoint':''));
const targets=['神豪终端.json','worldbook.json','runtime.js','bootstrap-loader.js','release.json','schema.js','mvu-domestic.js','mvu-global.js','opening.html','phone.html','artifact-manifest.json'];
if(process.argv.includes('--dry-run')){console.log(JSON.stringify({root,version:cfg.version,writes:targets.map(x=>path.join(output,x)),policy:'New isolated project; no writes outside workspace.'},null,2));process.exit(0);}
await fs.mkdir(output,{recursive:true});
const css=(await fs.readFile(path.join(root,'src/ui/style.css'),'utf8')).replaceAll('\r\n','\n');
const ui=await build({entryPoints:[path.join(root,'src/ui/app.js')],bundle:true,write:false,format:'iife',target:'es2022',minify:true});
const app=ui.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=async surface=>(await fs.readFile(path.join(root,'src/ui',surface+'.template.html'),'utf8')).replace('__STYLE__',css).replace('__APP__',app);
const opening=await html('setup'),phone=await html('phone');
// Only generated intermediate within the workspace, excluded from source authority.
await fs.writeFile(path.join(root,'src/ui/phone.html'),phone);
const worldbookHash=crypto.createHash('sha256').update((await fs.readFile(path.join(root,'src/content/state-context.txt'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/content/literary.json'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/content/protocol.txt'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/runtime/schema.js'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/runtime/schema-entry.js'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/runtime/mvu-loader.js'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/runtime/script-loader.js'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/update/release-contract.js'),'utf8')).replaceAll('\r\n','\n')).update((await fs.readFile(path.join(root,'src/ui/setup.template.html'),'utf8')).replaceAll('\r\n','\n')).update(String(cfg.cardContractRevision||1)).update(JSON.stringify(nativeDisplayRegexes())).update('mvu:d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc').digest('hex');
const runtime=await build({entryPoints:[path.join(root,'src/runtime/host.js')],bundle:true,write:false,format:'esm',target:'es2022',loader:{'.html':'text','.txt':'text'},define:{__BOOK_HASH__:JSON.stringify(worldbookHash)},minify:true});
const script='// CJ_SHENGHAO_TERMINAL_CORE\n;(async()=>{\n'+runtime.outputFiles[0].text+'\n})();\n';
const releaseMetadata={schemaVersion:2,projectId:cfg.id,repository:cfg.repository,version:cfg.version,runtimeFile:'dist/terminal.js',mark:'CJ_SHENGHAO_TERMINAL_CORE',worldbookHash,sha256:crypto.createHash('sha256').update(script).digest('hex'),notes:cfg.releaseNotes||''};
await fs.writeFile(path.join(root,'dist/terminal.js'),script);await fs.writeFile(path.join(root,'dist/release.json'),JSON.stringify(releaseMetadata,null,2)+'\n');
if(coreOnly){console.log('CORE_PREPARED_NOT_PUBLISHED '+cfg.version);process.exit(0);}
const fallbackMetadata=checkpoint?null:JSON.parse(execFileSync('git',['show',releaseConfig.fallbackRef+':dist/release.json'],{cwd:root,encoding:'utf8',maxBuffer:50000}));
if(!checkpoint&&fallbackMetadata.worldbookHash!==worldbookHash)throw Error('保底提交不兼容当前世界书/正则/结构，请先发布并验证本体，再更新fallbackRef');
const bootstrapBuild=checkpoint?null:await build({entryPoints:[path.join(root,'src/runtime/script-loader.js')],bundle:true,write:false,format:'esm',target:'es2022',minify:true,define:{__RELEASE_CONFIG__:JSON.stringify(releaseConfig),__BOOK_HASH__:JSON.stringify(worldbookHash)}});
const bootstrap=checkpoint?script:'// CJ_SHENGHAO_STABLE_LOADER\n;(async()=>{\n'+bootstrapBuild.outputFiles[0].text+'\n})().catch(e=>{console.log("[神豪终端 加载器] "+e.message);try{toastr.error("终端加载器未能启动，请检查配置与网络。","神豪终端");}catch{}});\n';
const prose=await read('src/content/literary.json');
const protocol=await fs.readFile(path.join(root,'src/content/protocol.txt'),'utf8');
const bodies=[{id:'state-context',title:'当前人物与现场资料',body:await fs.readFile(path.join(root,'src/content/state-context.txt'),'utf8')},...prose.entries.map(b=>({...b,title:'[mvu_plot] '+b.title})),{id:'protocol',title:'[mvu_update] 原生变量与结算事实协议',body:protocol},{id:'initvar',title:'[InitVar]',body:'{"shenghao":null}',disabled:true},{id:'config',title:'[config_override]',body:JSON.stringify({兼容性:{更新到聊天变量:false}}),disabled:true}];
const book={name:'神豪终端 · v'+cfg.version,description:'原生MVU/Zod · 当代都市、人物自主、时间日历与专属奖池',scan_depth:2,recursive_scanning:false,
  extensions:{project_id:cfg.id,version:cfg.version,scan_depth:2,recursive_scanning:false},
  entries:bodies.map((b,i)=>({id:i+1,keys:b.keys||[],secondary_keys:[],comment:b.title,content:b.body,constant:b.constant!==false,selective:false,enabled:!b.disabled,
    insertion_order:100+i*10,position:'before_char',use_regex:false,
    extensions:{position:b.id==='protocol'?4:0,exclude_recursion:true,prevent_recursion:true,scan_depth:2,depth:b.id==='protocol'?0:4,role:0,probability:100,useProbability:true,stable_id:b.id}}))};
const schemaBuild=await build({entryPoints:[path.join(root,'src/runtime/schema-entry.js')],bundle:true,write:false,format:'esm',target:'es2022',minify:true});
const schemaScript=schemaBuild.outputFiles[0].text;
const mvuPin='d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc';
async function loader(region){return (await build({entryPoints:[path.join(root,'src/runtime/mvu-loader.js')],bundle:true,write:false,format:'esm',target:'es2022',define:{__MVU_SOURCE__:JSON.stringify('https://'+(region==='domestic'?'testingcf':'cdn')+'.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@'+mvuPin+'/artifact/bundle.js')},minify:true})).outputFiles[0].text;}
const domestic=await loader('domestic'),globalLoader=await loader('global');
const helperScript=(id,name,content,enabled,info)=>({type:'script',enabled,name,id,content,info,button:{enabled:false,buttons:[]},data:{},export_with:{data:false,button:false}});
const regex=(id,name,find,replace,display,prompt)=>({id,scriptName:name,findRegex:find,replaceString:replace,trimStrings:[],placement:[2],disabled:false,markdownOnly:display,promptOnly:prompt,runOnEdit:true,substituteRegex:0,minDepth:null,maxDepth:null});
const data={name:cfg.name,description:'',personality:'',scenario:'',first_mes:prose.opening+'\n\n```html\n'+opening+'\n```',mes_example:'',creator_notes:'原生MVU修正版 v'+cfg.version+'。需要酒馆助手4.12及其Zod4能力。导入并启用正则、世界书及角色脚本：原生MVU国内加载器、Zod结构注册、终端；全球备用加载器默认关闭，不要同时开启。按开局表单确认起点。人物、时间、场景与经济均保存在原生MVU楼层变量stat_data.shenghao。额外模型解析使用MVU原生面板配置。本卡不兼容旧版自定义事件存档，请使用新聊天。MVU及结构注册依赖固定版本HTTPS资源，联网失败会明确停在未就绪。世界书/结构变更需整卡导入，终端使用固定加载器与Supabase发布指针，按jsDelivr完整提交号自动加载已发布本体；旧完整版需先换一次加载器。',system_prompt:'',post_history_instructions:'',alternate_greetings:[],tags:['都市','自由人生','神豪终端','v2'],creator:'1208496',character_version:cfg.version,
  character_book:book,extensions:{world:book.name,cj_shenghao:{project_id:cfg.id,version:cfg.version,card_type:'mvu_zod',authoritative_root:'stat_data.shenghao',parser:'native-inline-or-extra',mvu:'required-native-pinned',zod:'required-host-v4',update_delivery:'supabase-commit-loader'},
    regex_scripts:[...nativeDisplayRegexes(),
      {...regex('adfc3cee-f138-4a81-9f61-47f4d08e1b12','历史更新命令不进入提示词','/<UpdateVariable>[\\s\\S]*?(?:<\\/UpdateVariable>|$)/gi','',false,true),placement:[1,2]},
      regex('15c9f6ea-198b-426b-8a11-a55a6e509a55','开局页面不进入上下文','/\x60\x60\x60html[\\s\\S]*?\x60\x60\x60/g','',false,true),
      regex('a2dc6996-237c-4014-8d92-5834d2c3f800','移除兼容占位','/<StatusPlaceHolderImpl\\s*\\/>/gi','',true,false)],
    tavern_helper:{scripts:[
      helperScript('40fb64d6-582e-4cdc-bd9f-c6c0427e0c0e','神豪终端 · Zod结构注册',schemaScript,true,'原生registerMvuSchema；StageDog固定提交，PolyForm Noncommercial 1.0.0。'),
      helperScript('c533f64c-f4cf-49f7-a420-f136a457a7ae','MVU变量框架 · 国内线路',domestic,true,'MagicalAstrogy/MagVarUpdate，MIT，固定提交'+mvuPin+'。'),
      helperScript('c533f64c-f4cf-49f7-a420-f136a457a7af','MVU变量框架 · 全球备用',globalLoader,false,'与国内线路互斥；仅国内资源失败时切换。'),
      helperScript('e3b93f04-34ca-4287-b69c-928148cf88f6','神豪终端 · 固定加载器',bootstrap,true,'Supabase只读版本指针，jsDelivr完整提交号、多线路、保底版本与紧急停用；本体只读取原生MVU。')
    ],variables:{}}}};

const card={spec:'chara_card_v3',spec_version:'3.0',data};
if(checkpoint){
  data.creator_notes='本地验收整卡 v'+cfg.version+'：内嵌当前本体，不连接线上更新指针。需新聊天、酒馆助手与原生MVU/Zod，远程MVU依赖保持原固定版本。正式热更新发布需另走release流程。';
  data.extensions.cj_shenghao.update_delivery='embedded-checkpoint';
  Object.assign(data.extensions.tavern_helper.scripts[3],{name:'神豪终端 · 本地验收本体',info:'仅用于本次本地验收；内嵌当前本体，不读取Supabase指针。'});
}
await Promise.all([fs.writeFile(path.join(output,'神豪终端.json'),JSON.stringify(card,null,2)+'\n'),fs.writeFile(path.join(output,'worldbook.json'),JSON.stringify(book,null,2)+'\n'),fs.writeFile(path.join(output,'runtime.js'),script),fs.writeFile(path.join(output,'bootstrap-loader.js'),bootstrap),fs.writeFile(path.join(output,'release.json'),JSON.stringify(releaseMetadata,null,2)+'\n'),fs.writeFile(path.join(output,'schema.js'),schemaScript),fs.writeFile(path.join(output,'mvu-domestic.js'),domestic),fs.writeFile(path.join(output,'mvu-global.js'),globalLoader),fs.writeFile(path.join(output,'opening.html'),opening),fs.writeFile(path.join(output,'phone.html'),phone)]);
const hashes={};for(const f of targets.filter(x=>x!=='artifact-manifest.json')){const b=await fs.readFile(path.join(output,f));hashes[f]={sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};}
await fs.writeFile(path.join(output,'artifact-manifest.json'),JSON.stringify({schemaVersion:1,projectId:cfg.id,version:cfg.version,gate:'offline-candidate',files:hashes},null,2)+'\n');
// updates/latest.json is a historical rc.5 artifact, never the new system's pointer.
console.log('BUILD_OK '+output);
