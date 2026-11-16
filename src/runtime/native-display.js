// These rules affect display only. Raw messages remain untouched for native MVU.
export function nativeDisplayRegexes(){
  const make=(id,name,findRegex,replaceString,disabled=false)=>({id,scriptName:name,findRegex,replaceString,trimStrings:[],placement:[2],disabled,markdownOnly:true,promptOnly:false,runOnEdit:true,substituteRegex:0,minDepth:null,maxDepth:null});
  const inside='(?<=<UpdateVariable>(?:(?!<\\/?UpdateVariable>)[\\s\\S])*)';
  const beforeClose='(?=(?:(?!<\\/?UpdateVariable>)[\\s\\S])*<\\/UpdateVariable>)';
  return [
    make('4e6572ad-1668-4905-85cc-8799e1d3f1d4','变量更新 · 优先隐藏（默认关闭，开启即隐藏）','/<UpdateVariable>[\\s\\S]*?(?:<\\/UpdateVariable>|$)/gi','',true),
    make('d2f1c0ab-a613-4b02-b0ea-a1679010b211','变量折叠框 · 1 转义与号','/'+inside+'&'+beforeClose+'/g','&amp;'),
    make('d2f1c0ab-a613-4b02-b0ea-a1679010b212','变量折叠框 · 2 转义左括号','/'+inside+'<'+beforeClose+'/g','&lt;'),
    make('d2f1c0ab-a613-4b02-b0ea-a1679010b213','变量折叠框 · 3 转义右括号','/'+inside+'>'+beforeClose+'/g','&gt;'),
    make('d2f1c0ab-a613-4b02-b0ea-a1679010b215','变量折叠框 · 4 保护JSON引号','/'+inside+'"'+beforeClose+'/g','&quot;'),
    make('d2f1c0ab-a613-4b02-b0ea-a1679010b214','变量折叠框 · 5 正文底部显示','/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gi','<details class="cj-mvu-fold" data-cj-mvu=""><summary>本轮变量更新<span>点击展开</span></summary><pre><code>$1</code></pre></details>')
  ];
}
