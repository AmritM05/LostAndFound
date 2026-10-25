// SYNTHETIC component browser harness: real AdminPortal, mocked router + API.
// No Next server auth, real sign-in, Neon, Blob or remote writes are exercised.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { browserEngine, browserOptions } from './helpers/student-browser.mjs';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const app = process.cwd(), temp = await mkdtemp(join(tmpdir(), 'magpie-staff-ui-'));
let server, browser, passed = 0;
try {
  await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Portal from './components/admin/AdminPortal'; createRoot(document.getElementById('root')).render(<Portal section={new URLSearchParams(location.search).get('section') || 'matches'} />);`, resolveDir: app, loader: 'tsx' },
    bundle: true, outfile: join(temp, 'app.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    plugins: [{ name: 'synthetic-next', setup(b) {
      b.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
      b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ resolveDir: app, loader: 'tsx', contents: args.path.endsWith('link')
        ? "import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}"
        : "const router={replace(){},push(){},refresh(){}};export const useRouter=()=>router;" }));
    } }] });
  const cssFolder = resolve(app, process.env.MAGPIE_NEXT_DIST_DIR || '.next-final-integrated', 'static/css');
  const css = (await Promise.all((await readdir(cssFolder)).filter(f => f.endsWith('.css')).map(f => readFile(join(cssFolder, f), 'utf8')))).join('\n');
  const js = await readFile(join(temp, 'app.js'));
  server = createServer((req,res) => { if (req.url === '/app.js') { res.setHeader('Content-Type','text/javascript');res.end(js); } else {res.setHeader('Content-Type','text/html');res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);} });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await browserEngine().launch(browserOptions());
  for (const width of [390,1440]) {
    const page = await browser.newPage({ viewport: {width,height:1000} });
    const errors = [], actions = [], unexpected = [];
    page.on('pageerror', e => {errors.push(e.message); console.error('Staff harness browser error:',e.message);});
    const report = (id,type) => ({id,type,name:`Synthetic ${type} earbuds`,category:'Electronics',location:'Unknown',status:'Matching',description:'Private sample description',image_paths:[],created_at:'2026-10-24T12:00Z'});
    const data = {reports:[report('lost','lost'),report('found','found')],matches:[{id:'match',lost_report_id:'lost',found_report_id:'found',score:98,factors:{Description:100},minutes_difference:15,distance_km:null,staff_reasoning:{eligible:true,classification:'very_strong_match',matchingFactors:['Same brand','Compatible model'],contradictions:[]}}], claims:[{id:'claim',match_id:'match',status:'Pending',display_name:'Synthetic claimant',email:'demo@example.test',answers:'Private ownership sample'}], pickups:[],zones:[{id:'desk',name:'Synthetic desk',active:true}],activity:[],buildings:[],notes:[]};
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let response;
      if(path==='/api/admin/session/') response={user:{id:'staff',role:'admin',name:'Synthetic Staff'}};
      else if(path==='/api/admin/workspace/') response=data;
      else if(path==='/api/admin/actions/') {actions.push(route.request().postDataJSON());response={ok:true};}
      else {unexpected.push(path);response={error:'Unexpected synthetic API'};}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    });
    await page.goto(base);
    await page.getByText('Strong potential match',{exact:true}).waitFor();
    await page.getByText('Same brand · Compatible model',{exact:true}).waitFor();
    await page.getByText(/Similarity ranking only; not an ownership probability/).waitFor();passed++;
    if(process.env.STAFF_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.STAFF_SCREENSHOT_DIR}/staff-matches-${width}.png`,fullPage:true});
    if (width===390) assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    passed++;
    await page.goto(`${base}?section=claims`);
    await page.getByLabel('Information requested (private, required)').fill('Describe the hidden synthetic stitching.');
    await page.getByRole('button',{name:'Save claim decision',exact:true}).click();
    await page.getByText('Claim decision saved.',{exact:true}).waitFor();
    assert.equal(actions.at(-1).status,'More information');passed++;
    data.reports.forEach(r=>r.status='Returned');data.claims[0].status='Returned';
    await page.reload();
    await page.getByText('Private ownership sample',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Save claim decision'}).count(),0);passed++;
    data.reports.forEach(r=>r.status='Ready for Pickup');data.claims[0].status='Approved';
    data.pickups=[{id:'pickup',claim_id:'claim',expires_at:'2026-10-20T12:00Z',display_code:'EXPIRED_SYNTHETIC_CODE'}];
    await page.goto(`${base}?section=pickup`);
    await page.getByRole('button',{name:'Renew pickup pass',exact:true}).click();
    assert.equal(await page.getByText('EXPIRED_SYNTHETIC_CODE',{exact:true}).count(),0);
    await page.getByLabel('Active pickup location').selectOption('desk');
    await page.getByRole('button',{name:'Confirm renewal',exact:true}).click();
    await page.getByText('Pickup pass renewed. The previous code is invalid.',{exact:true}).waitFor();
    assert.equal(actions.at(-1).action,'reissuePickup');passed++;
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    if(process.env.STAFF_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.STAFF_SCREENSHOT_DIR}/staff-${width}.png`,fullPage:true});
    await page.close();
  }
  console.log(JSON.stringify({passed,verification:'Synthetic real-component browser harness; mocked Next router and API, not live authentication/recovery.'}));
} finally { await browser?.close(); if(server) await new Promise(r=>server.close(r)); await rm(temp,{recursive:true,force:true}); }
