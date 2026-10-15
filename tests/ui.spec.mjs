import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/')});
test('桌面：预算、抽取、锁定、重抽和清空旧结果',async({page})=>{
 await expect(page.getByText('不限预算 · 一人餐',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'预算 30 元',exact:true}).click();await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();
 await expect(page.locator('#result')).toBeVisible();expect(Number(await page.locator('#total').getAttribute('data-cents'))).toBeLessThanOrEqual(3000);
 const main=await page.locator('[data-role=main] .item-name').innerText();
 await page.getByRole('button',{name:'锁定主食',exact:true}).click();await page.getByRole('button',{name:'换一份',exact:true}).click();
 await expect(page.locator('[data-role=main] .item-name')).toHaveText(main);
 await page.screenshot({path:'.local/screenshots/desktop-result.png',fullPage:true});
 await page.getByRole('button',{name:'预算 40 元',exact:true}).click();await expect(page.locator('#result')).toBeHidden();
});
test('跳过预算与全部锁定',async({page})=>{
 await page.getByRole('button',{name:'跳过预算',exact:true}).click();await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();
 await expect(page.locator('#result')).toBeVisible();await expect(page.locator('.meal-item')).toHaveCount(3);
 for(const role of ['主食','小食','饮品'])await page.getByRole('button',{name:'锁定'+role,exact:true}).click();
 await expect(page.getByRole('button',{name:'换一份',exact:true})).toBeDisabled();await expect(page.locator('#lock-note')).toHaveText('先解锁一个餐品，再换一份。');
});
test('低预算和非法自定义输入有明确反馈',async({page})=>{
 await page.getByLabel('自定义预算').fill('1');await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();await expect(page.locator('#error')).toContainText('当前预算');await expect(page.locator('#result')).toBeHidden();
 await page.getByLabel('自定义预算').fill('1.001');await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();await expect(page.locator('#error')).toContainText('两位小数');
});
test('复制失败显示可手动复制的清单，包含演示标识',async({page})=>{
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
 await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();await expect(page.locator('#result')).toBeVisible();await page.getByRole('button',{name:'复制清单',exact:true}).click();await expect(page.locator('#copy-fallback')).toBeVisible();await expect(page.locator('#copy-text')).toHaveValue(/演示搭配/);
});
test('预算变化丢弃晚到的报价',async({page})=>{
 await page.route('**/api/recommend',async route=>{const res=await route.fetch();await new Promise(r=>setTimeout(r,600));try{await route.fulfill({response:res})}catch{}});
 await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();await page.getByRole('button',{name:'预算 40 元',exact:true}).click();await page.waitForTimeout(800);await expect(page.locator('#result')).toBeHidden();await expect(page.locator('#budget-summary')).toHaveText('40 元以内 · 一人餐');
});
test('手机：无横向溢出，减少动画设置生效',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
 await expect(page.getByRole('button',{name:'帮我搭一餐',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/screenshots/mobile-home.png',fullPage:true});
 await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();await expect(page.locator('#result')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/screenshots/mobile-result.png',fullPage:true});
});
test('实时连接未配置时明确提示，不假装有实时结果',async({page})=>{
 await page.getByRole('button',{name:'实时菜单',exact:true}).click();await expect(page.locator('#connection-note')).toContainText('尚未配置');await expect(page.locator('#result')).toBeHidden();
});

test('合法的小数预算不能因浮点误差被拒绝',async({page})=>{
 await page.getByLabel('自定义预算').fill('0.29');await page.getByRole('button',{name:'帮我搭一餐',exact:true}).click();
 await expect(page.locator('#error')).toContainText('当前预算');
});
