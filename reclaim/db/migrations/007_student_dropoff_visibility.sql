begin;
-- MAG-003: staff activity/custody does not imply consent to student publication.
-- Never copy legacy staff instructions or auto-publish existing active desks.
alter table dropoff_zones add column if not exists student_visible boolean not null default false;
alter table dropoff_zones add column if not exists public_instructions text not null default '';
commit;
