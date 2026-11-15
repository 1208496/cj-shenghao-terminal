import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..'),cfg=JSON.parse(await fs.readFile(path.join(root,'project.json'),'utf8'));
const checkpoint=process.argv.includes('--checkpoint');
const out=path.join(root,'dist',cfg.version+(checkpoint?'-checkpoint':'')),card=JSON.parse(await fs.readFile(path.join(out,'神豪终端.json'),'utf8')),d=card.data;
const must=(v,s)=>{if(!v)throw Error(s);};
must(card.spec==='chara_card_v3'&&d.name===cfg.name,'card identity');
for(const k of ['description','personality','scenario','mes_example','system_prompt','post_history_instructions'])must(d[k]==='','unexpected traditional field '+k);
must(d.first_mes.includes('<section')||d.first_mes.includes('data-surface="setup"'),'opening carrier');
must(d.character_book.entries.length>=11,'substantive worldbook');
must(d.extensions.world===d.character_book.name&&d.character_version===d.character_book.extensions.version,'book version alignment');
for(const e of d.character_book.entries){if(['[InitVar]','[config_override]'].includes(e.comment)){must(!e.enabled,'native metadata must not enter prompt');JSON.parse(e.content);}else{must(e.content.length>150&&(e.enabled||e.extensions.stable_id==='extra-boundary')&&e.constant,'entry substantive');}must(e.extensions.scan_depth===2&&e.extensions.exclude_recursion&&e.extensions.prevent_recursion,'activation settings');must(!e.content.includes('【候选提案】'),'author metadata leak');}
const scripts=d.extensions.tavern_helper.scripts;
must(scripts.length===4&&scripts.filter(s=>s.enabled).length===3,'native runtime dependency count');
must(scripts[0].content.includes('registerMvuSchema')&&scripts[1].enabled&&!scripts[2].enabled,'schema and mutually exclusive regional loaders');
must(d.extensions.cj_shenghao.card_type==='mvu_zod','required MVU/Zod type');
for(const r of d.extensions.regex_scripts){const m=r.findRegex.match(/^\/([\s\S]*)\/([a-z]*)$/);new RegExp(m[1],m[2]);must(r.placement.every(p=>[1,2].includes(p)),'regex placement');}
const display=d.extensions.regex_scripts[0],m=display.findRegex.match(/^\/([\s\S]*)\/([a-z]*)$/);must('前文<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>后文'.replace(new RegExp(m[1],m[2]),'')==='前文后文','regex surrounding text');
const packed=await fs.readFile(path.join(out,'runtime.js'),'utf8'),bootstrap=await fs.readFile(path.join(out,'bootstrap-loader.js'),'utf8');must(bootstrap===scripts[3].content,'stable loader parity');
must(checkpoint?bootstrap===packed&&d.extensions.cj_shenghao.update_delivery==='embedded-checkpoint':bootstrap.startsWith('// CJ_SHENGHAO_STABLE_LOADER')&&!bootstrap.includes('raw.githubusercontent.com'),'declared loader delivery');
must(packed.startsWith('// CJ_SHENGHAO_TERMINAL_CORE'),'core marker');new vm.Script(packed);new vm.Script(bootstrap);
must(await fs.readFile(path.join(root,'dist/terminal.js'),'utf8')===packed,'canonical core parity');
const release=JSON.parse(await fs.readFile(path.join(out,'release.json'),'utf8'));must(release.schemaVersion===2&&release.sha256===crypto.createHash('sha256').update(packed).digest('hex'),'release metadata integrity');
for(const [i,file] of ['schema.js','mvu-domestic.js','mvu-global.js'].entries())must(await fs.readFile(path.join(out,file),'utf8')===scripts[i].content,'dependency parity '+file);
const protocol=await fs.readFile(path.join(root,'src/content/protocol.txt'),'utf8');must(protocol.includes('<JSONPatch>')&&d.character_book.entries.some(e=>e.extensions.stable_id==='state-context'&&e.content.includes('get_message_variable::stat_data.shenghao._context')),'native output and state macro');
must(!/import\s*['"]https?:/.test(packed),'unlisted remote runtime');
const manifest=JSON.parse(await fs.readFile(path.join(out,'artifact-manifest.json'),'utf8'));
for(const [f,meta] of Object.entries(manifest.files)){const b=await fs.readFile(path.join(out,f));must(b.length===meta.bytes&&crypto.createHash('sha256').update(b).digest('hex')===meta.sha256,'hash '+f);}
const ui=await fs.readFile(path.join(root,'src/ui/app.js'),'utf8');must(!/sample1|demoSpend|沈知意|模拟送礼/.test(ui),'prototype state leak');
console.log('CHECK_OK: card, worldbook, dependencies, regex, hashes, source/artifact parity');
