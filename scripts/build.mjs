import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const cfg=await read('project.json');
const output=path.join(root,'dist',cfg.version);
const targets=['神豪终端.json','worldbook.json','runtime.js','opening.html','phone.html','artifact-manifest.json'];
if(process.argv.includes('--dry-run')){console.log(JSON.stringify({root,version:cfg.version,writes:targets.map(x=>path.join(output,x)),policy:'New isolated project; no writes outside workspace.'},null,2));process.exit(0);}
await fs.mkdir(output,{recursive:true});
const css=await fs.readFile(path.join(root,'src/ui/style.css'),'utf8');
const ui=await build({entryPoints:[path.join(root,'src/ui/app.js')],bundle:true,write:false,format:'iife',target:'es2022',minify:true});
const app=ui.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=async surface=>(await fs.readFile(path.join(root,'src/ui',surface+'.template.html'),'utf8')).replace('__STYLE__',css).replace('__APP__',app);
const opening=await html('setup'),phone=await html('phone');
// Only generated intermediate within the workspace, excluded from source authority.
await fs.writeFile(path.join(root,'src/ui/phone.html'),phone);
const worldbookHash=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'src/content/literary.json'))).update(await fs.readFile(path.join(root,'src/content/protocol.txt'))).digest('hex');
const runtime=await build({entryPoints:[path.join(root,'src/runtime/host.js')],bundle:true,write:false,format:'esm',target:'es2022',loader:{'.html':'text','.txt':'text'},define:{__BOOK_HASH__:JSON.stringify(worldbookHash)},minify:true});
const script=runtime.outputFiles[0].text;
const prose=await read('src/content/literary.json');
const protocol=await fs.readFile(path.join(root,'src/content/protocol.txt'),'utf8');
const bodies=[...prose.entries,{id:'protocol',title:'唯一事实协议',body:protocol}];
const book={name:'神豪终端 · v'+cfg.version,description:'都市自由人生、人物自主与唯一事件结算',scan_depth:2,recursive_scanning:false,
  extensions:{project_id:cfg.id,version:cfg.version,scan_depth:2,recursive_scanning:false},
  entries:bodies.map((b,i)=>({id:i+1,keys:[],secondary_keys:[],comment:b.title,content:b.body,constant:true,selective:false,enabled:true,
    insertion_order:100+i*10,position:'before_char',use_regex:false,
    extensions:{position:0,exclude_recursion:true,prevent_recursion:true,scan_depth:2,depth:4,role:0,probability:100,useProbability:true,stable_id:b.id,recipient:'plot-and-extra-parser'}}))};
const regex=(id,name,find,replace,display,prompt)=>({id,scriptName:name,findRegex:find,replaceString:replace,trimStrings:[],placement:[2],disabled:false,markdownOnly:display,promptOnly:prompt,runOnEdit:true,substituteRegex:0,minDepth:null,maxDepth:null});
const data={name:cfg.name,description:'',personality:'',scenario:'',first_mes:prose.opening+'\n\n```html\n'+opening+'\n```',mes_example:'',creator_notes:'全新v2工程，依据SHEJI。导入后启用角色卡正则与酒馆助手脚本。先在正文完成开局。本卡使用酒馆助手楼层变量，不要求另装MVU或Zod。可选MVU仅作外部解析兼容；不负责现金结算。公开仓库提供完整性校验的前端更新；世界书变更需导入新版整卡。',system_prompt:'',post_history_instructions:'',alternate_greetings:[],tags:['都市','自由人生','神豪终端','v2'],creator:'1208496',character_version:cfg.version,
  character_book:book,extensions:{world:book.name,cj_shenghao:{project_id:cfg.id,version:cfg.version,card_type:'hybrid',authoritative_root:'stat_data.shenghao',parser:'inline',mvu:'optional-protected-subtree'},
    regex_scripts:[regex('4e6572ad-1668-4905-85cc-8799e1d3f1d4','隐藏事件提案 · 仅显示','/<SH_EVENTS>[\\s\\S]*?(?:<\\/SH_EVENTS>|$)/g','',true,false),
      regex('15c9f6ea-198b-426b-8a11-a55a6e509a55','开局页面不进入上下文','/```html[\\s\\S]*?```/g','',false,true),
      regex('a2dc6996-237c-4014-8d92-5834d2c3f800','移除兼容占位','/<StatusPlaceHolderImpl\\s*\\/>/gi','',true,false)],
    tavern_helper:{scripts:[{type:'script',enabled:true,name:'神豪终端 v2 · 统一结算与手机',id:'e3b93f04-34ca-4287-b69c-928148cf88f6',content:script,info:'内嵌唯一结算器及前端，无远程代码加载。仅使用酒馆助手API。',button:{enabled:false,buttons:[]},data:{},export_with:{data:false,button:false}}],variables:{}}}};
const card={spec:'chara_card_v3',spec_version:'3.0',data};
await Promise.all([fs.writeFile(path.join(output,'神豪终端.json'),JSON.stringify(card,null,2)+'\n'),fs.writeFile(path.join(output,'worldbook.json'),JSON.stringify(book,null,2)+'\n'),fs.writeFile(path.join(output,'runtime.js'),script),fs.writeFile(path.join(output,'opening.html'),opening),fs.writeFile(path.join(output,'phone.html'),phone)]);
const hashes={};for(const f of targets.filter(x=>x!=='artifact-manifest.json')){const b=await fs.readFile(path.join(output,f));hashes[f]={sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};}
await fs.writeFile(path.join(output,'artifact-manifest.json'),JSON.stringify({schemaVersion:1,projectId:cfg.id,version:cfg.version,gate:'offline-candidate',files:hashes},null,2)+'\n');
await fs.mkdir(path.join(root,'updates'),{recursive:true});
await fs.writeFile(path.join(root,'updates/latest.json'),JSON.stringify({schemaVersion:1,projectId:cfg.id,version:cfg.version,url:'https://github.com/'+cfg.repository+'/tree/main/dist/'+cfg.version,visibility:'public',worldbookHash,
  runtime:{url:'https://raw.githubusercontent.com/'+cfg.repository+'/main/dist/'+cfg.version+'/runtime.js',sha256:hashes['runtime.js'].sha256}},null,2)+'\n');
console.log('BUILD_OK '+output);
