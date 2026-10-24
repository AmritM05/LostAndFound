begin;
-- Keep recovery protection identical in the UI projection and deletion transaction.
create or replace function has_active_recovery(p_report uuid) returns boolean language sql stable as $$
 select exists(select 1 from reports where id=p_report and status in ('Awaiting Verification','Ready for Pickup'))
 or exists(select 1 from potential_matches m join claims c on c.match_id=m.id
 where (m.lost_report_id=p_report or m.found_report_id=p_report) and c.status not in ('Rejected','Returned'))
 or exists(select 1 from potential_matches m join claims c on c.match_id=m.id join pickups p on p.claim_id=c.id
 where (m.lost_report_id=p_report or m.found_report_id=p_report) and p.used_at is null and (p.expires_at is null or p.expires_at>now()));
$$;
-- Transactional outbox survives a deleted report and temporary Blob outages.
create table if not exists blob_cleanup_jobs (
 id uuid primary key default gen_random_uuid(), report_id uuid not null, user_id uuid not null references users(id),
 blob_pathname text not null unique, attempts integer not null default 0, last_error text,
 created_at timestamptz not null default now(), completed_at timestamptz
);
create or replace function delete_own_lost_report(p_user uuid,p_report uuid) returns boolean language plpgsql as $$
declare match_ids uuid[]; claim_ids uuid[];
begin
 perform 1 from reports where id=p_report and reporter_id=p_user and report_type='lost' for update;
 if not found then return false;end if;
 -- Lock related rows before checking recovery and deleting dependent records.
 -- Concurrent FK inserts either finish before this check or fail after deletion.
 perform 1 from potential_matches where lost_report_id=p_report or found_report_id=p_report for update;
 select coalesce(array_agg(id),'{}') into match_ids from potential_matches where lost_report_id=p_report or found_report_id=p_report;
 perform 1 from claims where match_id=any(match_ids) for update;
 select coalesce(array_agg(id),'{}') into claim_ids from claims where match_id=any(match_ids);
 perform 1 from pickups where claim_id=any(claim_ids) for update;
 if has_active_recovery(p_report) then raise exception 'This report cannot be deleted while an active recovery is in progress.';end if;
 insert into blob_cleanup_jobs(report_id,user_id,blob_pathname)
 select p_report,p_user,path from report_images i cross join lateral (values(i.blob_pathname),(i.preview_pathname)) paths(path)
 where i.report_id=p_report and path is not null on conflict(blob_pathname) do nothing;
 delete from updates where report_id=p_report or (report_id is null and match_id=any(match_ids));
 -- Preserve notices about other reports while removing their stale match references.
 update updates set match_id=null where match_id=any(match_ids);
 delete from pickups where claim_id=any(claim_ids);
 delete from claims where id=any(claim_ids);
 delete from potential_matches where id=any(match_ids);
 delete from report_notes where report_id=p_report;
 delete from reports where id=p_report;
 -- private_report_details and report_images cascade from reports.
 return true;
end $$;
commit;
