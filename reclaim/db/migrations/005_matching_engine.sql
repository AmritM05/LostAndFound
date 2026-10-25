begin;
-- MAG-001/002: compatibility before ranking. No recovery/auth function replacement.
-- Keep policy synchronized with services/matchingPolicy.json; parity tests compare it.
create or replace function matching_policy() returns jsonb language sql immutable as $policy$
 select '{"version":"compatibility-v1","unknown":["","unknown","not known","not sure","unsure","uncertain","n a","na","none","null","undefined","other","generic","unbranded","no brand","not provided","not specified","not applicable","unidentified","multicolor","multi color","mixed","various"],"brand":{"apple inc":"apple","apple computer":"apple","appple":"apple","samsung electronics":"samsung","sam sung":"samsung","samung":"samsung","nike inc":"nike","addidas":"adidas","adidas ag":"adidas","the north face":"north face","tnf":"north face","jan sport":"jansport","hewlett packard":"hp","h p":"hp","h m":"hm","hydroflask":"hydro flask","fj llr ven":"fjallraven"},"category":{"electronics":"electronics","electronic":"electronics","electronic devices":"electronics","devices":"electronics","clothing":"clothing","clothes":"clothing","apparel":"clothing","wallet":"wallet cards","wallets":"wallet cards","wallets cards":"wallet cards","wallets and cards":"wallet cards","cards":"wallet cards","university id":"wallet cards","student id":"wallet cards","id card":"wallet cards","keys":"keys","key":"keys","keyring":"keys","backpack":"backpack","backpacks":"backpack","bags":"backpack","bags backpacks":"backpack","bag":"backpack","rucksack":"backpack","water bottle":"bottle","water bottles":"bottle","bottle":"bottle","bottles":"bottle","drinkware":"bottle","jewelry":"jewelry","jewellery":"jewelry","school supplies":"supplies","stationery":"supplies","school supply":"supplies","books supplies":"supplies"},"color":{"black":"black","jet black":"black","matte black":"black","white":"white","off white":"cream","ivory":"cream","cream":"cream","blue":"blue","navy":"dark blue","navy blue":"dark blue","dark blue":"dark blue","light blue":"light blue","sky blue":"light blue","gray":"gray","grey":"gray","dark gray":"dark gray","dark grey":"dark gray","charcoal":"dark gray","charcoal gray":"dark gray","light grey":"light gray","light gray":"light gray","silver":"silver","yellow":"yellow","bright yellow":"yellow","gold":"gold","golden":"gold","red":"red","bright red":"red","maroon":"dark red","burgundy":"dark red","dark red":"dark red","green":"green","dark green":"dark green","forest green":"dark green","olive":"dark green","brown":"brown","dark brown":"brown","tan":"tan","beige":"tan","orange":"orange","pink":"pink","purple":"purple","violet":"purple"},"colorFamily":{"dark blue":"blue","light blue":"blue","dark gray":"gray","light gray":"gray","dark red":"red","dark green":"green"},"colorNeighbors":[["black","dark blue"],["black","dark gray"],["gray","silver"],["white","cream"],["brown","tan"],["yellow","gold"]],"model":{"airpodspro":"airpods pro","airpodspro2":"airpods pro 2","airpods pro ii":"airpods pro 2","galaxybuds":"galaxy buds","galaxy buds2":"galaxy buds 2","galaxy buds2 pro":"galaxy buds 2 pro","iphone13":"iphone 13","iphone14":"iphone 14","iphone15":"iphone 15","iphone16":"iphone 16"},"modelFamilies":["airpods","airpods pro","galaxy buds","iphone","ipad","macbook","macbook pro","surface","thinkpad"],"genericModels":["earbuds","wireless earbuds","headphones","phone","smartphone","laptop","computer","backpack","bag","wallet","bottle","water bottle","case","pro","standard","regular"],"itemTypes":{"audio":["earbuds","earbud","earphones","headphones","headphone","airpods","air pods","galaxy buds","headset"],"phone":["phone","smartphone","iphone"],"laptop":["laptop","macbook","notebook computer","thinkpad"],"tablet":["tablet","ipad"],"backpack":["backpack","rucksack"],"wallet":["wallet","bifold"],"bottle":["bottle","flask"],"keys":["keys","keyring","keychain"],"id card":["student id","id card","access card"],"ring":["ring"],"necklace":["necklace"],"jacket":["jacket","coat"],"shoes":["shoes","sneakers","trainers"],"umbrella":["umbrella"]},"identifierKinds":{"serial":"serial","serial number":"serial","imei":"imei","asset tag":"asset tag","device id":"device id"}}'::jsonb
