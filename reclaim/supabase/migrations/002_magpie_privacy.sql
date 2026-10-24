-- Magpie: fresh setup or in-place upgrade of the original payload-based schema.
-- Run as the database owner in Supabase SQL editor. No existing reports are deleted.
create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users on delete cascade,email text not null,full_name text not null default 'Student',role text not null default 'student' check(role in('student','admin')),university_verified boolean not null default false,student_id_last4 text check(student_id_last4 ~ '^\d{4}$'),avatar_url text,created_at timestamptz default now());
alter table public.profiles drop constraint if exists profiles_email_check;
create table if not exists public.campus_settings(id boolean primary key default true check(id),name text not null default 'University campus',allowed_domains text[] not null default '{}',locations jsonb not null default '[]');
insert into public.campus_settings(id) values(true) on conflict do nothing;
create table if not exists public.items(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles,report_type text not null check(report_type in('lost','found')),payload jsonb not null,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists public.item_images(id uuid primary key default gen_random_uuid(),item_id uuid references public.items on delete cascade,image_url text not null,embedding jsonb,created_at timestamptz default now());
create table if not exists public.private_item_details(id uuid primary key default gen_random_uuid(),item_id uuid unique references public.items on delete cascade,reporter_id uuid not null references public.profiles,private_description text,serial_last4 text check(length(serial_last4)<=4),unique_markings text,private_notes text);
create table if not exists public.matches(id text primary key,lost_item_id uuid references public.items,found_item_id uuid references public.items,payload jsonb not null,created_at timestamptz default now(),unique(lost_item_id,found_item_id));
create table if not exists public.claims(id uuid primary key default gen_random_uuid(),match_id text not null references public.matches,claimant_id uuid not null references public.profiles,payload jsonb not null,created_at timestamptz default now(),updated_at timestamptz default now(),unique(match_id,claimant_id));
create table if not exists public.pickup_locations(id uuid primary key default gen_random_uuid(),name text not null,building text,latitude float,longitude float,hours text,description text);
create table if not exists public.pickups(id uuid primary key default gen_random_uuid(),claim_id uuid unique references public.claims,pickup_location_id uuid references public.pickup_locations,pickup_code text unique,qr_token uuid unique default gen_random_uuid(),status text default 'Ready',secured_at timestamptz default now(),picked_up_at timestamptz);
create table if not exists public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles,payload jsonb not null,created_at timestamptz default now());
create table if not exists public.correspondence(id uuid primary key default gen_random_uuid(),report_id uuid not null references public.items on delete cascade,user_id uuid not null references public.profiles,sender_id uuid not null references public.profiles,body text not null check(length(body) between 3 and 2000),from_staff boolean not null default false,created_at timestamptz default now());
create index if not exists reports_owner_idx on public.items(reporter_id);
create index if not exists correspondence_owner_idx on public.correspondence(user_id,report_id);
create index if not exists notifications_owner_idx on public.notifications(user_id);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
create or replace function public.allowed_campus_email(email_input text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select email_input ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and case when cardinality(allowed_domains)>0 then lower(split_part(email_input,'@',2))=any(allowed_domains) else lower(split_part(email_input,'@',2)) like '%.edu' end from public.campus_settings where id=true $$;
create or replace function public.handle_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.allowed_campus_email(new.email) then raise exception 'A configured university email address is required';end if;
 insert into public.profiles(id,email,full_name,university_verified) values(new.id,new.email,left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Student'),100),new.email_confirmed_at is not null);return new;end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_user();
-- Replace all old permissive policies. Write access is through validated RPCs only.
do $$ declare p record;t text;begin
 for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['profiles','campus_settings','items','item_images','private_item_details','matches','claims','pickup_locations','pickups','notifications','correspondence']) loop
 execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);end loop;
 foreach t in array array['profiles','campus_settings','items','item_images','private_item_details','matches','claims','pickup_locations','pickups','notifications','correspondence'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);end loop;
