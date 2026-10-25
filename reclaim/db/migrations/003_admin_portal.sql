begin;
create table if not exists admin_sessions (
 token_hash text primary key, user_id uuid not null references users(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists admin_sessions_expiry on admin_sessions(expires_at);
create table if not exists admin_login_attempts (key_hash text primary key, attempts integer not null default 1, window_start timestamptz not null default now());
alter table dropoff_zones add column if not exists latitude double precision check(latitude between -90 and 90);
alter table dropoff_zones add column if not exists longitude double precision check(longitude between -180 and 180);
alter table pickups add column if not exists display_code text;
alter table report_images add column if not exists upload_role text not null default 'student' check(upload_role in ('student','admin'));
update report_images i set upload_role='admin' from reports r where r.id=i.report_id and r.report_type='found' and i.upload_role<>'admin';
create or replace function validate_image_report_role() returns trigger language plpgsql as $$
begin
 if new.report_id is not null and not exists(select 1 from reports r where r.id=new.report_id and r.reporter_id=new.owner_id and ((r.report_type='lost' and new.upload_role='student') or (r.report_type='found' and new.upload_role='admin'))) then raise exception 'Image upload is incomplete or unavailable';end if;
 return new;
end $$;
drop trigger if exists image_report_role on report_images;
create trigger image_report_role before insert or update of report_id on report_images for each row execute function validate_image_report_role();
create table if not exists staff_activity (
 id uuid primary key default gen_random_uuid(), staff_id uuid not null references users(id),
 report_id uuid references reports(id) on delete set null, action text not null, created_at timestamptz not null default now()
);
create unique index if not exists one_claim_per_matchant on claims(match_id,claimant_id);
-- Same token overlap and fallback weights used by the existing TypeScript matching engine.
create or replace function match_text(a text,b text) returns float language sql immutable as $$
 with x as (select distinct case t when 'clip' then 'keychain' when 'silicone' then 'case' when 'grey' then 'gray' else t end t from regexp_split_to_table(regexp_replace(lower(coalesce(a,'')),'[^a-z0-9 ]',' ','g'),'\s+') t where length(t)>2),
 y as (select distinct case t when 'clip' then 'keychain' when 'silicone' then 'case' when 'grey' then 'gray' else t end t from regexp_split_to_table(regexp_replace(lower(coalesce(b,'')),'[^a-z0-9 ]',' ','g'),'\s+') t where length(t)>2)
 select coalesce(2.0*(select count(*) from x join y using(t))/nullif((select count(*) from x)+(select count(*) from y),0),0)::float
$$;
create or replace function refresh_report_matches() returns trigger language plpgsql as $$
declare l reports; f reports; candidate reports; dist float; mins integer; cat float; brand float; color float; txt float; visual float; tm float; loc float; score_value integer; factors_value jsonb; mid uuid; is_new boolean;
begin
 if new.status in ('Returned','Archived') then return new; end if;
 for candidate in select * from reports where report_type<>new.report_type and status not in ('Returned','Archived') loop
  if new.report_type='lost' then l:=new; f:=candidate; else l:=candidate; f:=new; end if;
  if l.latitude is not null and f.latitude is not null then
   dist:=6371*2*asin(least(1,sqrt(power(sin(radians(f.latitude-l.latitude)/2),2)+cos(radians(l.latitude))*cos(radians(f.latitude))*power(sin(radians(f.longitude-l.longitude)/2),2))));
  else dist:=null; end if;
  mins:=round(extract(epoch from (f.occurred_at-l.occurred_at))/60);
  cat:=case when l.category=f.category then 100 else 0 end;
  brand:=case when l.brand<>'' and f.brand<>'' then match_text(l.brand||' '||l.model,f.brand||' '||f.model)*100 else 50 end;
  color:=case when lower(l.primary_color)=lower(f.primary_color) then 100 else 20 end;
  txt:=match_text(l.item_name||' '||l.description,f.item_name||' '||f.description)*100;
  visual:=round(((cat+color+brand)/3)*0.85);tm:=round(greatest(20,100-abs(mins)/10.0));loc:=case when dist is null then null else round(greatest(35,100-dist*24)) end;
  score_value:=least(99,round((cat*.15+brand*.15+txt*.2+visual*.25+coalesce(loc,0)*.1+tm*.1+match_text(l.description,f.description)*5)/(case when dist is null then .9 else 1 end)));
  if score_value<60 then
   update potential_matches set dismissed=true where lost_report_id=l.id and found_report_id=f.id and not exists(select 1 from claims where match_id=potential_matches.id);
   continue;
  end if;
  factors_value:=jsonb_build_object('Visual attributes',visual,'Description',round(txt),'Time',tm,'Brand & category',round((cat+brand)/2));
  if dist is not null then factors_value:=factors_value||jsonb_build_object('Location',loc);end if;
  is_new:=not exists(select 1 from potential_matches where lost_report_id=l.id and found_report_id=f.id);
  insert into potential_matches(lost_report_id,found_report_id,score,factors,distance_km,minutes_difference) values(l.id,f.id,score_value,factors_value,dist,mins)
   on conflict(lost_report_id,found_report_id) do update set score=excluded.score,factors=excluded.factors,distance_km=excluded.distance_km,minutes_difference=excluded.minutes_difference returning id into mid;
  if is_new then insert into updates(user_id,report_id,match_id,title,message) values(l.reporter_id,l.id,mid,'Possible match','Magpie found a possible match. Review it privately in Updates.');end if;
 end loop;
 return new;
end $$;
drop trigger if exists reports_match on reports;
create trigger reports_match after insert or update of category,item_name,brand,model,primary_color,description,occurred_at,latitude,longitude on reports for each row execute function refresh_report_matches();
create or replace function save_found_report(p_staff uuid,p jsonb,p_private text,p_images uuid[]) returns uuid language plpgsql as $$
declare rid uuid:=(p->>'id')::uuid; bid text; lat float; lng float; loc text; occurred timestamptz:=(p->>'date')::timestamptz; received timestamptz:=(p->>'receivedAt')::timestamptz;
begin
 if not exists(select 1 from users where id=p_staff and role='admin') then raise exception 'Access denied';end if;
 if p->>'type' is distinct from 'found' or length(trim(coalesce(p->>'name','')))=0 then raise exception 'Invalid found report';end if;
 perform 1 from dropoff_zones where id=(p->>'dropoffZoneId')::uuid and active for share;
 if not found then raise exception 'Select an active drop-off zone';end if;
 if coalesce(p->>'custodyStatus','Received') not in ('Received','Stored') then raise exception 'Invalid found report';end if;
 if occurred is null or received is null or occurred>now()+interval '5 minutes' or received>now()+interval '5 minutes' or received<occurred then raise exception 'Choose valid found and received times';end if;
 if exists(select 1 from reports where id=rid) then raise exception 'Report ID unavailable';end if;
 if coalesce((p->>'locationKnown')::boolean,false) then
  bid:=nullif(p->>'buildingId','');
  if bid is not null then select latitude,longitude,name into lat,lng,loc from buildings where id=bid and active;if not found then raise exception 'Select an active campus building';end if;
  else lat:=(p->>'lat')::float;lng:=(p->>'lng')::float;loc:='Approximate campus location';end if;
  if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 then raise exception 'Choose valid coordinates or location unknown';end if;
 else loc:='Location unknown';end if;
 if cardinality(p_images)>3 or cardinality(p_images)<>(select count(distinct x) from unnest(p_images) x) then raise exception 'Choose up to three unique images';end if;
 perform 1 from report_images where id=any(p_images) for update;
 if cardinality(p_images)<>(select count(*) from report_images where id=any(p_images) and owner_id=p_staff and report_id is null and status='uploaded') then raise exception 'Image upload is incomplete or unavailable';end if;
 insert into reports(id,reporter_id,report_type,category,item_name,brand,model,primary_color,secondary_color,size,description,location_known,building_id,latitude,longitude,location_label,lost_date,lost_time,occurred_at,status,dropoff_zone_id,custody_status,found_at,received_at,staff_notes)
 values(rid,p_staff,'found',p->>'category',trim(p->>'name'),coalesce(p->>'brand',''),coalesce(p->>'model',''),coalesce(p->>'color',''),coalesce(p->>'secondaryColor',''),coalesce(p->>'size',''),coalesce(p->>'description',''),coalesce((p->>'locationKnown')::boolean,false),bid,lat,lng,loc,(occurred at time zone 'UTC')::date,(occurred at time zone 'UTC')::time,occurred,'Secured',(p->>'dropoffZoneId')::uuid,coalesce(p->>'custodyStatus','Received'),occurred,received,coalesce(p->>'staffNotes',''));
 insert into private_report_details(report_id,owner_description) values(rid,coalesce(p_private,''));
 update report_images set report_id=rid where id=any(p_images);
 insert into staff_activity(staff_id,report_id,action) values(p_staff,rid,'Received found item');return rid;
end $$;
create or replace function submit_ownership_claim(p_user uuid,p_match uuid,p_answer text) returns uuid language plpgsql as $$
declare m potential_matches; l reports; f reports; cid uuid;
begin
 select * into m from potential_matches where id=p_match;
 select * into l from reports where id=m.lost_report_id for update;
 select * into f from reports where id=m.found_report_id for update;
 select * into m from potential_matches where id=p_match for update;
 if l.reporter_id is distinct from p_user or m.dismissed or l.status in ('Returned','Archived') or f.status in ('Returned','Archived','Ready for Pickup') then raise exception 'Match unavailable';end if;
 if length(trim(p_answer))<10 or length(p_answer)>1500 then raise exception 'Provide ownership details';end if;
 insert into claims(match_id,claimant_id,answers) values(p_match,p_user,p_answer) on conflict(match_id,claimant_id) do update set answers=excluded.answers,status='Pending',updated_at=now() where claims.status='More information' returning id into cid;
 if cid is null then raise exception 'Claim already submitted';end if;
 update reports set status='Awaiting Verification' where id=l.id;
 update reports set custody_status='Claim Pending' where id=f.id;
 insert into updates(user_id,report_id,match_id,title,message) values(p_user,l.id,m.id,'Claim submitted','Campus staff will review your ownership information privately.');return cid;
end $$;
create or replace function review_ownership_claim(p_staff uuid,p_claim uuid,p_status text,p_zone uuid,p_code text,p_hash text,p_message text) returns void language plpgsql as $$
declare c claims;m potential_matches;l reports;f reports;notice text;
begin
 if not exists(select 1 from users where id=p_staff and role='admin') then raise exception 'Access denied';end if;
 select * into c from claims where id=p_claim;
 select * into m from potential_matches where id=c.match_id;
 select * into l from reports where id=m.lost_report_id for update;
 select * into f from reports where id=m.found_report_id for update;
 select * into c from claims where id=p_claim for update;
 if c.id is null then raise exception 'Claim not found';end if;
 if c.status not in ('Pending','More information') or p_status not in ('Approved','Rejected','More information') then raise exception 'Claim cannot be changed';end if;
 if p_status='Approved' then
  perform 1 from dropoff_zones where id=p_zone and active for share;
  if not found then raise exception 'Select an active drop-off zone';end if;
  if exists(select 1 from claims c2 join potential_matches m2 on m2.id=c2.match_id where c2.status='Approved' and (m2.found_report_id=f.id or m2.lost_report_id=l.id)) or f.status in ('Returned','Archived') then raise exception 'Item already assigned';end if;
  insert into pickups(claim_id,zone_id,code_hash,display_code,expires_at) values(c.id,p_zone,p_hash,p_code,now()+interval '7 days');
  update reports set status='Ready for Pickup',custody_status=case when report_type='found' then 'Ready for Pickup' else custody_status end where id in(l.id,f.id);
  notice:='Your claim was approved. Your item is ready for pickup. Open your private pickup pass.';
 elsif p_status='More information' then notice:='Additional ownership information is needed. Reply privately in Updates.';
 else
  notice:='Your claim was not approved. Contact campus staff if you have additional evidence.';
 end if;
 update claims set status=p_status,updated_at=now() where id=c.id;
 if p_status='Rejected' then
  if not has_active_recovery_claims(l.id) then update reports set status='Matching' where id=l.id;end if;
  if not has_active_recovery_claims(f.id) then update reports set custody_status='Stored' where id=f.id;end if;
 end if;
 insert into updates(user_id,report_id,match_id,title,message) values(c.claimant_id,l.id,m.id,case p_status when 'Approved' then 'Ready for pickup' when 'Rejected' then 'Claim reviewed' else 'More information needed' end,notice);
 if length(trim(coalesce(p_message,'')))>0 then insert into report_notes(report_id,sender_id,body,from_staff) values(l.id,p_staff,p_message,true);end if;
 insert into staff_activity(staff_id,report_id,action) values(p_staff,f.id,'Claim '||lower(p_status));
end $$;
create or replace function has_active_recovery_claims(rid uuid) returns boolean language sql stable as $$ select exists(select 1 from claims c join potential_matches m on m.id=c.match_id where rid in(m.lost_report_id,m.found_report_id) and c.status not in ('Rejected','Returned')) $$;
create or replace function redeem_pickup(p_staff uuid,p_hash text) returns void language plpgsql as $$
declare p pickups;c claims;m potential_matches;
begin
 if not exists(select 1 from users where id=p_staff and role='admin') then raise exception 'Access denied';end if;
 select * into p from pickups where code_hash=p_hash;
 select * into c from claims where id=p.claim_id;
 select * into m from potential_matches where id=c.match_id;
 perform 1 from reports where id in(m.lost_report_id,m.found_report_id) order by report_type desc for update;
 select * into c from claims where id=c.id for update;
 select * into p from pickups where code_hash=p_hash for update;
 if p.id is null or p.used_at is not null or p.expires_at<=now() or c.status<>'Approved' then raise exception 'Pickup code is invalid or expired';end if;
 update pickups set used_at=now() where id=p.id;
 update claims set status='Returned',updated_at=now() where id=c.id;
 update reports set status='Returned',custody_status=case when report_type='found' then 'Returned' else custody_status end where id in(m.lost_report_id,m.found_report_id);
 insert into updates(user_id,report_id,match_id,title,message) values(c.claimant_id,m.lost_report_id,m.id,'Item returned','Your item was returned. Thank you for using Magpie.');
 insert into staff_activity(staff_id,report_id,action) values(p_staff,m.found_report_id,'Confirmed item return');
end $$;
commit;
