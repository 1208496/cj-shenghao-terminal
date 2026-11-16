import {createSchema} from './schema.js';
const root=window.parent;
const provider=globalThis.z;
if(!provider?.object||!provider?.looseObject||!provider?.record)throw new Error('神豪终端需要酒馆助手提供的 Zod 4。');
const sources=[
 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource@290eb3b610b6c3cab2cd437e0f111bcc23c4bf53/dist/util/mvu_zod.js',
 'https://cdn.jsdelivr.net/gh/StageDog/tavern_resource@290eb3b610b6c3cab2cd437e0f111bcc23c4bf53/dist/util/mvu_zod.js'
];
let registrar,lastError;
for(const source of sources){try{registrar=await import(source);break;}catch(e){lastError=e;}}
if(!registrar?.registerMvuSchema)throw lastError||new Error('MVU 结构注册器未能加载');
const schemas=createSchema(provider);
registrar.registerMvuSchema(schemas.root);
root.__CJ_SHENGHAO_SCHEMA__=schemas;
console.info('[神豪终端] 原生 MVU 结构已注册', {root:'stat_data.shenghao'});
window.addEventListener('pagehide',()=>{if(root.__CJ_SHENGHAO_SCHEMA__===schemas)delete root.__CJ_SHENGHAO_SCHEMA__;},{once:true});
