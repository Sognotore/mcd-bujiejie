import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/')});
test('桌面：预算、抽取、锁定、重抽和清空旧结果',async({page})=>{
 await expect(page.getByText('不限预算 · 一人餐',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'预算 30 元',exact:true}).click();await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();
 await expect(page.locator('#result')).toBeVisible();expect(Number(await page.locator('#total').getAttribute('data-cents'))).toBeLessThanOrEqual(3000);
 const main=await page.locator('[data-role=main] .item-name').innerText();
 await page.getByRole('button',{name:'锁定主食',exact:true}).click();await page.getByRole('button',{name:'换一份',exact:true}).click();await expect(page.locator('#draw-ritual')).toBeHidden();
 await expect(page.locator('[data-role=main] .item-name')).toHaveText(main);
 await page.screenshot({path:'.local/screenshots/desktop-result.png',fullPage:true});
 await page.getByRole('button',{name:'修改预算',exact:true}).click();await page.getByRole('button',{name:'预算 40 元',exact:true}).click();await expect(page.locator('#result')).toBeHidden();
});
test('跳过预算与全部锁定',async({page})=>{
 await page.getByRole('button',{name:'跳过预算',exact:true}).click();await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();
 await expect(page.locator('#result')).toBeVisible();await expect(page.locator('.meal-item')).toHaveCount(3);
 for(const role of ['主食','小食','饮品'])await page.getByRole('button',{name:'锁定'+role,exact:true}).click();
 await expect(page.getByRole('button',{name:'换一份',exact:true})).toBeDisabled();await expect(page.locator('#lock-note')).toHaveText('先解锁一个餐品，再换一份。');
});
test('低预算和非法自定义输入有明确反馈',async({page})=>{
 await page.getByLabel('自定义预算').fill('1');await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#error')).toContainText('当前预算');await expect(page.locator('#result')).toBeHidden();
 await page.getByLabel('自定义预算').fill('1.001');await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#error')).toContainText('两位小数');
});
test('复制失败显示可手动复制的清单，包含演示标识',async({page})=>{
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#result')).toBeVisible();await page.getByRole('button',{name:'复制清单',exact:true}).click();await expect(page.locator('#copy-fallback')).toBeVisible();await expect(page.locator('#copy-text')).toHaveValue(/演示搭配/);
});
test('预算变化丢弃晚到的报价',async({page})=>{
 await page.route('**/api/recommend',async route=>{const res=await route.fetch();await new Promise(r=>setTimeout(r,600));try{await route.fulfill({response:res})}catch{}});
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await page.getByRole('button',{name:'先等等',exact:true}).click();await page.getByRole('button',{name:'预算 40 元',exact:true}).click();await page.waitForTimeout(1200);await expect(page.locator('#result')).toBeHidden();await expect(page.locator('#budget-summary')).toHaveText('40 元以内 · 一人餐');
});
test('手机：无横向溢出，减少动画设置生效',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
 await expect(page.getByRole('button',{name:'抽个好吃的',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/screenshots/mobile-home.png',fullPage:true});
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#result')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/screenshots/mobile-result.png',fullPage:true});
});
test('实时连接未配置时明确提示，不假装有实时结果',async({page})=>{
 await page.getByRole('button',{name:'实时点餐',exact:true}).click();await expect(page.locator('#connection-note')).toContainText('尚未配置');await expect(page.locator('#result')).toBeHidden();
});

test('合法的小数预算不能因浮点误差被拒绝',async({page})=>{
 await page.getByLabel('自定义预算').fill('0.29');await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();
 await expect(page.locator('#error')).toContainText('当前预算');
});

test('复制套餐时保留套餐名称及套餐内关系',async({page})=>{
 await page.route('**/api/status',r=>r.fulfill({json:{live:{configured:true}}}));
 await page.route('**/api/stores',r=>r.fulfill({json:{stores:[{id:'1000',name:'测试门店',address:'测试路',distance:1}]}}));
 const items=['main','side','drink'].map((role,i)=>({id:String(i),name:['测试主食','测试小食','测试饮品'][i],role,priceCents:0,included:true,variantId:'included'}));
 await page.route('**/api/recommend',r=>r.fulfill({json:{status:'ok',mode:'live',store:{id:'1000',name:'测试门店'},meal:{key:'set',kind:'bundle',name:'测试三件套',lockable:false,totalCents:3000,discountCents:0,feesCents:0,quotedAt:Date.now(),budgetCents:null,items}}}));
 await page.reload();await page.getByRole('button',{name:'实时点餐',exact:true}).click();await page.getByLabel('城市',{exact:true}).fill('测试市');await page.getByLabel('附近位置',{exact:true}).fill('测试路');await page.getByRole('button',{name:/查找门店/}).click();await page.getByRole('combobox',{name:'选择取餐门店',exact:true}).selectOption('1000');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#result')).toBeVisible();await page.getByRole('button',{name:'复制清单',exact:true}).click();
 await expect(page.locator('#copy-text')).toHaveValue(/套餐：测试三件套/);await expect(page.locator('#copy-text')).toHaveValue(/套餐内/);
});

test('抽取后菜单替换设置页，重抽留在菜单，可返回修改预算',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'预算 30 元',exact:true}).click();
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();
 await expect(page.locator('.decision')).toBeHidden();await expect(page.locator('#result')).toBeVisible();
 await expect(page.locator('#result-title')).toBeFocused();expect((await page.locator('#result').boundingBox()).y).toBeLessThan(150);
 await expect(page.getByRole('button',{name:'换一份',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'修改预算',exact:true})).toBeVisible();
 const first=await page.locator('.item-name').allTextContents();await page.getByRole('button',{name:'换一份',exact:true}).click();await expect(page.locator('#draw-ritual')).toBeHidden();await expect(page.locator('.decision')).toBeHidden();
 await expect.poll(()=>page.locator('.item-name').allTextContents()).not.toEqual(first);
 await page.getByRole('button',{name:'修改预算',exact:true}).click();await expect(page.locator('.decision')).toBeVisible();await expect(page.locator('#result')).toBeHidden();await expect(page.getByRole('button',{name:'预算 30 元',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'预算 40 元',exact:true}).click();await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();expect(Number(await page.locator('#total').getAttribute('data-cents'))).toBeLessThanOrEqual(4000);
});

