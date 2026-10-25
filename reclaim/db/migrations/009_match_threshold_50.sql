begin;
-- Forward-only behavior change. No tables/columns or auth/recovery policies change.
create or replace function matching_candidate_min_score() returns integer language sql immutable as $$ select 50 $$;
create or replace function matching_notice_min_score() returns integer language sql immutable as $$ select 60 $$;
create or replace function evaluate_report_match(l jsonb,f jsonb,signals jsonb default '{}') returns jsonb language plpgsql stable as $$
declare a jsonb:=matching_normalized(l);b jsonb:=matching_normalized(f); contradictions jsonb:='[]'; reasons jsonb:='[]';
 k text; av text; bv text; factors jsonb:='{}'; weights jsonb:='{}'; attrs float[]:='{}'; val float; lexical float; semantic float; image float;
 lat1 float:=matching_number(l,'lat');lng1 float:=matching_number(l,'lng');lat2 float:=matching_number(f,'lat');lng2 float:=matching_number(f,'lng');
 dist float; mins integer:=matching_minutes(l->>'date',f->>'date'); numerator float:=0; denominator float:=0; score integer; result jsonb;
begin
 foreach k in array array['category','type','brand','model','color'] loop
  av:=a->>k;bv:=b->>k;
  if av is not null and bv is not null and not(case k when 'model' then matching_models_compatible(av,bv) when 'color' then matching_colors_compatible(av,bv) else av=bv end) then
   contradictions:=contradictions||jsonb_build_array(initcap(k)||' mismatch: '||av||' versus '||bv);
  end if;
 end loop;
 for k in select key from jsonb_each(a->'identifiers') order by key loop
  if b->'identifiers'->>k is not null and a->'identifiers'->>k<>b->'identifiers'->>k then contradictions:=contradictions||jsonb_build_array('Conflicting identifier: '||k);end if;
 end loop;
 if l->>'status' in ('Returned','Archived','Ready for Pickup') or f->>'status' in ('Returned','Archived','Ready for Pickup') then contradictions:=contradictions||jsonb_build_array('Report is closed or assigned');end if;
 if l->>'type' is distinct from 'lost' or f->>'type' is distinct from 'found' then contradictions:=contradictions||jsonb_build_array('Expected a lost and found pair');end if;
 if lat1 between -90 and 90 and lat2 between -90 and 90 and lng1 between -180 and 180 and lng2 between -180 and 180 then
  dist:=6371*2*asin(least(1,greatest(0,sqrt(power(sin(radians(lat2-lat1)/2),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2)))));
 end if;
 result:=jsonb_build_object('eligible',jsonb_array_length(contradictions)=0,'contradictions',contradictions,'distance',dist,'minutes',coalesce(mins,0),'policyVersion',matching_policy()->>'version');
 if jsonb_array_length(contradictions)>0 then return result||jsonb_build_object('score',0,'classification','no_match','factors','{}'::jsonb,'matchingFactors','[]'::jsonb);end if;
 foreach k in array array['category','type','brand','model'] loop
  if a->>k is not null and b->>k is not null then
   attrs:=array_append(attrs,case when k='model' and replace(a->>k,' ','')<>replace(b->>k,' ','') then 85 else 100 end::float);
   reasons:=reasons||jsonb_build_array(case when k='model' then 'Compatible model' else 'Same '||k end);
  end if;
 end loop;
 if cardinality(attrs)>0 then
  select floor(avg(v)+0.5) into val from unnest(attrs) v;
  factors:=factors||jsonb_build_object('Brand & category',val);weights:=weights||jsonb_build_object('Brand & category',20);
 end if;
 if a->>'color' is not null and b->>'color' is not null then
  factors:=factors||jsonb_build_object('Color/details',case when a->>'color'=b->>'color' then 100 else 90 end);weights:=weights||jsonb_build_object('Color/details',10);reasons:=reasons||jsonb_build_array('Compatible color');
 end if;
 if matching_known(l->>'description') is not null and matching_known(f->>'description') is not null and cardinality(matching_tokens(l->>'description'))>0 and cardinality(matching_tokens(f->>'description'))>0 then lexical:=matching_description(coalesce(l->>'name','')||' '||(l->>'description'),coalesce(f->>'name','')||' '||(f->>'description'))*100;end if;
 semantic:=matching_number(signals,'semanticSimilarity');if semantic not between 0 and 1 then semantic:=null;end if;
 image:=matching_number(signals,'imageSimilarity');if image not between 0 and 1 then image:=null;end if;
 val:=case when lexical is null then semantic*100 when semantic is null then lexical else (lexical+semantic*100)/2 end;
 if val is not null then
  factors:=factors||jsonb_build_object('Description',floor(val+0.5));weights:=weights||jsonb_build_object('Description',20);
  if val>=60 then reasons:=reasons||jsonb_build_array('Similar description');end if;
 end if;
 if image is not null then
  factors:=factors||jsonb_build_object('Image similarity',floor(image*100+0.5));weights:=weights||jsonb_build_object('Image similarity',30);
  if image>=0.6 then reasons:=reasons||jsonb_build_array('Similar images');end if;
 end if;
 if dist is not null then factors:=factors||jsonb_build_object('Location',floor(greatest(35,100-dist*24)+0.5));weights:=weights||jsonb_build_object('Location',10);end if;
 if mins is not null then factors:=factors||jsonb_build_object('Time',floor(greatest(20,100-abs(mins)/10.0)+0.5));weights:=weights||jsonb_build_object('Time',10);end if;
 for k in select key from jsonb_each(factors) order by key loop numerator:=numerator+(factors->>k)::float*(weights->>k)::float;denominator:=denominator+(weights->>k)::float;end loop;
 score:=case when denominator>0 then least(99,floor(numerator/denominator+0.5)) else 0 end;
 return result||jsonb_build_object('score',score,'classification',matching_classification(score),'factors',factors,'matchingFactors',reasons);
