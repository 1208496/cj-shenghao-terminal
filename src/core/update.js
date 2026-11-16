export function compareVersion(a,b) {
  const parse=v=>{const m=/^(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.]+))?$/.exec(v);if(!m)throw Error('INVALID_VERSION');return {n:m.slice(1,4).map(Number),pre:m[4]?.split('.')};};
  const x=parse(a),y=parse(b);
  for(let i=0;i<3;i++)if(x.n[i]!==y.n[i])return Math.sign(x.n[i]-y.n[i]);
  if(!x.pre&&!y.pre)return 0;if(!x.pre)return 1;if(!y.pre)return -1;
  for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){
    const p=x.pre[i],q=y.pre[i];if(p===q)continue;if(p===undefined)return -1;if(q===undefined)return 1;
    const pn=/^\d+$/.test(p),qn=/^\d+$/.test(q);if(pn&&qn)return Math.sign(Number(p)-Number(q));if(pn!==qn)return pn?-1:1;return p<q?-1:1;
  }return 0;
}
