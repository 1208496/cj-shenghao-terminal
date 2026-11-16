export const openingMarker='<CJ_SHENGHAO_OPENING/>';
export function openingDisplayRegexes(html){
  // ST 1.19 uses a replacement callback: $$ is literal, while $n/$<name>
  // are expanded separately. Keep template-literal dollars intact.
  if(/\$\d|\$<|\{\{match\}\}/i.test(html))throw Error('Opening HTML contains host replacement tokens');
  const base={trimStrings:[],placement:[2],disabled:false,runOnEdit:true,substituteRegex:0,minDepth:null,maxDepth:null};
  return [
    {...base,id:'6efaa04b-3201-454f-b41a-596b30b8d514',scriptName:'开局表单 · 本地加载',findRegex:'/<CJ_SHENGHAO_OPENING\\s*\\/>/g',replaceString:'```html\n'+html+'\n```',markdownOnly:true,promptOnly:false},
    {...base,id:'15c9f6ea-198b-426b-8a11-a55a6e509a55',scriptName:'开局页面不进入上下文',findRegex:'/<CJ_SHENGHAO_OPENING\\s*\\/>/g',replaceString:'',markdownOnly:false,promptOnly:true}
  ];
}
