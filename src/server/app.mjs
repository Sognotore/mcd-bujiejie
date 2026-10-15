import {CheckoutService} from './checkout.mjs';
import http from 'node:http';import {readFile} from 'node:fs/promises';
import {MealError,recommend,publicMeal,parseBudget,parseMealStyle,mealStyleAvailability} from '../domain/engine.mjs';import {demoCatalog} from '../providers/demo.mjs';import {McdProvider} from '../providers/mcd-adapter.mjs';
const assets={'/nutrition.mjs':['../src/domain/nutrition.mjs','text/javascript; charset=utf-8'],'/nutrition-data.mjs':['../src/domain/nutrition-data.mjs','text/javascript; charset=utf-8'],'/demo-data.mjs':['../src/providers/demo.mjs','text/javascript; charset=utf-8'],'/engine.mjs':['../src/domain/engine.mjs','text/javascript; charset=utf-8'],'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/app.mjs':['app.mjs','text/javascript; charset=utf-8'],'/art.mjs':['art.mjs','text/javascript; charset=utf-8'],'/state.mjs':['state.mjs','text/javascript; charset=utf-8']};
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(res,status,data)=>{res.writeHead(status,{...headers,'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))throw new MealError('CONTENT_TYPE','请使用 JSON 格式。',415);
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>16384)throw new MealError('BODY_TOO_LARGE','请求内容过长。',413);chunks.push(chunk)}
 try{const data=JSON.parse(Buffer.concat(chunks).toString());if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data}catch{throw new MealError('INVALID_JSON','请求格式不正确。')}
}
export function createApp({liveProvider=new McdProvider(),publicOrigin=null,sessions=null}={}){
 const checkout=liveProvider?new CheckoutService(liveProvider):null;
 if(publicOrigin&&new URL(publicOrigin).protocol!=='https:')throw new Error('Public origin must use HTTPS');
 const server=http.createServer(async(req,res)=>{
  try{
   const port=req.socket.localPort;const hosts=[`127.0.0.1:${port}`,`localhost:${port}`,...(publicOrigin?[new URL(publicOrigin).host]:[])];
   const origins=[...hosts.filter(h=>h.startsWith('127.0.0.1:')||h.startsWith('localhost:')).map(h=>'http://'+h),...(publicOrigin?[publicOrigin]:[])];
   if(!hosts.includes(req.headers.host)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!origins.includes(req.headers.origin)))throw new MealError('ORIGIN_DENIED','此页面只接受本机请求。',403);
   const session=sessions?.get(req);const provider=sessions?session?.provider:liveProvider;const orderService=sessions?session?.checkout:checkout;
   const path=new URL(req.url,'http://127.0.0.1').pathname;
   if(req.method==='GET'&&path==='/api/status')return json(res,200,{live:sessions?{configured:Boolean(session),authorizationRequired:true,ordering:true,expiresAt:session?.expires}:provider?.status()??{configured:false},order:orderService?.latest()??null});
   if(req.method==='POST'&&path==='/api/session'&&sessions){const input=await body(req);return json(res,200,{live:await sessions.connect(req,res,input.token)});}
   if(req.method==='DELETE'&&path==='/api/session'&&sessions){sessions.disconnect(req,res);return json(res,200,{live:{configured:false,authorizationRequired:true,ordering:true}});}
   if(req.method==='POST'&&['/api/checkout/prepare','/api/checkout/confirm','/api/order/status'].includes(path)){
    if(!provider||!orderService)throw new MealError('NOT_CONNECTED','请先连接自己的麦当劳账户。',401);
    const input=await body(req);
    if(path==='/api/checkout/prepare')return json(res,200,await orderService.prepare(input.draftId));
    if(path==='/api/checkout/confirm')return json(res,200,await orderService.confirm(input));
    return json(res,200,await orderService.status(input.receiptId));
   }
   if(req.method==='POST'&&path==='/api/stores'){
    const input=await body(req);if(!provider)throw new MealError('NOT_CONNECTED','尚未配置实时连接，请先体验演示。',503);
    return json(res,200,{stores:await provider.findStores(input)});
   }
   if(req.method==='POST'&&['/api/recommend','/api/meal-styles'].includes(path)){
    const input=await body(req);if(!['demo','live'].includes(input.mode))throw new MealError('INVALID_MODE','请选择演示或实时菜单。');
    parseBudget(input.budget);parseMealStyle(input.mealStyle);
    if(input.mode==='live'&&!provider)throw new MealError('NOT_CONNECTED','尚未配置实时连接，请先体验演示。',503);
    const catalog=input.mode==='demo'?demoCatalog:await provider.catalog(input.store);
    if(path==='/api/meal-styles')return json(res,200,{mealStyles:mealStyleAvailability(catalog)});
    const result=await recommend({catalog,mealStyle:input.mealStyle,budget:input.budget,lockedIds:input.lockedIds,previousKey:input.previousKey,quote:input.mode==='live'?c=>provider.quote(c,catalog.store):undefined});
    return json(res,200,{...result,meal:publicMeal(result.meal),draftId:input.mode==='live'?orderService.draft(result.meal,catalog.store):null,mode:input.mode,store:catalog.store,takeWay:'到店取餐'});
   }
   const asset=assets[path]??(/^\/assets\/(?:brand-mark-v3|meal-hero|food-(?:burger|chicken|fish|fries|nuggets|pie|corn|cola|tea|coffee|juice))\.webp$/.test(path)?[path.slice(1),'image/webp']:undefined);if((req.method==='GET'||req.method==='HEAD')&&asset){const content=await readFile(new URL('../../web/'+asset[0],import.meta.url));res.writeHead(200,{...headers,'content-type':asset[1]});return res.end(req.method==='HEAD'?undefined:content)}
   json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});
  }catch(e){if(res.headersSent)return res.end();const safe=e instanceof MealError?e:new MealError('INTERNAL','暂时无法完成，请重试。',500);json(res,safe.status,{error:{code:safe.code,message:safe.message,...(safe.mealStyles?{mealStyles:safe.mealStyles}:{})}})}
 });
 server.requestTimeout=120000;server.headersTimeout=15000;server.on('close',()=>{void liveProvider?.close();void sessions?.close()});return server;
}