end $$;
create or replace function refresh_report_matches() returns trigger language plpgsql as $$
declare l reports;f reports;candidate reports;assessment jsonb;mid uuid;
begin
 if new.status in ('Returned','Archived','Ready for Pickup') then return new;end if;
 for candidate in select * from reports where report_type<>new.report_type and status not in ('Returned','Archived','Ready for Pickup') order by id loop
  if new.report_type='lost' then l:=new;f:=candidate;else l:=candidate;f:=new;end if;
  assessment:=evaluate_report_match(report_matching_input(l),report_matching_input(f));
  if not (assessment->>'eligible')::boolean or (assessment->>'score')::int<matching_candidate_min_score() then
   update potential_matches set dismissed=true,score=(assessment->>'score')::int,factors=assessment->'factors',staff_reasoning=assessment where lost_report_id=l.id and found_report_id=f.id;
   continue;
  end if;
  mid:=null;
  insert into potential_matches(lost_report_id,found_report_id,score,factors,distance_km,minutes_difference,staff_reasoning)
   values(l.id,f.id,(assessment->>'score')::int,assessment->'factors',(assessment->>'distance')::float,(assessment->>'minutes')::int,assessment)
   on conflict(lost_report_id,found_report_id) do nothing returning id into mid;
  if mid is not null then
   if (assessment->>'score')::int>=matching_notice_min_score() then
   insert into updates(user_id,report_id,match_id,title,message) values(l.reporter_id,l.id,mid,'Possible match','Magpie found a possible match. Review it privately in Updates.');
   end if;
  else
   -- Preserve manual/historical dismissal. Never change claims or pickup state.
   update potential_matches set score=(assessment->>'score')::int,factors=assessment->'factors',distance_km=(assessment->>'distance')::float,minutes_difference=(assessment->>'minutes')::int,staff_reasoning=assessment where lost_report_id=l.id and found_report_id=f.id;
  end if;
 end loop;
 return new;
