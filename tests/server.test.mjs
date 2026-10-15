import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../src/server/app.mjs';
async function serve(fn){const app=createApp({liveProvider:null});await new Promise(r=>app.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.address().port}`;try{await fn(url)}finally{await new Promise(r=>app.close(r))}}
const post=(url,body,headers={})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('演示推荐无需凭证，最终金额符合预算',()=>serve(async url=>{const res=await post(url+'/api/recommend',{mode:'demo',budget:'30'});assert.equal(res.status,200);const data=await res.json();assert.equal(data.mode,'demo');assert.ok(data.meal.totalCents<=3000);assert.equal(data.meal.items.length,3)}));
test('实时无凭证不得回退演示',()=>serve(async url=>{const res=await post(url+'/api/recommend',{mode:'live',budget:null,store:{id:'1000',name:'test'}});assert.equal(res.status,503);assert.equal((await res.json()).error.code,'NOT_CONNECTED')}));
test('拒绝非法预算、模式、跨站、非 JSON、大请求与未知路由',()=>serve(async url=>{
 assert.equal((await post(url+'/api/recommend',{mode:'demo',budget:'-1'})).status,400);
 assert.equal((await post(url+'/api/recommend',{mode:'other'})).status,400);
 assert.equal((await post(url+'/api/recommend',{mode:'demo'},{origin:'https://evil.example'})).status,403);
 assert.equal((await fetch(url+'/api/recommend',{method:'POST',body:'x'})).status,415);
 assert.equal((await post(url+'/api/recommend',{x:'a'.repeat(20000)})).status,413);
 for(const path of ['/.env','/package.json','/api/tools','/%2e%2e/.env']) assert.equal((await fetch(url+path)).status,404);
}));
test('状态与错误不包含凭证或内部堆栈',()=>serve(async url=>{const data=await (await fetch(url+'/api/status')).json();assert.deepEqual(data.live,{configured:false});const text=await (await post(url+'/api/recommend',{mode:'demo',budget:{}})).text();assert.ok(!text.includes('stack'));assert.ok(!text.includes('MCD_MCP_TOKEN'))}));
test('餐型参数通过服务端校验，客户端伪造营养值不能改变结果',()=>serve(async url=>{
 const options=await (await post(url+'/api/meal-styles',{mode:'demo'})).json();assert.deepEqual(options.mealStyles.ids,['joy','lean','fit']);
 const res=await post(url+'/api/recommend',{mode:'demo',mealStyle:'fit',budget:'30',nutrition:{kcal:1,proteinG:999}});assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.meal.mealStyle,'fit');assert(data.meal.nutrition.kcal>=550&&data.meal.nutrition.kcal<=800);assert(data.meal.nutrition.proteinG>=35);assert(data.meal.totalCents<=3000);
 const invalid=await post(url+'/api/recommend',{mode:'demo',mealStyle:'unknown'});assert.equal(invalid.status,400);assert.equal((await invalid.json()).error.code,'INVALID_MEAL_STYLE');
 for(const path of ['/nutrition.mjs','/nutrition-data.mjs','/assets/food-corn.webp'])assert.equal((await fetch(url+path)).status,200);
}));
