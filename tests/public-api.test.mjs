import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../src/server/app.mjs';import {Sessions} from '../src/server/sessions.mjs';import {demoCatalog} from '../src/providers/demo.mjs';
async function serve(fn){
 const sessions=new Sessions({providerFactory:token=>({gateway:{connect:async()=>{}},status:()=>({configured:true}),catalog:async()=>({...demoCatalog,source:'live',store:{id:'1000',name:token.endsWith('A')?'A门店':'B门店'}}),quote:async c=>({totalCents:c.priceCents,discountCents:0,feesCents:0,quotedAt:Date.now()}),quoteDetails:async c=>({quote:{totalCents:c.totalCents,discountCents:0,feesCents:0,quotedAt:Date.now()},lines:[],takeWays:[{code:'eat-in',name:'堂食'}]}),close:async()=>{}})});
 const app=createApp({liveProvider:null,publicOrigin:'https://preview.example',sessions});await new Promise(r=>app.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.address().port;
 const post=(path,data,cookie,origin='https://preview.example')=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json',origin,...(cookie?{cookie}:{})},body:JSON.stringify(data)});
 try{await fn({url,post});}finally{await new Promise(r=>app.close(r));await sessions.close();}
}
test('公共 API 无默认作者账户，个人 Cookie 无法使用另一人的草稿',()=>serve(async({url,post})=>{
 const status=await (await fetch(url+'/api/status')).json();assert.equal(status.live.configured,false);assert.equal((await post('/api/recommend',{mode:'live',budget:'30'})).status,503);assert.equal((await post('/api/checkout/prepare',{draftId:'x'})).status,401);
 const authA=await post('/api/session',{token:'test-token-person-A'}),authB=await post('/api/session',{token:'test-token-person-B'});const a=authA.headers.get('set-cookie').split(';')[0],b=authB.headers.get('set-cookie').split(';')[0];assert.notEqual(a,b);
 const recommendation=await (await post('/api/recommend',{mode:'live',budget:'30'},a)).json();assert.equal(recommendation.store.name,'A门店');assert(recommendation.draftId);
 assert.equal((await post('/api/checkout/prepare',{draftId:recommendation.draftId},b)).status,409);assert.equal((await post('/api/checkout/prepare',{draftId:recommendation.draftId},a)).status,200);
 assert.equal((await post('/api/checkout/confirm',{confirmationId:'x',takeWayCode:'eat-in'},a,'https://evil.example')).status,403);assert.equal((await fetch(url+'/.env')).status,404);
}));

test('分享页可以顶层跳转公开首页，跨站 API、嵌入和错误 Host 仍拒绝',()=>serve(async({url})=>{
 const {request}=await import('node:http');
 // fetch supplies its own sec-fetch-mode; use HTTP to reproduce browser navigation metadata.
 const visit=(path,headers,method='GET')=>new Promise((resolve,reject)=>{const req=request(url+path,{method,headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
 const navigation={'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
 assert.equal(await visit('/',navigation),200);
 assert.equal(await visit('/index.html',navigation),200);
 assert.equal(await visit('/api/status',navigation),403);
 assert.equal(await visit('/',{...navigation,'sec-fetch-dest':'iframe'}),403);
 assert.equal(await visit('/api/recommend',navigation,'POST'),403);
 assert.equal(await visit('/',{...navigation,host:'evil.example'}),403);
}));
