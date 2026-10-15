import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {demoCatalog} from '../src/providers/demo.mjs';
const cli=input=>{const p=spawnSync(process.execPath,['skills/mcd-bujiejie/scripts/choose.mjs'],{input:JSON.stringify(input),encoding:'utf8'});return {code:p.status,data:JSON.parse(p.stdout)}};
test('Skill 的引擎与网页后端源文件一致',async()=>{assert.equal(await readFile('src/domain/engine.mjs','utf8'),await readFile('skills/mcd-bujiejie/scripts/lib/engine.mjs','utf8'))});
test('Skill 独立运行演示，并明确演示标识',()=>{const {code,data}=cli({action:'demo',catalog:demoCatalog,budget:'30'});assert.equal(code,0);assert.equal(data.mode,'demo');assert.ok(data.meal.totalCents<=3000)});
test('真实候选不冒充已确认报价，超预算 verify 拒绝',()=>{
 const {data}=cli({action:'candidates',catalog:{...demoCatalog,source:'live'},budget:'30'});assert.equal(data.requiresOfficialQuote,true);
 const result=cli({action:'verify',candidate:data.candidate,budget:'30',quote:{totalCents:4000,discountCents:0,feesCents:0,quotedAt:Date.now()}});assert.equal(result.code,1);assert.equal(result.data.error.code,'BUDGET_TOO_LOW');
});