end $$;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy campus_read on public.campus_settings for select to authenticated using(true);
create policy own_reports on public.items for select to authenticated using(reporter_id=auth.uid() or public.is_admin());
create policy own_images on public.item_images for select to authenticated using(exists(select 1 from public.items i where i.id=item_id and (i.reporter_id=auth.uid() or public.is_admin())));
create policy own_identifying_details on public.private_item_details for select to authenticated using(reporter_id=auth.uid() or public.is_admin());
create policy own_matches on public.matches for select to authenticated using(public.is_admin() or exists(select 1 from public.items i where i.id=lost_item_id and i.reporter_id=auth.uid()));
create policy own_claims on public.claims for select to authenticated using(claimant_id=auth.uid() or public.is_admin());
create policy location_read on public.pickup_locations for select to authenticated using(true);
create policy own_pickups on public.pickups for select to authenticated using(public.is_admin() or exists(select 1 from public.claims c where c.id=claim_id and c.claimant_id=auth.uid()));
create policy own_notifications on public.notifications for select to authenticated using(user_id=auth.uid());
create policy own_correspondence on public.correspondence for select to authenticated using(user_id=auth.uid() or public.is_admin());
-- Anonymous search has an explicit allowlist, never a projection of private payloads.
create or replace function public.search_public_reports() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'type',i.report_type,'category',case when i.payload->>'category'=any(array['Electronics','Clothing','Wallet','University ID','Keys','Backpack','Water Bottle','Jewelry','School Supplies','Other']) then i.payload->>'category' else 'Other' end,'location',case when exists(select 1 from public.campus_settings s,jsonb_array_elements(s.locations) l where l->>'name'=i.payload->>'location') then i.payload->>'location' else 'Campus' end,'date',case when i.payload->>'date' ~ '^\d{4}-\d{2}-\d{2}' then left(i.payload->>'date',10) else to_char(i.created_at,'YYYY-MM-DD') end,'status','Active') order by i.created_at desc),'[]'::jsonb) from (select * from public.items where payload->>'status' not in('Returned','Archived') order by created_at desc limit 200) i
 $$;
