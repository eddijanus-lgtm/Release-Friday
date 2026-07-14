create extension if not exists pgcrypto;

create table if not exists public.release_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  artist text not null check (char_length(btrim(artist)) between 1 and 200),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  release_date date not null,
  country text not null check (country in ('DE', 'US')),
  kind text not null check (kind in ('album', 'ep', 'single', 'mixtape')),
  cover_url text,
  storage_path text,
  spotify_url text,
  spotify_pre_save_url text,
  apple_music_url text,
  youtube_url text,
  source_url text,
  description text check (description is null or char_length(description) <= 5000),
  track_count smallint check (track_count is null or track_count between 1 and 999),
  genres text[] not null default '{}',
  source text not null default 'Manuell veröffentlicht',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists releases_created_by_idx on public.releases (created_by);
create index if not exists releases_published_release_date_idx
  on public.releases (release_date, country, created_at)
  where status = 'published';
create unique index if not exists releases_spotify_url_unique_idx
  on public.releases (spotify_url)
  where spotify_url is not null and spotify_url <> '';

create or replace function public.is_release_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_release_admin() from public;
grant execute on function public.is_release_admin() to anon, authenticated;

create or replace function public.set_release_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_release_updated_at on public.releases;
create trigger set_release_updated_at
before update on public.releases
for each row execute function public.set_release_updated_at();

alter table public.release_admins enable row level security;
alter table public.releases enable row level security;

revoke all on public.release_admins from anon, authenticated;
grant select on public.release_admins to authenticated;
revoke all on public.releases from anon, authenticated;
grant select (
  id,
  artist,
  title,
  release_date,
  country,
  kind,
  cover_url,
  spotify_url,
  spotify_pre_save_url,
  apple_music_url,
  youtube_url,
  source_url,
  description,
  track_count,
  genres,
  source,
  status,
  created_at,
  updated_at
) on public.releases to anon, authenticated;
grant insert, update, delete on public.releases to authenticated;

drop policy if exists "Admins can read their own membership" on public.release_admins;
create policy "Admins can read their own membership"
on public.release_admins
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Published releases are public" on public.releases;
create policy "Published releases are public"
on public.releases
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all releases" on public.releases;
create policy "Admins can read all releases"
on public.releases
for select
to authenticated
using ((select public.is_release_admin()));

drop policy if exists "Admins can create releases" on public.releases;
create policy "Admins can create releases"
on public.releases
for insert
to authenticated
with check (
  (select public.is_release_admin())
  and created_by = (select auth.uid())
);

drop policy if exists "Admins can update releases" on public.releases;
create policy "Admins can update releases"
on public.releases
for update
to authenticated
using ((select public.is_release_admin()))
with check ((select public.is_release_admin()));

drop policy if exists "Admins can delete releases" on public.releases;
create policy "Admins can delete releases"
on public.releases
for delete
to authenticated
using ((select public.is_release_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'release-covers',
  'release-covers',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Release covers are public" on storage.objects;
create policy "Release covers are public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'release-covers');

drop policy if exists "Admins can upload release covers" on storage.objects;
create policy "Admins can upload release covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'release-covers'
  and (select public.is_release_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Admins can update their release covers" on storage.objects;
create policy "Admins can update their release covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'release-covers'
  and (select public.is_release_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'release-covers'
  and (select public.is_release_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Admins can delete their release covers" on storage.objects;
create policy "Admins can delete their release covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'release-covers'
  and (select public.is_release_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
