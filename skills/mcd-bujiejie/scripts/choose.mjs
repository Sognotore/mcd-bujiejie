import {parseBudget,selectMealCandidates,parseMealStyle,shuffled,recommend,validateQuote,publicMeal,MealError} from './lib/engine.mjs';
import {mealNutrition,fitsMealStyle} from './lib/nutrition.mjs';
import {configurationSnapshot} from './lib/identity.mjs';
let buffer='';
try{
 for await(const part of process.stdin){buffer+=part;if(Buffer.byteLength(buffer)>2_000_000)throw new MealError('INPUT_TOO_LARGE','输入菜单过大。')}
 const input=JSON.parse(buffer);const budgetCents=parseBudget(input.budget);const mealStyle=parseMealStyle(input.mealStyle??input.candidate?.mealStyle);
 if(input.action==='demo'){
  if(input.catalog?.source!=='demo')throw new MealError('INVALID_SOURCE','演示必须明确使用演示菜单。');
  const result=await recommend(input);console.log(JSON.stringify({...result,mode:'demo',meal:publicMeal(result.meal)}));
 }else if(input.action==='candidates'){
  if(input.catalog?.source!=='live')throw new MealError('INVALID_SOURCE','真实候选必须来源于本次官方菜单。');
  const catalog={...input.catalog,items:input.catalog.items.map(configurationSnapshot)};
  const rejected=new Set(input.rejectedKeys??[]);const {candidates,mealStyles}=selectMealCandidates({catalog,mealStyle,lockedIds:input.lockedIds});const all=candidates.filter(x=>!rejected.has(x.key));
  const others=all.filter(x=>x.key!==input.previousKey);const eligible=budgetCents===null?others:others.filter(x=>x.priceCents<=budgetCents);
  const candidate=shuffled(eligible)[0]??shuffled(others)[0]??all[0];
  if(!candidate)throw new MealError('NO_MEAL','本次候选已检查完，暂时无法搭配。',422);
  console.log(JSON.stringify({mealStyles,requiresOfficialQuote:true,budgetCents,candidate,isPrevious:candidate.key===input.previousKey}));
 }else if(input.action==='verify'){
  const candidate=input.candidate;
  if(!candidate||candidate.items?.length!==3||new Set(candidate.items.map(x=>x.role)).size!==3||!candidate.items.every(x=>['main','side','drink'].includes(x.role)))throw new MealError('INVALID_CANDIDATE','组合必须包含主食、小食、饮品各一份。');
  const nutrition=mealNutrition(candidate.items);if(!fitsMealStyle(nutrition,mealStyle))throw new MealError('NO_STYLE_MEAL','这份搭配不符合所选餐型，请重新搭配。',422);
  const quote=validateQuote(input.quote);if(budgetCents!==null&&quote.totalCents>budgetCents)throw new MealError('BUDGET_TOO_LOW','实际应付超过预算，请重新搭配。',422);
  console.log(JSON.stringify({mode:'live',status:'ok',meal:publicMeal({...candidate,...quote,budgetCents,mealStyle,nutrition})}));
 }else throw new MealError('INVALID_ACTION','请选择 candidates、verify 或 demo。');
}catch(e){console.log(JSON.stringify({error:{code:e.code??'INVALID_INPUT',message:e instanceof MealError?e.message:'输入格式不正确。'}}));process.exitCode=1}
