-- Magpie: targeted upgrade after 002_magpie_privacy.sql. Safe to reapply.
-- Buildings stay in campus_settings.locations; approved intake reuses pickup_locations.
alter table public.pickup_locations add column if not exists campus_id text not null default 'osu-columbus';
alter table public.pickup_locations add column if not exists building_id text;
alter table public.pickup_locations add column if not exists active boolean not null default false;
alter table public.items add column if not exists reported_by_role text;
alter table public.items add column if not exists location_known boolean not null default false;
alter table public.items add column if not exists building_id text;
alter table public.items add column if not exists latitude double precision;
alter table public.items add column if not exists longitude double precision;
alter table public.items add column if not exists dropoff_zone_id uuid references public.pickup_locations(id);
alter table public.items add column if not exists found_at timestamptz;
alter table public.items add column if not exists received_at timestamptz;
alter table public.items add column if not exists custody_status text check(custody_status in('Received','Stored','Potential Match','Claim Pending','Ready for Pickup','Returned'));
-- Email/password supports hackathon email addresses; explicit configured domain restrictions still apply.
create or replace function public.allowed_campus_email(email_input text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select email_input ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and (cardinality(allowed_domains)=0 or lower(split_part(email_input,'@',2))=any(allowed_domains)) from public.campus_settings where id=true $$;
create or replace function public.handle_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.allowed_campus_email(new.email) then raise exception 'Use an email address permitted by this campus';end if;
 insert into public.profiles(id,email,full_name,role,university_verified) values(new.id,new.email,left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),100),'student',new.email_confirmed_at is not null) on conflict(id) do nothing;return new;end $$;
create or replace function public.ensure_profile() returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare u auth.users;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into u from auth.users where id=auth.uid();if not found then raise exception 'Authenticated user not found';end if;
 insert into public.profiles(id,email,full_name,role,university_verified) values(u.id,u.email,left(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),100),'student',u.email_confirmed_at is not null) on conflict(id) do nothing;end $$;
insert into public.profiles(id,email,full_name,role,university_verified) select u.id,u.email,left(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),100),'student',u.email_confirmed_at is not null from auth.users u where u.email is not null on conflict(id) do nothing;
create or replace function public.sync_report_columns() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 new.reported_by_role:=coalesce((select role from public.profiles where id=new.reporter_id),'student');
 new.location_known:=coalesce((new.payload->>'locationKnown')::boolean,(new.payload->>'lat') is not null and (new.payload->>'lng') is not null);
 new.latitude:=case when new.location_known then (new.payload->>'lat')::float else null end;new.longitude:=case when new.location_known then (new.payload->>'lng')::float else null end;
 new.building_id:=case when new.location_known then nullif(new.payload->>'buildingId','') else null end;
 if new.report_type='found' then
 new.dropoff_zone_id:=nullif(new.payload->>'dropoffZoneId','')::uuid;new.found_at:=coalesce((new.payload->>'foundAt')::timestamptz,(new.payload->>'date')::timestamptz);new.received_at:=(new.payload->>'receivedAt')::timestamptz;
 new.custody_status:=case when new.payload->>'status'='Returned' then 'Returned' when new.payload->>'status'='Ready for Pickup' then 'Ready for Pickup' else coalesce(new.payload->>'custodyStatus',new.custody_status,'Received') end;
 new.payload:=new.payload||jsonb_build_object('custodyStatus',new.custody_status,'reportedByRole',new.reported_by_role);
 end if;return new;end $$;
