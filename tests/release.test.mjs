import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
for(const scenario of ['ok','config','test','core','syntax','stage','diff-error','commit','push','cdn','build','check','package-stage','package-commit','package-push','package-no-diff','readback'])test('发布流程 '+scenario+' 的指针门控',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'cj-release-')),repo=path.join(temp,'repo'),report=path.join(temp,'report.json');
  try{
    await fs.mkdir(path.join(repo,'scripts'),{recursive:true});await fs.mkdir(path.join(repo,'release'));await fs.mkdir(path.join(repo,'dist'));
    await fs.copyFile(path.join(root,'scripts/release.ps1'),path.join(repo,'scripts/release.ps1'));
    await fs.writeFile(path.join(temp,'service.env'),'SUPABASE_SERVICE_KEY=sb_secret_fixture_only\n');
    await fs.writeFile(path.join(repo,'release/loader.config.json'),JSON.stringify({repository:'1208496/cj-shenghao-terminal',file:'dist/terminal.js',metadataFile:'dist/release.json',mark:'CJ_SHENGHAO_TERMINAL_CORE',supabaseUrl:'https://fixture.supabase.co',table:'fixture',refKey:'fixture_ref',fallbackRef:''}));
    const core='// CJ_SHENGHAO_TERMINAL_CORE\nvoid 0;\n';await fs.writeFile(path.join(repo,'dist/terminal.js'),core);await fs.writeFile(path.join(repo,'dist/release.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(core).digest('hex'),worldbookHash:'c'.repeat(64)}));
    const result=spawnSync('pwsh',['-NoProfile','-File',path.join(root,'tests/release-harness.ps1'),'-Repo',repo,'-Scenario',scenario,'-Report',report],{encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(result.status,0,result.stderr);const actual=JSON.parse((await fs.readFile(report,'utf8')).replace(/^\uFEFF/,''));
    if(['ok','package-no-diff'].includes(scenario)){assert.equal(actual.error,'');assert.equal(actual.writes,1);assert.equal(actual.pushes,2);}
    else if(scenario==='readback'){assert.equal(actual.writes,1);assert.match(actual.error,/read-back/);}
    else{assert.notEqual(actual.error,'','expected release to stop');assert.equal(actual.writes,0,'failed prerequisite must never switch pointer');}
  }finally{assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'cj-release-'));await fs.rm(temp,{recursive:true,force:true});}
});