test('重抽失败时菜单和操作保留，错误在结果页可见',async({page})=>{
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#result')).toBeVisible();
 const names=await page.locator('.item-name').allTextContents();await page.route('**/api/recommend',r=>r.fulfill({status:503,json:{error:{message:'暂时无法查询，请重试。'}}}));
 await page.getByRole('button',{name:'换一份',exact:true}).click();await expect(page.locator('#draw-ritual')).toBeHidden();await expect(page.locator('.decision')).toBeHidden();await expect(page.locator('#error')).toContainText('暂时无法查询');expect(await page.locator('.item-name').allTextContents()).toEqual(names);await expect(page.locator('#copy')).toBeDisabled();
});

test('首页首屏包含标题、生成插画、预算和抽签按钮，抽取有揭晓过程',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.reload();
 for(const selector of ['#hero-title','.hero-art img','.budget-area','#draw']){const box=await page.locator(selector).boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(844);}
 expect(await page.locator('.hero-art img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#draw-ritual')).toBeVisible();await expect(page.locator('#result')).toBeVisible();await expect(page.locator('#draw-ritual')).toBeHidden();
});

test('官方下单先核对再确认，取消不下单，成功后展示付款入口与查单',async({page})=>{
 let creates=0;await page.route('**/api/status',r=>r.fulfill({json:{live:{configured:true,ordering:true}}}));
 await page.route('**/api/stores',r=>r.fulfill({json:{stores:[{id:'1000',name:'测试门店',address:'测试路',distance:1}]}}));
 const items=['main','side','drink'].map((role,i)=>({id:String(i),name:['测试主食','测试小食','测试饮品'][i],role,priceCents:1000,variantId:'exact',art:['burger','fries','cola'][i]}));
 const meal={key:'exact',kind:'custom',lockable:true,totalCents:3000,discountCents:0,feesCents:0,quotedAt:Date.now(),budgetCents:3000,items},store={id:'1000',name:'测试门店'};
 await page.route('**/api/recommend',r=>r.fulfill({json:{status:'ok',mode:'live',store,meal,draftId:'draft-test'}}));
 await page.route('**/api/checkout/prepare',r=>r.fulfill({json:{confirmationId:'confirmation-test',meal,store,takeWays:[{code:'eat-in',name:'堂食'}]}}));
 await page.route('**/api/checkout/confirm',r=>{creates++;return r.fulfill({json:{receiptId:'receipt-test',orderId:'order-test',status:'待支付',paymentUrl:'https://m.mcdchina.net/mcp/scanToPay?orderId=order-test',store,meal}});});
 await page.route('**/api/order/status',r=>r.fulfill({json:{receiptId:'receipt-test',orderId:'order-test',status:'已支付'}}));
 await page.reload();await page.getByRole('button',{name:'实时点餐',exact:true}).click();await page.getByLabel('城市',{exact:true}).fill('测试市');await page.getByLabel('附近位置',{exact:true}).fill('测试路');await page.getByRole('button',{name:/查找门店/}).click();await page.getByRole('combobox',{name:'选择取餐门店',exact:true}).selectOption('1000');
 await page.getByRole('button',{name:'抽个好吃的',exact:true}).click();await expect(page.locator('#result')).toBeVisible();await page.locator('#checkout-start').click();await expect(page.locator('#checkout-dialog')).toBeVisible();await expect(page.locator('#checkout-store')).toContainText('测试门店');await expect(page.locator('#checkout-total')).toHaveText('¥30');expect(creates).toBe(0);
 await page.getByRole('button',{name:'再想想',exact:true}).click();expect(creates).toBe(0);await page.locator('#checkout-start').click();await page.getByRole('button',{name:'确认下单，去付款',exact:true}).click();await expect(page.locator('#payment-panel')).toBeVisible();expect(creates).toBe(1);await expect(page.locator('#payment-link')).toHaveAttribute('href',/mcdchina.net\/mcp\/scanToPay/);
 await page.getByRole('button',{name:'查询订单状态',exact:true}).click();await expect(page.locator('#order-status')).toContainText('已支付');
});

test('公共实时模式需要个人授权，凭证输入清空且不进入浏览器存储',async({page})=>{
 await page.route('**/api/status',r=>r.fulfill({json:{live:{configured:false,authorizationRequired:true,ordering:true}}}));
 await page.route('**/api/session',r=>r.fulfill({json:{live:{configured:true,authorizationRequired:true,ordering:true}}}));
 await page.reload();await page.getByRole('button',{name:'实时点餐',exact:true}).click();await expect(page.locator('#auth-form')).toBeVisible();await page.getByLabel('个人 MCP Token',{exact:true}).fill('test-token-not-real');await page.getByRole('button',{name:'连接账户',exact:true}).click();await expect(page.locator('#disconnect')).toBeVisible();await expect(page.getByLabel('个人 MCP Token',{exact:true})).toHaveValue('');expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('test-token-not-real');
});
