create table if not exists public.release_import_requests (
  id uuid primary key default gen_random_uuid(),
  spotify_release text not null,
  spotify_id text not null check (spotify_id ~ '^[A-Za-z0-9]{22}$'),
  spotify_type text not null check (spotify_type in ('album', 'prerelease')),
  country text not null check (country in ('DE', 'US')),
  requested_status text not null default 'published' check (requested_status in ('draft', 'published')),
  release_date date null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  release_id uuid null references public.releases(id) on delete set null,
  source text not null default 'custom_gpt_action',
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null
);

create index if not exists release_import_requests_status_created_idx
  on public.release_import_requests (status, created_at);

create index if not exists release_import_requests_spotify_idx
  on public.release_import_requests (spotify_release, country, created_at desc);

create index if not exists release_import_requests_release_id_idx
  on public.release_import_requests (release_id);

create unique index if not exists release_import_requests_active_unique
  on public.release_import_requests (spotify_release, country)
  where status in ('queued', 'processing');

alter table public.release_import_requests enable row level security;

comment on table public.release_import_requests is
  'Private queue for authenticated Custom GPT Spotify import requests processed by GitHub Actions.';
