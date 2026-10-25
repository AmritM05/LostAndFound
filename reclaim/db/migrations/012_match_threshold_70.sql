begin;
-- Visibility/persistence threshold only; preserve stored historical assessments,
-- report data, measured AI, claims, pickups and existing notifications.
create or replace function matching_candidate_min_score() returns integer language sql immutable as $$ select 70 $$;
create or replace function matching_notice_min_score() returns integer language sql immutable as $$ select 70 $$;
commit;
