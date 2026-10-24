begin;
create table if not exists users (
 id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email)),
 display_name text not null, role text not null default 'student' check(role in ('student','admin')), created_at timestamptz not null default now()
);
create table if not exists demo_sessions (
 token_hash text primary key, user_id uuid not null references users(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists demo_sessions_expiry on demo_sessions(expires_at);
create table if not exists buildings (
 id text primary key, campus_id text not null, name text not null, aliases text[] not null default '{}',
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180), active boolean not null default true
);
create table if not exists dropoff_zones (
 id uuid primary key default gen_random_uuid(), building_id text references buildings(id), name text not null,
 instructions text, active boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists reports (
 id uuid primary key, reporter_id uuid not null references users(id), report_type text not null check(report_type in ('lost','found')),
 category text not null, item_name text not null, brand text not null default '', model text not null default '',
 primary_color text not null default '', secondary_color text not null default '', size text not null default '', description text not null default '',
 location_known boolean not null default false, building_id text references buildings(id), latitude double precision, longitude double precision,
 location_label text not null default 'Location unknown', lost_date date not null, lost_time time not null, occurred_at timestamptz not null,
 status text not null default 'Matching', dropoff_zone_id uuid references dropoff_zones(id), custody_status text, found_at timestamptz, received_at timestamptz, staff_notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((not location_known and building_id is null and latitude is null and longitude is null) or
 (location_known and latitude between -90 and 90 and longitude between -180 and 180 and latitude is not null and longitude is not null))
);
create index if not exists reports_owner on reports(reporter_id,created_at desc);
create index if not exists reports_matching on reports(report_type,category,status);
create table if not exists private_report_details (
 report_id uuid primary key references reports(id) on delete cascade, owner_description text not null default '',
 serial_fragment text, stickers text, scratches text, contents text, unique_markings text
);
create table if not exists report_images (
 id uuid primary key, owner_id uuid not null references users(id), report_id uuid references reports(id) on delete cascade,
 filename text not null, mime_type text not null, byte_size bigint not null check(byte_size>0),
 blob_pathname text not null unique, blob_url text, preview_pathname text unique, preview_url text,
 status text not null default 'pending' check(status in ('pending','uploaded')), created_at timestamptz not null default now()
);
create index if not exists report_images_report on report_images(report_id);
create table if not exists potential_matches (
 id uuid primary key default gen_random_uuid(), lost_report_id uuid not null references reports(id), found_report_id uuid not null references reports(id),
 score double precision not null, factors jsonb not null default '{}', distance_km double precision, minutes_difference integer,
 dismissed boolean not null default false, created_at timestamptz not null default now(), unique(lost_report_id,found_report_id)
);
create table if not exists claims (
 id uuid primary key default gen_random_uuid(), match_id uuid not null references potential_matches(id), claimant_id uuid not null references users(id),
 answers text not null, status text not null default 'Pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists pickups (
 id uuid primary key default gen_random_uuid(), claim_id uuid not null unique references claims(id), zone_id uuid references dropoff_zones(id),
 code_hash text unique, token_hash text unique, expires_at timestamptz, used_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists updates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id), report_id uuid references reports(id), match_id uuid references potential_matches(id),
 title text not null, message text not null, read boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists updates_owner on updates(user_id,created_at desc);
create table if not exists report_notes (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references reports(id), sender_id uuid not null references users(id),
 body text not null, from_staff boolean not null default false, created_at timestamptz not null default now()
);
-- The only generic search representation. No photos, identifying attributes, identities or staff notes.
create or replace view public_found_summaries as
 select r.id, 'found'::text as type, r.category, coalesce(b.name,'Campus drop-off point') as location,
 (r.occurred_at at time zone 'UTC')::date as date, 'In Magpie custody'::text as status
 from reports r left join dropoff_zones z on z.id=r.dropoff_zone_id left join buildings b on b.id=z.building_id
 where r.report_type='found' and r.status not in ('Returned','Archived') and r.dropoff_zone_id is not null;
create or replace function save_student_report(p_user uuid, p jsonb, p_private text, p_images uuid[], p_edit boolean default false)
returns uuid language plpgsql as $$
declare rid uuid := (p->>'id')::uuid; bid text; lat double precision; lng double precision; known boolean; loc text; occurred timestamptz; existing reports;
begin
 if p->>'type' is distinct from 'lost' then raise exception 'Students may only create lost reports'; end if;
 if not exists(select 1 from users where id=p_user) then raise exception 'User not found'; end if;
 if coalesce(length(trim(p->>'name')),0)=0 or length(p->>'name')>150 or coalesce(length(trim(p->>'category')),0)=0 then raise exception 'Item name and category are required'; end if;
 occurred := (p->>'date')::timestamptz;
 if occurred is null or occurred>now()+interval '5 minutes' then raise exception 'Choose a valid past date'; end if;
 known := coalesce((p->>'locationKnown')::boolean,false); bid:=nullif(p->>'buildingId','');
 if known and bid is not null then
   select latitude,longitude,name into lat,lng,loc from buildings where id=bid and active;
   if not found then raise exception 'Select an active campus building'; end if;
 elsif known then lat:=(p->>'lat')::float;lng:=(p->>'lng')::float;loc:='Approximate campus location';
 else bid:=null;lat:=null;lng:=null;loc:='Location unknown';end if;
 if known and (lat is null or lng is null or not(lat between -90 and 90) or not(lng between -180 and 180)) then raise exception 'Choose valid coordinates or location unknown';end if;
 if p_edit then
   select * into existing from reports where id=rid and reporter_id=p_user and report_type='lost' for update;
   if not found then raise exception 'Report not found';end if;
   if exists(select 1 from claims c join potential_matches m on m.id=c.match_id where m.lost_report_id=rid and c.status not in ('Rejected','Returned')) then raise exception 'This report has an active claim';end if;
   update reports set category=p->>'category',item_name=trim(p->>'name'),brand=coalesce(p->>'brand',''),model=coalesce(p->>'model',''),primary_color=coalesce(p->>'color',''),secondary_color=coalesce(p->>'secondaryColor',''),size=coalesce(p->>'size',''),description=coalesce(p->>'description',''),location_known=known,building_id=bid,latitude=lat,longitude=lng,location_label=loc,lost_date=(occurred at time zone 'UTC')::date,lost_time=(occurred at time zone 'UTC')::time,occurred_at=occurred,updated_at=now() where id=rid;
 else
   select * into existing from reports where id=rid;
   if found then if existing.reporter_id=p_user and existing.report_type='lost' then return rid;else raise exception 'Report ID unavailable';end if;end if;
   if cardinality(p_images)>3 or cardinality(p_images)<>(select count(distinct x) from unnest(p_images) x) then raise exception 'Choose up to three unique images';end if;
   perform 1 from report_images where id=any(p_images) for update;
   if cardinality(p_images)<>(select count(*) from report_images where id=any(p_images) and owner_id=p_user and report_id is null and status='uploaded') then raise exception 'Image upload is incomplete or unavailable';end if;
   insert into reports(id,reporter_id,report_type,category,item_name,brand,model,primary_color,secondary_color,size,description,location_known,building_id,latitude,longitude,location_label,lost_date,lost_time,occurred_at)
   values(rid,p_user,'lost',p->>'category',trim(p->>'name'),coalesce(p->>'brand',''),coalesce(p->>'model',''),coalesce(p->>'color',''),coalesce(p->>'secondaryColor',''),coalesce(p->>'size',''),coalesce(p->>'description',''),known,bid,lat,lng,loc,(occurred at time zone 'UTC')::date,(occurred at time zone 'UTC')::time,occurred);
   update report_images set report_id=rid where id=any(p_images);
   insert into updates(user_id,report_id,title,message) values(p_user,rid,'Lost report saved','Your report has been saved. Possible matches and staff updates will appear here when available.');
 end if;
 insert into private_report_details(report_id,owner_description) values(rid,coalesce(p_private,'')) on conflict(report_id) do update set owner_description=excluded.owner_description;
 return rid;
end $$;
commit;
