-- Replace the delay-sensitive GitHub Actions archive job with an observable,
-- idempotent database cron job.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres;

create or replace function private.release_archive_due_at(p_release_date date)
returns timestamptz
language sql
immutable
strict
set search_path = ''
as $$
  select (p_release_date::timestamp + interval '2 days 1 minute')
    at time zone 'Europe/Berlin';
$$;

create or replace function private.archive_due_releases(p_now timestamptz default now())
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  archived_count integer;
begin
  update public.releases as release
  set archived_at = private.release_archive_due_at(release.release_date)
  where release.status = 'published'
    and release.archived_at is null
    and private.release_archive_due_at(release.release_date) <= p_now;

  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

-- Only the database scheduler may execute the internal archive functions.
revoke all on function private.release_archive_due_at(date) from public, anon, authenticated;
revoke all on function private.archive_due_releases(timestamptz) from public, anon, authenticated;
grant execute on function private.release_archive_due_at(date) to postgres;
grant execute on function private.archive_due_releases(timestamptz) to postgres;

create index if not exists releases_archive_due_idx
  on public.releases (release_date)
  where status = 'published' and archived_at is null;

-- Staged releases become public at Sunday 00:01 Europe/Berlin.
create or replace function public.set_release_visible_from()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  next_sunday timestamp;
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    next_sunday := date_trunc('week', local_now) + interval '6 days 1 minute';
    if local_now < next_sunday then
      new.visible_from := next_sunday at time zone 'Europe/Berlin';
    else
      new.visible_from := now();
    end if;
  end if;
  return new;
end;
$$;

-- Cover both UTC offsets for Europe/Berlin. Running every minute makes the
-- operation self-healing when an individual tick is delayed or missed.
do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'archive-due-friday-releases'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'archive-due-friday-releases',
  '* 22,23 * * 6',
  'select private.archive_due_releases();'
);

-- Catch up safely when the migration is installed after a deadline.
select private.archive_due_releases();
