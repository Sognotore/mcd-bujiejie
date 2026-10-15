export class MealError extends Error {
  constructor(code,message,status=400){super(message);this.code=code;this.status=status;}
}
const fail=(code,message,status)=>{throw new MealError(code,message,status)};
export function parseBudget(value){
  if(value==null || (typeof value==='string' && value.trim()==='')) return null;
  if(typeof value!=='string' || !/^\d+(\.\d{1,2})?$/.test(value.trim())) fail('INVALID_BUDGET','请输入大于 0、最多两位小数的预算。');
  const [whole,fraction='']=value.trim().split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents<=0) fail('INVALID_BUDGET','预算金额超出可用范围。');
  return cents;
}
const isMoney=n=>Number.isSafeInteger(n)&&n>=0;
const roles=['main','side','drink'];
const text=v=>typeof v==='string'&&v.length>0&&v.length<=160;
function validItem(x){
  return x && text(x.id) && text(x.name) && roles.includes(x.role) && isMoney(x.priceCents) && (x.priceCents>0||x.included===true) && text(x.variantId);
}
export const candidateKey=items=>items.map(x=>`${encodeURIComponent(x.id)}@${encodeURIComponent(x.variantId)}`).sort().join('|');
export function buildCandidates(catalog){
  if(!catalog || !Array.isArray(catalog.items) || (catalog.bundles!==undefined&&!Array.isArray(catalog.bundles))) fail('INVALID_CATALOG','菜单格式无法识别，请重新连接。',502);
  const ids=new Set();
  for(const item of catalog.items){
    if(!validItem(item)||ids.has(item.id)) fail('INVALID_CATALOG','菜单包含无法确认的餐品或重复编号。',502);
    ids.add(item.id);
  }
  const groups=roles.map(role=>catalog.items.filter(x=>x.role===role&&x.available===true));
  if(groups.reduce((n,g)=>n*g.length,1)>100000) fail('CATALOG_TOO_LARGE','当前菜单组合过多，请先缩小菜单范围。',502);
  const result=[];
  for(const main of groups[0]) for(const side of groups[1]) for(const drink of groups[2]){
    const items=[main,side,drink];const priceCents=items.reduce((n,x)=>n+x.priceCents,0);
    if(!Number.isSafeInteger(priceCents)) fail('INVALID_CATALOG','菜单金额超出可用范围。',502);
    result.push({key:candidateKey(items),items,priceCents,lockable:true,kind:'custom'});
  }
  const bundleIds=new Set();
  for(const bundle of catalog.bundles??[]){
    if(!text(bundle.id)||bundleIds.has(bundle.id)||!text(bundle.name)||!isMoney(bundle.priceCents)||bundle.priceCents<=0||!Array.isArray(bundle.items)||bundle.items.length!==3||!bundle.items.every(validItem)||new Set(bundle.items.map(x=>x.role)).size!==3) fail('INVALID_CATALOG','套餐组成或价格无法确认。',502);
    bundleIds.add(bundle.id);
    if(bundle.available!==true) continue;
    result.push({key:`bundle:${encodeURIComponent(bundle.id)}`,id:bundle.id,name:bundle.name,items:bundle.items,priceCents:bundle.priceCents,lockable:false,kind:'bundle',orderLine:bundle.orderLine,coupon:bundle.coupon});
  }
  return result;
}
export function validateQuote(quote,now=Date.now()){
  if(!quote||!['totalCents','discountCents','feesCents'].every(k=>isMoney(quote[k]))||!Number.isSafeInteger(quote.quotedAt)||quote.quotedAt>now+5000||now-quote.quotedAt>60000) fail('INVALID_QUOTE','价格未能确认或已过期，请重试。',502);
  return quote;
}
export function shuffled(items,rng=Math.random){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
  return result;
}
export function eligibleCandidates(catalog,lockedIds=[]){
  if(!Array.isArray(lockedIds)||lockedIds.length>3||new Set(lockedIds).size!==lockedIds.length||!lockedIds.every(text)) fail('INVALID_LOCKS','锁定条件无效，请重新选择。');
  const all=buildCandidates(catalog);
  if(lockedIds.some(id=>!catalog.items.some(x=>x.id===id&&x.available===true))) fail('LOCK_UNAVAILABLE','锁定的餐品已不可用，请先解锁。');
  if(lockedIds.length===3) fail('ALL_LOCKED','先解锁一个餐品，再换一份。');
  const filtered=all.filter(x=>!lockedIds.length||(x.lockable&&lockedIds.every(id=>x.items.some(i=>i.id===id))));
  if(!filtered.length) fail('NO_MEAL',lockedIds.length?'锁定条件下暂时搭不出完整一餐，请解锁后重试。':'当前菜单暂时搭不出完整一餐。',422);
  return filtered;
}
export async function recommend({catalog,budget=null,lockedIds=[],previousKey=null,quote,rng=Math.random}){
  const budgetCents=parseBudget(budget);
  let candidates=eligibleCandidates(catalog,lockedIds);
  if(!quote) candidates=candidates.filter(x=>budgetCents===null||x.priceCents<=budgetCents);
  if(!candidates.length) fail('BUDGET_TOO_LOW','当前预算下暂时搭不出完整一餐，可以调整预算或跳过。',422);
  const others=candidates.filter(x=>x.key!==previousKey);
  const alternatives=quote&&budgetCents!==null?[...shuffled(others.filter(x=>x.priceCents<=budgetCents),rng),...shuffled(others.filter(x=>x.priceCents>budgetCents),rng)]:shuffled(others,rng);
  const previous=candidates.find(x=>x.key===previousKey);
  const queue=previous?[...alternatives,previous]:alternatives;
  let count=0;
  for(const candidate of queue){
    if(quote&&count>=12) fail('QUOTE_LIMIT','暂未找到预算内搭配，可以重试或调整预算。',422);
    const pricing=quote?validateQuote(await quote(candidate)): {totalCents:candidate.priceCents,discountCents:0,feesCents:0,quotedAt:Date.now()};
    count++;
    if(budgetCents!==null&&pricing.totalCents>budgetCents) continue;
    return {status:candidate.key===previousKey?'unchanged':'ok',message:candidate.key===previousKey?'当前条件下只有这一份搭配，可以解锁餐品或调整预算。':'',meal:{...candidate,...pricing,budgetCents}};
  }
  fail('BUDGET_TOO_LOW','当前预算下暂时搭不出完整一餐，可以调整预算或跳过。',422);
}
export function publicMeal(meal){
  return {key:meal.key,kind:meal.kind,name:meal.name,lockable:meal.lockable,totalCents:meal.totalCents,discountCents:meal.discountCents,feesCents:meal.feesCents,quotedAt:meal.quotedAt,budgetCents:meal.budgetCents,items:meal.items.map(({id,name,role,priceCents,variantId,art,included})=>({id,name,role,priceCents,variantId,art,included}))};
}