-- Notifications are written by trusted functions; user-facing text is always rendered as text.
create or replace function public.magpie_notify(owner_id uuid,title_input text,body_input text,report_id_input uuid default null,match_id_input text default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare nid uuid:=gen_random_uuid();begin
 insert into public.notifications(id,user_id,payload) values(nid,owner_id,jsonb_build_object('id',nid,'title',title_input,'message',body_input,'read',false,'reportId',report_id_input,'matchId',match_id_input));end $$;
create or replace function public.refresh_matches() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.items;f public.items;score int;attr int;txt int;dist float;mins float;loc int;tm int;mp jsonb;mid text;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 for l in select * from public.items where report_type='lost' and payload->>'status' not in('Returned','Archived') loop
 for f in select * from public.items where report_type='found' and payload->>'status' not in('Returned','Archived') and payload->>'category'=l.payload->>'category' loop
 attr:=case when lower(l.payload->>'brand')=lower(f.payload->>'brand') and coalesce(l.payload->>'brand','')<>'' then 100 else 40 end;
 txt:=case when lower(l.payload->>'name')=lower(f.payload->>'name') then 100 when attr=100 then 85 else 40 end;
 dist:=sqrt(power(((l.payload->>'lat')::float-(f.payload->>'lat')::float)*111,2)+power(((l.payload->>'lng')::float-(f.payload->>'lng')::float)*85,2));
 mins:=extract(epoch from ((f.payload->>'date')::timestamptz-(l.payload->>'date')::timestamptz))/60;
 loc:=greatest(35,100-dist*24);tm:=greatest(20,100-abs(mins)/10);
 score:=least(99,round(15+attr*.15+txt*.25+(case when lower(l.payload->>'color')=lower(f.payload->>'color') then 85 else 20 end)*.25+loc*.1+tm*.1));
 if score>=60 then mid:=l.id::text||':'||f.id::text;
 mp:=jsonb_build_object('id',mid,'lostId',l.id,'foundId',f.id,'score',score,'distance',dist,'minutes',round(mins),'factors',jsonb_build_object('Item attributes',attr,'Text similarity',txt,'Location proximity',loc,'Time proximity',tm));
 if exists(select 1 from public.matches where id=mid and payload->>'dismissed'='true') then mp:=mp||'{"dismissed":true}'::jsonb;end if;
 if not exists(select 1 from public.matches where id=mid) then perform public.magpie_notify(l.reporter_id,'Possible match found','A similar report may match your item. Review it privately in Magpie Updates.',l.id,mid);end if;
 insert into public.matches(id,lost_item_id,found_item_id,payload) values(mid,l.id,f.id,mp) on conflict(id) do update set payload=mp;
 update public.items set payload=jsonb_set(payload,'{status}','"Potential Match"') where id in(l.id,f.id) and payload->>'status'='Matching';
 end if;end loop;end loop;end $$;
create or replace function public.submit_report(report_id uuid,report_type text,report_payload jsonb,private_detail text,photo_paths text[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p jsonb;photo text;name_input text;category_input text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if (select count(*) from public.items where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Report limit reached. Try again later.';end if;
 if report_type not in('lost','found') then raise exception 'Invalid report type';end if;
 name_input:=trim(report_payload->>'name');category_input:=report_payload->>'category';
 if name_input is null or length(name_input) not between 2 and 80 then raise exception 'Item type must be 2–80 characters';end if;
 if category_input is null or category_input<>all(array['Electronics','Clothing','Wallet','University ID','Keys','Backpack','Water Bottle','Jewelry','School Supplies','Other']) then raise exception 'Invalid item category';end if;
 if length(coalesce(report_payload->>'color','')) not between 1 and 80 then raise exception 'General color or appearance is required';end if;
 if length(coalesce(report_payload->>'location','')) not between 1 and 120 then raise exception 'Campus location is required';end if;
 if length(coalesce(report_payload->>'description',''))>1500 or length(coalesce(private_detail,''))>1000 then raise exception 'Description is too long';end if;
 if (report_payload->>'date') is null or (report_payload->>'date')::timestamptz>now()+interval '15 minutes' then raise exception 'Date must not be in the future';end if;
 if (report_payload->>'lat') is null or (report_payload->>'lng') is null or (report_payload->>'lat')::float not between -90 and 90 or (report_payload->>'lng')::float not between -180 and 180 then raise exception 'A valid campus location is required';end if;
 if coalesce(array_length(photo_paths,1),0)>3 then raise exception 'At most three photos are allowed';end if;
 foreach photo in array coalesce(photo_paths,'{}'::text[]) loop
 if photo not like auth.uid()::text||'/'||report_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='item-images' and name=photo) then raise exception 'Photo does not belong to this report';end if;end loop;
 -- Explicit allowlist prevents injected statuses, foreign owners, or persistent signed URLs.
 p:=jsonb_build_object('id',report_id,'reporterId',auth.uid(),'type',report_type,'name',name_input,'category',category_input,'brand',left(coalesce(report_payload->>'brand',''),60),'model',left(coalesce(report_payload->>'model',''),60),'size',left(coalesce(report_payload->>'size',''),30),'color',report_payload->>'color','description',coalesce(report_payload->>'description',''),'features',coalesce(report_payload->>'description',''),'location',report_payload->>'location','lat',(report_payload->>'lat')::float,'lng',(report_payload->>'lng')::float,'date',report_payload->>'date','status','Matching','image','','imagePaths',to_jsonb(coalesce(photo_paths,'{}'::text[])));
 insert into public.items(id,reporter_id,report_type,payload) values(report_id,auth.uid(),submit_report.report_type,p);
 insert into public.private_item_details(item_id,reporter_id,private_description) values(report_id,auth.uid(),coalesce(private_detail,''));
 foreach photo in array coalesce(photo_paths,'{}'::text[]) loop insert into public.item_images(item_id,image_url) values(report_id,photo);end loop;
 perform public.magpie_notify(auth.uid(),'Report received','Your report is active. Possible matches will be sent privately.',report_id,null);
 perform public.refresh_matches();end $$;
create or replace function public.submit_claim(match_id_input text,answer_input text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare m public.matches;cid uuid:=gen_random_uuid();begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into m from public.matches where id=match_id_input;
 if not found or not exists(select 1 from public.items where id=m.lost_item_id and reporter_id=auth.uid() and payload->>'status' not in('Returned','Archived')) then raise exception 'Match is not available to your account';end if;
 if length(trim(answer_input)) not between 10 and 1500 then raise exception 'Provide 10–1500 characters of private identifying detail';end if;
 if (select count(*) from public.claims where claimant_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Claim limit reached. Try again later.';end if;
 if exists(select 1 from public.claims where claimant_id=auth.uid() and match_id=match_id_input) then raise exception 'You have already submitted a claim for this match';end if;
 if exists(select 1 from public.claims c join public.matches cm on cm.id=c.match_id where cm.found_item_id=m.found_item_id and c.payload->>'status' in('Approved','Returned')) then raise exception 'This item is no longer available';end if;
 insert into public.claims(id,match_id,claimant_id,payload) values(cid,match_id_input,auth.uid(),jsonb_build_object('id',cid,'matchId',match_id_input,'claimantId',auth.uid(),'answers',trim(answer_input),'score',0,'status','Pending'));
 update public.items set payload=jsonb_set(payload,'{status}','"Awaiting Verification"') where id=m.lost_item_id;
 perform public.magpie_notify(auth.uid(),'Ownership evidence received','Campus staff will review your private identifying details.',m.lost_item_id,match_id_input);end $$;
-- Supersede the old client-driven approval trigger; the new RPC owns the transaction.
drop trigger if exists claim_reviewed on public.claims;
drop trigger if exists limit_claim_inserts on public.claims;
create or replace function public.review_claim(claim_id_input uuid,decision text,pickup_location text,staff_message text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.claims;m public.matches;code_input text;token_input uuid;begin
 if not public.is_admin() then raise exception 'Administrator access required';end if;
 if decision not in('Approved','Rejected','More information') or length(trim(staff_message)) not between 3 and 2000 then raise exception 'Choose a decision and provide a private message';end if;
 select * into c from public.claims where id=claim_id_input for update;
 if not found or c.payload->>'status' not in('Pending','More information') then raise exception 'Claim is no longer awaiting review';end if;
 select * into m from public.matches where id=c.match_id;
 -- Serialize approvals for the same found item, including claims on different matches.
 perform 1 from public.items where id=m.found_item_id for update;
 if decision='Approved' then
 if length(trim(pickup_location)) not between 2 and 150 then raise exception 'Pickup location is required';end if;
 if exists(select 1 from public.claims cc join public.matches mm on mm.id=cc.match_id where cc.id<>c.id and mm.found_item_id=m.found_item_id and cc.payload->>'status' in('Approved','Returned')) then raise exception 'This item already has an approved owner';end if;
 code_input:='MAGPIE-'||upper(left(replace(gen_random_uuid()::text,'-',''),12));token_input:=gen_random_uuid();
 update public.claims set payload=payload||jsonb_build_object('status','Approved','code',code_input,'token',token_input,'pickupLocation',trim(pickup_location)),updated_at=now() where id=c.id;
 insert into public.pickups(claim_id,pickup_code,qr_token,status) values(c.id,code_input,token_input,'Ready');
 update public.items set payload=jsonb_set(payload,'{status}','"Ready for Pickup"'),updated_at=now() where id in(m.lost_item_id,m.found_item_id);
 else update public.claims set payload=jsonb_set(payload,'{status}',to_jsonb(decision)),updated_at=now() where id=c.id;
 if decision='Rejected' then update public.items set payload=jsonb_set(payload,'{status}','"Matching"') where id=m.lost_item_id;end if;
 end if;
 insert into public.correspondence(report_id,user_id,sender_id,body,from_staff) values(m.lost_item_id,c.claimant_id,auth.uid(),trim(staff_message),true);
 perform public.magpie_notify(c.claimant_id,case when decision='Approved' then 'Your item is ready for pickup' when decision='More information' then 'Additional ownership details requested' else 'Claim reviewed' end,trim(staff_message),m.lost_item_id,m.id);end $$;
create or replace function public.confirm_pickup(code text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare c public.claims;m public.matches;begin
 if not public.is_admin() then raise exception 'Administrator access required';end if;
 select * into c from public.claims where (payload->>'code'=upper(trim(code)) or payload->>'token'=trim(code)) and payload->>'status'='Approved' for update;
 if not found then raise exception 'Invalid or already redeemed pickup code';end if;
 select * into m from public.matches where id=c.match_id;
 update public.claims set payload=jsonb_set(payload,'{status}','"Returned"'),updated_at=now() where id=c.id;
 update public.items set payload=jsonb_set(payload,'{status}','"Returned"'),updated_at=now() where id in(m.lost_item_id,m.found_item_id);
 update public.pickups set status='Returned',picked_up_at=now() where claim_id=c.id;
 perform public.magpie_notify(c.claimant_id,'Item returned','Campus staff have confirmed your pickup.',m.lost_item_id,m.id);
 perform public.magpie_notify((select reporter_id from public.items where id=m.found_item_id),'Your found item was returned','Thank you for returning this item to its owner.',m.found_item_id,null);end $$;
create or replace function public.send_correspondence(report_id_input uuid,message_body text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare owner_id uuid;staff boolean:=public.is_admin();begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select reporter_id into owner_id from public.items where id=report_id_input;
 if owner_id is null or (owner_id<>auth.uid() and not staff) then raise exception 'You do not have access to this report';end if;
 if length(trim(message_body)) not between 3 and 2000 then raise exception 'Message must be 3–2000 characters';end if;
 if (select count(*) from public.correspondence where sender_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Message limit reached. Try again later.';end if;
 insert into public.correspondence(report_id,user_id,sender_id,body,from_staff) values(report_id_input,owner_id,auth.uid(),trim(message_body),staff);
 if staff then perform public.magpie_notify(owner_id,'New message from campus staff','You have a private message about your report.',report_id_input,null);end if;end $$;
create or replace function public.update_report_status(report_id uuid,new_status text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.is_admin() then raise exception 'Administrator access required';end if;
 if new_status not in('Matching','Secured','Archived') then raise exception 'Use the claim and pickup workflow to mark a return';end if;
 if exists(select 1 from public.matches m join public.claims c on c.match_id=m.id where report_id in(m.lost_item_id,m.found_item_id) and c.payload->>'status' in('Approved','Returned')) then raise exception 'This report is managed by an approved claim';end if;
 update public.items set payload=jsonb_set(payload,'{status}',to_jsonb(new_status)),updated_at=now() where id=report_id;
 if not found then raise exception 'Report not found';end if;
 perform public.magpie_notify((select reporter_id from public.items where id=report_id),'Report status updated','Your report status is now '||case when new_status='Matching' then 'Active' else new_status end||'.',report_id,null);end $$;
create or replace function public.dismiss_match(match_id_input text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if auth.uid() is null or not exists(select 1 from public.matches m join public.items i on i.id=m.lost_item_id where m.id=match_id_input and i.reporter_id=auth.uid()) then raise exception 'Match is not available to your account';end if;
 if exists(select 1 from public.claims where match_id=match_id_input and payload->>'status'<>'Rejected') then raise exception 'A claim is already in progress';end if;
 update public.matches set payload=jsonb_set(payload,'{dismissed}','true') where id=match_id_input;end $$;
create or replace function public.mark_updates_read() returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin if auth.uid() is null then raise exception 'Authentication required';end if;update public.notifications set payload=jsonb_set(payload,'{read}','true') where user_id=auth.uid();end $$;
-- Storage is private and requester-scoped. A short-lived URL may be minted only by owner/staff.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('item-images','item-images',false,3145728,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists own_image_upload on storage.objects;
drop policy if exists own_image_read on storage.objects;
drop policy if exists magpie_photo_read on storage.objects;
drop policy if exists magpie_photo_upload on storage.objects;
drop policy if exists magpie_photo_delete on storage.objects;
create policy magpie_photo_upload on storage.objects for insert to authenticated with check(bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text and array_length(storage.foldername(name),1)=2);
create policy magpie_photo_read on storage.objects for select to authenticated using(bucket_id='item-images' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy magpie_photo_delete on storage.objects for delete to authenticated using(bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.item_images im where im.image_url=storage.objects.name));
-- Remove old persistent bearer URLs from private report payloads; Storage remains the source.
update public.items set payload=jsonb_set(payload,'{image}','""') where payload->>'image' is not null and payload->>'image'<>'';
-- Explicit execute grants avoid PostgreSQL's default PUBLIC access to definer functions.
revoke all on function public.is_admin() from public;grant execute on function public.is_admin() to authenticated;
revoke all on function public.allowed_campus_email(text) from public;
revoke all on function public.handle_user() from public;
revoke all on function public.magpie_notify(uuid,text,text,uuid,text) from public;
revoke all on function public.search_public_reports() from public;grant execute on function public.search_public_reports() to anon,authenticated;
revoke all on function public.refresh_matches() from public;grant execute on function public.refresh_matches() to authenticated;
revoke all on function public.submit_report(uuid,text,jsonb,text,text[]) from public;grant execute on function public.submit_report(uuid,text,jsonb,text,text[]) to authenticated;
revoke all on function public.submit_claim(text,text) from public;grant execute on function public.submit_claim(text,text) to authenticated;
revoke all on function public.review_claim(uuid,text,text,text) from public;grant execute on function public.review_claim(uuid,text,text,text) to authenticated;
revoke all on function public.confirm_pickup(text) from public;grant execute on function public.confirm_pickup(text) to authenticated;
revoke all on function public.send_correspondence(uuid,text) from public;grant execute on function public.send_correspondence(uuid,text) to authenticated;
revoke all on function public.update_report_status(uuid,text) from public;grant execute on function public.update_report_status(uuid,text) to authenticated;
revoke all on function public.dismiss_match(text) from public;grant execute on function public.dismiss_match(text) to authenticated;
revoke all on function public.mark_updates_read() from public;grant execute on function public.mark_updates_read() to authenticated;
-- Restrict legacy internal trigger functions if upgrading.
do $$begin
 if to_regprocedure('public.on_claim_review()') is not null then execute 'revoke all on function public.on_claim_review() from public';end if;
 if to_regprocedure('public.limit_claims()') is not null then execute 'revoke all on function public.limit_claims() from public';end if;
end $$;
