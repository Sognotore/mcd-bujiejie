import http from 'node:http';import {readFile} from 'node:fs/promises';
import {MealError,recommend,publicMeal,parseBudget} from '../domain/engine.mjs';import {demoCatalog} from '../providers/demo.mjs';import {McdProvider} from '../providers/mcd-adapter.mjs';
const assets={'/demo-data.mjs':['../src/providers/demo.mjs','text/javascript; charset=utf-8'],'/engine.mjs':['../src/domain/engine.mjs','text/javascript; charset=utf-8'],'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/app.mjs':['app.mjs','text/javascript; charset=utf-8'],'/art.mjs':['art.mjs','text/javascript; charset=utf-8'],'/state.mjs':['state.mjs','text/javascript; charset=utf-8']};
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(res,status,data)=>{res.writeHead(status,{...headers,'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))throw new MealError('CONTENT_TYPE','请使用 JSON 格式。',415);
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>16384)throw new MealError('BODY_TOO_LARGE','请求内容过长。',413);chunks.push(chunk)}
 try{const data=JSON.parse(Buffer.concat(chunks).toString());if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data}catch{throw new MealError('INVALID_JSON','请求格式不正确。')}
}
export function createApp({liveProvider=new McdProvider()}={}){
 const server=http.createServer(async(req,res)=>{
  try{
   const port=req.socket.localPort;const hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
   if(!hosts.includes(req.headers.host)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!hosts.map(h=>'http://'+h).includes(req.headers.origin)))throw new MealError('ORIGIN_DENIED','此页面只接受本机请求。',403);
   const path=new URL(req.url,'http://127.0.0.1').pathname;
   if(req.method==='GET'&&path==='/api/status')return json(res,200,{live:liveProvider?.status()??{configured:false}});
   if(req.method==='POST'&&path==='/api/stores'){
    const input=await body(req);if(!liveProvider)throw new MealError('NOT_CONNECTED','尚未配置实时连接，请先体验演示。',503);
    return json(res,200,{stores:await liveProvider.findStores(input)});
   }
   if(req.method==='POST'&&path==='/api/recommend'){
    const input=await body(req);if(!['demo','live'].includes(input.mode))throw new MealError('INVALID_MODE','请选择演示或实时菜单。');
    parseBudget(input.budget);
    if(input.mode==='live'&&!liveProvider)throw new MealError('NOT_CONNECTED','尚未配置实时连接，请先体验演示。',503);
    const catalog=input.mode==='demo'?demoCatalog:await liveProvider.catalog(input.store);
    const result=await recommend({catalog,budget:input.budget,lockedIds:input.lockedIds,previousKey:input.previousKey,quote:input.mode==='live'?c=>liveProvider.quote(c,catalog.store):undefined});
    return json(res,200,{...result,meal:publicMeal(result.meal),mode:input.mode,store:catalog.store,takeWay:'到店取餐'});
   }
   const asset=assets[path];if((req.method==='GET'||req.method==='HEAD')&&asset){const content=await readFile(new URL('../../web/'+asset[0],import.meta.url));res.writeHead(200,{...headers,'content-type':asset[1]});return res.end(req.method==='HEAD'?undefined:content)}
   json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});
  }catch(e){if(res.headersSent)return res.end();const safe=e instanceof MealError?e:new MealError('INTERNAL','暂时无法完成，请重试。',500);json(res,safe.status,{error:{code:safe.code,message:safe.message}})}
 });
 server.requestTimeout=120000;server.headersTimeout=15000;server.on('close',()=>{void liveProvider?.close()});return server;
}
