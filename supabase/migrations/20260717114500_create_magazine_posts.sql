create table if not exists public.magazine_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  scope text not null check (scope in ('ALL', 'DE', 'US')),
  excerpt text not null check (char_length(btrim(excerpt)) between 1 and 500),
  body text not null check (char_length(btrim(body)) between 1 and 20000),
  cover_url text,
  source_url text,
  author_name text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists magazine_posts_scope_published_idx
  on public.magazine_posts (scope, published_at desc, created_at desc)
  where status = 'published';

create or replace function public.set_magazine_post_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_magazine_post_updated_at on public.magazine_posts;
create trigger set_magazine_post_updated_at
before insert or update on public.magazine_posts
for each row execute function public.set_magazine_post_updated_at();

alter table public.magazine_posts enable row level security;
revoke all on public.magazine_posts from anon, authenticated;
grant select, insert, update, delete on public.magazine_posts to authenticated;

create policy "Admins can manage magazine posts"
on public.magazine_posts
for all
to authenticated
using (exists (select 1 from public.release_admins where user_id = (select auth.uid())))
with check (
  exists (select 1 from public.release_admins where user_id = (select auth.uid()))
  and created_by = (select auth.uid())
);
