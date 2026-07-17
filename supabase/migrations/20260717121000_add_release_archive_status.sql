alter table public.releases
  add column if not exists archived_at timestamptz;

create index if not exists releases_archived_at_idx
  on public.releases (archived_at desc, release_date desc)
  where archived_at is not null;

grant select (archived_at) on public.releases to anon, authenticated;
