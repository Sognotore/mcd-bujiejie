import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,changeCondition,applyResponse,applyFailure} from '../web/state.mjs';
test('预算和模式变化清空旧结果、锁定并增加版本',()=>{
 const s=changeCondition({...initialState(),meal:{key:'old'},locks:['a'],busy:true},{budget:'30'});
 assert.equal(s.meal,null);assert.deepEqual(s.locks,[]);assert.equal(s.revision,1);assert.equal(s.busy,false);
});
test('旧请求不能覆盖新预算或模式的结果',()=>{
 const s=changeCondition(initialState(),{mode:'live'});
 assert.equal(applyResponse(s,0,{meal:{key:'old'}}),s);
 const next=applyResponse(s,1,{meal:{key:'new'}});assert.equal(next.meal.key,'new');
});
test('请求失败保留旧结果但明确标记价格未更新',()=>{
 const s=applyFailure({...initialState(),meal:{key:'old'}},0,'超时');assert.equal(s.stale,true);assert.equal(s.error,'超时');assert.equal(s.meal.key,'old');
});
test('切换餐型会清空旧锁定和草稿，晚到的旧餐型结果不能覆盖',()=>{
 const before={...initialState(),meal:{key:'old'},draftId:'old-draft',locks:['a'],busy:true};
 const next=changeCondition(before,{mealStyle:'fit'});assert.equal(next.mealStyle,'fit');assert.equal(next.meal,null);assert.equal(next.draftId,null);assert.deepEqual(next.locks,[]);
 assert.equal(applyResponse(next,before.revision,{meal:{key:'wrong-goal'}}),next);
});
