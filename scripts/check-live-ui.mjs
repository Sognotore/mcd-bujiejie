import {chromium} from '@playwright/test';import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.goto('http://127.0.0.1:3187');await page.getByRole('button',{name:'实时点餐',exact:true}).click();
 await page.getByLabel('城市',{exact:true}).fill(process.env.MCD_TEST_CITY??'上海');await page.getByLabel('附近位置',{exact:true}).fill(process.env.MCD_TEST_KEYWORD??'人民广场');
 await page.getByRole('button',{name:/查找门店/}).click();await page.waitForFunction(()=>document.querySelector('#store-select').options.length>1,undefined,{timeout:30000});
 const id=await page.locator('#store-select option').nth(1).getAttribute('value');await page.getByRole('combobox',{name:'选择取餐门店',exact:true}).selectOption(id);
 await page.getByRole('button',{name:'预算 50 元',exact:true}).click();const pending=page.waitForResponse(r=>r.url().endsWith('/api/recommend'),{timeout:120000});
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();const response=await pending;const data=await response.json();
 if(!response.ok)throw new Error(data.error?.message??'Live request failed');
 await page.locator('#result').waitFor({state:'visible'});await mkdir('.local/screenshots',{recursive:true});await page.screenshot({path:'.local/screenshots/live-result.png',fullPage:true});
 if(data.mode!=='live'||data.meal.totalCents>5000||data.meal.items.length!==3)throw new Error('Live result constraints failed');
 await writeFile('.local/live-ui-proof.json',JSON.stringify({at:new Date().toISOString(),...data},null,2),{mode:0o600});
 console.log(JSON.stringify({verified:true,mode:data.mode,store:data.store.name,totalCents:data.meal.totalCents,items:data.meal.items.map(x=>x.name),screenshot:'.local/screenshots/live-result.png'}));
}finally{await browser.close()}
