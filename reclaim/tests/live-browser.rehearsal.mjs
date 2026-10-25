// Real local browser rehearsal. No interception. Synthetic owned scenario only.
import assert from 'node:assert/strict';
import { browserEngine, browserOptions } from './helpers/student-browser.mjs';
if(process.env.MAGPIE_LIVE_ACCEPTANCE!=='1'||process.env.MAGPIE_DISPOSABLE_ENVIRONMENT!=='yes') throw Error('Explicit disposable-target opt-in required');
const base=process.env.MAGPIE_LIVE_BASE_URL, run=process.env.MAGPIE_REHEARSAL_RUN;
assert.ok(/^[a-f0-9]{8}$/.test(run||''));
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const email=`magpie-demo-${run}@example.com`;
const browser=await browserEngine().launch(browserOptions());let passed=0;
try{
 const student=await browser.newContext({viewport:{width:1440,height:1000}}),staff=await browser.newContext({viewport:{width:1440,height:1000}});
 const sp=await student.newPage(),ap=await staff.newPage();const errors=[];
 for(const p of [sp,ap]) p.on('pageerror',()=>errors.push('Uncaught browser error'));
 await sp.goto(base+'/login/');await sp.getByLabel('Email address').fill(email);await sp.getByRole('button',{name:'Continue',exact:true}).click();await sp.waitForURL('**/student/overview/');passed++;
 await ap.goto(base+'/admin/login/');await ap.getByLabel('Email',{exact:true}).fill(process.env.ADMIN_DEMO_EMAIL);await ap.getByLabel('Password',{exact:true}).fill(process.env.ADMIN_DEMO_PASSWORD);await ap.getByRole('button',{name:'Staff sign in'}).click();await ap.waitForURL('**/admin/');passed++;
 const workspace=await (await student.request.get(base+'/api/workspace/')).json();
 const item=workspace.state.items.find(x=>x.name===`Synthetic earbuds ${run}`);assert.ok(item);
 const match=workspace.state.matches.find(m=>m.lostId===item.id&&workspace.state.claims.some(c=>c.matchId===m.id));const claim=workspace.state.claims.find(c=>c.matchId===match.id);assert.ok(claim);
 for(const [path,title] of [['found','Found Item Intake'],['reports','Reports'],['matches','Matches'],['claims','Claims'],['pickup','Pickup'],['dropoffs','Drop-Off Zones']]){
  await ap.goto(`${base}/admin/${path}/`);await ap.getByRole('heading',{level:1,name:title,exact:true}).waitFor();passed++;
 }
 await ap.goto(base+'/admin/claims/');
 const card=ap.locator('section.panel').filter({hasText:`Claim reference: ${claim.id}`});
 await card.getByLabel('Information requested (private, required)').fill('Synthetic video rehearsal: describe the concealed blue thread.');
 await card.getByRole('button',{name:'Save claim decision',exact:true}).click();await ap.getByText('Claim decision saved.',{exact:true}).waitFor();passed++;
 await sp.goto(base+'/student/updates/');const owner=sp.locator(`#claim-${claim.id}`);
 await owner.getByRole('textbox',{name:'Additional ownership evidence'}).fill('Synthetic video rehearsal: the concealed blue thread is inside the sleeve.');
 await owner.getByRole('button',{name:'Submit private response',exact:true}).click();await owner.getByText('Your ownership information has been received and is awaiting staff review.',{exact:true}).waitFor();passed++;
 await ap.reload();await ap.locator('section.panel').filter({hasText:`Claim reference: ${claim.id}`}).getByText('Synthetic video rehearsal: the concealed blue thread is inside the sleeve.',{exact:true}).first().waitFor();passed++;
 await sp.goto(base+'/student/map/');await sp.getByText('Synthetic public handover instructions',{exact:true}).first().waitFor();
 await sp.locator('.map-container').evaluate(async el=>{for(let i=0;i<150&&el.getAttribute('aria-busy')==='true';i++)await new Promise(r=>setTimeout(r,100));});
 const maps={sdk:await sp.evaluate(()=>!!window.google?.maps?.Map),unavailable:await sp.getByRole('heading',{name:'Map unavailable',exact:true}).count()>0};
 passed++;
 await sp.setViewportSize({width:390,height:844});await sp.getByRole('button',{name:'Open navigation',exact:true}).click();await sp.getByRole('navigation',{name:'Student navigation'}).getByRole('link',{name:'My reports'}).click();await sp.getByRole('heading',{name:'My reports',exact:true}).waitFor();assert.equal(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);passed++;
 await ap.setViewportSize({width:390,height:844});await ap.goto(base+'/admin/matches/');await ap.getByRole('heading',{level:1,name:'Matches',exact:true}).waitFor();assert.equal(await ap.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);passed++;
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed,failed:0,maps,scenario:run,status:'Real browser/UI/API; no mocks. Prepared claim left Pending after private response.'}));
}finally{await browser.close();}
