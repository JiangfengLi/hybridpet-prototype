import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lijia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true});
const base=process.env.TEST_URL||'http://127.0.0.1:4173/';
const output=new URL('../test-results/',import.meta.url);await mkdir(output,{recursive:true});
const errors=[],checks=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const ready=async p=>{await p.goto(base);await p.locator('#save-status').filter({hasText:'已保存到本地'}).waitFor({state:'attached'});};
const result=async p=>p.locator('#lab-status').filter({hasText:'新生命已诞生'}).waitFor();
const sample= (p,n)=>p.locator('#pet-grid [data-action="sample"]').nth(n);
try{
 await ready(page);assert.equal(await page.locator('.pet-card').count(),6);
 await page.screenshot({path:fileURLToPath(new URL('desktop.png',output)),fullPage:true});checks.push('桌面工作台与六只初始宠物');
 await sample(page,0).click();await page.locator('#lab-status').filter({hasText:'已放入 1 / 2'}).waitFor();
 await sample(page,0).click();await page.locator('#toast').filter({hasText:'请选择另一只宠物'}).waitFor();assert.equal(await page.locator('#collection-count').textContent(),'6');checks.push('单份不繁衍，同一个体重复提交被拒绝');
 await sample(page,1).click();await page.locator('#lab-status').filter({hasText:'正在重组'}).waitFor();
 assert.ok(await sample(page,2).isDisabled());
 await page.screenshot({path:fileURLToPath(new URL('recombination.png',output))});
 await page.reload();await result(page);assert.equal(await page.locator('#collection-count').textContent(),'7');
 const bornId=await page.locator('[data-action="continue"]').getAttribute('data-id');
 await page.reload();await result(page);assert.equal(await page.locator('[data-action="continue"]').getAttribute('data-id'),bornId);assert.equal(await page.locator('#collection-count').textContent(),'7');checks.push('动画中刷新恢复同一后代，反复刷新不重复出生');
 await page.locator('[data-action="rename"]').click();await page.locator('#pet-name').fill('星际 <小不点>');await page.locator('#rename-form button[type=submit]').click();
 await page.locator('.name-line h3').filter({hasText:'星际 <小不点>'}).waitFor();assert.equal(await page.locator('#observation script').count(),0);checks.push('命名与安全文本显示');
 await page.locator(`[data-action="favorite"][data-id="${bornId}"]`).click();await page.locator('[data-filter="favorite"]').click();assert.equal(await page.locator('.pet-card').count(),1);await page.locator('[data-filter="all"]').click();checks.push('收藏与筛选');
 for(let gen=2;gen<=3;gen++){
  await page.locator('[data-action="continue"]').click();await page.locator('#lab-status').filter({hasText:'已放入 1 / 2'}).waitFor();
  await page.locator('[data-action="sample"][data-id="origin-3"]').click();
  if(gen===3){await page.locator('[data-action="skip"]').click();}
  await result(page);await page.locator('.observation-subline').filter({hasText:`第 ${gen} 代`}).waitFor();
 }
 assert.equal(await page.locator('#collection-count').textContent(),'9');assert.equal(await page.locator('#milestones li.done').count(),3);checks.push('连续三代、真实动画、跳过动画和探索进度');
 await page.screenshot({path:fileURLToPath(new URL('newborn.png',output)),fullPage:true});
 await page.locator('[data-action="complete"]').click();await page.locator('#lab-status').filter({hasText:'等待样本'}).waitFor();
 await sample(page,0).dragTo(page.locator('#drop-zone'));await page.locator('#lab-status').filter({hasText:'已放入 1 / 2'}).waitFor();await page.locator('.remove-sample').click();await page.locator('#lab-status').filter({hasText:'等待样本'}).waitFor();checks.push('拖入同一格和移除样本');
 await sample(page,0).focus();await page.keyboard.press('Enter');await page.locator('#lab-status').filter({hasText:'已放入 1 / 2'}).waitFor();checks.push('键盘样本投放');
 const second=await context.newPage();await second.goto(base);await second.locator('#read-only-banner').waitFor();assert.ok(await sample(second,0).isDisabled());await page.close();page=second;await page.locator('#save-status').filter({hasText:'已保存到本地'}).waitFor({timeout:8000});assert.equal(await page.locator('#collection-count').textContent(),'9');checks.push('多页面写锁、关闭后接管同一存档');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await ready(phone);
 const overflow=await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 await sample(phone,0).tap();await phone.locator('#lab-status').filter({hasText:'已放入 1 / 2'}).waitFor();await sample(phone,1).tap();await result(phone);
 const clippedButtons=await phone.locator('main button:visible').evaluateAll(buttons=>buttons.filter(b=>{const p=b.closest('.panel');if(!p)return false;const a=b.getBoundingClientRect(),r=p.getBoundingClientRect();return a.right>r.right+1||a.left<r.left-1;}).map(b=>b.textContent));assert.deepEqual(clippedButtons,[]);
 await phone.screenshot({path:fileURLToPath(new URL('mobile.png',output)),fullPage:true});checks.push('390px 触屏点选、繁衍完成、无横向溢出');
 const failureContext=await browser.newContext();const failure=await failureContext.newPage();await ready(failure);
 await failure.evaluate(()=>{window.failSave=true;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,...args){if(v?.pets?.length>6&&window.failSave){window.attemptedGenes=v.pets.at(-1).genes;throw new DOMException('Test quota','QuotaExceededError');}return put.call(this,v,...args);};});
 await sample(failure,0).click();await failure.locator('#lab-status').filter({hasText:'已放入 1 / 2'}).waitFor();await sample(failure,1).click();await failure.getByRole('button',{name:'重试保存'}).waitFor();assert.equal(await failure.locator('#collection-count').textContent(),'6');await failure.evaluate(()=>window.failSave=false);await failure.getByRole('button',{name:'重试保存'}).click();await result(failure);
 const same=await failure.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('evo-pet-laboratory-v1',1);req.onsuccess=()=>{const db=req.result,r=db.transaction('documents').objectStore('documents').get('save');r.onsuccess=()=>{resolve(r.result.pets.length===7&&r.result.pets.at(-1).genes===window.attemptedGenes);db.close();};};}));assert.ok(same);checks.push('模拟保存失败不会假成功，重试保持同一后代基因');
 assert.deepEqual(errors,[]);checks.push('无浏览器脚本错误');
 await writeFile(new URL('browser-checks.json',output),JSON.stringify({passed:checks,errors},null,2));console.log(JSON.stringify({passed:checks,errors},null,2));
}catch(e){await page.screenshot({path:fileURLToPath(new URL('failure.png',output)),fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1;}finally{await browser.close();}
