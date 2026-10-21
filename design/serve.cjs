const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('Forbidden')}if(file===root||url.pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data)})}).listen(4173,'127.0.0.1',()=>console.log('GEKI design prototype: http://127.0.0.1:4173'));
