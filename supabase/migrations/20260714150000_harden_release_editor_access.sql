drop policy if exists "Release covers are public" on storage.objects;

drop policy if exists "Published releases are public" on public.releases;
drop policy if exists "Admins can read all releases" on public.releases;
create policy "Published releases are public"
on public.releases
for select
to anon
using (status = 'published');

create policy "Authenticated release visibility"
on public.releases
for select
to authenticated
using (
  status = 'published'
  or exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can create releases" on public.releases;
create policy "Admins can create releases"
on public.releases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
  and created_by = (select auth.uid())
);

drop policy if exists "Admins can update releases" on public.releases;
create policy "Admins can update releases"
on public.releases
for update
to authenticated
using (
  exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can delete releases" on public.releases;
create policy "Admins can delete releases"
on public.releases
for delete
to authenticated
using (
  exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can upload release covers" on storage.objects;
create policy "Admins can upload release covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'release-covers'
  and exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Admins can update their release covers" on storage.objects;
create policy "Admins can update their release covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'release-covers'
  and exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'release-covers'
  and exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Admins can delete their release covers" on storage.objects;
create policy "Admins can delete their release covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'release-covers'
  and exists (
    select 1
    from public.release_admins
    where user_id = (select auth.uid())
  )
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

revoke all on function public.is_release_admin() from public, anon, authenticated;
drop function if exists public.is_release_admin();
