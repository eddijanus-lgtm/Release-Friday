alter table public.magazine_posts
  add column if not exists category text not null default 'IN_SCOPE',
  add column if not exists region text not null default 'GLOBAL',
  add column if not exists facts jsonb not null default '[]'::jsonb,
  add column if not exists release_week date,
  add column if not exists publish_at timestamptz,
  add column if not exists featured boolean not null default false,
  add column if not exists storage_path text;

alter table public.magazine_posts
  drop constraint if exists magazine_posts_category_check,
  add constraint magazine_posts_category_check
    check (category in ('IN_SCOPE', 'US_RADAR', 'DE_FOCUS', 'MUST_HEAR', 'FIRST_LISTEN', 'COVER_CHECK', 'FEATURE_WATCH'));

alter table public.magazine_posts
  drop constraint if exists magazine_posts_region_check,
  add constraint magazine_posts_region_check
    check (region in ('DE', 'US', 'GLOBAL'));

alter table public.magazine_posts
  drop constraint if exists magazine_posts_status_check,
  add constraint magazine_posts_status_check
    check (status in ('draft', 'preview', 'published', 'archived'));

alter table public.magazine_posts
  drop constraint if exists magazine_posts_facts_array_check,
  add constraint magazine_posts_facts_array_check
    check (jsonb_typeof(facts) = 'array' and jsonb_array_length(facts) <= 6);

alter table public.magazine_posts
  alter column category drop default,
  alter column region drop default;

create table if not exists public.magazine_post_releases (
  magazine_post_id uuid not null references public.magazine_posts (id) on delete cascade,
  release_id uuid not null references public.releases (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (magazine_post_id, release_id)
);

create index if not exists magazine_posts_public_idx
  on public.magazine_posts (featured desc, publish_at desc, published_at desc, created_at desc)
  where status = 'published';

create index if not exists magazine_posts_week_idx
  on public.magazine_posts (release_week desc, region, category);

create index if not exists magazine_post_releases_release_idx
  on public.magazine_post_releases (release_id, position);

grant select on public.magazine_posts to anon;

drop policy if exists "Published magazine posts are public" on public.magazine_posts;
create policy "Published magazine posts are public"
on public.magazine_posts
for select
to anon
using (
  status = 'published'
  and coalesce(publish_at, published_at, created_at) <= now()
);

create or replace function public.set_magazine_post_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  elsif new.status in ('draft', 'preview') then
    new.published_at = null;
  end if;

  if new.publish_at is null and new.status = 'published' then
    new.publish_at = new.published_at;
  end if;

  return new;
end;
$$;

alter table public.magazine_post_releases enable row level security;
revoke all on public.magazine_post_releases from anon, authenticated;
grant select, insert, update, delete on public.magazine_post_releases to authenticated;
grant select on public.magazine_post_releases to anon;

drop policy if exists "Published magazine post release links are public" on public.magazine_post_releases;
create policy "Published magazine post release links are public"
on public.magazine_post_releases
for select
to anon
using (
  exists (
    select 1
    from public.magazine_posts
    where magazine_posts.id = magazine_post_releases.magazine_post_id
      and magazine_posts.status = 'published'
      and coalesce(magazine_posts.publish_at, magazine_posts.published_at, magazine_posts.created_at) <= now()
  )
);

drop policy if exists "Admins can manage magazine post releases" on public.magazine_post_releases;
create policy "Admins can manage magazine post releases"
on public.magazine_post_releases
for all
to authenticated
using (exists (select 1 from public.release_admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.release_admins where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('magazine-assets', 'magazine-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload magazine assets" on storage.objects;
create policy "Admins can upload magazine assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'magazine-assets'
  and exists (select 1 from public.release_admins where user_id = (select auth.uid()))
);

drop policy if exists "Admins can update magazine assets" on storage.objects;
create policy "Admins can update magazine assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'magazine-assets'
  and exists (select 1 from public.release_admins where user_id = (select auth.uid()))
)
with check (
  bucket_id = 'magazine-assets'
  and exists (select 1 from public.release_admins where user_id = (select auth.uid()))
);

drop policy if exists "Admins can delete magazine assets" on storage.objects;
create policy "Admins can delete magazine assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'magazine-assets'
  and exists (select 1 from public.release_admins where user_id = (select auth.uid()))
);
