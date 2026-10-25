begin;
-- Color is ranking evidence, not proof of a different object. Confirmed brand,
-- model/category/type/identifier contradictions and recovery guards stay hard.
create or replace function matching_candidate_min_score() returns integer language sql immutable as $$ select 35 $$;
create or replace function matching_policy() returns jsonb language sql immutable as $policy$
 select '{"version":"compatibility-v2-color-soft","unknown":["","unknown","not known","not sure","unsure","uncertain","n a","na","none","null","undefined","other","generic","unbranded","no brand","not provided","not specified","not applicable","unidentified","multicolor","multi color","mixed","various","dont know","do not know","dont remember","cannot remember","cant remember","cannot recall","unspecified","unavailable","not recorded","to be determined","tbd"],"brand":{"apple inc":"apple","apple computer":"apple","appple":"apple","samsung electronics":"samsung","sam sung":"samsung","samung":"samsung","nike inc":"nike","addidas":"adidas","adidas ag":"adidas","the north face":"north face","tnf":"north face","jan sport":"jansport","hewlett packard":"hp","h p":"hp","h m":"hm","hydroflask":"hydro flask","fj llr ven":"fjallraven"},"category":{"electronics":"electronics","electronic":"electronics","electronic devices":"electronics","devices":"electronics","clothing":"clothing","clothes":"clothing","apparel":"clothing","wallet":"wallet cards","wallets":"wallet cards","wallets cards":"wallet cards","wallets and cards":"wallet cards","cards":"wallet cards","university id":"wallet cards","student id":"wallet cards","id card":"wallet cards","keys":"keys","key":"keys","keyring":"keys","backpack":"backpack","backpacks":"backpack","bags":"backpack","bags backpacks":"backpack","bag":"backpack","rucksack":"backpack","water bottle":"bottle","water bottles":"bottle","bottle":"bottle","bottles":"bottle","drinkware":"bottle","jewelry":"jewelry","jewellery":"jewelry","school supplies":"supplies","stationery":"supplies","school supply":"supplies","books supplies":"supplies"},"color":{"black":"black","jet black":"black","matte black":"black","white":"white","off white":"cream","ivory":"cream","cream":"cream","blue":"blue","navy":"dark blue","navy blue":"dark blue","dark blue":"dark blue","light blue":"light blue","sky blue":"light blue","gray":"gray","grey":"gray","dark gray":"dark gray","dark grey":"dark gray","charcoal":"dark gray","charcoal gray":"dark gray","light grey":"light gray","light gray":"light gray","silver":"silver","yellow":"yellow","bright yellow":"yellow","gold":"gold","golden":"gold","red":"red","bright red":"red","maroon":"dark red","burgundy":"dark red","dark red":"dark red","green":"green","dark green":"dark green","forest green":"dark green","olive":"dark green","brown":"brown","dark brown":"brown","tan":"tan","beige":"tan","orange":"orange","pink":"pink","purple":"purple","violet":"purple"},"colorFamily":{"dark blue":"blue","light blue":"blue","dark gray":"gray","light gray":"gray","dark red":"red","dark green":"green"},"colorNeighbors":[["black","dark blue"],["black","dark gray"],["gray","silver"],["white","cream"],["brown","tan"],["yellow","gold"]],"model":{"airpodspro":"airpods pro","airpodspro2":"airpods pro 2","airpods pro ii":"airpods pro 2","galaxybuds":"galaxy buds","galaxy buds2":"galaxy buds 2","galaxy buds2 pro":"galaxy buds 2 pro","iphone13":"iphone 13","iphone14":"iphone 14","iphone15":"iphone 15","iphone16":"iphone 16"},"modelFamilies":["airpods","airpods pro","galaxy buds","iphone","ipad","macbook","macbook pro","surface","thinkpad"],"genericModels":["earbuds","wireless earbuds","headphones","phone","smartphone","laptop","computer","backpack","bag","wallet","bottle","water bottle","case","pro","standard","regular"],"itemTypes":{"audio":["earbuds","earbud","earphones","headphones","headphone","airpods","air pods","galaxy buds","headset"],"phone":["phone","smartphone","iphone"],"laptop":["laptop","macbook","notebook computer","thinkpad"],"tablet":["tablet","ipad"],"backpack":["backpack","rucksack"],"wallet":["wallet","bifold"],"bottle":["bottle","flask"],"keys":["keys","keyring","keychain"],"id card":["student id","id card","access card"],"ring":["ring"],"necklace":["necklace"],"jacket":["jacket","coat"],"shoes":["shoes","sneakers","trainers"],"umbrella":["umbrella"]},"identifierKinds":{"serial":"serial","serial number":"serial","imei":"imei","asset tag":"asset tag","device id":"device id"}}'::jsonb
