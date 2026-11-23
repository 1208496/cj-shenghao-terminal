// rc.41：样式表括号平衡守卫。rc.40 曾在 wheel.css 留下孤立 } 与悬空属性，
// 浏览器静默恢复会吞掉紧随其后的规则，所以把这条检查固化进单测。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=['style.css','wheel.css','card-face.css'];

function stripNoise(text){
  // 去掉注释，避免注释里的花括号干扰计数。
  return text.replace(/\/\*[\s\S]*?\*\//g,'');
}

for(const file of files){
  test(`rc.41 ${file} 花括号必须平衡且无悬空属性行`,()=>{
    const css=stripNoise(fs.readFileSync(new URL(`../src/ui/${file}`,import.meta.url),'utf8'));
    const open=(css.match(/\{/g)||[]).length,close=(css.match(/\}/g)||[]).length;
    assert.equal(open,close,`${file} 花括号不平衡：{ ${open} / } ${close}`);
    // 顶层出现「属性:值;」却不在任何规则内的悬空行（rc.40 事故形态）。
    let depth=0;
    for(const line of css.split('\n')){
      const text=line.trim();
      if(!text)continue;
      if(depth===0&&/^[a-z-]+\s*:\s*[^;{]+;?$/i.test(text))assert.fail(`${file} 存在悬空属性行：${text}`);
      depth+=(text.match(/\{/g)||[]).length-(text.match(/\}/g)||[]).length;
      if(depth<0)assert.fail(`${file} 出现多余的 }`);
    }
    assert.equal(depth,0,`${file} 结束时仍有未闭合的规则`);
  });
}
