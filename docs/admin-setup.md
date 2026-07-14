# Admin editor setup

The `/admin/` route is a private editor for adding Release Friday entries from a phone. Supabase provides password authentication, Postgres storage and public cover images. GitHub Pages continues to host the frontend.

## 1. Supabase project

The `Release Friday` Supabase project is already connected to the GitHub Pages deployment. Its public project URL and publishable browser key live in `.github/workflows/pages.yml`; never replace that key with a secret or service-role key.

The database migrations are tracked in `supabase/migrations/` and have already been applied to the connected project:

- `20260714140000_create_release_editor.sql` creates the editor tables, policies and cover bucket.
- `20260714150000_harden_release_editor_access.sql` prevents public bucket listing and keeps the admin allowlist checks out of the public RPC surface.

Together they provide:

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

## Runtime behavior

- Drafts remain visible only through authenticated database access.
- Published entries for the current Friday are loaded into the public app without another deployment.
- If Supabase is temporarily unavailable or unconfigured, the curated static release list remains available.
- Public clients can only read rows whose status is `published`; database and storage writes require both a valid session and membership in `release_admins`.