$policy$;
create or replace function evaluate_report_match(l jsonb,f jsonb,signals jsonb default '{}') returns jsonb language plpgsql stable as $$
declare a jsonb:=matching_normalized(l);b jsonb:=matching_normalized(f); contradictions jsonb:='[]'; reasons jsonb:='[]';
 k text; av text; bv text; factors jsonb:='{}'; weights jsonb:='{}'; attrs float[]:='{}'; val float; lexical float; semantic float; image float;
 lat1 float:=matching_number(l,'lat');lng1 float:=matching_number(l,'lng');lat2 float:=matching_number(f,'lat');lng2 float:=matching_number(f,'lng');
 dist float; mins integer:=matching_minutes(l->>'date',f->>'date'); numerator float:=0; denominator float:=0; score integer; result jsonb;
begin
 foreach k in array array['category','type','brand','model'] loop
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
  factors:=factors||jsonb_build_object('Color/details',case when a->>'color'=b->>'color' then 100 when matching_colors_compatible(a->>'color',b->>'color') then 90 else 0 end);weights:=weights||jsonb_build_object('Color/details',10);reasons:=reasons||jsonb_build_array(case when matching_colors_compatible(a->>'color',b->>'color') then 'Compatible color' else 'Different reported colors; staff verification required' end);
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

-- Staff-only idempotent deterministic recalculation. No Google egress, report
-- rewrites, claim changes, pass changes, or student notices. AI assessments on
-- unchanged eligible pairs and all explicit/historical dismissals are retained.
create or replace function recalculate_potential_matches(p_staff uuid) returns jsonb language plpgsql as $$
declare l reports;f reports;m potential_matches;a jsonb;
 evaluated integer:=0;eligible_count integer:=0;inserted integer:=0;updated integer:=0;rejected integer:=0;protected_count integer:=0;
begin
 if not exists(select 1 from users where id=p_staff and role='admin') then raise exception 'Access denied';end if;
 perform pg_advisory_xact_lock(hashtext('magpie-recalculate-matches'));
 -- Use the existing report-before-match lock order. Active recovery states are
 -- rechecked after locks, preventing stale reevaluation from reopening returns.
 perform 1 from reports where status not in ('Returned','Archived','Ready for Pickup') order by report_type desc,id for update;
 for l in select * from reports where report_type='lost' and status not in ('Returned','Archived','Ready for Pickup') order by id loop
  for f in select * from reports where report_type='found' and status not in ('Returned','Archived','Ready for Pickup') order by id loop
   select * into m from potential_matches where lost_report_id=l.id and found_report_id=f.id for update;
   if m.dismissed or exists(select 1 from claims c join potential_matches pm on pm.id=c.match_id where c.status not in ('Rejected','Returned') and (pm.lost_report_id=l.id or pm.found_report_id=f.id)) then
    protected_count:=protected_count+1;continue;
   end if;
   evaluated:=evaluated+1;
   a:=evaluate_report_match(report_matching_input(l),report_matching_input(f));
   if not (a->>'eligible')::boolean or (a->>'score')::int<matching_candidate_min_score() then
    -- Existing measured AI can legitimately lift a compatible deterministic pair
    -- above threshold. Keep that measured result if reports are unchanged.
    if (a->>'eligible')::boolean and coalesce(m.staff_reasoning->'ai'->>'used','false')='true' and m.score>=matching_candidate_min_score() then
     eligible_count:=eligible_count+1;continue;
    end if;
    rejected:=rejected+1;
    if m.id is not null then update potential_matches set dismissed=true,score=(a->>'score')::int,factors=a->'factors',staff_reasoning=a where id=m.id;end if;
    continue;
   end if;
   eligible_count:=eligible_count+1;
   if m.id is null then
    insert into potential_matches(lost_report_id,found_report_id,score,factors,distance_km,minutes_difference,staff_reasoning)
    values(l.id,f.id,(a->>'score')::int,a->'factors',(a->>'distance')::float,(a->>'minutes')::int,a)
    on conflict(lost_report_id,found_report_id) do nothing;
    if found then inserted:=inserted+1;end if;
   elsif coalesce(m.staff_reasoning->'ai'->>'used','false')<>'true' then
    update potential_matches set score=(a->>'score')::int,factors=a->'factors',distance_km=(a->>'distance')::float,minutes_difference=(a->>'minutes')::int,staff_reasoning=a where id=m.id;
    updated:=updated+1;
   end if;
  end loop;
 end loop;
 return jsonb_build_object('evaluated',evaluated,'eligible',eligible_count,'inserted',inserted,'updated',updated,'rejectedOrBelowThreshold',rejected,'protected',protected_count);
end $$;
-- Upgrade existing reports once using an existing authorized staff identity.
-- An empty fresh database needs no backfill; future report triggers use35.
do $$ declare staff uuid;begin
 select id into staff from users where role='admin' order by created_at,id limit 1;
 if staff is not null then perform recalculate_potential_matches(staff);end if;
end $$;
commit;
