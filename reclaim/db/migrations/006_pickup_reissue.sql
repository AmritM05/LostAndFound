begin;
-- MAG-009: a missed deadline does not imply physical return or release assignment.
-- 005 is reserved for matching. This additive migration replaces no shared function.
create or replace function reissue_expired_pickup(
 p_staff uuid, p_pickup uuid, p_zone uuid, p_code text, p_hash text
) returns void language plpgsql as $$
declare p pickups; c claims; m potential_matches; l reports; f reports; deadline timestamptz;
begin
 if not exists(select 1 from users where id=p_staff and role='admin') then
  raise exception 'Access denied';
 end if;
 select * into p from pickups where id=p_pickup;
 select * into c from claims where id=p.claim_id;
 select * into m from potential_matches where id=c.match_id;
 -- Same report order as migration 004 redemption/claim review.
 perform 1 from reports where id in(m.lost_report_id,m.found_report_id)
  order by report_type desc, id for update;
 select * into m from potential_matches where id=c.match_id for update;
 select * into c from claims where id=p.claim_id for update;
 select * into p from pickups where id=p_pickup for update;
 select * into l from reports where id=m.lost_report_id;
 select * into f from reports where id=m.found_report_id;
 if p.id is null or c.id is null or m.id is null or l.id is null or f.id is null
  or p.used_at is not null or c.status<>'Approved' or m.dismissed
  or c.claimant_id is distinct from l.reporter_id
  or l.status<>'Ready for Pickup' or f.status<>'Ready for Pickup'
  or (p.expires_at is not null and p.expires_at>clock_timestamp())
  or exists(select 1 from claims c2 join potential_matches m2 on m2.id=c2.match_id
   where c2.id<>c.id and c2.status in ('Approved','Returned')
    and (m2.lost_report_id=l.id or m2.found_report_id=f.id))
  then raise exception 'Pickup cannot be reissued';
 end if;
 if p_code is null or p_code !~ '^[A-F0-9]{12}$' or p_hash is null
  or p_hash !~ '^[a-f0-9]{64}$' or p_hash=p.code_hash then
  raise exception 'Pickup cannot be reissued';
 end if;
 perform 1 from dropoff_zones where id=p_zone and active for share;
 if not found then raise exception 'Select an active drop-off zone';end if;
 deadline:=clock_timestamp()+interval '7 days';
 -- Preserve the single approved assignment and invalidate all old credentials.
 update pickups set code_hash=p_hash,display_code=p_code,token_hash=null,
  zone_id=p_zone,expires_at=deadline where id=p.id;
 insert into updates(user_id,report_id,match_id,title,message)
  values(c.claimant_id,l.id,m.id,'Pickup pass renewed',
   'Campus staff renewed your private pickup pass. Your previous code no longer works. Open your current pass in Updates. Collect by '
    ||to_char(deadline at time zone 'UTC','YYYY-MM-DD HH24:MI')||' UTC.');
 insert into staff_activity(staff_id,report_id,action)
  values(p_staff,f.id,'Renewed expired pickup pass');
end $$;
commit;
