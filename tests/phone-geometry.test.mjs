import test from 'node:test';
import assert from 'node:assert/strict';
import {phoneGeometry} from '../src/runtime/phone-geometry.js';
test('browser zoom cycles preserve physical size without cumulative shrinking',()=>{
  for(const scale of [.82,1])for(const zoom of [1,1.25,1.5,2,1.5,1,.8,.5,1,2,1]){
    const g=phoneGeometry({width:365,height:730,scale},{innerWidth:1600/zoom,innerHeight:1000/zoom,devicePixelRatio:zoom,referenceDpr:1});
    assert(Math.abs(g.ratio*zoom-scale)<1e-9);
  }
});
test('viewport shrink is temporary and never changes the requested size',()=>{
 const desired={width:365,height:730,scale:1};
 assert(phoneGeometry(desired,{innerWidth:300,innerHeight:400}).ratio<1);
 assert.equal(phoneGeometry(desired,{innerWidth:1600,innerHeight:1000}).ratio,1);
 assert.equal(desired.scale,1);
});
test('folded phone also compensates zoom and positions remain in viewport',()=>{
 const g=phoneGeometry({width:74,height:108,scale:1,left:9999,top:-100},{innerWidth:800,innerHeight:500,devicePixelRatio:2,referenceDpr:1});
 assert.equal(g.ratio,.5);assert(g.left+74*g.ratio<=800);assert(g.top>=0);
});
