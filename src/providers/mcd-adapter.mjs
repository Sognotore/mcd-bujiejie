// Fields verified against https://open.mcd.cn/mcp/doc and authorized live calls on 2026-10-15.
import {MealError,parseBudget,buildCandidates,validateQuote} from '../domain/engine.mjs';
import {McpGateway} from './mcp.mjs';import {readFile,writeFile,mkdir} from 'node:fs/promises';
const invalid=()=>{throw new MealError('INVALID_RESPONSE','餐品结构无法确认，请重试或更换门店。',502)};
export function defaultModification(detail){
 const values=[];
 for(const group of detail.modification?.items??[]){
  if(!Array.isArray(group.values))invalid();
  const selected=group.values.filter(x=>x.selectedQuantity>0);
  if(group.minValues>selected.length)invalid();
  for(const value of group.values){
   if(!Number.isInteger(value.selectedQuantity)||value.selectedQuantity<0)invalid();
   const key=value.selectedQuantity>0?value.selectedKey:value.unselectedKey;
   if(value.selectedQuantity>0||key){if(typeof key!=='string'||!key||typeof value.code!=='string')invalid();values.push({code:value.code,key,quantity:value.selectedQuantity})}
  }
 }
 return {values};
}
const withMod=d=>{const m=defaultModification(d);return m.values.length?{modification:m}:{}};
const nameFor=d=>d.name+(d.supportModify?'【可特调】':'');
const artFor=(role,name)=>role==='main'?(/鸡/.test(name)?'chicken':'burger'):role==='side'?(/薯/.test(name)?'fries':'nuggets'):(/咖啡/.test(name)?'coffee':'cola');
export function extractProducts(menu){
 if(!Array.isArray(menu?.categories)||!menu.meals||typeof menu.meals!=='object')invalid();
 const found=new Map();
 for(const category of menu.categories){
  const label=String(category.name).replace(/\s/g,'');
  for(const ref of category.meals??[]){
   const p=menu.meals[ref.code];if(!p||p.canWithOrder||p.isCanWithOrder||String(p.discountType).includes('随单购'))continue;
   const tags=ref.tags??[];let role;
   if(/汉堡|牛鱼肉堡|厚牛堡|麦满分/.test(label)&&tags.includes('单品'))role='main';
   else if((/小食/.test(label)&&tags.includes('小食'))||(label==='炸鸡'&&tags.includes('单品')))role='side';
   else if(label==='饮品')role='drink';
   const bundle=label==='精选单人餐'||label==='500大卡套餐'||(tags.includes('套餐')&&/汉堡|肉堡|厚牛堡|炸鸡/.test(label));
   if(!role&&!bundle)continue;
   let priceCents;try{priceCents=parseBudget(p.currentPrice)}catch{continue}
   if(priceCents===null)continue;
   const existing=found.get(ref.code);if(!existing||(!existing.role&&role))found.set(ref.code,{...p,code:ref.code,priceCents,role,bundle:!role&&bundle});
  }
 }
 return [...found.values()];
}
export function normalizeSingle(entry,detail){
 if(detail.code!==entry.code||!detail.name||!Array.isArray(detail.rounds))invalid();
 if(detail.rounds.length)return null; // Multiple-choice products are handled only when all roles can be confirmed.
 return {id:entry.code,name:nameFor(detail),role:entry.role,priceCents:entry.priceCents,variantId:'default',available:true,art:artFor(entry.role,detail.name),orderLine:{productCode:entry.code,quantity:1,...withMod(detail)}};
}
const roleForRound=name=>/主食|汉堡|肉堡/.test(name)?'main':/小食|薯条/.test(name)?'side':/饮料|饮品/.test(name)?'drink':null;
function diffCents(choice){
 if(choice.isDefault===1&&(choice.diffPrice==null||choice.diffPrice===''))return 0;
 const match=/^([+-])\s*[¥￥]\s*(\d+(?:\.\d{1,2})?)$/.exec(choice.diffPrice??'');
 if(!match)return null;return (Number(match[2])===0?0:parseBudget(match[2]))*(match[1]==='-'?-1:1);
}
export function expandBundle(entry,detail){
 if(!Array.isArray(detail.rounds)||detail.rounds.length!==3)return [];
 const groups=detail.rounds.map(round=>({round,role:roleForRound(round.name),choices:round.choices?.filter(x=>x.code&&x.name&&((x.isDefault===1&&(/^[+]\s*[¥￥]\s*0(?:\.0+)?$/.test(x.diffPrice??'')||x.diffPrice==null))||diffCents(x)!==null))??[]}));
 if(groups.some(x=>!x.role||x.round.minQuantity!==1||x.round.maxQuantity!==1||!x.choices.length)||new Set(groups.map(x=>x.role)).size!==3)return [];
 const out=[];const base=entry.priceCents??parseBudget(entry.currentPrice);
 for(const a of groups[0].choices)for(const b of groups[1].choices)for(const c of groups[2].choices){
  const chosen=[a,b,c];
  const delta=chosen.reduce((n,x)=>n+(x.isDefault===1?0:diffCents(x)),0);
  if(base+delta<=0)continue;
  const id=entry.code+':'+chosen.map(x=>x.code).join(':');
  const items=chosen.map((x,i)=>({id:x.code,name:nameFor(x),role:groups[i].role,priceCents:0,included:true,variantId:'included',available:true,art:artFor(groups[i].role,x.name)}));
  const roundList=chosen.map((x,i)=>({round:String(groups[i].round.id),comboItemList:[{code:x.code,quantity:1,...withMod(x)}]}));
  out.push({id,name:detail.name,available:true,priceCents:base+delta,items,orderLine:{productCode:entry.code,quantity:1,roundList}});
  if(out.length>10000)throw new MealError('CATALOG_TOO_LARGE','当前套餐选项过多，暂时无法搭配。',502);
 }
 return out;
}
export function priceToQuote(data,lines){
 if(!Number.isSafeInteger(data?.price)||data.price<0||!Array.isArray(data.productList))invalid();
 const expected=lines.map(x=>`${x.productCode}:${x.quantity}`).sort();
 const actual=data.productList.map(x=>`${x.productCode}:${x.quantity}`).sort();
 if(JSON.stringify(expected)!==JSON.stringify(actual))invalid();
 return validateQuote({totalCents:data.price,discountCents:data.discount??0,feesCents:(data.deliveryPrice??0)+(data.tablewarePrice??0),quotedAt:Date.now()});
}
async function parallelMap(items,fn){let cursor=0;const output=[];await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{while(cursor<items.length){const i=cursor++;output[i]=await fn(items[i])}}));return output}
export class McdProvider{
 constructor({gateway=new McpGateway(),cacheDirectory=new URL('../../.local/',import.meta.url)}={}){this.gateway=gateway;this.cacheDirectory=cacheDirectory;this.stores=new Map();this.catalogCache=new Map()}
 status(){return {configured:Boolean(this.gateway.token)}}
 async findStores({city,keyword}){
  if(typeof city!=='string'||!city.trim()||city.length>60||typeof keyword!=='string'||!keyword.trim()||keyword.length>120)throw new MealError('INVALID_LOCATION','请输入城市和附近的地标或路名。');
  const data=await this.gateway.call('query-nearby-stores',{searchType:2,beType:1,city:city.trim(),keyword:keyword.trim()});
  if(!Array.isArray(data))invalid();
  const stores=data.filter(x=>x.businessStatus===true&&/^\d+$/.test(x.storeCode)&&typeof x.storeName==='string').map(x=>({id:x.storeCode,name:x.storeName,address:x.address??'',distance:x.distance??null}));
  for(const s of stores)this.stores.set(s.id,{id:s.id,name:s.name});
  await mkdir(this.cacheDirectory,{recursive:true});await writeFile(new URL('known-stores.json',this.cacheDirectory),JSON.stringify([...this.stores.values()]),{mode:0o600});
  return stores;
 }
 async knownStore(id){
  if(!this.stores.size){try{for(const s of JSON.parse(await readFile(new URL('known-stores.json',this.cacheDirectory),'utf8')))if(/^\d+$/.test(s.id)&&typeof s.name==='string')this.stores.set(s.id,{id:s.id,name:s.name})}catch{}}
  const store=this.stores.get(id);if(!store)throw new MealError('SELECT_STORE','请先搜索并选择一家门店。');return store;
 }
 async catalog(storeInput){
  const store=await this.knownStore(storeInput?.id);const cached=this.catalogCache.get(store.id);
  if(cached&&Date.now()-cached.at<60000)return cached.catalog;
  const args={storeCode:store.id,orderType:1,beType:1};
  const [menu,coupons]=await Promise.all([this.gateway.call('query-meals',args),this.gateway.call('query-store-coupons',args)]);
  if(!Array.isArray(coupons))invalid();
  const entries=extractProducts(menu);
  const resolved=await parallelMap(entries,async e=>{const detail=await this.gateway.call('query-meal-detail',{...args,code:e.code});return {e,detail}});
  const items=[];const bundles=[];
  for(const {e,detail} of resolved){if(e.role){const item=normalizeSingle(e,detail);if(item)items.push(item)}else bundles.push(...expandBundle(e,detail))}
  const all=[...items,...bundles];
  for(const product of all){const matches=coupons.filter(c=>(c.products??[]).some(p=>p.productCode===product.orderLine.productCode));if(matches.length)product.coupon=matches[0]}
  const catalog={items,bundles,store,source:'live'};buildCandidates(catalog);this.catalogCache.set(store.id,{at:Date.now(),catalog});return catalog;
 }
 async quote(candidate,store){
  let lines=candidate.kind==='bundle'?[candidate.orderLine]:candidate.items.map(x=>x.orderLine);
  lines=lines.map((line,i)=>{const product=candidate.kind==='bundle'?candidate:candidate.items[i];return product.coupon?{...line,couponId:product.coupon.couponId,couponCode:product.coupon.couponCode}:line});
  const data=await this.gateway.call('calculate-price',{storeCode:store.id,orderType:1,beType:1,items:lines,needTableware:false});
  return priceToQuote(data,lines);
 }
 async close(){await this.gateway.close()}
}
