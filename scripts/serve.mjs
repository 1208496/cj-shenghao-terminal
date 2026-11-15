import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer(async(req,res)=>{
  try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep))throw Error('outside root');
    if(!/^(?:dist|\.work)\//.test(path.relative(root,file).replaceAll('\\','/')))throw Error('not a preview file');
    const b=await fs.readFile(file);const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(b);
  }catch{res.writeHead(404);res.end('Not found');}
});server.listen(4176,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:4176/.work/preview.html'));