$policy$;
create or replace function matching_text(v text) returns text language sql immutable as $$
 select trim(regexp_replace(regexp_replace(lower(coalesce(v,'')),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))
$$;
create or replace function matching_known(v text) returns text language plpgsql immutable as $$
declare t text:=matching_text(v);
begin
 if v is null or v ~* '[?\/]|\m(maybe|possibly|probably|uncertain|unsure|unknown|guess|guessed)\M' or matching_policy()->'unknown' ? t then return null;end if;
 return t;
end $$;
create or replace function matching_attribute(kind text,v text) returns text language sql immutable as $$
 select case when kind='brand' and (matching_known(v) ~ '\m(and|or|either|not)\M' or (position('&' in v)>0 and matching_policy()->'brand'->>matching_known(v) is null)) then null else coalesce(matching_policy()->kind->>matching_known(v),case when kind='brand' then matching_known(v) end) end
$$;
create or replace function matching_model(v text,brand text,name text) returns text language plpgsql immutable as $$
declare t text:=matching_known(v); prefix text; recognized boolean;
begin
 if t is null then return null;end if;
 if t ~ '\m(or|either|not)\M' then return null;end if;
 t:=regexp_replace(t,'\mair pods\M','airpods','g');
 t:=regexp_replace(t,'\m(first|1st) (gen|generation)\M','1','g');
 t:=regexp_replace(t,'\m(second|2nd) (gen|generation)\M','2','g');
 t:=regexp_replace(t,'\m(third|3rd) (gen|generation)\M','3','g');
 t:=regexp_replace(t,'\m(fourth|4th) (gen|generation)\M','4','g');
 t:=regexp_replace(t,'\m(gen|generation) ?([1-4])\M','\2','g');
 foreach prefix in array array[matching_known(brand),matching_attribute('brand',brand)] loop
  if prefix is not null and left(t,length(prefix)+1)=prefix||' ' then t:=substr(t,length(prefix)+2);end if;
 end loop;
 t:=coalesce(matching_policy()->'model'->>t,t);
 if matching_policy()->'genericModels' ? t then return null;end if;
 select exists(select 1 from jsonb_array_elements_text(matching_policy()->'modelFamilies') f where t=f or left(t,length(f)+1)=f||' ') into recognized;
 if not recognized and t !~ '[0-9]' and t=matching_text(name) then return null;end if;
 return t;
end $$;
create or replace function matching_models_compatible(a text,b text) returns boolean language sql immutable as $$
 select replace(a,' ','')=replace(b,' ','') or exists(select 1 from jsonb_array_elements_text(matching_policy()->'modelFamilies') f where (a=f and left(b,length(f)+1)=f||' ') or (b=f and left(a,length(f)+1)=f||' '))
$$;
create or replace function matching_colors_compatible(a text,b text) returns boolean language sql immutable as $$
 select coalesce(matching_policy()->'colorFamily'->>a,a)=coalesce(matching_policy()->'colorFamily'->>b,b) or exists(select 1 from jsonb_array_elements(matching_policy()->'colorNeighbors') pair where pair ? a and pair ? b)
$$;
create or replace function matching_item_type(v text) returns text language plpgsql immutable as $$
declare t text:=matching_known(v); types text[];
begin
 if t is null or t ~ '\m(case|cover)\M' then return null;end if;
 select array_agg(key) into types from jsonb_each(matching_policy()->'itemTypes') e where exists(select 1 from jsonb_array_elements_text(e.value) w where position(' '||w||' ' in ' '||t||' ')>0);
 if cardinality(types)=1 then return types[1];end if;
 return null;
end $$;
create or replace function matching_identifiers(p jsonb) returns jsonb language plpgsql immutable as $$
declare k text; v jsonb; kind text; t text; result jsonb:='{}'; conflicted text[]:='{}';
begin
 if coalesce(p->'uncertainAttributes','[]') ? 'identifiers' or jsonb_typeof(p->'identifiers') is distinct from 'object' then return result;end if;
 for k,v in select key,value from jsonb_each(p->'identifiers') loop
  kind:=matching_policy()->'identifierKinds'->>matching_text(k);
  t:=matching_known(case when jsonb_typeof(v)='string' then v#>>'{}' end);
  if kind is not null and t is not null and not kind=any(conflicted) then
   t:=replace(t,' ','');
   if result ? kind and result->>kind<>t then result:=result-kind;conflicted:=array_append(conflicted,kind);
   else result:=result||jsonb_build_object(kind,t);end if;
  end if;
 end loop;return result;
end $$;
create or replace function matching_normalized(p jsonb) returns jsonb language plpgsql immutable as $$
declare result jsonb; k text;
begin
 result:=jsonb_build_object('category',matching_attribute('category',p->>'category'),'type',matching_item_type(p->>'name'),'brand',matching_attribute('brand',p->>'brand'),'model',matching_model(p->>'model',p->>'brand',p->>'name'),'color',matching_attribute('color',p->>'color'),'identifiers',matching_identifiers(p));
 for k in select jsonb_array_elements_text(coalesce(p->'uncertainAttributes','[]')) loop
  if k in ('category','type','brand','model','color') then result:=jsonb_set(result,array[k],'null');end if;
 end loop;
 return result;
end $$;
create or replace function matching_tokens(v text) returns text[] language sql immutable as $$
 select array_agg(distinct case t when 'clip' then 'keychain' when 'silicone' then 'case' when 'grey' then 'gray' else t end) from regexp_split_to_table(matching_text(v),'\s+') t where length(t)>2
$$;
create or replace function matching_description(a text,b text) returns float language sql immutable as $$
 with x as (select unnest(matching_tokens(a)) t), y as (select unnest(matching_tokens(b)) t)
 select coalesce(2.0*(select count(*) from x join y using(t))/nullif((select count(*) from x)+(select count(*) from y),0),0)::float
$$;
create or replace function matching_number(p jsonb,k text) returns float language sql immutable as $$
 select case when jsonb_typeof(p->k)='number' then (p->>k)::float end
$$;
create or replace function matching_minutes(a text,b text) returns integer language plpgsql stable as $$
begin return floor(extract(epoch from (b::timestamptz-a::timestamptz))/60+0.5)::integer;
exception when others then return null;
end $$;
create or replace function matching_classification(score integer) returns text language sql immutable as $$
 select case when score>=90 then 'very_strong_match' when score>=75 then 'strong_match' when score>=60 then 'possible_match' else 'weak_match' end
$$;
-- Staff-only reasoning is never embedded in numeric factors or student/public DTOs.
create or replace function evaluate_report_match(l jsonb,f jsonb,signals jsonb default '{}') returns jsonb language plpgsql stable as $$
declare a jsonb:=matching_normalized(l);b jsonb:=matching_normalized(f); contradictions jsonb:='[]'; reasons jsonb:='[]';
 k text; av text; bv text; factors jsonb:='{}'; weights jsonb:='{}'; attrs float[]:='{}'; val float; lexical float; semantic float; image float;
 lat1 float:=matching_number(l,'lat');lng1 float:=matching_number(l,'lng');lat2 float:=matching_number(f,'lat');lng2 float:=matching_number(f,'lng');
 dist float; mins integer:=matching_minutes(l->>'date',f->>'date'); numerator float:=0; denominator float:=0; identity_count integer:=0; score integer; result jsonb;
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
  factors:=factors||jsonb_build_object('Brand & category',val);weights:=weights||jsonb_build_object('Brand & category',20);identity_count:=identity_count+1;
 end if;
 if a->>'color' is not null and b->>'color' is not null then
  factors:=factors||jsonb_build_object('Color/details',case when a->>'color'=b->>'color' then 100 else 90 end);weights:=weights||jsonb_build_object('Color/details',10);identity_count:=identity_count+1;reasons:=reasons||jsonb_build_array('Compatible color');
 end if;
 if matching_known(l->>'description') is not null and matching_known(f->>'description') is not null and cardinality(matching_tokens(l->>'description'))>0 and cardinality(matching_tokens(f->>'description'))>0 then lexical:=matching_description(coalesce(l->>'name','')||' '||(l->>'description'),coalesce(f->>'name','')||' '||(f->>'description'))*100;end if;
 semantic:=matching_number(signals,'semanticSimilarity');if semantic not between 0 and 1 then semantic:=null;end if;
 image:=matching_number(signals,'imageSimilarity');if image not between 0 and 1 then image:=null;end if;
 val:=case when lexical is null then semantic*100 when semantic is null then lexical else (lexical+semantic*100)/2 end;
 if val is not null then
  factors:=factors||jsonb_build_object('Description',floor(val+0.5));weights:=weights||jsonb_build_object('Description',20);identity_count:=identity_count+1;
  if val>=60 then reasons:=reasons||jsonb_build_array('Similar description');end if;
 end if;
 if image is not null then
  factors:=factors||jsonb_build_object('Image similarity',floor(image*100+0.5));weights:=weights||jsonb_build_object('Image similarity',30);identity_count:=identity_count+1;
  if image>=0.6 then reasons:=reasons||jsonb_build_array('Similar images');end if;
 end if;
 if dist is not null then factors:=factors||jsonb_build_object('Location',floor(greatest(35,100-dist*24)+0.5));weights:=weights||jsonb_build_object('Location',10);end if;
 if mins is not null then factors:=factors||jsonb_build_object('Time',floor(greatest(20,100-abs(mins)/10.0)+0.5));weights:=weights||jsonb_build_object('Time',10);end if;
 for k in select key from jsonb_each(factors) order by key loop numerator:=numerator+(factors->>k)::float*(weights->>k)::float;denominator:=denominator+(weights->>k)::float;end loop;
 score:=case when denominator>0 then least(99,floor(numerator/denominator+0.5)) else 0 end;
 if identity_count<2 then score:=least(score,59);end if;
 return result||jsonb_build_object('score',score,'classification',matching_classification(score),'factors',factors,'matchingFactors',reasons);
end $$;
create or replace function report_matching_input(r reports) returns jsonb language sql stable as $$
 select jsonb_build_object('id',r.id,'type',r.report_type,'name',r.item_name,'category',r.category,'brand',r.brand,'model',r.model,'color',r.primary_color,'description',r.description,'lat',r.latitude,'lng',r.longitude,'date',r.occurred_at,'status',r.status)
$$;
alter table potential_matches add column if not exists staff_reasoning jsonb not null default '{}';
create or replace function refresh_report_matches() returns trigger language plpgsql as $$
declare l reports;f reports;candidate reports;assessment jsonb;mid uuid;
begin
 if new.status in ('Returned','Archived','Ready for Pickup') then return new;end if;
 for candidate in select * from reports where report_type<>new.report_type and status not in ('Returned','Archived','Ready for Pickup') order by id loop
  if new.report_type='lost' then l:=new;f:=candidate;else l:=candidate;f:=new;end if;
  assessment:=evaluate_report_match(report_matching_input(l),report_matching_input(f));
  if not (assessment->>'eligible')::boolean or (assessment->>'score')::int<60 then
   update potential_matches set dismissed=true,score=(assessment->>'score')::int,factors=assessment->'factors',staff_reasoning=assessment where lost_report_id=l.id and found_report_id=f.id;
   continue;
  end if;
  mid:=null;
  insert into potential_matches(lost_report_id,found_report_id,score,factors,distance_km,minutes_difference,staff_reasoning)
   values(l.id,f.id,(assessment->>'score')::int,assessment->'factors',(assessment->>'distance')::float,(assessment->>'minutes')::int,assessment)
   on conflict(lost_report_id,found_report_id) do nothing returning id into mid;
  if mid is not null then
   insert into updates(user_id,report_id,match_id,title,message) values(l.reporter_id,l.id,mid,'Possible match','Magpie found a possible match. Review it privately in Updates.');
  else
   -- Preserve manual/historical dismissal. Never change claims or pickup state.
   update potential_matches set score=(assessment->>'score')::int,factors=assessment->'factors',distance_km=(assessment->>'distance')::float,minutes_difference=(assessment->>'minutes')::int,staff_reasoning=assessment where lost_report_id=l.id and found_report_id=f.id;
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists reports_match on reports;
create trigger reports_match after insert or update of category,item_name,brand,model,primary_color,description,occurred_at,latitude,longitude on reports for each row execute function refresh_report_matches();
-- Upgrade only existing active pairs; no report rewrite, new notices, or claim deletion.
with assessments as materialized (
 select m.id,evaluate_report_match(report_matching_input(l),report_matching_input(f)) a from potential_matches m join reports l on l.id=m.lost_report_id join reports f on f.id=m.found_report_id
 where l.status not in ('Returned','Archived','Ready for Pickup') and f.status not in ('Returned','Archived','Ready for Pickup')
)
update potential_matches m set staff_reasoning=s.a,score=(s.a->>'score')::int,factors=s.a->'factors',distance_km=(s.a->>'distance')::float,minutes_difference=(s.a->>'minutes')::int,
 dismissed=m.dismissed or not (s.a->>'eligible')::boolean or (s.a->>'score')::int<60 from assessments s where m.id=s.id;
commit;
