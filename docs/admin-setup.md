# Admin editor setup

The `/admin/` route is a private editor for adding Release Friday entries from a phone. Supabase provides password authentication, Postgres storage and public cover images. GitHub Pages continues to host the frontend.

## 1. Create the Supabase project

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor**.
3. Run `supabase/migrations/20260714140000_create_release_editor.sql` once.

The migration creates:

- `release_admins`, the explicit editor allowlist;
- `releases`, including draft and published states;
- row-level security policies for public reads and admin-only writes;
- the public `release-covers` bucket with an 8 MB image limit.

## 2. Create the first admin

1. In Supabase, open **Authentication → Users → Add user**.
2. Create the user with an email and a strong password, and mark the email as confirmed.
3. In **SQL Editor**, run the following statement with the same email:

```sql
insert into public.release_admins (user_id)
select id from auth.users where email = 'YOUR-ADMIN-EMAIL'
on conflict (user_id) do nothing;
```

Do not add a public sign-up flow. Additional editors should be created and allowlisted the same way.

## 3. Connect GitHub Pages

In Supabase, open **Project Settings → API** and copy the project URL and the publishable key (the legacy anon key also works). Never use the service-role key in the frontend.

In GitHub, open **Settings → Secrets and variables → Actions** and add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then run **Actions → Deploy Release Friday to GitHub Pages → Run workflow** once. The `/admin/` login becomes active after deployment.

## Runtime behavior

- Drafts remain visible only through authenticated database access.
- Published entries for the current Friday are loaded into the public app without another deployment.
- If Supabase is temporarily unavailable or unconfigured, the curated static release list remains available.
- Public clients can only read rows whose status is `published`; database and storage writes require both a valid session and membership in `release_admins`.
