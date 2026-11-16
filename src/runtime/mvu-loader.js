// Pinned upstream MagVarUpdate, MIT. The second loader is an explicitly disabled regional alternative.
const source=__MVU_SOURCE__;
await import(source);
const root=window.parent;
await waitGlobalInitialized('Mvu');
const bridge={
  reprocess:()=>eventEmit(getButtonEvent('重新处理变量')),
  retryExtra:()=>eventEmit(getButtonEvent('重试额外模型解析')),
  source
};
root.__CJ_MVU_LOADER__=bridge;
window.addEventListener('pagehide',()=>{if(root.__CJ_MVU_LOADER__===bridge)delete root.__CJ_MVU_LOADER__;},{once:true});
