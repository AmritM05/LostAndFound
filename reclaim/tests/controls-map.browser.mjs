// Synthetic student API fixtures; actual compiled UI + real Google Maps SDK.
// No database writes, reports or photos are created.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {browserEngine,browserOptions} from './helpers/student-browser.mjs';
const base=process.env.MAGPIE_STUDENT_TEST_URL;
if(!base||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an isolated local server');
const browser=await browserEngine().launch(browserOptions());let passed=0;const maps=[];
const screenshots=process.env.MAGPIE_CONTROLS_SCREENSHOTS;
if(screenshots)await mkdir(screenshots,{recursive:true});
try{
 for(const width of[390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(45000);
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url());if(url.origin!==base)return route.continue();
   assert.equal(route.request().method(),'GET','Visual acceptance must not mutate services');
   const responses={'/api/session/':{user:{id:'synthetic',name:'Sample student',email:'sample@example.test',role:'student',verified:false}},'/api/workspace/':{state:{items:[],matches:[],claims:[],notices:[],privateDetails:{}},messages:[]},'/api/search/':[],'/api/dropoffs/':[]};
   assert.ok(url.pathname in responses,'Unexpected API path');await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(responses[url.pathname])});
  });
  await page.goto(base+'/student/search/');const input=page.getByRole('textbox',{name:'Search campus items',exact:true});await input.waitFor();
  const box=await input.boundingBox(),icon=await page.locator('.search-input > svg').boundingBox();assert.ok(Math.abs(box.y+box.height/2-icon.y-icon.height/2)<1.5);assert.equal(box.height,44);passed++;
  for(const select of await page.locator('.search-toolbar select').all()){assert.equal((await select.boundingBox()).height,44);assert.equal(await select.evaluate(e=>getComputedStyle(e).appearance),'none');}passed++;
  await input.fill('library');await page.getByLabel('Filter by category').selectOption('Electronics');passed++;
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));passed++;
  if(screenshots)await page.screenshot({path:`${screenshots}/search-${width}.png`,fullPage:true});
  await page.goto(base+'/student/map/');const building=page.getByRole('combobox',{name:/Find a campus building/});await building.waitFor();
  assert.ok((await building.boundingBox()).width>Math.min(width-100,300));await building.fill('Thompson');await building.press('ArrowDown');await building.press('Enter');assert.ok((await building.inputValue()).includes('Thompson'));passed++;
  if(process.env.MAGPIE_VERIFY_REAL_MAPS==='1'){
   await page.locator('.map-container[aria-busy="false"]').waitFor();
   const selectedHeight=await page.locator('gmp-advanced-marker').evaluateAll(es=>Math.max(...es.map(e=>e.getBoundingClientRect().height)));
   assert.ok(selectedHeight>25&&selectedHeight<38,'Selected location should stand out without a full-size pin');passed++;
  }
  const clear=page.getByRole('button',{name:'Clear building selection',exact:true}),bb=await building.boundingBox(),cb=await clear.boundingBox();assert.ok(Math.abs(bb.y+bb.height/2-cb.y-cb.height/2)<1.5);await clear.click();assert.equal(await building.inputValue(),'');await building.press('Escape');passed++;
  if(process.env.MAGPIE_VERIFY_REAL_MAPS==='1'){
   await page.locator('.map-container[aria-busy="false"]').waitFor();assert.equal(await page.getByText('Map unavailable',{exact:true}).count(),0);
   const metrics=await page.locator('gmp-advanced-marker').evaluateAll(elements=>{const pins=elements.map(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height,visible:getComputedStyle(e).visibility!=='hidden'&&r.width>0&&r.height>0};});return{total:pins.length,visible:pins.filter(p=>p.visible).length,maxHeight:Math.max(...pins.filter(p=>p.visible).map(p=>p.height))};});
   assert.ok(metrics.total>0);assert.ok(metrics.maxHeight<32,'Unselected campus pins should stay compact');maps.push({width,...metrics});passed++;
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));passed++;
  if(screenshots)await page.screenshot({path:`${screenshots}/map-${width}.png`,fullPage:true});
  await context.close();
 }
 console.log(JSON.stringify({passed,failed:0,maps,verification:'Synthetic read-only student APIs; actual browser controls and Google Maps when opted in'}));
}finally{await browser.close();}
