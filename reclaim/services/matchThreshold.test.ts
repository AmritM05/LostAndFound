import test from "node:test";
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { MIN_MATCH_SCORE,MIN_MATCH_NOTICE_SCORE,rankPotentialMatches,isPotentialMatch } from "../lib/matchVisibility";
import type { MatchingItem } from "./matchingAttributes";
import { assessMatch,findMatches } from "./matchingService";
import { repository } from "../lib/server/repository";
import { adminRepository } from "../lib/server/adminRepository";
import { findOwnedPotentialMatch } from "../lib/server/matchCandidates";
const id=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`;
const owner={id:id(1),role:'student',name:'Owner',email:'owner@example.test',verified:false} as const;
const folder=new URL('../db/migrations/',import.meta.url);
const item=(type:'lost'|'found',extra: Partial<MatchingItem>={}): MatchingItem =>({id:id(type==='lost'?10:11),reporterId:id(1),type,name:'Object',category:'Other',brand:'',model:'',color:'Unknown',description:'',features:'',location:'Unknown',lat:null,lng:null,date:'invalid',status:'Matching',image:'',...extra});
const setup=async(before012=false)=>{
 const db=new PGlite();
 for(const name of(await readdir(folder)).filter(f=>f.endsWith('.sql')&&(!before012||f<'012_')).sort()) await db.exec(await readFile(new URL(name,folder),'utf8'));
 const q=async(s:string,args:any[]=[]) =>(await db.query(s,args)).rows as any[];
 await q("insert into users(id,email,display_name,role) values($1,'owner@example.test','Owner','student'),($2,'staff@example.test','Staff','admin'),($3,'other@example.test','Other','student')",[id(1),id(2),id(3)]);
 const insert=async(n:number,type:'lost'|'found',minutes=0,category='Electronics',description=type==='lost'?'crimson threaded fabric':'quartz metallic pebble')=>q("insert into reports(id,reporter_id,report_type,category,item_name,primary_color,description,lost_date,lost_time,occurred_at,status) values($1,$2,$3,$4,$5,'Unknown',$6,'2026-10-24','12:00','2026-10-24T12:00:00Z'::timestamptz+$7::integer*interval '1 minute',$8)",[id(n),type==='lost'?id(1):id(2),type,category,type==='lost'?'Object alpha':'Gadget beta',description,minutes,type==='lost'?'Matching':'Secured']);
 return {db,q,insert};
};
test('69 is hidden;70 and higher are candidates, ranked descending with contradiction/dismissal guards',()=>{
 assert.equal(MIN_MATCH_SCORE,70);assert.equal(MIN_MATCH_NOTICE_SCORE,70);
 assert.deepEqual(rankPotentialMatches([{id:'69',score:69},{id:'70',score:70},{id:'high',score:85},{id:'rejected',score:99,staff_reasoning:{eligible:false}},{id:'dismissed',score:99,dismissed:true}]).map(m=>m.id),['high','70']);
 assert.equal(isPotentialMatch({score:NaN}),false);
 for(const score of [69,70,85]){
  const a=assessMatch(item('lost'),item('found'),{imageSimilarity:score/100});assert.equal(a.score,score);assert.equal(a.eligible,true);assert.equal(isPotentialMatch(a),score>=70);
 }
 assert.ok(assessMatch(item('lost',{category:'Electronics'}),item('found',{category:'Electronics'})).score>59,'one available attribute group is no longer capped');
 const lost=item('lost',{category:'Other',name:'Object alpha',description:'',date:'2026-10-24T12:00:00Z'});
 const found=(n:number,minutes:number)=>item('found',{id:id(n),category:'Other',name:'Gadget beta',description:'',date:new Date(Date.parse(lost.date)+minutes*60000).toISOString()});
 assert.deepEqual(findMatches([lost,found(21,310),found(22,300),found(23,150)]).map(m=>[m.foundId,m.score]),[[id(23),85],[id(22),70]]);

 for(const extra of [{brand:'Samsung'},{model:'Galaxy Buds 2'},{category:'Clothing'},{identifiers:{serial:'B-456'}}]){
  const a=assessMatch(item('lost',{category:'Electronics',brand:'Apple',model:'AirPods Pro',identifiers:{serial:'A-123'}}),item('found',{category:'Electronics',brand:'Apple',model:'AirPods Pro',identifiers:{serial:'A-123'},...extra}),{imageSimilarity:1,semanticSimilarity:1});assert.equal(a.eligible,false);assert.equal(isPotentialMatch(a),false);
 }
});
test('SQL trigger and silent upgrade expose all70+ pairs; repositories/API preserve privacy and recovery history',async()=>{
 const f=await setup(true);try{
  await f.insert(10,'lost',0,'Other','');await f.insert(11,'found',310,'Other','');await f.insert(12,'found',300,'Other','');await f.insert(13,'found',150,'Other','');
  assert.equal((await f.q('select count(*)::int n from potential_matches'))[0].n,3,'old35 cutoff');
  const notices=(await f.q('select count(*)::int n from updates'))[0].n;
  const recovery=await f.q("select proname,prosrc from pg_proc where proname in ('submit_ownership_claim','review_ownership_claim','redeem_pickup','reissue_expired_pickup') order by proname");
  await f.db.exec(await readFile(new URL('012_match_threshold_70.sql',folder),'utf8'));
  assert.deepEqual(await f.q("select proname,prosrc from pg_proc where proname in ('submit_ownership_claim','review_ownership_claim','redeem_pickup','reissue_expired_pickup') order by proname"),recovery);
  assert.equal((await f.q('select count(*)::int n from updates'))[0].n,notices,'upgrade does not notify');
  assert.deepEqual((await f.q('select score from potential_matches order by score desc')).map(m=>m.score),[85,70,69]);
  assert.deepEqual((await f.q('select matching_candidate_min_score() candidate,matching_notice_min_score() notice'))[0],{candidate:MIN_MATCH_SCORE,notice:MIN_MATCH_NOTICE_SCORE});
  const student=repository(f.q),staff=adminRepository(f.q);
  await assert.rejects(()=>staff.recalculateMatches(id(1)),/Access denied/);
  const first=await staff.recalculateMatches(id(2)),second=await staff.recalculateMatches(id(2));
  assert.equal(first.inserted,0);assert.equal(second.inserted,0);
  assert.equal((await f.q('select count(*)::int n from updates'))[0].n,notices);
  assert.deepEqual((await student.workspace(owner)).state.matches.map(m=>m.score),[85,70]);
  assert.deepEqual((await staff.workspace()).matches.map(m=>m.score),[85,70]);
  assert.equal(await findOwnedPotentialMatch(f.q,id(10),id(11),id(1)),undefined);
  const direct=await findOwnedPotentialMatch(f.q,id(10),id(12),id(1));assert.equal(direct.score,70);assert.ok(!('staff_reasoning' in direct));
  assert.equal(await findOwnedPotentialMatch(f.q,id(10),id(12),id(3)),undefined);
  await f.insert(14,'found',310,'Other','');assert.equal((await f.q('select count(*)::int n from updates'))[0].n,notices,'newweak match does not notify');
  await f.insert(15,'found',150,'Other','');assert.equal((await f.q('select count(*)::int n from updates'))[0].n,notices+1);
  await f.q("update potential_matches set score=69 where found_report_id=$1",[id(12)]);
  assert.ok(!(await staff.workspace()).matches.some(m=>m.found_report_id===id(12)));
  assert.ok(!(await student.workspace(owner)).state.matches.some(m=>m.foundId===id(12)));
  assert.equal(await findOwnedPotentialMatch(f.q,id(10),id(12),id(1)),undefined);
  const [m]=await f.q('select id from potential_matches where found_report_id=$1',[id(12)]);
  await f.q("insert into claims(match_id,claimant_id,answers) values($1,$2,'Historical private claim')",[m.id,id(1)]);
  assert.ok((await staff.workspace()).matches.some(x=>x.id===m.id),'claim-linked history retained belowthreshold');
  assert.ok(!rankPotentialMatches((await staff.workspace()).matches).some(x=>x.id===m.id));
  const count=(await f.q('select count(*)::int n from potential_matches'))[0].n;
  await f.db.exec(await readFile(new URL('012_match_threshold_70.sql',folder),'utf8'));
  assert.equal((await f.q('select count(*)::int n from potential_matches'))[0].n,count);
 }finally{await f.db.close();}
});
test('Gemini SQL persistence uses70 withoutidentity cap and suppresses weak student notifications',async()=>{
 const f=await setup();try{
  await f.insert(10,'lost',0,'Other','');await f.insert(11,'found',800,'Other','');
  const rev=async()=>await f.q('select id,ai_report_revision(r) revision from reports r order by id');
  const apply=async(signal:number)=>{const rows=await rev();return(await f.q('select apply_ai_match($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) a',[id(2),id(10),id(11),rows[0].revision,rows[1].revision,JSON.stringify({imageSimilarity:signal}),JSON.stringify({model:'gemini-embedding-2',dimensions:768,channels:['visual']})]))[0].a;};
  const a69=await apply(.85);assert.equal(a69.assessment.score,69);assert.equal(a69.reason,'below-threshold');assert.equal((await f.q('select count(*)::int n from potential_matches'))[0].n,0);
  const a70=await apply(.86);assert.equal(a70.assessment.score,70);assert.equal(a70.applied,true);assert.equal(a70.assessment.ai.used,true);assert.equal((await f.q('select count(*)::int n from updates'))[0].n,1);
  const high=await apply(1);assert.equal(high.assessment.score,80);assert.equal(high.applied,true);
  assert.equal((await f.q('select count(*)::int n from claims'))[0].n,0,'matching never automatically creates or approves a claim');
  const low=await apply(.85);assert.equal(low.assessment.score,69);assert.equal((await adminRepository(f.q).workspace()).matches.length,0);
 }finally{await f.db.close();}
});

test('synthetic demo A/B/C: strong earbuds, missing-brand backpack and authoritative brand rejection',()=>{
 const a=item('lost',{name:'Apple AirPods Pro',category:'Electronics',brand:'Apple',model:'AirPods Pro',color:'Black',description:'Black case with wireless earbuds'});
 const b=item('found',{...a,id:id(11),type:'found',status:'Secured',description:'Wireless earbuds in a black case'});
 assert.ok(isPotentialMatch(assessMatch(a,b)));
 const backpack=item('lost',{name:'Backpack',category:'Bags',brand:'I do not know',color:'Black',location:'Library',lat:40,lng:-83,date:'2026-10-24T12:00:00Z'});
 const found=item('found',{...backpack,id:id(11),type:'found',status:'Secured',brand:'',color:'Dark',location:'Elsewhere',lat:40.01,lng:-83.01});
 assert.ok(isPotentialMatch(assessMatch(backpack,found)));
 assert.equal(assessMatch(a,{...b,brand:'Samsung',model:'Galaxy Buds'},{imageSimilarity:1,semanticSimilarity:1}).eligible,false);
 const conflict=assessMatch(a,{...b,color:'Yellow'}),same=assessMatch(a,b);
 assert.equal(conflict.eligible,true);assert.ok(conflict.score<same.score);
 assert.equal(conflict.factors['Color/details'],0);
});

test('recalculation preserves dismissals, recovery, measured AI, returned states and emits no notices',async()=>{
 const f=await setup();try{
  await f.insert(10,'lost',0,'Other','');await f.insert(11,'found',150,'Other','');
  const staff=adminRepository(f.q);
  const [m]=await f.q('select * from potential_matches');
  await f.q("update potential_matches set score=91,staff_reasoning=staff_reasoning||'{\"ai\":{\"used\":true}}'::jsonb where id=$1",[m.id]);
  const notices=await f.q('select id from updates order by id');
  await staff.recalculateMatches(id(2));assert.equal((await f.q('select score from potential_matches'))[0].score,91);
  await f.q('update potential_matches set dismissed=true where id=$1',[m.id]);
  await staff.recalculateMatches(id(2));assert.equal((await f.q('select dismissed from potential_matches'))[0].dismissed,true);
  await f.q('update potential_matches set dismissed=false where id=$1',[m.id]);
  await f.q("insert into claims(match_id,claimant_id,answers) values($1,$2,'Private synthetic answer')",[m.id,id(1)]);
  assert.equal((await staff.recalculateMatches(id(2))).protected,1);
  await f.q("update reports set status='Returned' where id=any($1::uuid[])",[[id(10),id(11)]]);
  assert.equal((await staff.recalculateMatches(id(2))).evaluated,0);
  assert.equal((await f.q('select count(*)::int n from claims'))[0].n,1);
  assert.deepEqual(await f.q('select id from updates order by id'),notices);
 }finally{await f.db.close();}
});
