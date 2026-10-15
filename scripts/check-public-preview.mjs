import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const origin=process.argv[2];if(!origin||new URL(origin).protocol!=='https:')throw new Error('Pass the approved HTTPS preview origin');
const approved=JSON.parse(await readFile(new URL('../.local/public-runtime.json',import.meta.url),'utf8'));if(origin!==approved.origin)throw new Error('Origin must match the explicitly approved local runtime configuration');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});let orderRequests=0;const errors=[];
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/checkout/confirm')orderRequests++;});page.on('pageerror',e=>errors.push(e.message));
 // This validation must never create an order, even if the UI changes.
 await page.route('**/api/checkout/confirm',r=>r.abort('blockedbyclient'));
 const response=await page.goto(origin,{waitUntil:'networkidle',timeout:60000});if(response.status()!==200)throw new Error('Preview did not return HTTP 200');
 const initial=await page.evaluate(()=>fetch('/api/status').then(r=>r.json()));if(initial.live.configured)throw new Error('Anonymous preview inherited an account');
 await expect(page.locator('.hero-art img')).toBeVisible();await page.getByRole('button',{name:'实时点餐',exact:true}).click();await expect(page.locator('#auth-form')).toBeVisible();
 const unauthorized=await page.evaluate(()=>fetch('/api/checkout/prepare',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.status));if(unauthorized!==401)throw new Error('Anonymous checkout should require authorization');
 const env=await readFile(new URL('../.env',import.meta.url),'utf8');const token=env.match(/^MCD_MCP_TOKEN\s*=\s*["']?([^\s"']+)/m)?.[1];if(!token)throw new Error('Local token is unavailable');
 await page.getByLabel('个人 MCP Token',{exact:true}).fill(token);await page.getByRole('button',{name:'连接账户',exact:true}).click();await expect(page.locator('#disconnect')).toBeVisible({timeout:60000});await expect(page.getByLabel('个人 MCP Token',{exact:true})).toHaveValue('');
 const cookies=await page.context().cookies();const cookie=cookies.find(c=>c.name==='__Host-mcd-session');if(!cookie?.secure||!cookie.httpOnly||cookie.sameSite!=='Strict')throw new Error('Session cookie attributes invalid');
 await page.getByLabel('城市',{exact:true}).fill('上海');await page.getByLabel('附近位置',{exact:true}).fill('人民广场');await page.getByRole('button',{name:/查找门店/}).click();await expect(page.locator('#store-select option[value="1450713"]')).toBeAttached({timeout:60000});await page.locator('#store-select').selectOption('1450713');await page.getByRole('button',{name:'预算 50 元',exact:true}).click();await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#checkout-start')).toBeVisible({timeout:180000});await page.locator('#checkout-start').click();await expect(page.locator('#checkout-dialog')).toBeVisible({timeout:60000});
 const proof={origin,at:new Date().toISOString(),http:response.status(),anonymousConfigured:initial.live.configured,cookie:{secure:cookie.secure,httpOnly:cookie.httpOnly,sameSite:cookie.sameSite},store:await page.locator('#checkout-store').innerText(),total:await page.locator('#checkout-total').innerText(),takeWays:await page.locator('#checkout-takeway option').allTextContents(),orderRequests,errors};
 if(orderRequests||errors.length)throw new Error('Unexpected order request or page error');
 await page.screenshot({path:'.local/screenshots/public-live-confirmation.png',fullPage:true});await page.getByRole('button',{name:'再想想',exact:true}).click();await page.getByRole('button',{name:'修改预算',exact:true}).click();await page.getByRole('button',{name:'断开个人账户',exact:true}).click();await expect(page.locator('#auth-form')).toBeVisible();
 const disconnected=await page.evaluate(()=>fetch('/api/status').then(r=>r.json()));if(disconnected.live.configured)throw new Error('Disconnect did not clear session');proof.disconnected=true;
 await writeFile(new URL('../.local/public-preview-proof.json',import.meta.url),JSON.stringify(proof,null,2),{mode:0o600});console.log(JSON.stringify(proof));
}finally{await browser.close();}
