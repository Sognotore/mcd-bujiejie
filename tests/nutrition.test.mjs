import test from 'node:test';import assert from 'node:assert/strict';
import {nutritionRecords,nutritionSource} from '../src/domain/nutrition-data.mjs';
import {nutritionForItem,mealNutrition,fitsMealStyle} from '../src/domain/nutrition.mjs';
import {recommend,mealStyleAvailability,publicMeal} from '../src/domain/engine.mjs';
import {demoCatalog} from '../src/providers/demo.mjs';
const catalog=ids=>({...demoCatalog,items:demoCatalog.items.filter(item=>ids.includes(item.id))});
test('大陆官方营养快照有来源和份量，千焦仅转换为千卡，不按宏量营养素倒推',()=>{
 assert.equal(nutritionSource.market,'中国大陆');assert.equal(nutritionSource.referenceUpdated,'2025-04');
 assert.equal(nutritionRecords.length,nutritionSource.servingCount);assert.equal(nutritionSource.servingCount,137);
 const burger=nutritionForItem({name:'板烧鸡腿堡'});assert.equal(burger.energyKj,1638);assert.equal(burger.kcal,391);assert.equal(burger.proteinG,23);
 const meal=mealNutrition([{name:'板烧鸡腿堡'},{name:'玉米杯（小）'},{name:'无糖可口可乐（中）'}]);
 assert.equal(meal.energyKj,1861);assert.equal(meal.kcal,445);assert.equal(meal.proteinG,25);assert(fitsMealStyle(meal,'lean'));assert(!fitsMealStyle(meal,'fit'));
});
test('未知份量、特调、伪造营养 key 不进入营养筛选，缺失不能当作零热量',()=>{
 assert.equal(nutritionForItem({name:'可口可乐'}),null);assert.equal(nutritionForItem({name:'无糖可口可乐'}),null);
 assert.equal(nutritionForItem({name:'板烧鸡腿堡',nutritionEligible:false}),null);
 assert.equal(nutritionForItem({name:'板烧鸡腿堡',nutritionKey:'unknown'}),null);
 const unknown=mealNutrition([{name:'新品汉堡'},{name:'玉米杯（小）'},{name:'无糖可口可乐（中）'}]);
 assert.equal(unknown.complete,false);assert.equal(unknown.matchedCount,2);assert.equal(unknown.kcal,undefined);assert(!fitsMealStyle(unknown,'lean'));assert(fitsMealStyle(unknown,'joy'));
});
test('官方同份量别名只在营养数值一致时合并，所有演示商品均有精确记录',()=>{
 assert.equal(nutritionForItem({name:'汉堡包'}).proteinG,13);assert.equal(nutritionForItem({name:'小玉米杯'}).energyKj,223);
 for(const item of demoCatalog.items)assert(nutritionForItem(item),item.name);
});
test('SKU 充足时有三类，不足时仅提供可验证的两类，完全未知时只有快乐餐',()=>{
 assert.deepEqual(mealStyleAvailability(demoCatalog).ids,['joy','lean','fit']);
 assert.deepEqual(mealStyleAvailability(catalog(['double','corn','zero'])).ids,['joy','lean']);
 assert.deepEqual(mealStyleAvailability(catalog(['double','nuggets','zero'])).ids,['joy','fit']);
 const unknown={items:demoCatalog.items.map(item=>({...item,name:'未知'+item.name}))};assert.deepEqual(mealStyleAvailability(unknown).ids,['joy']);
});
test('减脂和健身连续抽取均满足整餐热量、蛋白质、预算，锁定与去重仍成立',async()=>{
 for(const mealStyle of ['lean','fit']){
  let previousKey=null;
  for(let i=0;i<50;i++){
   const result=await recommend({catalog:demoCatalog,mealStyle,budget:'30',previousKey});
   assert(fitsMealStyle(result.meal.nutrition,mealStyle));assert(result.meal.totalCents<=3000);assert.equal(result.meal.items.length,3);
   assert.notEqual(result.meal.key,previousKey);previousKey=result.meal.key;
   const view=publicMeal(result.meal);assert.equal(view.mealStyle,mealStyle);assert(view.items.every(item=>item.nutrition));
  }
  const first=(await recommend({catalog:demoCatalog,mealStyle,budget:'40'})).meal;
  const lockedId=first.items.find(item=>item.role==='drink').id;
  const next=(await recommend({catalog:demoCatalog,mealStyle,budget:'40',lockedIds:[lockedId],previousKey:first.key})).meal;
  assert(next.items.some(item=>item.id===lockedId));assert(fitsMealStyle(next.nutrition,mealStyle));
 }
});
test('餐型非法、不可用、预算不足和锁定不相容分别提示，不静默降级',async()=>{
 await assert.rejects(()=>recommend({catalog:demoCatalog,mealStyle:'invented'}),{code:'INVALID_MEAL_STYLE'});
 await assert.rejects(()=>recommend({catalog:catalog(['double','corn','zero']),mealStyle:'fit'}),error=>error.code==='MEAL_STYLE_UNAVAILABLE'&&error.mealStyles.ids.join(',')==='joy,lean');
 await assert.rejects(()=>recommend({catalog:demoCatalog,mealStyle:'fit',budget:'1'}),{code:'BUDGET_TOO_LOW'});
 await assert.rejects(()=>recommend({catalog:demoCatalog,mealStyle:'fit',lockedIds:['corn']}),{code:'NO_STYLE_MEAL'});
});
test('真实试算优惠只影响价格，不改变餐型或营养计算',async()=>{
 const result=await recommend({catalog:demoCatalog,mealStyle:'fit',budget:'10',quote:async()=>({totalCents:999,feesCents:0,discountCents:1000,quotedAt:Date.now()})});
 assert.equal(result.meal.totalCents,999);assert(fitsMealStyle(result.meal.nutrition,'fit'));
});
