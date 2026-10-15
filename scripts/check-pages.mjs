import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const out=new URL('../dist/',import.meta.url);
const allowed=['assets','.nojekyll','index.html','styles.css','app.mjs','art.mjs','state.mjs','engine.mjs','demo-data.mjs'];
assert.deepEqual((await readdir(out)).sort(),[...allowed].sort());
// Compare against the locally configured secret without ever printing it.
const env=await readFile(new URL('../.env',import.meta.url),'utf8').catch(()=>'');
const token=env.match(/^MCD_MCP_TOKEN\s*=\s*["']?([^\s"']+)/m)?.[1];
for(const name of allowed.filter(n=>n!=='assets')){const content=await readFile(new URL(name,out),'utf8');if(token)assert(!content.includes(token),'Private credential found in public build');}
let server;let url=process.argv[2];
if(!url){
 server=http.createServer(async(req,res)=>{try{
  const prefix='/mcd-bujiejie/';const path=new URL(req.url,'http://localhost').pathname;
  const name=path.startsWith(prefix)?path.slice(prefix.length)||'index.html':'';
  if(!allowed.includes(name)&&!/^assets\/(brand-mark-v3|meal-hero|food-(burger|chicken|fish|fries|nuggets|pie|cola|tea|coffee|juice))\.webp$/.test(name)){res.writeHead(404);return res.end();}
  const type=name.endsWith('.webp')?'image/webp':name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'content-type':type});res.end(await readFile(new URL(name,out)));
 }catch{res.writeHead(500);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/mcd-bujiejie/`;
}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[],apis=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.includes('/api/'))apis.push(r.url());});
 await page.goto(url,{waitUntil:'networkidle',timeout:60000});
 await expect(page.locator('.brand-mark img')).toBeVisible();assert(await page.locator('.brand-mark img').evaluate(img=>img.complete&&img.naturalWidth>0),'Brand icon failed to load');
 await expect(page.getByRole('button',{name:'公开体验版',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'实时点餐',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'预算 30 元',exact:true}).click();await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();
 await expect(page.locator('#result')).toBeVisible();await expect(page.locator('.decision')).toBeHidden();assert(Number(await page.locator('#total').getAttribute('data-cents'))<=3000);
 const first=await page.locator('.item-name').allTextContents();await page.getByRole('button',{name:'锁定饮品',exact:true}).click();await page.getByRole('button',{name:'换一份',exact:true}).click();
 await expect.poll(()=>page.locator('.item-name').allTextContents()).not.toEqual(first);const next=await page.locator('.item-name').allTextContents();assert.equal(next[2],first[2]);assert.notDeepEqual(first,next);assert(Number(await page.locator('#total').getAttribute('data-cents'))<=3000);
 await page.getByRole('button',{name:'修改预算',exact:true}).click();await expect(page.locator('.decision')).toBeVisible();await page.getByRole('button',{name:'跳过预算',exact:true}).click();await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('.meal-item')).toHaveCount(3);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile layout overflow');
 await page.screenshot({path:'.local/screenshots/public-demo-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(apis,[]);
 console.log(JSON.stringify({url,passed:['public demo','result replaces setup','edit budget','30 yuan budget','locked drink','different reroll','skip budget','390px layout','no backend requests','allowlist and secret scan']}));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
