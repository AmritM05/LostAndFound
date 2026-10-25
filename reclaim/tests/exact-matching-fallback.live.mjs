// REAL local application + Neon acceptance with server-side Gemini disabled.
// Only an explicitly supplied synthetic pair is reevaluated; no reports are created/deleted.
import assert from 'node:assert/strict';
import {browserEngine,browserOptions} from './helpers/student-browser.mjs';
const base=process.env.MAGPIE_FALLBACK_BASE_URL;
if(process.env.MAGPIE_EXACT_MATCH_ACCEPTANCE!=='1'||!base||!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Use an explicitly authorized isolated loopback app with Gemini disabled');
assert.ok(process.env.MAGPIE_SYNTHETIC_LOST_ID&&process.env.MAGPIE_SYNTHETIC_FOUND_ID);
const browser=await browserEngine().launch(browserOptions());
try{
 const context=await browser.newContext(),headers={Origin:base};
 const login=await context.request.post(base+'/api/admin/session/',{headers,data:{email:process.env.ADMIN_DEMO_EMAIL,password:process.env.ADMIN_DEMO_PASSWORD}});assert.equal(login.status(),200);
 const r=await context.request.post(base+'/api/admin/ai-matching/',{headers,data:{lostId:process.env.MAGPIE_SYNTHETIC_LOST_ID,foundId:process.env.MAGPIE_SYNTHETIC_FOUND_ID,confirmSynthetic:true}});assert.equal(r.status(),200);
 const result=await r.json();assert.equal(result.mode,'deterministic');assert.equal(result.providerReason,'disabled');assert.equal(result.applied,true);assert.equal(result.assessment.eligible,true);assert.ok(result.assessment.score>=35);
 console.log(JSON.stringify({passed:1,failed:0,verification:'REAL isolated local API + Neon, server Gemini flag disabled; no mocks',loginStatus:login.status(),matchingStatus:r.status(),mode:result.mode,providerReason:result.providerReason,score:result.assessment.score}));
}finally{await browser.close();}
