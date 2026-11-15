import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..'),cfg=JSON.parse(await fs.readFile(path.join(root,'project.json'),'utf8'));
const out=path.join(root,'dist',cfg.version),card=JSON.parse(await fs.readFile(path.join(out,'神豪终端.json'),'utf8')),d=card.data;
const must=(v,s)=>{if(!v)throw Error(s);};
must(card.spec==='chara_card_v3'&&d.name===cfg.name,'card identity');
for(const k of ['description','personality','scenario','mes_example','system_prompt','post_history_instructions'])must(d[k]==='','unexpected traditional field '+k);
must(d.first_mes.includes('<section')||d.first_mes.includes('data-surface="setup"'),'opening carrier');
must(d.character_book.entries.length===5,'substantive worldbook');
must(d.extensions.world===d.character_book.name&&d.character_version===d.character_book.extensions.version,'book version alignment');
for(const e of d.character_book.entries){must(e.content.length>150&&e.enabled&&e.constant,'entry substantive');must(e.extensions.scan_depth===2&&e.extensions.exclude_recursion&&e.extensions.prevent_recursion,'activation settings');must(!e.content.includes('【候选提案】'),'author metadata leak');}
must(d.extensions.tavern_helper.scripts.length===1&&d.extensions.tavern_helper.scripts[0].enabled,'embedded runtime');
for(const r of d.extensions.regex_scripts){const m=r.findRegex.match(/^\/([\s\S]*)\/([a-z]*)$/);new RegExp(m[1],m[2]);must(r.placement.length===1&&r.placement[0]===2,'regex placement');}
const display=d.extensions.regex_scripts[0],m=display.findRegex.match(/^\/([\s\S]*)\/([a-z]*)$/);must('前文<SH_EVENTS>{}</SH_EVENTS>后文'.replace(new RegExp(m[1],m[2]),'')==='前文后文','regex surrounding text');
const packed=await fs.readFile(path.join(out,'runtime.js'),'utf8');must(packed===d.extensions.tavern_helper.scripts[0].content,'runtime parity');
must(!/import\s*['"]https?:/.test(packed),'unlisted remote runtime');
const manifest=JSON.parse(await fs.readFile(path.join(out,'artifact-manifest.json'),'utf8'));
for(const [f,meta] of Object.entries(manifest.files)){const b=await fs.readFile(path.join(out,f));must(b.length===meta.bytes&&crypto.createHash('sha256').update(b).digest('hex')===meta.sha256,'hash '+f);}
const ui=await fs.readFile(path.join(root,'src/ui/app.js'),'utf8');must(!/sample1|demoSpend|沈知意|模拟送礼/.test(ui),'prototype state leak');
console.log('CHECK_OK: card, worldbook, dependencies, regex, hashes, source/artifact parity');