drop trigger if exists sync_report_columns on public.items;
create trigger sync_report_columns before insert or update on public.items for each row execute function public.sync_report_columns();
-- Populate normalized columns without creating fake approved zones or assigning legacy stock to a zone.
update public.items set payload=payload;
-- Full reports/photos stay private. Legacy student-submitted found records are staff-only too.
drop policy if exists own_reports on public.items;
create policy own_reports on public.items for select to authenticated using(public.is_admin() or (reporter_id=auth.uid() and report_type='lost'));
drop policy if exists own_identifying_details on public.private_item_details;
create policy own_identifying_details on public.private_item_details for select to authenticated using(public.is_admin() or (reporter_id=auth.uid() and exists(select 1 from public.items i where i.id=item_id and i.report_type='lost' and i.reporter_id=auth.uid())));
drop policy if exists magpie_photo_read on storage.objects;
create policy magpie_photo_read on storage.objects for select to authenticated using(bucket_id='item-images' and (public.is_admin() or ((storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.item_images im join public.items i on i.id=im.item_id where im.image_url=storage.objects.name and i.report_type='found'))));
-- Security definer predicate is needed because item RLS hides legacy found rows from their old reporter.
create or replace function public.can_read_report_photo(path_input text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select public.is_admin() or ((storage.foldername(path_input))[1]=auth.uid()::text and not exists(select 1 from public.item_images im join public.items i on i.id=im.item_id where im.image_url=path_input and i.report_type='found')) $$;
drop policy if exists magpie_photo_read on storage.objects;
create policy magpie_photo_read on storage.objects for select to authenticated using(bucket_id='item-images' and public.can_read_report_photo(name));
create or replace function public.get_dropoff_zones() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$ select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'campusId',z.campus_id,'name',z.name,'buildingId',z.building_id,'building',z.building,'description',coalesce(z.description,''),'lat',z.latitude,'lng',z.longitude,'active',z.active) order by z.name),'[]'::jsonb) from public.pickup_locations z where z.active or public.is_admin() $$;
create or replace function public.save_dropoff_zone(zone_id uuid,zone_payload jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare bid text:=zone_payload->>'buildingId';b jsonb;zid uuid:=coalesce(zone_id,gen_random_uuid());begin
 if not public.is_admin() then raise exception 'Administrator access required';end if;
 select l into b from public.campus_settings s,jsonb_array_elements(s.locations) l where l->>'id'=bid;
 if b is null then raise exception 'Select a configured campus building';end if;
 if length(trim(zone_payload->>'name')) not between 2 and 120 or length(coalesce(zone_payload->>'description',''))>500 then raise exception 'Provide a zone name and concise public intake instructions';end if;
 insert into public.pickup_locations(id,name,building,latitude,longitude,description,campus_id,building_id,active) values(zid,trim(zone_payload->>'name'),b->>'name',(b->>'lat')::float,(b->>'lng')::float,coalesce(zone_payload->>'description',''),left(coalesce(zone_payload->>'campusId','campus'),80),bid,coalesce((zone_payload->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,building=excluded.building,latitude=excluded.latitude,longitude=excluded.longitude,description=excluded.description,building_id=excluded.building_id,active=excluded.active;
 return zid;end $$;
-- Only found inventory appears in Search; exact custody/storage information never leaves this function.
create or replace function public.search_public_reports() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$ select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'type','found','category',case when i.payload->>'category'=any(array['Electronics','Clothing','Wallet','University ID','Keys','Backpack','Water Bottle','Jewelry','School Supplies','Other']) then i.payload->>'category' else 'Other' end,'location',coalesce(z.building,'Campus drop-off'),'date',to_char(i.found_at,'YYYY-MM-DD'),'status','In Magpie custody') order by i.created_at desc),'[]'::jsonb) from (select * from public.items where report_type='found' and dropoff_zone_id is not null and payload->>'status' not in('Returned','Archived') order by created_at desc limit 200) i join public.pickup_locations z on z.id=i.dropoff_zone_id $$;
-- Shared scoring ignores absent coordinates and renormalizes remaining factors.
create or replace function public.score_report_pair(l public.items,f public.items) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$ declare attr int;txt int;visual int;dist float;mins float;loc int;tm int;score int;factors jsonb;begin
 attr:=case when lower(l.payload->>'brand')=lower(f.payload->>'brand') and coalesce(l.payload->>'brand','')<>'' then 100 else 40 end;
 txt:=case when lower(l.payload->>'name')=lower(f.payload->>'name') then 100 when attr=100 then 85 else 40 end;
 visual:=case when lower(l.payload->>'color')=lower(f.payload->>'color') then 85 else 20 end;
 if l.latitude is not null and l.longitude is not null and f.latitude is not null and f.longitude is not null then dist:=sqrt(power((l.latitude-f.latitude)*111,2)+power((l.longitude-f.longitude)*85,2));loc:=greatest(35,100-dist*24);end if;
 mins:=extract(epoch from ((f.payload->>'date')::timestamptz-(l.payload->>'date')::timestamptz))/60;tm:=greatest(20,100-abs(mins)/10);
 score:=least(99,round((15+attr*.15+txt*.25+visual*.25+coalesce(loc*.1,0)+tm*.1)/(case when loc is null then .9 else 1 end)));
 factors:=jsonb_build_object('Item attributes',attr,'Text similarity',txt,'Time proximity',tm);if loc is not null then factors:=factors||jsonb_build_object('Location proximity',loc);end if;
 return jsonb_build_object('id',l.id::text||':'||f.id::text,'lostId',l.id,'foundId',f.id,'score',score,'distance',dist,'minutes',round(mins),'factors',factors);end $$;
create or replace function public.refresh_matches() returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare l public.items;f public.items;mp jsonb;mid text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 for l in select * from public.items where report_type='lost' and payload->>'status' not in('Returned','Archived') loop
 for f in select * from public.items where report_type='found' and dropoff_zone_id is not null and payload->>'status' not in('Returned','Archived') and payload->>'category'=l.payload->>'category' loop
 mp:=public.score_report_pair(l,f);mid:=mp->>'id';
 if (mp->>'score')::int>=60 then
 if exists(select 1 from public.matches where id=mid and payload->>'dismissed'='true') then mp:=mp||'{"dismissed":true}'::jsonb;end if;
 if not exists(select 1 from public.matches where id=mid) then perform public.magpie_notify(l.reporter_id,'Possible match found','Campus staff received a similar item. Review it privately in Magpie Updates.',l.id,mid);end if;
 insert into public.matches(id,lost_item_id,found_item_id,payload) values(mid,l.id,f.id,mp) on conflict(id) do update set payload=excluded.payload;
 update public.items set payload=jsonb_set(payload,'{status}','"Potential Match"') where id=l.id and payload->>'status'='Matching';
 update public.items set payload=payload||jsonb_build_object('status','Potential Match','custodyStatus','Potential Match') where id=f.id and custody_status in('Received','Stored');
 end if;end loop;end loop;end $$;
create or replace function public.submit_report(report_id uuid,report_type text,report_payload jsonb,private_detail text,photo_paths text[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare p jsonb;photo text;name_input text;category_input text;known boolean;lat float;lng float;bid text;building jsonb;zone public.pickup_locations;received timestamptz;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if report_type not in('lost','found') or report_type is null then raise exception 'Invalid report type';end if;
 if report_type='found' and not public.is_admin() then raise exception 'Only authorized staff can create found-item reports';end if;
 if (select count(*) from public.items where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 and not public.is_admin() then raise exception 'Report limit reached. Try again later.';end if;
 name_input:=trim(report_payload->>'name');category_input:=report_payload->>'category';
 if name_input is null or length(name_input) not between 2 and 80 then raise exception 'Item type must be 2–80 characters';end if;
 if category_input is null or category_input<>all(array['Electronics','Clothing','Wallet','University ID','Keys','Backpack','Water Bottle','Jewelry','School Supplies','Other']) then raise exception 'Invalid item category';end if;
 if length(coalesce(report_payload->>'color','')) not between 1 and 80 then raise exception 'General color or appearance is required';end if;
 if length(coalesce(report_payload->>'description',''))>1500 or length(coalesce(private_detail,''))>1000 or length(coalesce(report_payload->>'staffNotes',''))>2000 then raise exception 'Description or staff notes are too long';end if;
 if report_payload->>'date' is null or (report_payload->>'date')::timestamptz>now()+interval '15 minutes' then raise exception 'Date must not be in the future';end if;
 known:=coalesce((report_payload->>'locationKnown')::boolean,(report_payload->>'lat') is not null or (report_payload->>'lng') is not null or nullif(report_payload->>'buildingId','') is not null);
 bid:=case when known then nullif(report_payload->>'buildingId','') else null end;
 if bid is not null then
 select b into building from public.campus_settings s,jsonb_array_elements(s.locations) b where b->>'id'=bid;
 if building is null then raise exception 'Select a configured campus building';end if;
 lat:=(building->>'lat')::float;lng:=(building->>'lng')::float;
 elsif known then lat:=(report_payload->>'lat')::float;lng:=(report_payload->>'lng')::float;end if;
 if known and (lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180) then raise exception 'Provide valid coordinates or leave the location unknown';end if;
 if report_type='found' then
 select * into zone from public.pickup_locations where id=(report_payload->>'dropoffZoneId')::uuid and active;
 if not found then raise exception 'Select an active approved drop-off zone';end if;
 received:=(report_payload->>'receivedAt')::timestamptz;
 if received is null or received>now()+interval '15 minutes' or received<(report_payload->>'date')::timestamptz then raise exception 'Received time must be on or after the found time and not in the future';end if;
 if length(trim(coalesce(report_payload->>'description','')))<3 then raise exception 'Describe the found item privately';end if;
 if coalesce(report_payload->>'custodyStatus','Received') not in('Received','Stored') then raise exception 'New inventory must be Received or Stored';end if;
 end if;
 if coalesce(array_length(photo_paths,1),0)>3 then raise exception 'At most three photos are allowed';end if;
 foreach photo in array coalesce(photo_paths,'{}'::text[]) loop if photo not like auth.uid()::text||'/'||report_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='item-images' and name=photo) then raise exception 'Photo does not belong to this report';end if;end loop;
 p:=jsonb_build_object('id',report_id,'reporterId',auth.uid(),'reportedByRole',case when public.is_admin() then 'admin' else 'student' end,'type',report_type,'name',name_input,'category',category_input,'brand',left(coalesce(report_payload->>'brand',''),60),'model',left(coalesce(report_payload->>'model',''),60),'size',left(coalesce(report_payload->>'size',''),30),'color',report_payload->>'color','description',coalesce(report_payload->>'description',''),'features',coalesce(report_payload->>'description',''),'location',case when not known then 'Location unknown' when building is not null then building->>'name' else 'Approximate campus location' end,'locationKnown',known,'buildingId',bid,'lat',lat,'lng',lng,'date',report_payload->>'date','status','Matching','image','','imagePaths',to_jsonb(coalesce(photo_paths,'{}'::text[])));
 if report_type='found' then p:=p||jsonb_build_object('dropoffZoneId',zone.id,'foundAt',report_payload->>'date','receivedAt',received,'custodyStatus',coalesce(report_payload->>'custodyStatus','Received'),'staffNotes',coalesce(report_payload->>'staffNotes',''));end if;
 insert into public.items(id,reporter_id,report_type,payload) values(report_id,auth.uid(),submit_report.report_type,p);
 insert into public.private_item_details(item_id,reporter_id,private_description) values(report_id,auth.uid(),coalesce(private_detail,''));
 foreach photo in array coalesce(photo_paths,'{}'::text[]) loop insert into public.item_images(item_id,image_url) values(report_id,photo);end loop;
 perform public.magpie_notify(auth.uid(),'Report received','Your report is saved. Any possible matches will be sent privately.',report_id,null);perform public.refresh_matches();end $$;
create or replace function public.connect_search_report(found_report_id uuid,lost_report_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ declare l public.items;f public.items;mp jsonb;begin
 if auth.uid() is null then raise exception 'Sign in to connect your lost report';end if;
 select * into l from public.items where id=lost_report_id and reporter_id=auth.uid() and report_type='lost' and payload->>'status' not in('Returned','Archived') for update;
 if not found then raise exception 'Create your own active lost report first';end if;
 select * into f from public.items where id=found_report_id and report_type='found' and dropoff_zone_id is not null and payload->>'status' not in('Returned','Archived');
 if not found or f.payload->>'category'<>l.payload->>'category' then raise exception 'Select a compatible available found item';end if;
 mp:=public.score_report_pair(l,f);
 insert into public.matches(id,lost_item_id,found_item_id,payload) values(mp->>'id',l.id,f.id,mp) on conflict(id) do update set payload=excluded.payload;
 perform public.magpie_notify(auth.uid(),'Ownership check connected','Your independently described lost report has been connected for private review.',l.id,mp->>'id');return mp;end $$;
create or replace function public.edit_lost_report(report_id uuid,report_payload jsonb,private_detail text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare i public.items;known boolean;lat float;lng float;bid text;b jsonb;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into i from public.items where id=report_id and reporter_id=auth.uid() and report_type='lost' for update;
 if not found then raise exception 'You can edit only your own lost reports';end if;
 if i.payload->>'status' in('Returned','Ready for Pickup','Archived') or exists(select 1 from public.claims c join public.matches m on m.id=c.match_id where m.lost_item_id=i.id and c.payload->>'status' in('Pending','More information','Approved','Returned')) then raise exception 'This report is in an ownership or pickup workflow and cannot be edited';end if;
 if report_payload->>'name' is null or length(trim(report_payload->>'name')) not between 2 and 80 or length(coalesce(report_payload->>'color','')) not between 1 and 80 or length(coalesce(report_payload->>'description',''))>1500 or length(coalesce(private_detail,''))>1000 then raise exception 'Check item name, appearance and description lengths';end if;
 known:=coalesce((report_payload->>'locationKnown')::boolean,false);bid:=case when known then nullif(report_payload->>'buildingId','') else null end;
 if bid is not null then select l into b from public.campus_settings s,jsonb_array_elements(s.locations) l where l->>'id'=bid;if b is null then raise exception 'Select a configured building';end if;lat:=(b->>'lat')::float;lng:=(b->>'lng')::float;
 elsif known then lat:=(report_payload->>'lat')::float;lng:=(report_payload->>'lng')::float;end if;
 if known and (lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180) then raise exception 'Provide valid coordinates or choose location unknown';end if;
 update public.items set payload=payload||jsonb_build_object('name',trim(report_payload->>'name'),'color',report_payload->>'color','description',coalesce(report_payload->>'description',''),'features',coalesce(report_payload->>'description',''),'locationKnown',known,'buildingId',bid,'lat',lat,'lng',lng,'location',case when not known then 'Location unknown' when b is not null then b->>'name' else 'Approximate campus location' end),updated_at=now() where id=i.id;
 update public.private_item_details set private_description=coalesce(private_detail,'') where item_id=i.id;
 delete from public.matches m where m.lost_item_id=i.id and not exists(select 1 from public.claims c where c.match_id=m.id);
 perform public.refresh_matches();end $$;
create or replace function public.update_custody_status(report_id uuid,new_status text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.is_admin() then raise exception 'Administrator access required';end if;
 if new_status not in('Received','Stored') then raise exception 'Use ownership approval and pickup for custody transitions';end if;
 if not exists(select 1 from public.items where id=report_id and report_type='found' and payload->>'status' not in('Returned','Ready for Pickup')) then raise exception 'Found inventory is unavailable for this change';end if;
 update public.items set payload=jsonb_set(payload,'{custodyStatus}',to_jsonb(new_status)),updated_at=now() where id=report_id;end $$;
create or replace function public.claim_custody_transition() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if new.payload->>'status' in('Pending','More information') then update public.items set payload=jsonb_set(payload,'{custodyStatus}','"Claim Pending"') where id=(select found_item_id from public.matches where id=new.match_id);end if;return new;end $$;
drop trigger if exists claim_custody_transition on public.claims;
create trigger claim_custody_transition after insert or update on public.claims for each row execute function public.claim_custody_transition();
-- New definer routines are never executable via PostgreSQL's default PUBLIC grant.
revoke all on function public.ensure_profile() from public;grant execute on function public.ensure_profile() to authenticated;
revoke all on function public.sync_report_columns() from public;
revoke all on function public.can_read_report_photo(text) from public;grant execute on function public.can_read_report_photo(text) to authenticated;
revoke all on function public.get_dropoff_zones() from public;grant execute on function public.get_dropoff_zones() to anon,authenticated;
revoke all on function public.save_dropoff_zone(uuid,jsonb) from public;grant execute on function public.save_dropoff_zone(uuid,jsonb) to authenticated;
revoke all on function public.score_report_pair(public.items,public.items) from public;
revoke all on function public.connect_search_report(uuid,uuid) from public;grant execute on function public.connect_search_report(uuid,uuid) to authenticated;
revoke all on function public.edit_lost_report(uuid,jsonb,text) from public;grant execute on function public.edit_lost_report(uuid,jsonb,text) to authenticated;
revoke all on function public.update_custody_status(uuid,text) from public;grant execute on function public.update_custody_status(uuid,text) to authenticated;
revoke all on function public.claim_custody_transition() from public;

-- Legacy correspondence on found inventory is staff-only as well.
drop policy if exists own_correspondence on public.correspondence;
create policy own_correspondence on public.correspondence for select to authenticated using(public.is_admin() or (user_id=auth.uid() and exists(select 1 from public.items i where i.id=report_id and i.report_type='lost' and i.reporter_id=auth.uid())));
