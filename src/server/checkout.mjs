import {randomUUID} from 'node:crypto';
import {MealError,publicMeal,validateQuote} from '../domain/engine.mjs';
const fail=(code,message,status=409)=>{throw new MealError(code,message,status)};
export function paymentLink(value){
 try{const url=new URL(value);const h=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['mcd.cn','mcdchina.net'].some(d=>h===d||h.endsWith('.'+d))||/(?:^|[-.])(sit|uat|test|dev)(?:[-.]|$)/i.test(h)||url.pathname!=='/mcp/scanToPay')return null;
  return url.href;
 }catch{return null;}
}
export class CheckoutService{
 constructor(provider,{now=Date.now}={}){this.provider=provider;this.now=now;this.drafts=new Map();this.confirmations=new Map();this.orders=new Map();this.uncertain=false;}
 draft(meal,store){
  if(this.drafts.size>=12)this.drafts.delete(this.drafts.keys().next().value);
  const draftId=randomUUID();this.drafts.set(draftId,{meal:structuredClone(meal),store:structuredClone(store),expires:this.now()+5*60000});return draftId;
 }
 async prepare(draftId){
  if(this.uncertain)fail('ORDER_UNCERTAIN','本次连接有未确认的订单，请先到麦当劳官方渠道查单，勿重复下单。');
  const draft=this.drafts.get(draftId);if(!draft||draft.expires<this.now())fail('DRAFT_EXPIRED','这份搭配已过期，请重新抽取。');
  if([...this.confirmations.values()].some(c=>c.draftId===draftId&&['submitting','created','uncertain'].includes(c.state)))fail('ORDER_ALREADY_STARTED','这份搭配已经提交过订单，请先查看订单状态，勿重复下单。');
  const {quote,lines,takeWays}=await this.provider.quoteDetails(draft.meal,draft.store);validateQuote(quote);
  if(draft.meal.budgetCents!==null&&quote.totalCents>draft.meal.budgetCents)fail('OVER_BUDGET','最新价格超过预算，请重新搭配。');
  if(!takeWays.length)fail('NO_TAKE_WAY','暂时无法确认取餐方式，请稍后重试。');
  if(this.confirmations.size>=24){for(const [id,c] of this.confirmations)if(c.state==='ready'||c.expires<this.now())this.confirmations.delete(id);}
  if(this.confirmations.size>=24)fail('ORDER_LIMIT','本次连接的订单记录已满，请在官方渠道查看订单。',429);
  const confirmationId=randomUUID(),expiresAt=this.now()+60000;
  this.confirmations.set(confirmationId,{draftId,store:draft.store,meal:draft.meal,quote,lines,takeWays,expires:expiresAt,state:'ready'});
  return {confirmationId,expiresAt,meal:publicMeal({...draft.meal,...quote}),store:draft.store,takeWays,priceChanged:quote.totalCents!==draft.meal.totalCents};
 }
 async confirm({confirmationId,takeWayCode}){
  const c=this.confirmations.get(confirmationId);if(!c)fail('CONFIRMATION_EXPIRED','确认已过期，请重新核对搭配。');
  if(c.state==='created')return c.receipt;
  if(this.uncertain)fail('ORDER_UNCERTAIN','本次连接有未确认的订单，请先到麦当劳官方渠道查单。');
  if(c.state==='submitting')return c.promise;
  if(c.state==='uncertain')fail('ORDER_UNCERTAIN','订单提交结果尚未确认，请先到麦当劳官方渠道查单，勿重复提交。');
  if(c.state==='expired'||c.expires<this.now())fail('CONFIRMATION_EXPIRED','确认已过期，请重新核对搭配。');
  if(!c.takeWays.some(t=>t.code===takeWayCode))fail('INVALID_TAKE_WAY','请选择官方返回的取餐方式。',400);
  if([...this.confirmations.values()].some(x=>x!==c&&x.draftId===c.draftId&&['submitting','created','uncertain'].includes(x.state)))fail('ORDER_ALREADY_STARTED','这份搭配已经提交过订单，请先查看订单状态。');
  // Claim synchronously before any remote work: duplicate clicks share one operation.
  c.state='submitting';c.promise=this.submit(c,takeWayCode);return c.promise;
 }
 async submit(c,takeWayCode){
  let sent=false;
  try{
   const fresh=await this.provider.quoteDetails(c.meal,c.store);validateQuote(fresh.quote);
   if(c.expires<this.now()||fresh.quote.totalCents!==c.quote.totalCents||JSON.stringify(fresh.lines)!==JSON.stringify(c.lines)||!fresh.takeWays.some(t=>t.code===takeWayCode)||(c.meal.budgetCents!==null&&fresh.quote.totalCents>c.meal.budgetCents)){
    c.state='expired';fail('CHECKOUT_CHANGED','价格、优惠或取餐方式有变化，请重新核对后下单。');
   }
   // No automatic retry after this boundary, even if the response is lost.
   sent=true;const data=await this.provider.createOrder({store:c.store,lines:c.lines,takeWayCode});
   if(typeof data?.orderId!=='string'||!data.orderId||data.orderId.length>160)fail('ORDER_UNCERTAIN','官方返回未能确认订单，请到麦当劳官方渠道查单，勿重复提交。');
   const amount=data.orderDetail?.realTotalAmount;
   const actualCents=typeof amount==='string'&&/^\d+(?:\.\d{1,2})?$/.test(amount)?Math.round(Number(amount)*100):null;
   const amountConfirmed=Number.isSafeInteger(actualCents)&&actualCents===c.quote.totalCents;
   const receiptId=randomUUID();const receipt={receiptId,orderId:data.orderId,status:typeof data.orderDetail?.orderStatus==='string'?data.orderDetail.orderStatus:'已创建，请核对官方状态',paymentUrl:amountConfirmed?paymentLink(data.payH5Url):null,totalCents:actualCents,amountConfirmed,store:c.store,meal:publicMeal({...c.meal,...c.quote})};
   this.orders.set(receiptId,{orderId:data.orderId,receipt});c.receipt=receipt;c.state='created';return receipt;
  }catch(error){if(c.state!=='expired')c.state=sent?'uncertain':'ready';if(sent){this.uncertain=true;fail('ORDER_UNCERTAIN','订单提交结果尚未确认，请先到麦当劳官方渠道查单，勿重复提交。');}throw error;}
 }
 latest(){return [...this.orders.values()].at(-1)?.receipt??null;}
 async status(receiptId){
  const order=this.orders.get(receiptId);if(!order)fail('ORDER_NOT_FOUND','本次连接中没有这笔订单。',404);
  const data=await this.provider.queryOrder(order.orderId);
  // Return a small display allowlist; never forward addresses, phone or raw data.
  const detail=data.orderDetail??data;
  const status=typeof detail.orderStatusTitle==='string'?detail.orderStatusTitle:typeof detail.orderStatus==='string'?detail.orderStatus:'状态已查询，请在官方页面核对';
  order.receipt={...order.receipt,status};return order.receipt;
 }
}
