alter table public.releases
  add column if not exists visible_from timestamptz not null default now();

create index if not exists releases_visible_from_idx
  on public.releases (visible_from, release_date desc)
  where status = 'published';

create or replace function public.set_release_visible_from()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  next_sunday timestamp;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    next_sunday := date_trunc('week', local_now) + interval '6 days';
    if local_now < next_sunday then
      new.visible_from := next_sunday at time zone 'Europe/Berlin';
    else
      new.visible_from := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists set_release_visible_from on public.releases;
create trigger set_release_visible_from
before insert or update on public.releases
for each row execute function public.set_release_visible_from();

grant select (visible_from) on public.releases to anon, authenticated;

drop policy if exists "Published releases are public" on public.releases;
create policy "Published and visible releases are public"
on public.releases
for select
to anon
using (status = 'published' and visible_from <= now());

drop policy if exists "Authenticated release visibility" on public.releases;
create policy "Authenticated release visibility"
on public.releases
for select
to authenticated
using (
  (status = 'published' and visible_from <= now())
  or exists (select 1 from public.release_admins where user_id = (select auth.uid()))
);
