import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {adminRepository} from '../lib/server/adminRepository';
const id=(n:number)=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`;
test('011 repairs existing short/qualified models; both insert orders auto-persist; hard variants and brands remain excluded',async()=>{
 const db=new PGlite(),folder=new URL('../db/migrations/',import.meta.url);
 const q=async(s:string,args:any[]=[]) =>(await db.query(s,args)).rows as any[];
 try{
  for(const f of(await readdir(folder)).filter(f=>f.endsWith('.sql')&&f<'011_').sort())await db.exec(await readFile(new URL(f,folder),'utf8'));
  await q("insert into users(id,email,display_name,role) values($1,'student@example.test','Synthetic','student'),($2,'staff@example.test','Staff','admin')",[id(1),id(2)]);
  const insert=async(n:number,type:string,model:string,brand='Apple',description='Synthetic phone with a plain protective case')=>q("insert into reports(id,reporter_id,report_type,category,item_name,brand,model,primary_color,description,lost_date,lost_time,occurred_at,status) values($1,$2,$3,'Electronics','Phone',$4,$5,'Black',$6,'2026-10-24','12:00','2026-10-24T12:00:00Z',$7)",[id(n),type==='lost'?id(1):id(2),type,brand,model,description,type==='lost'?'Matching':'Secured']);
  await insert(10,'lost','15 Pro Max');await insert(11,'found','iPhone 15 Pro Max');
  assert.equal((await q('select count(*)::int n from potential_matches'))[0].n,0,'reproduces deployed rejection');
  const before=await q('select id,status from reports order by id'),notices=await q('select id from updates order by id');
  await db.exec(await readFile(new URL('011_phone_model_family.sql',folder),'utf8'));
  assert.deepEqual(await q('select id,status from reports order by id'),before);
  assert.deepEqual(await q('select id from updates order by id'),notices);
  const [repaired]=await q('select * from potential_matches');assert.equal(repaired.score,99);assert.equal(repaired.staff_reasoning.eligible,true);
  await insert(12,'found','15 Pro Max','Apple','Plain protective shell around a synthetic handset');
  assert.ok((await q('select * from potential_matches where found_report_id=$1',[id(12)])).length);
  await insert(13,'lost','iPhone 15 Pro Max');
  assert.equal((await q('select count(*)::int n from potential_matches where lost_report_id=$1',[id(13)]))[0].n,2);
  await insert(14,'found','iPhone 15 Pro');await insert(15,'found','Galaxy S24','Samsung');
  assert.equal((await q('select count(*)::int n from potential_matches where found_report_id=any($1::uuid[])',[[id(14),id(15)]]))[0].n,0);
  const count=(await q('select count(*)::int n from potential_matches'))[0].n;
  await adminRepository(q).recalculateMatches(id(2));await db.exec(await readFile(new URL('011_phone_model_family.sql',folder),'utf8'));
  assert.equal((await q('select count(*)::int n from potential_matches'))[0].n,count);
  assert.equal((await q('select matching_candidate_min_score() n'))[0].n,35);
 }finally{await db.close();}
});
