import {nutritionRecords,nutritionSource} from './nutrition-data.mjs';
export {nutritionSource};
export const mealStyles=Object.freeze({
 joy:{id:'joy',name:'快乐餐',hint:'好吃就行，惊喜随缘。',rule:'自由搭配，不设热量限制。'},
 lean:{id:'lean',name:'减脂餐',hint:'热量轻一点',rule:'约 400–600 大卡，蛋白质至少 25g。',minKcal:400,maxKcal:600,minProteinG:25},
 fit:{id:'fit',name:'健身餐',hint:'蛋白多一点',rule:'约 550–800 大卡，蛋白质至少 35g。',minKcal:550,maxKcal:800,minProteinG:35}
});
const normalize=value=>String(value).replace(/[®™\s]/g,'').replace(/（/g,'(').replace(/）/g,')');
const records=new Map(nutritionRecords.map(record=>[record.key,record]));
const index=new Map();
const counts=new Map();for(const record of nutritionRecords)counts.set(record.name,(counts.get(record.name)??0)+1);
const fields=['energyKj','proteinG','fatG','carbG','sodiumMg','calciumMg'];
const same=(a,b)=>a&&b&&fields.every(field=>a[field]===b[field]);
function add(name,key){
 const value=normalize(name);
 if(!index.has(value))index.set(value,key);
 else if(index.get(value)!==key&&!same(records.get(index.get(value)),records.get(key)))index.set(value,null);
}
for(const record of nutritionRecords){
 const {name,serving,key}=record;
 add(`${name}（${serving}）`,key);
 if(/^\d+[个块盒]$/.test(serving)){add(name+serving,key);add(serving+name,key);}
 if(name==='100%苹果汁'&&serving==='1盒')add('100% 苹果汁(盒装)',key);
 if(counts.get(name)===1||nutritionRecords.filter(row=>row.name===name).every(row=>['1个','默认'].includes(row.serving)&&same(row,record)))add(name,key);
 if(['小','中','大','迷你'].includes(serving)){
  for(const unit of ['','杯','份']){add(`${name}（${serving}${unit}）`,key);add(`${serving}${unit}${name}`,key);}
 }
 if(name==='麦乐鸡 (5块)'){add('麦乐鸡（5块）',key);add('麦乐鸡5块',key);add('5块麦乐鸡',key);}
}
export const findNutritionKey=name=>typeof name==='string'?index.get(normalize(name))??null:null;
export function nutritionForItem(item){
 if(item?.nutritionEligible===false)return null;
 if(item?.nutritionName&&normalize(item.name.replace(/【可特调】$/,''))!==normalize(item.nutritionName))return null;
 const inferred=findNutritionKey(item?.nutritionName??item?.name);
 if(!inferred||(item.nutritionKey!==undefined&&item.nutritionKey!==inferred))return null;
 const record=records.get(inferred);
 return {key:record.key,energyKj:record.energyKj,kcal:Math.round(record.energyKj/4.184),proteinG:record.proteinG,fatG:record.fatG,carbG:record.carbG,sodiumMg:record.sodiumMg};
}
const round=value=>Math.round(value*10)/10;
export function mealNutrition(items){
 const nutrients=items.map(nutritionForItem);const known=nutrients.filter(Boolean);
 if(known.length!==items.length||!items.length)return {complete:false,matchedCount:known.length,itemCount:items.length};
 const sum=field=>round(known.reduce((total,record)=>total+record[field],0));
 const energyKj=sum('energyKj');
 return {complete:true,matchedCount:known.length,itemCount:items.length,energyKj,kcal:Math.round(energyKj/4.184),proteinG:sum('proteinG'),fatG:sum('fatG'),carbG:sum('carbG'),sodiumMg:sum('sodiumMg'),sourceUrl:nutritionSource.sourceUrl,referenceUpdated:nutritionSource.referenceUpdated};
}
export function fitsMealStyle(nutrition,style){
 if(style==='joy')return true;
 const rule=mealStyles[style];if(!rule||!nutrition?.complete)return false;
 const kcal=nutrition.energyKj/4.184;
 return kcal>=rule.minKcal&&kcal<=rule.maxKcal&&nutrition.proteinG>=rule.minProteinG;
}
export function styleAvailability(candidates){
 const pools={};
 for(const id of ['lean','fit']){
  const pool=candidates.filter(candidate=>fitsMealStyle(candidate.nutrition??mealNutrition(candidate.items),id));
  const identity=item=>nutritionForItem(item)?.key??item.id+'@'+item.variantId;
  const mains=new Set(pool.map(candidate=>identity(candidate.items.find(item=>item.role==='main'))));
  const pairs=new Set(pool.map(candidate=>candidate.items.filter(item=>item.role!=='drink').map(identity).sort().join('|')));
  pools[id]={keys:new Set(pool.map(candidate=>candidate.key)),count:pool.length,mainCount:mains.size,pairCount:pairs.size,sufficient:mains.size>=2&&pairs.size>=3};
 }
 const distinct=[...pools.lean.keys].some(key=>!pools.fit.keys.has(key))&&[...pools.fit.keys].some(key=>!pools.lean.keys.has(key));
 let ids=['joy'];
 if(pools.lean.sufficient&&pools.fit.sufficient&&distinct)ids.push('lean','fit');
 else {const preferred=['lean','fit'].find(id=>pools[id].sufficient)??['lean','fit'].find(id=>pools[id].count>0);if(preferred)ids.push(preferred);}
 return {ids,counts:{joy:candidates.length,lean:pools.lean.count,fit:pools.fit.count},reason:ids.length===3?'':ids.length===2?'当前菜单的可核验搭配较少，先提供两种餐型。':'当前菜单缺少足够的可核验营养搭配，先提供快乐餐。'};
}
