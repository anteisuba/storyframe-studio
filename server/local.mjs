import http from 'node:http';
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'data');
await mkdir(data,{recursive:true});
const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg'};
async function body(req,max){let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>max)throw Error('文件过大');chunks.push(chunk)}return Buffer.concat(chunks)}
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value))};
let queue=Promise.resolve();
async function route(req,res){
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method!=='GET'&&req.headers.origin&&!/^http:\/\/(127\.0\.0\.1|localhost):(5174|8788)$/.test(req.headers.origin))return reply(res,403,{error:'来源不允许'});
 if(url.pathname==='/api/projects'&&req.method==='GET'){
  const rows=[];for(const file of await readdir(data)){if(!file.endsWith('.json'))continue;const p=JSON.parse(await readFile(path.join(data,file),'utf8'));rows.push({id:p.id,title:p.title})}return reply(res,200,rows);
 }
 if(url.pathname==='/api/projects'&&req.method==='POST'){
  const p=JSON.parse((await body(req,1024*1024)).toString());const id=randomUUID();const row={id,title:String(p.title||'未命名项目').slice(0,200),description:'',revision:0,shots:[],assets:[],notes:''};await writeFile(path.join(data,id+'.json'),JSON.stringify(row,null,2));return reply(res,201,row);
 }
 const match=url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]+)$/);
 if(match){const file=path.join(data,match[1]+'.json');const old=JSON.parse(await readFile(file,'utf8'));if(req.method==='GET')return reply(res,200,old);
  if(req.method==='PUT'){const p=JSON.parse((await body(req,4*1024*1024)).toString());if(p.revision!==old.revision)return reply(res,409,{error:'项目已被修改，请先重新载入，避免覆盖他人的内容'});if(p.id!==old.id||typeof p.title!=='string'||!Array.isArray(p.shots)||!Array.isArray(p.assets))return reply(res,400,{error:'项目格式错误'});await mkdir(path.join(data,'history'),{recursive:true});await writeFile(path.join(data,'history',old.id+'-'+old.revision+'.json'),JSON.stringify(old));p.revision++;await writeFile(file,JSON.stringify(p,null,2));return reply(res,200,p)}
 }
 if(url.pathname==='/api/upload'&&req.method==='POST'){
  const ext=Object.keys(types).find(x=>types[x]===req.headers['content-type']);if(!ext)return reply(res,400,{error:'支持 PNG/JPG/WebP、MP4/WebM、MP3/WAV/OGG'});const content=await body(req,50*1024*1024);const id=randomUUID();await mkdir(path.join(root,'media'),{recursive:true});await writeFile(path.join(root,'media',id+ext),content);return reply(res,201,{id,url:'/media/'+id+ext,bytes:content.length});
 }
 if(url.pathname.startsWith('/media/')&&req.method==='GET'){
  const name=url.pathname.slice(7);if(!/^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(name))return reply(res,400,{error:'文件名错误'});const content=await readFile(path.join(root,'media',name));const headers={'Content-Type':types[path.extname(name)]||'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};const m=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(m){const start=Number(m[1]),end=Math.min(m[2]?Number(m[2]):content.length-1,content.length-1);if(start>end){res.writeHead(416,{'Content-Range':`bytes */${content.length}`});return res.end()}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${content.length}`,'Content-Length':end-start+1});return res.end(content.subarray(start,end+1))}res.writeHead(200,{...headers,'Content-Length':content.length});return res.end(content);
 }
 reply(res,404,{error:'未找到'});
}
http.createServer((req,res)=>{const run=()=>route(req,res).catch(e=>reply(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'未找到文件':e.message}));if(req.method==='GET')run();else queue=queue.then(run,run)}).listen(8788,'127.0.0.1',()=>console.log('Local data API http://127.0.0.1:8788'));
