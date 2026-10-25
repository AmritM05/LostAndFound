begin;
-- MAG-008: terminal reports stay resolved; preserve competing claim history.
create or replace function submit_ownership_claim(p_user uuid,p_match uuid,p_answer text) returns uuid language plpgsql as $$
declare m potential_matches; l reports; f reports; cid uuid;
begin
 select * into m from potential_matches where id=p_match;
 -- All recovery actions lock lost, then found, then match/claim/pass.
 perform 1 from reports where id in(m.lost_report_id,m.found_report_id) order by report_type desc, id for update;
 select * into l from reports where id=m.lost_report_id;
 select * into f from reports where id=m.found_report_id;
 select * into m from potential_matches where id=p_match for update;
 if m.id is null or l.id is null or f.id is null or l.reporter_id is distinct from p_user or m.dismissed or l.status in ('Returned','Archived','Ready for Pickup') or f.status in ('Returned','Archived','Ready for Pickup') then raise exception 'Match unavailable';end if;
 if p_answer is null or length(trim(p_answer))<10 or length(p_answer)>1500 then raise exception 'Provide ownership details';end if;
 -- Keep the previous answer privately when more information is resubmitted.
 insert into report_notes(report_id,sender_id,body,from_staff) select l.id,p_user,answers,false from claims where match_id=p_match and claimant_id=p_user and status='More information';
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
 -- All recovery actions lock lost, then found, then match/claim/pass.
 perform 1 from reports where id in(m.lost_report_id,m.found_report_id) order by report_type desc, id for update;
 select * into l from reports where id=m.lost_report_id;
 select * into f from reports where id=m.found_report_id;
 select * into c from claims where id=p_claim for update;
 if c.id is null then raise exception 'Claim not found';end if;
 if p_status is null or m.dismissed or c.status not in ('Pending','More information') or p_status not in ('Approved','Rejected','More information') or l.status in ('Returned','Archived') or f.status in ('Returned','Archived') then raise exception 'Claim cannot be changed';end if;
 if length(coalesce(p_message,''))>2000 or (p_status='More information' and length(trim(coalesce(p_message,'')))=0) then raise exception 'Provide a private information request';end if;
 if p_status='Approved' then
  perform 1 from dropoff_zones where id=p_zone and active for share;
  if not found then raise exception 'Select an active drop-off zone';end if;
  if exists(select 1 from claims c2 join potential_matches m2 on m2.id=c2.match_id where c2.status in ('Approved','Returned') and (m2.found_report_id=f.id or m2.lost_report_id=l.id)) or l.status='Ready for Pickup' or f.status='Ready for Pickup' then raise exception 'Item already assigned';end if;
  insert into pickups(claim_id,zone_id,code_hash,display_code,expires_at) values(c.id,p_zone,p_hash,p_code,now()+interval '7 days');
  update reports set status='Ready for Pickup',custody_status=case when report_type='found' then 'Ready for Pickup' else custody_status end where id in(l.id,f.id);
  notice:='Your claim was approved. Your item is ready for pickup. Open your private pickup pass.';
 elsif p_status='More information' then notice:='Additional ownership information is needed. Submit an updated private claim answer or contact campus staff.';
 else
  notice:='Your claim was not approved. Contact campus staff if you have additional evidence.';
 end if;
 update claims set status=p_status,updated_at=now() where id=c.id;
 if p_status='Rejected' then
  if not has_active_recovery_claims(l.id) then update reports set status='Matching' where id=l.id;end if;
  if not has_active_recovery_claims(f.id) then update reports set custody_status='Stored' where id=f.id;end if;
 end if;
 insert into updates(user_id,report_id,match_id,title,message) values(c.claimant_id,l.id,m.id,case p_status when 'Approved' then 'Ready for pickup' when 'Rejected' then 'Claim reviewed' else 'More information needed' end,case when p_status='More information' then notice||E'\n\n'||trim(p_message) else notice end);
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
 perform 1 from reports where id in(m.lost_report_id,m.found_report_id) order by report_type desc, id for update;
 select * into c from claims where id=c.id for update;
 select * into p from pickups where code_hash=p_hash for update;
 if p.id is null or p.used_at is not null or p.expires_at is null or p.expires_at<=now() or c.status<>'Approved' or (select count(*) from reports where id in(m.lost_report_id,m.found_report_id) and status='Ready for Pickup')<>2 then raise exception 'Pickup code is invalid or expired';end if;
 update pickups set used_at=now() where id=p.id;
 update claims set status='Returned',updated_at=now() where id=c.id;
 update reports set status='Returned',custody_status=case when report_type='found' then 'Returned' else custody_status end where id in(m.lost_report_id,m.found_report_id);
 insert into updates(user_id,report_id,match_id,title,message) values(c.claimant_id,m.lost_report_id,m.id,'Item returned','Your item was returned. Thank you for using Magpie.');
 insert into staff_activity(staff_id,report_id,action) values(p_staff,m.found_report_id,'Confirmed item return');
end $$;
commit;
