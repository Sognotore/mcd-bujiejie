import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {demoCatalog} from '../src/providers/demo.mjs';
const cli=input=>{const p=spawnSync(process.execPath,['skills/mcd-bujiejie/scripts/choose.mjs'],{input:JSON.stringify(input),encoding:'utf8'});return {code:p.status,data:JSON.parse(p.stdout)}};
test('Skill 的引擎与网页后端源文件一致',async()=>{for(const file of ['engine.mjs','identity.mjs','nutrition.mjs','nutrition-data.mjs'])assert.equal(await readFile('src/domain/'+file,'utf8'),await readFile('skills/mcd-bujiejie/scripts/lib/'+file,'utf8'))});
test('Skill 独立运行演示，并明确演示标识',()=>{const {code,data}=cli({action:'demo',catalog:demoCatalog,budget:'30'});assert.equal(code,0);assert.equal(data.mode,'demo');assert.ok(data.meal.totalCents<=3000)});
test('真实候选不冒充已确认报价，超预算 verify 拒绝',()=>{
 const {data}=cli({action:'candidates',catalog:{...demoCatalog,source:'live'},budget:'30'});assert.equal(data.requiresOfficialQuote,true);
 const result=cli({action:'verify',candidate:data.candidate,budget:'30',quote:{totalCents:4000,discountCents:0,feesCents:0,quotedAt:Date.now()}});assert.equal(result.code,1);assert.equal(result.data.error.code,'BUDGET_TOO_LOW');
});

test('Skill 配置快照稳定，特调改变后旧锁定失效',()=>{
 const catalog={...demoCatalog,source:'live',items:demoCatalog.items.map(x=>({...x,orderLine:{productCode:x.id,quantity:1,modification:{values:[{code:'ice',key:'less',quantity:1}]}}}))};
 const first=cli({action:'candidates',catalog,budget:'30'}).data.candidate;const drink=first.items.find(x=>x.role==='drink');
 const changed={...catalog,items:catalog.items.map(x=>({...x,orderLine:{...x.orderLine,modification:{values:[{code:'ice',key:'normal',quantity:1}]}}}))};
 const result=cli({action:'candidates',catalog:changed,budget:'30',lockedIds:[drink.id]});assert.equal(result.data.error.code,'LOCK_UNAVAILABLE');
});
test('独立 Skill 营养筛选与网页一致，verify 重新计算营养并拒绝伪造总量',()=>{
 const result=cli({action:'demo',catalog:demoCatalog,mealStyle:'fit',budget:'30'});assert.equal(result.code,0);assert(result.data.meal.nutrition.proteinG>=35);
 const chosen=cli({action:'candidates',catalog:{...demoCatalog,source:'live'},mealStyle:'lean'});assert.equal(chosen.code,0);assert.equal(chosen.data.candidate.mealStyle,'lean');
 const fake={...chosen.data.candidate,nutrition:{complete:true,energyKj:2500,proteinG:50},items:chosen.data.candidate.items.map(item=>({...item,name:'未知'+item.name}))};
 const checked=cli({action:'verify',candidate:fake,mealStyle:'fit',quote:{totalCents:1000,feesCents:0,discountCents:0,quotedAt:Date.now()}});assert.equal(checked.code,1);assert.equal(checked.data.error.code,'NO_STYLE_MEAL');
});
