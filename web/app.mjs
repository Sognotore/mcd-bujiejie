import {parseBudget} from './engine.mjs';
import {initialState,changeCondition,applyResponse,applyFailure} from './state.mjs';
import {trayArt,foodArt,lockIcon} from './art.mjs';
const $=selector=>document.querySelector(selector);
const roleNames={main:'主食',side:'小食',drink:'饮品'};
const money=cents=>(cents/100).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
let state=initialState();let controller;let selectedStore=null;let stores=[];let configured=false;let searching=false;
try{const saved=JSON.parse(localStorage.getItem('mcd-store'));if(saved&&/^\d+$/.test(saved.id)&&typeof saved.name==='string')selectedStore={id:saved.id,name:saved.name}}catch{}
$('#tray-art').innerHTML=trayArt();
function message(el,text){el.textContent=text;el.hidden=!text}
function invalidate(patch){controller?.abort();state=changeCondition(state,patch);$('#copy-fallback').hidden=true;$('#copy-status').textContent='';render()}
function render(){
 const allLocked=state.locks.length===3;
 for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
 $('#live-panel').hidden=state.mode!=='live';
 $('#mode-note').textContent=state.mode==='demo'?'当前为演示模式，餐品和价格仅供体验。':'当前使用官方实时菜单，到店取餐。';
 $('#connection-note').textContent=configured?'已配置实时连接，搜索并选择你要取餐的门店。':'尚未配置实时连接，可以先切回体验演示。';
 $('#store-form').hidden=!configured;
 $('#selected-store').textContent=selectedStore?`已选：${selectedStore.name} · 门店 ${selectedStore.id}`:'';
 $('#budget-summary').textContent=state.budget.trim()?`${state.budget.trim()} 元以内 · 一人餐`:'不限预算 · 一人餐';
 $('#draw').disabled=state.busy||allLocked||(state.mode==='live'&&(!configured||!selectedStore));
 $('#draw').classList.toggle('is-busy',state.busy);$('#draw').setAttribute('aria-busy',String(state.busy));
 $('#draw-label').textContent=state.busy?(state.mode==='live'?'查询菜单并试算中…':'正在搭配…'):(state.meal?'换一份':'帮我搭一餐');
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
  row.append(art,info);
  if(meal.lockable){const locked=state.locks.includes(item.id);const button=document.createElement('button');button.type='button';button.className='lock-button';button.setAttribute('aria-label',(locked?'解锁':'锁定')+roleNames[item.role]);button.setAttribute('aria-pressed',String(locked));button.disabled=state.busy;button.title=locked?'点击解锁，下次一起换':'点击保留这个餐品';button.innerHTML=lockIcon(locked);button.addEventListener('click',()=>{state={...state,revision:state.revision+1,locks:locked?state.locks.filter(x=>x!==item.id):[...state.locks,item.id],message:''};render()});row.append(button)}
  $('#meal-items').append(row);
 }
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
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{if(state.mode!==button.dataset.mode)invalidate({mode:button.dataset.mode,store:null})});
async function request(path,data,signal){
 const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal});
 const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'暂时无法完成，请重试。');return result;
}
$('#draw').addEventListener('click',async()=>{
 if(state.busy)return;
 const b=state.budget.trim();
 try{parseBudget(b)}catch(e){state={...state,error:e.message};render();return}
 const revision=state.revision;controller=new AbortController();state={...state,busy:true,error:'',message:''};$('#copy-fallback').hidden=true;$('#copy-status').textContent='';render();
 try{
  const result=await request('/api/recommend',{mode:state.mode,budget:state.budget,store:selectedStore,lockedIds:state.locks,previousKey:state.meal?.key??null},controller.signal);
  state=applyResponse(state,revision,result);render();
 }catch(e){if(e.name==='AbortError')return;state=applyFailure(state,revision,e.message);render()}
});
$('#store-form').addEventListener('submit',async event=>{
 event.preventDefault();if(searching)return;searching=true;const modeRevision=state.revision;const submit=$('#store-form button');submit.disabled=true;submit.textContent='查找中…';
 try{
  const result=await request('/api/stores',{city:$('#city').value,keyword:$('#keyword').value});
  if(state.mode!=='live'||state.revision!==modeRevision)return;
  stores=result.stores;$('#store-select').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=stores.length?'请选择一家门店':'附近暂时没有营业门店';$('#store-select').append(placeholder);
  for(const s of stores){const option=document.createElement('option');option.value=s.id;option.textContent=`${s.name} · ${s.distance??'--'}米 · ${s.address}`;$('#store-select').append(option)}
  $('#store-label').hidden=false;message($('#message'),stores.length?'':'附近暂时没有可用门店，可以更换地标试试。');
 }catch(e){if(state.mode==='live'&&state.revision===modeRevision){state={...state,error:e.message};render()}}
 finally{searching=false;submit.disabled=false;submit.textContent='查找门店 →'}
});
$('#store-select').addEventListener('change',()=>{
 selectedStore=stores.find(x=>x.id===$('#store-select').value)??null;
 if(selectedStore)selectedStore={id:selectedStore.id,name:selectedStore.name};
 try{if(selectedStore)localStorage.setItem('mcd-store',JSON.stringify(selectedStore));else localStorage.removeItem('mcd-store')}catch{}
 invalidate({store:null});
});
$('#copy').addEventListener('click',async()=>{
 const meal=state.meal;if(!meal)return;const live=state.mode==='live';
 const text=[`麦麦不纠结 · ${live?'实时搭配':'演示搭配（非实际售价）'}`,live?`${state.store?.name??selectedStore?.name} · 到店取餐`:'餐品与价格仅供体验',...(meal.kind==='bundle'?[`套餐：${meal.name} ×1（以下为套餐内组成，请按套餐点单）`]:[]),...meal.items.map(x=>`${x.included?'套餐内 ':''}${roleNames[x.role]}：${x.name} ×1`),`${live?'试算应付':'演示合计'}：¥${money(meal.totalCents)}`,live?`试算时间：${new Date(meal.quotedAt).toLocaleString('zh-CN')}。点餐时以官方实际价格为准。`:''].filter(Boolean).join('\n');
 try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='清单已复制。'}catch{$('#copy-text').value=text;$('#copy-fallback').hidden=false;$('#copy-text').focus();$('#copy-text').select();$('#copy-status').textContent='可以手动复制下方清单。'}
});
render();
try{const status=await(await fetch('/api/status')).json();configured=status.live.configured;render()}catch{state={...state,error:'本机服务连接失败，请刷新重试。'};render()}
