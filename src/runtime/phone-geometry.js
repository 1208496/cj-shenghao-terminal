// Keep the requested size separate from the temporary viewport fit.
export function phoneGeometry(layout,viewport){
  const {width,height,scale=1}=layout;
  const zoom=(viewport.referenceDpr||1)/(viewport.devicePixelRatio||1)/(viewport.pinchScale||1);
  const ratio=Math.max(.01,Math.min(scale*zoom,(viewport.innerWidth-8)/width,(viewport.innerHeight-8)/height));
  const w=width*ratio,h=height*ratio,minTop=Math.min(44,Math.max(4,viewport.innerHeight-h-4));
  const x=Math.max(4,Math.min(viewport.innerWidth-w-4,Number.isFinite(layout.left)?layout.left:viewport.innerWidth-w-20));
  const y=Math.max(minTop,Math.min(viewport.innerHeight-h-4,Number.isFinite(layout.top)?layout.top:80));
  return {ratio,left:x,top:y,zoom};
}
