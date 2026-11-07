/** Serve the GH-Pages export under the /ironhold/ sub-path, like GitHub does. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = normalize(new URL('../dist-gh/', import.meta.url).pathname);
const PORT = Number(process.argv[2] ?? 4174);
const PREFIX = '/ironhold';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.ico':'image/x-icon','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url??'/','http://localhost');
  let rel=decodeURIComponent(url.pathname);
  if (!rel.startsWith(PREFIX)) { res.writeHead(404).end('not found'); return; }
  rel = rel.slice(PREFIX.length) || '/';
  let file=normalize(join(ROOT, rel));
  if(!file.startsWith(ROOT)) return res.writeHead(403).end();
  let body, type=MIME[extname(file)]??'application/octet-stream';
  try { const i=await stat(file); if(i.isDirectory()){file=join(file,'index.html');type=MIME['.html'];} body=await readFile(file); }
  catch { body=await readFile(join(ROOT,'index.html')); type=MIME['.html']; }
  res.writeHead(200,{'content-type':type,'cache-control':'no-store'});
  res.end(body);
});
server.listen(PORT,'127.0.0.1',()=>console.log(`preview → http://127.0.0.1:${PORT}${PREFIX}/`));
