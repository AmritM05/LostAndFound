// REAL browser/API/Neon acceptance. Explicit opt-in creates five synthetic reports;
// never resets/deletes reports, changes recovery state, or sends existing evidence to Gemini.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {browserEngine,browserOptions} from './helpers/student-browser.mjs';
if(process.env.MAGPIE_EXACT_MATCH_ACCEPTANCE!=='1')throw Error('Opt in explicitly to synthetic live report creation');
const base=process.env.MAGPIE_LIVE_BASE_URL;
if(base!=='https://magpie-chi-eight.vercel.app')throw Error('Unexpected hosted target');
const u=new URL(process.env.DATABASE_URL);
assert.equal(createHash('sha256').update(u.hostname+u.pathname).digest('hex').slice(0,12),'76581ecb9b0b');
const q=neon(process.env.DATABASE_URL),run=randomUUID().slice(0,8),name=`Synthetic phone ${run}`;
const browser=await browserEngine().launch(browserOptions());let passed=0;const statuses=[];
try{
 const student=await browser.newContext(),staff=await browser.newContext();
 const sp=await student.newPage(),ap=await staff.newPage();
 for(const page of[sp,ap])page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')&&r.request().method()==='POST')statuses.push({path,status:r.status()});});
 await sp.goto(base+'/login/');await sp.getByLabel('Email address',{exact:true}).fill(`magpie-exact-${run}@example.com`);await sp.getByLabel('Name (optional)',{exact:true}).fill('Synthetic matching acceptance');await sp.getByRole('button',{name:'Continue',exact:true}).click();await sp.waitForURL('**/student/overview/');
 await ap.goto(base+'/admin/login/');await ap.getByLabel('Email',{exact:true}).fill(process.env.ADMIN_DEMO_EMAIL);await ap.getByLabel('Password',{exact:true}).fill(process.env.ADMIN_DEMO_PASSWORD);await ap.getByRole('button',{name:/Staff sign in/}).click();await ap.waitForURL('**/admin/');
 const json=async(ctx,path)=>{const r=await ctx.request.get(base+path);assert.equal(r.status(),200);return r.json();};
 const workspace=()=>json(staff,'/api/admin/workspace/');
 const before=await workspace();
 const actual=before.matches.find(m=>m.lost_report_id===process.env.MAGPIE_EXISTING_LOST_ID&&m.found_report_id===process.env.MAGPIE_EXISTING_FOUND_ID);
 assert.ok(actual&&actual.score>=70,'D: real existing pair must be persisted after authorized recalculation');passed++;
 async function submit(page,mode,model='iPhone 15 Pro Max',brand='Apple',description='Synthetic handset in a plain protective shell'){
  await page.goto(base+(mode==='lost'?'/student/report/':'/admin/found/'));
  await page.getByRole('heading',{name:'Start a report',exact:true}).waitFor();
  await page.getByLabel(/Item category/).selectOption('Electronics');
  if(mode==='found')await page.getByLabel(/Approved drop-off zone/).selectOption(before.zones.find(z=>z.active).id);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel(/Device type/).fill(name);await page.getByLabel(/^Brand/).fill(brand);await page.getByLabel(/^Model/).fill(model);await page.getByLabel(/General color/).fill('Black');await page.getByLabel(/Private description/).fill(description);await page.getByLabel(/Ownership details/).fill('Synthetic test ownership evidence');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('checkbox',{name:mode==='lost'?"I don't know where I lost this item":'The finder did not know where it was found'}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();
  const request=page.waitForResponse(r=>new URL(r.url()).pathname===(mode==='lost'?'/api/reports/':'/api/admin/reports/')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Submit report',exact:true}).click();const response=await request;assert.equal(response.status(),201);const result=await response.json();assert.ok(result.id);return result.id;
 }
 const lost=await submit(sp,'lost'),found=await submit(ap,'found');
 let state=await workspace();const pair=state.matches.find(m=>m.lost_report_id===lost&&m.found_report_id===found);assert.ok(pair&&pair.score>=70,'A/E: identical pair must match automatically after found UI intake');passed+=2;
 const moderate=await submit(ap,'found','15 Pro Max','Apple','Plain protective casing around the synthetic mobile handset');
 state=await workspace();assert.ok(state.matches.some(m=>m.lost_report_id===lost&&m.found_report_id===moderate&&m.score>=70),'B: short family alias and different wording');passed++;
 const rejected=await submit(ap,'found','Galaxy S24','Samsung');state=await workspace();assert.ok(!state.matches.some(m=>m.lost_report_id===lost&&m.found_report_id===rejected),'C: known brand mismatch rejected');passed++;
 const laterLost=await submit(sp,'lost','15 Pro Max');state=await workspace();assert.ok(state.matches.some(m=>m.lost_report_id===laterLost&&m.found_report_id===found&&m.score>=70),'F: new lost report matches prior found record');passed++;
 await ap.goto(base+'/admin/matches/');await ap.getByRole('button',{name:'Review Match',exact:true}).first().waitFor();assert.ok((await ap.locator('.staff-confidence').allTextContents()).some(s=>s.includes(`${pair.score}/100`)));assert.ok(await ap.getByText(name,{exact:true}).count());passed++;
 const [stored]=await q.query('select id,score,staff_reasoning from potential_matches where lost_report_id=$1 and found_report_id=$2',[lost,found]);assert.equal(stored.id,pair.id);assert.equal(stored.score,pair.score);assert.notEqual(stored.staff_reasoning?.ai?.used,true,'real automatic matching is deterministic and does not depend on Gemini');passed++;
 const duplicate=await q.query('select count(*)::int n from potential_matches where lost_report_id=$1 and found_report_id=$2',[lost,found]);assert.equal(duplicate[0].n,1);
 console.log(JSON.stringify({verification:'REAL hosted browser forms, real API/auth and Neon; no intercepted requests',passed,failed:0,existingPair:{lostId:actual.lost_report_id,foundId:actual.found_report_id,score:actual.score},synthetic:{run,lost,found,moderate,rejected,laterLost,matchId:stored.id,score:stored.score},statuses,providerOutageNotForcedInProduction:true}));
}finally{await browser.close();}
