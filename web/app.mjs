import {mealStyles,nutritionSource} from './nutrition.mjs';
import {parseBudget,recommend,publicMeal,mealStyleAvailability} from './engine.mjs';
import {demoCatalog} from './demo-data.mjs';
const publicDemo=document.documentElement.dataset.runtime==='public-demo';
import {initialState,changeCondition,applyResponse,applyFailure} from './state.mjs';
import {foodArt,lockIcon} from './art.mjs';
const $=selector=>document.querySelector(selector);
const roleNames={main:'主食',side:'小食',drink:'饮品'};
const money=cents=>(cents/100).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
let availableStyles=mealStyleAvailability(demoCatalog),stylesLoading=false,stylesEpoch=0,styleNotice='';
let state=initialState();let controller;let selectedStore=null;let stores=[];let configured=false;let searching=false;let showingResult=false;let authorizationRequired=false;let canOrder=false;let checkoutBusy=false;let creatingOrder=false;let checkoutReview=null;let lastReceipt=null;let orderUncertain=false;
try{const saved=JSON.parse(localStorage.getItem('mcd-store'));if(saved&&/^\d+$/.test(saved.id)&&typeof saved.name==='string')selectedStore={id:saved.id,name:saved.name}}catch{}
if(publicDemo){$('[data-mode=live]').hidden=true;$('[data-mode=demo]').textContent='公开体验版';}
function message(el,text){el.textContent=text;el.hidden=!text}
function invalidate(patch){showingResult=false;controller?.abort();state=changeCondition(state,patch);$('#copy-fallback').hidden=true;$('#copy-status').textContent='';render()}
function acceptMealStyles(available){
 availableStyles=available;
 if(!available.ids.includes(state.mealStyle)){
  const previous=mealStyles[state.mealStyle].name;showingResult=false;controller?.abort();state=changeCondition(state,{mealStyle:'joy'});
  styleNotice=`当前菜单暂不支持${previous}，已切换快乐餐，可重新选择。`;
 }
}
async function refreshMealStyles(){
 const epoch=++stylesEpoch;styleNotice='';
 if(state.mode==='demo'){stylesLoading=false;acceptMealStyles(mealStyleAvailability(demoCatalog));render();return;}
 availableStyles=null;
 if(!configured||!selectedStore){stylesLoading=false;render();return;}
 stylesLoading=true;render();
 try{const result=await request('/api/meal-styles',{mode:'live',store:selectedStore});if(epoch!==stylesEpoch)return;acceptMealStyles(result.mealStyles);}
 catch{if(epoch!==stylesEpoch)return;acceptMealStyles({ids:['joy'],reason:'当前门店营养信息暂未核验，先提供快乐餐。'});}
 finally{if(epoch===stylesEpoch){stylesLoading=false;render();}}
}
const nutritionText=meal=>meal?.nutrition?.complete?`约 ${meal.nutrition.kcal} 大卡 · 蛋白质 ${meal.nutrition.proteinG}g`:'营养数据未收录完整';
function render(){
 const resultVisible=showingResult&&Boolean(state.meal);
 $('.main-grid').classList.toggle('has-result',resultVisible);
 $('.decision').hidden=resultVisible;
 $('.meal-stage').hidden=!resultVisible;
 const actionTarget=$(resultVisible?'#result-actions':'#setup-actions');
 if($('#action-area').parentElement!==actionTarget)actionTarget.append($('#action-area'));
 $('#draw-ritual').hidden=!state.busy;
 $('#ritual-label').textContent=state.mode==='live'?'正在核对菜单与价格…':'好吃的，马上揭晓。';
 const allLocked=state.locks.length===3;
 for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
 for(const button of document.querySelectorAll('[data-meal-style]')){
  button.hidden=Boolean(availableStyles&&!availableStyles.ids.includes(button.dataset.mealStyle));
  button.disabled=stylesLoading||(!availableStyles&&button.dataset.mealStyle!=='joy');
  button.setAttribute('aria-pressed',String(button.dataset.mealStyle===state.mealStyle));
 }
 $('.meal-style-options').classList.toggle('two-options',availableStyles?.ids.length===2);
 $('.meal-style-options').classList.toggle('one-option',availableStyles?.ids.length===1);
 $('#meal-style-hint').textContent=stylesLoading?'正在核对门店的可用餐型…':!availableStyles?'选好门店后，查看可用餐型。':mealStyles[state.mealStyle].rule;
 message($('#meal-style-note'),[styleNotice,availableStyles?.reason].filter(Boolean).join(' '));
 $('#live-panel').hidden=state.mode!=='live';
 $('#mode-note').textContent=state.mode==='demo'?'当前为演示模式，餐品和价格仅供体验。':'当前使用官方实时菜单，到店取餐。';
 $('#connection-note').textContent=configured?'已配置实时连接，搜索并选择你要取餐的门店。':'尚未配置实时连接，可以先切回体验演示。';
 $('#auth-panel').hidden=state.mode!=='live'||!authorizationRequired;$('#auth-form').hidden=configured;$('#disconnect').hidden=!configured;
 $('#store-form').hidden=!configured;
 const orderAvailable=state.mode==='live'&&canOrder&&Boolean(state.draftId);
 $('#checkout-start').hidden=!orderAvailable;$('#checkout-start').disabled=state.busy||checkoutBusy||orderUncertain||Boolean(lastReceipt&&lastReceipt.draftId===state.draftId);
 $('#checkout-start').textContent=checkoutBusy?'核对最新价格…':orderUncertain?'请先到官方渠道核对订单':'就吃这份，去下单';
 $('#result').classList.toggle('has-checkout',orderAvailable);
 $('#payment-panel').hidden=!lastReceipt;
 if(lastReceipt)renderReceipt();
 $('#selected-store').textContent=selectedStore?`已选：${selectedStore.name} · 门店 ${selectedStore.id}`:'';
 $('#budget-summary').textContent=state.budget.trim()?`${state.budget.trim()} 元以内 · 一人餐`:'不限预算 · 一人餐';
 $('#draw').disabled=checkoutBusy||creatingOrder||state.busy||allLocked||(state.mode==='live'&&(!configured||!selectedStore))||stylesLoading;
 $('#draw').classList.toggle('is-busy',state.busy);$('#draw').setAttribute('aria-busy',String(state.busy));
 $('#draw-label').textContent=state.busy?(state.mode==='live'?'查询菜单并试算中…':'饭签揭晓中…'):(state.meal?'换一份':'抽个好吃的');
 message($('#error'),state.error);message($('#message'),state.message);
 message($('#lock-note'),allLocked?'先解锁一个餐品，再换一份。':state.meal&&!state.meal.lockable?'这份是套餐，换一份会整套更换。':'');
 $('#empty').hidden=Boolean(state.meal);$('#result').hidden=!state.meal;
 if(!state.meal)return;
 const meal=state.meal;const live=state.mode==='live';
 $('#source-badge').textContent=live?'官方实时试算':'演示搭配';$('#source-badge').classList.toggle('live',live);
 $('#meal-name').textContent=[meal.name,live?(state.store?.name??selectedStore?.name):'餐品插画与价格仅供演示'].filter(Boolean).join(' · ');
 $('#meal-items').replaceChildren();
 for(const item of meal.items){
  const row=document.createElement('div');row.className='meal-item';row.dataset.role=item.role;
  const art=document.createElement('div');art.className='item-art';art.innerHTML=foodArt(item.art);art.setAttribute('aria-hidden','true');
  const info=document.createElement('div');info.className='item-info';
  for(const [className,text] of [['item-role',roleNames[item.role]],['item-name',item.name],['item-price',item.included?'套餐内 · 1 份':`${live?'菜单价 ':''}¥${money(item.priceCents)} · 1 份`]]){const el=document.createElement('span');el.className=className;el.textContent=text;info.append(el)}
  const nutrition=document.createElement('span');nutrition.className='item-nutrition';nutrition.textContent=item.nutrition?`约 ${item.nutrition.kcal} 大卡 · 蛋白质 ${item.nutrition.proteinG}g`:'营养数据待核对';info.append(nutrition);
  row.append(art,info);
  if(meal.lockable){const locked=state.locks.includes(item.id);const button=document.createElement('button');button.type='button';button.className='lock-button';button.setAttribute('aria-label',(locked?'解锁':'锁定')+roleNames[item.role]);button.setAttribute('aria-pressed',String(locked));button.disabled=state.busy||checkoutBusy||creatingOrder;button.title=locked?'点击解锁，下次一起换':'点击保留这个餐品';button.innerHTML=lockIcon(locked);button.addEventListener('click',()=>{state={...state,revision:state.revision+1,locks:locked?state.locks.filter(x=>x!==item.id):[...state.locks,item.id],message:''};render()});row.append(button)}
  $('#meal-items').append(row);
 }
 $('#meal-style-result').textContent=mealStyles[meal.mealStyle??'joy'].name;
 $('#nutrition-values').hidden=!meal.nutrition?.complete;$('#nutrition-missing').hidden=Boolean(meal.nutrition?.complete);
 $('#meal-kcal').textContent=meal.nutrition?.kcal??'';$('#meal-protein').textContent=meal.nutrition?.proteinG??'';
 $('#nutrition-rule').textContent=mealStyles[meal.mealStyle??'joy'].rule;
 $('#total-label').textContent=live?'试算应付':'演示合计';
 $('#price-note').textContent=live?`含必要费用 ¥${money(meal.feesCents)}${meal.discountCents?` · 已优惠 ¥${money(meal.discountCents)}`:''}`:'演示价格，不代表实际售价';
 $('#total').replaceChildren();const symbol=document.createElement('small');symbol.textContent='¥';$('#total').append(symbol,document.createTextNode(money(meal.totalCents)));$('#total').dataset.cents=meal.totalCents;
 $('#quote-status').textContent=state.stale?'上次结果 · 本次价格未更新，请重试。':live?`到店取餐 · ${new Date(meal.quotedAt).toLocaleTimeString('zh-CN',{hour12:false})} 试算。价格可能变化，点餐时请再次核对。`:'一份主食、一份小食、一杯饮品。喜欢的可以锁定，其他再抽一次。';
 $('#copy').disabled=state.busy||state.stale;
}
for(const button of document.querySelectorAll('[data-budget]'))button.addEventListener('click',()=>{
 $('#custom-budget').value='';for(const b of document.querySelectorAll('[data-budget]'))b.setAttribute('aria-pressed',String(b===button));$('#skip-budget').setAttribute('aria-pressed','false');invalidate({budget:button.dataset.budget});
});
$('#custom-budget').addEventListener('input',()=>{for(const b of document.querySelectorAll('[data-budget]'))b.setAttribute('aria-pressed','false');$('#skip-budget').setAttribute('aria-pressed','false');invalidate({budget:$('#custom-budget').value})});
$('#skip-budget').addEventListener('click',()=>{for(const b of document.querySelectorAll('[data-budget]'))b.setAttribute('aria-pressed','false');$('#custom-budget').value='';$('#skip-budget').setAttribute('aria-pressed','true');invalidate({budget:''})});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{if(state.mode!==button.dataset.mode){invalidate({mode:button.dataset.mode,store:null});void refreshMealStyles();}});
for(const button of document.querySelectorAll('[data-meal-style]'))button.addEventListener('click',()=>{if(state.mealStyle!==button.dataset.mealStyle){styleNotice='';invalidate({mealStyle:button.dataset.mealStyle});}});
async function request(path,data,signal){
 if(publicDemo){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(path==='/api/meal-styles'&&data.mode==='demo')return {mealStyles:mealStyleAvailability(demoCatalog)};
  if(path!=='/api/recommend'||data.mode!=='demo')throw new Error('公开体验版目前提供演示搭配。');
  const result=await recommend({catalog:demoCatalog,mealStyle:data.mealStyle,budget:data.budget,lockedIds:data.lockedIds,previousKey:data.previousKey});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  return {...result,meal:publicMeal(result.meal),mode:'demo',store:demoCatalog.store};
 }
 const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal});
 const result=await response.json();if(!response.ok){const error=new Error(result.error?.message??'暂时无法完成，请重试。');error.code=result.error?.code;error.mealStyles=result.error?.mealStyles;throw error;}return result;
}
$('#draw').addEventListener('click',async()=>{
 if(state.busy)return;
 const b=state.budget.trim();
 try{parseBudget(b)}catch(e){state={...state,error:e.message};render();return}
 const started=performance.now();const revision=state.revision;controller=new AbortController();state={...state,busy:true,error:'',message:''};$('#copy-fallback').hidden=true;$('#copy-status').textContent='';render();
 try{
  const result=await request('/api/recommend',{mode:state.mode,mealStyle:state.mealStyle,budget:state.budget,store:selectedStore,lockedIds:state.locks,previousKey:state.meal?.key??null},controller.signal);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(r=>setTimeout(r,Math.max(0,1050-(performance.now()-started))));
  const current=state.revision===revision;
  if(current&&result.mealStyles)availableStyles=result.mealStyles;
  state=applyResponse(state,revision,result);
  if(current&&state.meal)showingResult=true;
  render();
  if(current&&showingResult){$('#result').classList.remove('is-revealing');void $('#result').offsetWidth;$('#result').classList.add('is-revealing');$('#result-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 }catch(e){if(e.name==='AbortError')return;if(state.revision===revision&&e.mealStyles){acceptMealStyles(e.mealStyles);state={...state,busy:false,error:e.message};}else state=applyFailure(state,revision,e.message);render()}
});
$('#cancel-draw').addEventListener('click',()=>{controller?.abort();state={...state,revision:state.revision+1,busy:false};render();});
$('#edit-budget').addEventListener('click',()=>{invalidate({});$('#budget-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});
$('#change-meal-style').addEventListener('click',()=>{invalidate({});$('#meal-style-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});
$('#store-form').addEventListener('submit',async event=>{
 event.preventDefault();if(searching)return;searching=true;const modeRevision=state.revision;const submit=$('#store-form button');submit.disabled=true;submit.textContent='查找中…';
 try{
  const result=await request('/api/stores',{city:$('#city').value,keyword:$('#keyword').value});
  if(state.mode!=='live'||state.revision!==modeRevision)return;
  stores=result.stores;$('#store-select').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=stores.length?'请选择一家门店':'附近暂时没有营业门店';$('#store-select').append(placeholder);
  for(const s of stores){const option=document.createElement('option');option.value=s.id;option.textContent=`${s.name} · ${s.distance??'--'}米 · ${s.address}`;$('#store-select').append(option)}
  $('#store-label').hidden=false;message($('#message'),stores.length?'':'附近暂时没有可用门店，可以更换地标试试。');
 }catch(e){if(state.mode==='live'&&state.revision===modeRevision){state={...state,error:e.message};render()}}
 finally{searching=false;submit.disabled=false;submit.textContent='查找门店'}
});
$('#store-select').addEventListener('change',()=>{
 selectedStore=stores.find(x=>x.id===$('#store-select').value)??null;
 if(selectedStore)selectedStore={id:selectedStore.id,name:selectedStore.name};
 try{if(selectedStore)localStorage.setItem('mcd-store',JSON.stringify(selectedStore));else localStorage.removeItem('mcd-store')}catch{}
 invalidate({store:null});void refreshMealStyles();
});
$('#copy').addEventListener('click',async()=>{
 const meal=state.meal;if(!meal)return;const live=state.mode==='live';
 const text=[`麦麦不纠结 · ${live?'实时搭配':'演示搭配（非实际售价）'}`,live?`${state.store?.name??selectedStore?.name} · 到店取餐`:'餐品与价格仅供体验',`餐型：${mealStyles[meal.mealStyle??'joy'].name}`,`营养参考：${nutritionText(meal)}`,meal.nutrition?.complete?`来源：麦当劳中国大陆官网标准份量（${nutritionSource.referenceUpdated}），非个性化饮食建议`:'',...(meal.kind==='bundle'?[`套餐：${meal.name} ×1（以下为套餐内组成，请按套餐点单）`]:[]),...meal.items.map(x=>`${x.included?'套餐内 ':''}${roleNames[x.role]}：${x.name} ×1`),`${live?'试算应付':'演示合计'}：¥${money(meal.totalCents)}`,live?`试算时间：${new Date(meal.quotedAt).toLocaleString('zh-CN')}。点餐时以官方实际价格为准。`:''].filter(Boolean).join('\n');
 try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='清单已复制。'}catch{$('#copy-text').value=text;$('#copy-fallback').hidden=false;$('#copy-text').focus();$('#copy-text').select();$('#copy-status').textContent='可以手动复制下方清单。'}
});

function setConnection(live){configured=Boolean(live.configured);authorizationRequired=Boolean(live.authorizationRequired);canOrder=Boolean(live.ordering);}
$('#auth-form').addEventListener('submit',async event=>{
 event.preventDefault();const input=$('#account-token'),token=input.value.trim();input.value='';const button=$('#auth-form button');button.disabled=true;
 try{const result=await request('/api/session',{token});setConnection(result.live);selectedStore=null;lastReceipt=null;orderUncertain=false;try{localStorage.removeItem('mcd-store')}catch{}invalidate({store:null});void refreshMealStyles();}
 catch(e){state={...state,error:e.message};render();}finally{button.disabled=false;}
});
$('#disconnect').addEventListener('click',async()=>{
 try{const response=await fetch('/api/session',{method:'DELETE'});if(!response.ok)throw new Error('暂时无法断开，请重试。');const result=await response.json();setConnection(result.live);selectedStore=null;lastReceipt=null;orderUncertain=false;invalidate({store:null});void refreshMealStyles();}
 catch(e){state={...state,error:e.message};render();}
});
$('#checkout-start').addEventListener('click',async()=>{
 if(checkoutBusy||!state.draftId)return;const draftId=state.draftId,revision=state.revision;checkoutBusy=true;render();
 try{const review=await request('/api/checkout/prepare',{draftId});if(state.revision!==revision||state.draftId!==draftId)return;
  checkoutReview={...review,draftId};$('#checkout-store').textContent=review.store.name+' · 到店取餐';
  $('#checkout-items').textContent=[review.meal.name,...review.meal.items.map(i=>(i.included?'套餐内 ':'')+i.name+' ×1')].filter(Boolean).join('\n');
  $('#checkout-nutrition').textContent=mealStyles[review.meal.mealStyle??'joy'].name+' · '+nutritionText(review.meal);
  $('#checkout-total').textContent='¥'+money(review.meal.totalCents);$('#checkout-price-note').textContent=review.priceChanged?'价格已更新，请以本次金额确认。':'已重新核对官方应付金额。';
  $('#checkout-takeway').replaceChildren();for(const t of review.takeWays){const option=document.createElement('option');option.value=t.code;option.textContent=t.name;$('#checkout-takeway').append(option);}
  message($('#checkout-error'),'');$('#recover-order').hidden=true;$('#checkout-takeway').disabled=false;$('#checkout-cancel').textContent='再想想';$('#checkout-confirm').disabled=false;$('#checkout-cancel').disabled=false;$('#checkout-confirm').textContent='确认下单，去付款';$('#checkout-dialog').showModal();
 }catch(e){if(e.code==='ORDER_UNCERTAIN')orderUncertain=true;state={...state,error:e.message};}
 finally{checkoutBusy=false;render();}
});
$('#checkout-cancel').addEventListener('click',()=>{if(!creatingOrder)$('#checkout-dialog').close();});
$('#checkout-dialog').addEventListener('cancel',event=>{if(creatingOrder)event.preventDefault();});
$('#checkout-confirm').addEventListener('click',async()=>{
 if(creatingOrder||!checkoutReview)return;creatingOrder=true;$('#checkout-takeway').disabled=true;$('#checkout-confirm').disabled=true;$('#checkout-cancel').disabled=true;$('#checkout-confirm').textContent='正在提交，请勿重复操作…';message($('#checkout-error'),'');
 try{const receipt=await request('/api/checkout/confirm',{confirmationId:checkoutReview.confirmationId,takeWayCode:$('#checkout-takeway').value});lastReceipt={...receipt,draftId:checkoutReview.draftId};$('#checkout-dialog').close();render();$('#payment-panel').scrollIntoView({block:'center',behavior:'smooth'});}
 catch(e){
  const knownSafe=['CHECKOUT_CHANGED','CONFIRMATION_EXPIRED','INVALID_TAKE_WAY','NOT_CONNECTED'].includes(e.code);
  const text=knownSafe?e.message:'订单提交结果尚未确认，请先查询提交结果或到麦当劳官方渠道查单，勿重复下单。';
  message($('#checkout-error'),text);if(!knownSafe){orderUncertain=true;state={...state,error:text};$('#recover-order').hidden=false;await recoverOrder();}
  $('#checkout-confirm').textContent='请返回重新核对';$('#checkout-cancel').textContent='返回菜单';
 }
 finally{creatingOrder=false;$('#checkout-takeway').disabled=false;$('#checkout-cancel').disabled=false;render();}
});
async function recoverOrder(){
 try{const status=await(await fetch('/api/status')).json();const receipt=status.order;
  if(receipt&&checkoutReview&&(receipt.confirmationId===checkoutReview.confirmationId||receipt.draftId===checkoutReview.draftId)){lastReceipt=receipt;orderUncertain=false;state={...state,error:''};$('#checkout-dialog').close();render();return true;}
 }catch{}
 return false;
}
$('#recover-order').addEventListener('click',async()=>{const button=$('#recover-order');button.disabled=true;try{if(!await recoverOrder())message($('#checkout-error'),'暂时未查到确认结果，请到麦当劳官方渠道查单，勿重复下单。');}finally{button.disabled=false;}});
function renderReceipt(){
 $('#order-title').textContent=lastReceipt.draftId&&lastReceipt.draftId===state.draftId?'这份餐单的官方订单':'最近一笔官方订单';
 $('#ordered-store').textContent=lastReceipt.store?.name??'';
 $('#ordered-items').textContent=[lastReceipt.meal?.name,...(lastReceipt.meal?.items??[]).map(i=>(i.included?'套餐内 ':'')+i.name+' ×1')].filter(Boolean).join(' · ');
 $('#ordered-nutrition').textContent=mealStyles[lastReceipt.meal?.mealStyle??'joy'].name+' · '+nutritionText(lastReceipt.meal);
 $('#ordered-total').textContent=Number.isSafeInteger(lastReceipt.totalCents)?'该订单金额：¥'+money(lastReceipt.totalCents):'订单金额请在官方渠道核对';
 $('#order-number').textContent='订单号：'+lastReceipt.orderId;$('#order-status').textContent='当前状态：'+lastReceipt.status;
 $('#payment-link').hidden=!lastReceipt.paymentUrl;if(lastReceipt.paymentUrl)$('#payment-link').href=lastReceipt.paymentUrl;else $('#payment-link').removeAttribute('href');
 $('#payment-note').textContent=lastReceipt.amountConfirmed===false?'订单已创建，但金额与确认金额不一致或未能核对，付款入口已暂停。请到官方渠道查单，勿重复创建。':lastReceipt.paymentUrl?'请在官方页面完成付款。若页面要求扫码，可按指引使用麦当劳 App；付款后可返回查单。':'订单已创建，但付款入口暂未能确认。请到麦当劳官方渠道查单，勿重复创建。';
}
$('#refresh-order').addEventListener('click',async()=>{if(!lastReceipt)return;const button=$('#refresh-order');button.disabled=true;try{lastReceipt={...lastReceipt,...await request('/api/order/status',{receiptId:lastReceipt.receiptId})};renderReceipt();}catch(e){$('#order-status').textContent=e.message;}finally{button.disabled=false;}});

render();
if(!publicDemo){try{const status=await(await fetch('/api/status')).json();setConnection(status.live);if(status.order){lastReceipt=status.order;state={...state,mode:'live',mealStyle:status.order.meal.mealStyle??'joy',meal:status.order.meal,store:status.order.store};showingResult=true;}render()}catch{state={...state,error:'本机服务连接失败，请刷新重试。'};render()}}
