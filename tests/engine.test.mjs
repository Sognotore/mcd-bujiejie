import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBudget, buildCandidates, recommend, validateQuote } from '../src/domain/engine.mjs';
import { demoCatalog } from '../src/providers/demo.mjs';
const item=(id,role,priceCents=500)=>({id,name:id,role,priceCents,available:true,variantId:'standard'});
const catalog={items:[item('a','main',1000),item('b','side'),item('c','drink'),item('d','main',1200)]};
test('金额使用整数分，空白或 null 跳过',()=>{
 for(const value of [null,undefined,'','  ']) assert.equal(parseBudget(value),null);
 assert.equal(parseBudget('20.01'),2001);assert.equal(parseBudget('20'),2000);
 for(const value of ['-1','0','abc','1.001','1e3',{},Infinity,'90071992547410']) assert.throws(()=>parseBudget(value));
});
test('完整枚举一人餐，套餐不重复计价',()=>{
 const bundle={id:'set',name:'完整套餐',available:true,priceCents:1800,items:catalog.items.slice(0,3)};
 const all=buildCandidates({...catalog,bundles:[bundle]});
 assert.equal(all.length,3);assert.equal(all.at(-1).priceCents,1800);assert.equal(all.at(-1).lockable,false);
});
test('去除不可售商品，拒绝重复 ID 及不完整套餐',()=>{
 assert.equal(buildCandidates({items:catalog.items.map(x=>({...x,available:false}))}).length,0);
 assert.throws(()=>buildCandidates({items:[...catalog.items,catalog.items[0]]}));
 assert.throws(()=>buildCandidates({...catalog,bundles:[{id:'x',available:true,priceCents:100,items:[]}]}));
});
test('随机组合反复满足预算与结构',async()=>{
 for(let n=0;n<250;n++){
  const {meal}=await recommend({catalog:demoCatalog,budget:'30'});
  assert.ok(meal.totalCents<=3000);assert.equal(meal.items.length,3);
  assert.deepEqual(new Set(meal.items.map(x=>x.role)),new Set(['main','side','drink']));
 }
});
test('跳过预算不额外加购；边界金额允许',async()=>{
 assert.equal((await recommend({catalog,budget:'20'})).meal.totalCents,2000);
 assert.equal((await recommend({catalog,budget:null})).meal.items.length,3);
});
test('预算不足与空菜单不能虚构搭配',async()=>{
 await assert.rejects(()=>recommend({catalog,budget:'1'}),{code:'BUDGET_TOO_LOW'});
 await assert.rejects(()=>recommend({catalog:{items:[]},budget:null}),{code:'NO_MEAL'});
});
test('锁定保留，重抽避免连续重复',async()=>{
 const first=(await recommend({catalog,budget:null,rng:()=>0})).meal;
 const second=await recommend({catalog,budget:null,previousKey:first.key,lockedIds:['c']});
 assert.notEqual(second.meal.key,first.key);assert.ok(second.meal.items.some(x=>x.id==='c'));
 await assert.rejects(()=>recommend({catalog,budget:null,lockedIds:['missing']}),{code:'LOCK_UNAVAILABLE'});
});
test('只有一种组合时保留结果，全锁定拒绝重抽',async()=>{
 const one={items:catalog.items.slice(0,3)};
 const first=(await recommend({catalog:one,budget:null})).meal;
 assert.equal((await recommend({catalog:one,budget:null,previousKey:first.key})).status,'unchanged');
 await assert.rejects(()=>recommend({catalog:one,budget:null,previousKey:first.key,lockedIds:['a','b','c']}),{code:'ALL_LOCKED'});
});
test('最终报价上浮必须重新筛选，降价不能因标价被排除',async()=>{
 await assert.rejects(()=>recommend({catalog,budget:'20',quote:async()=>({totalCents:2500,discountCents:0,feesCents:0,quotedAt:Date.now()})}),{code:'BUDGET_TOO_LOW'});
 const result=await recommend({catalog,budget:'10',quote:async()=>({totalCents:900,discountCents:1500,feesCents:0,quotedAt:Date.now()})});
 assert.equal(result.meal.totalCents,900);
});
test('报价失败不能回退演示或错误声称预算不足',async()=>{
 await assert.rejects(()=>recommend({catalog,budget:'30',quote:async()=>{throw new Error('offline')}}),/offline/);
 for(const totalCents of [NaN,-1,undefined,'1000',1.1]) assert.throws(()=>validateQuote({totalCents,discountCents:0,feesCents:0,quotedAt:Date.now()}));
 assert.throws(()=>validateQuote({totalCents:1000,discountCents:0,feesCents:0,quotedAt:Date.now()-120000}));
});
test('试算上限只表示暂未找到，不表示不存在',async()=>{
 let calls=0;
 await assert.rejects(()=>recommend({catalog:demoCatalog,budget:'1',quote:async()=>{calls++;return {totalCents:5000,discountCents:0,feesCents:0,quotedAt:Date.now()}}}),{code:'QUOTE_LIMIT'});
 assert.equal(calls,12);
});
