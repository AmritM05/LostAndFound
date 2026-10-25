begin;
-- No vector table: transient embeddings stay server-side in bounded memory.
create or replace function ai_report_revision(r reports) returns text language sql stable as $$
 select md5(to_jsonb(r)::text||coalesce((select jsonb_agg(jsonb_build_array(i.id,i.owner_id,i.upload_role,i.status,i.blob_pathname,i.preview_pathname,i.preview_url,i.mime_type,i.byte_size) order by i.id)::text from report_images i where i.report_id=r.id),''))
$$;
create or replace function apply_ai_match(p_staff uuid,p_lost uuid,p_found uuid,p_lrev text,p_frev text,p_signals jsonb,p_meta jsonb)
returns jsonb language plpgsql as $$
declare l reports;f reports;m potential_matches;a jsonb;mid uuid;measured boolean;semantic float;image float;
 defaults jsonb:='{"Image similarity":30,"Description":20,"Brand & category":20,"Color/details":10,"Location":10,"Time":10}';
 weights jsonb:='{}';k text;w float;n float:=0;d float:=0;identity_count int:=0;score int;channels jsonb:='[]';
begin
 if not exists(select 1 from users where id=p_staff and role='admin') then raise exception 'Access denied';end if;
 perform 1 from reports where id in(p_lost,p_found) order by report_type desc,id for update;
 select * into l from reports where id=p_lost and report_type='lost';
 select * into f from reports where id=p_found and report_type='found';
 if l.id is null or f.id is null then return jsonb_build_object('applied',false,'reason','unavailable');end if;
 if ai_report_revision(l) is distinct from p_lrev or ai_report_revision(f) is distinct from p_frev then return jsonb_build_object('applied',false,'reason','stale-report');end if;
 -- Recheck contradictions/current lifecycle after inference; client scores are never trusted.
 a:=evaluate_report_match(report_matching_input(l),report_matching_input(f),p_signals);
 if not (a->>'eligible')::boolean then return jsonb_build_object('applied',false,'reason','incompatible','assessment',a);end if;
 select * into m from potential_matches where lost_report_id=l.id and found_report_id=f.id for update;
 if m.dismissed then return jsonb_build_object('applied',false,'reason','dismissed');end if;
 if exists(select 1 from claims c join potential_matches pm on pm.id=c.match_id where c.status not in ('Rejected','Returned') and (pm.lost_report_id=l.id or pm.found_report_id=f.id)) then return jsonb_build_object('applied',false,'reason','active-recovery');end if;
 semantic:=matching_number(p_signals,'semanticSimilarity');image:=matching_number(p_signals,'imageSimilarity');
 measured:=(coalesce(semantic between 0 and 1,false) or coalesce(image between 0 and 1,false));
 if measured then
  if p_meta->>'model' is distinct from 'gemini-embedding-2' or p_meta->>'dimensions' is distinct from '768' then raise exception 'Invalid AI provenance';end if;
  if semantic between 0 and 1 then channels:=channels||jsonb_build_array('semantic');end if;
  if image between 0 and 1 then channels:=channels||jsonb_build_array(case when coalesce(p_meta->'channels','[]') ? 'image-to-text' then 'image-to-text' else 'visual' end);end if;
  for k in select key from jsonb_each(a->'factors') loop
   w:=matching_number(coalesce(p_meta->'weights','{}'),k);
   if w is null or w<=0 or w>100 then w:=(defaults->>k)::float;end if;
   if w is not null then n:=n+(a->'factors'->>k)::float*w;d:=d+w;weights:=weights||jsonb_build_object(k,w);end if;
   if k in ('Brand & category','Color/details','Description','Image similarity') then identity_count:=identity_count+1;end if;
  end loop;
  score:=case when d>0 then least(99,floor(n/d+0.5)::int) else 0 end;
  if identity_count<2 then score:=least(score,59);end if;
  a:=a||jsonb_build_object('score',score,'classification',matching_classification(score),'ai',jsonb_build_object('used',true,'provider','google','model','gemini-embedding-2','dimensions',768,'channels',channels,'weights',weights,'scoringVersion','gemini-v1','demoOnly',true,'confirmedBy',p_staff,'assessedAt',clock_timestamp()));
 end if;
 if (a->>'score')::int<60 then
  if m.id is not null then update potential_matches set score=(a->>'score')::int,factors=a->'factors',staff_reasoning=a,dismissed=true where id=m.id;end if;
  return jsonb_build_object('applied',m.id is not null,'reason','below-threshold','assessment',a);
 end if;
 insert into potential_matches(lost_report_id,found_report_id,score,factors,distance_km,minutes_difference,staff_reasoning)
 values(l.id,f.id,(a->>'score')::int,a->'factors',(a->>'distance')::float,(a->>'minutes')::int,a)
 on conflict(lost_report_id,found_report_id) do nothing returning id into mid;
 if mid is not null then
  insert into updates(user_id,report_id,match_id,title,message) values(l.reporter_id,l.id,mid,'Possible match','Magpie found a possible match. Review it privately in Updates.');
 else
  update potential_matches set score=(a->>'score')::int,factors=a->'factors',distance_km=(a->>'distance')::float,minutes_difference=(a->>'minutes')::int,staff_reasoning=a where lost_report_id=l.id and found_report_id=f.id;
 end if;
 return jsonb_build_object('applied',true,'reason',case when measured then 'measured' else 'deterministic-fallback' end,'assessment',a);
end $$;
commit;