end $$;
create or replace function apply_ai_match(p_staff uuid,p_lost uuid,p_found uuid,p_lrev text,p_frev text,p_signals jsonb,p_meta jsonb)
returns jsonb language plpgsql as $$
declare l reports;f reports;m potential_matches;a jsonb;mid uuid;measured boolean;semantic float;image float;
 defaults jsonb:='{"Image similarity":30,"Description":20,"Brand & category":20,"Color/details":10,"Location":10,"Time":10}';
 weights jsonb:='{}';k text;w float;n float:=0;d float:=0;score int;channels jsonb:='[]';
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
  end loop;
  score:=case when d>0 then least(99,floor(n/d+0.5)::int) else 0 end;
  a:=a||jsonb_build_object('score',score,'classification',matching_classification(score),'ai',jsonb_build_object('used',true,'provider','google','model','gemini-embedding-2','dimensions',768,'channels',channels,'weights',weights,'scoringVersion','gemini-v1','demoOnly',true,'confirmedBy',p_staff,'assessedAt',clock_timestamp()));
 end if;
 if (a->>'score')::int<matching_candidate_min_score() then
  if m.id is not null then update potential_matches set score=(a->>'score')::int,factors=a->'factors',staff_reasoning=a,dismissed=true where id=m.id;end if;
  return jsonb_build_object('applied',m.id is not null,'reason','below-threshold','assessment',a);
 end if;
 insert into potential_matches(lost_report_id,found_report_id,score,factors,distance_km,minutes_difference,staff_reasoning)
 values(l.id,f.id,(a->>'score')::int,a->'factors',(a->>'distance')::float,(a->>'minutes')::int,a)
 on conflict(lost_report_id,found_report_id) do nothing returning id into mid;
 if mid is not null then
  if (a->>'score')::int>=matching_notice_min_score() then
  insert into updates(user_id,report_id,match_id,title,message) values(l.reporter_id,l.id,mid,'Possible match','Magpie found a possible match. Review it privately in Updates.');
  end if;
 else
  update potential_matches set score=(a->>'score')::int,factors=a->'factors',distance_km=(a->>'distance')::float,minutes_difference=(a->>'minutes')::int,staff_reasoning=a where lost_report_id=l.id and found_report_id=f.id;
 end if;
 return jsonb_build_object('applied',true,'reason',case when measured then 'measured' else 'deterministic-fallback' end,'assessment',a);
end $$;

-- Reassess existing deterministic active pairs silently. Keep AI provenance/scores,
-- manual/historical dismissals, recovery/closed history and all claims intact.
with assessments as materialized (
 select m.id,evaluate_report_match(report_matching_input(l),report_matching_input(f)) a
 from potential_matches m join reports l on l.id=m.lost_report_id join reports f on f.id=m.found_report_id
 where l.status not in ('Returned','Archived','Ready for Pickup') and f.status not in ('Returned','Archived','Ready for Pickup')
 and coalesce(m.staff_reasoning->'ai'->>'used','false')<>'true'
)
update potential_matches m set staff_reasoning=s.a,score=(s.a->>'score')::int,factors=s.a->'factors',
 distance_km=(s.a->>'distance')::float,minutes_difference=(s.a->>'minutes')::int,
 dismissed=m.dismissed or not (s.a->>'eligible')::boolean or (s.a->>'score')::int<matching_candidate_min_score()
from assessments s where m.id=s.id;
-- Newly eligible50+ pairs were never persisted under the old60 cutoff.
-- Discover them without report rewrites, provider calls or student notifications.
with candidates as materialized (
 select l.id lost_id,f.id found_id,evaluate_report_match(report_matching_input(l),report_matching_input(f)) a
 from reports l join reports f on l.report_type='lost' and f.report_type='found'
 where l.status not in ('Returned','Archived','Ready for Pickup') and f.status not in ('Returned','Archived','Ready for Pickup')
 and not exists(select 1 from potential_matches m where m.lost_report_id=l.id and m.found_report_id=f.id)
)
insert into potential_matches(lost_report_id,found_report_id,score,factors,distance_km,minutes_difference,staff_reasoning)
select lost_id,found_id,(a->>'score')::int,a->'factors',(a->>'distance')::float,(a->>'minutes')::int,a
from candidates where (a->>'eligible')::boolean and (a->>'score')::int>=matching_candidate_min_score()
on conflict(lost_report_id,found_report_id) do nothing;
commit;
