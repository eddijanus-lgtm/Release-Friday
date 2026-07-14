# Repository instructions for AI agents

## Project source of truth

Before changing Release Friday, read:

1. `README.md`
2. `docs/architecture.md`
3. `docs/operations.md`
4. For release creation: `docs/chatgpt-release-template.md`

## Workflow

- Major features and bug fixes must be developed on a separate branch.
- Open a Pull Request for all major features and bug fixes.
- Small, low-risk changes such as documentation updates, text corrections, comments, and minor styling may be committed directly to `main`.

## Merge policy

- Never merge a Pull Request before all required GitHub Actions and CI checks have completed successfully.
- A PR with pending, missing, cancelled, or failed checks must not be merged.
- If any check fails, inspect the logs, fix the problem on the PR branch, and wait for a new fully green CI run.
- Never bypass or ignore failing checks.
- Prefer stability over speed.

## Release creation rules

- Supabase is the productive source of truth for releases.
- Do not claim a release is published when only `lib/releases/real-releases.generated.ts` was changed.
- Check duplicates by normalized artist, title and release date before inserting.
- Never overwrite an existing manual release unless the user explicitly requests an update.
- Never invent Spotify, Apple Music, YouTube, pre-save, source or cover URLs.
- Empty Spotify, Apple Music and YouTube fields may use search fallbacks.
- Empty pre-save and source fields must remain empty.
- Use only `album`, `ep`, `single` or `mixtape` for `kind`.
- Use only `DE` or `US` for `country`.
- Use `YYYY-MM-DD` for release dates.
- Verify the stored record after writing.

## Secrets

- Never expose or commit `SUPABASE_SERVICE_ROLE_KEY`.
- Never put a service-role key in `NEXT_PUBLIC_*` variables.
- The browser publishable key is not an admin credential.

## Frontend architecture

- GitHub Pages requires a static Next.js export.
- Productive Supabase loading must remain browser-side for the public page.
- Preserve the generated release list as an availability fallback.
- Preserve curated media when Supabase fields are empty.
- Keep iPhone behavior intact when changing iPad styles.

## Deployment

After frontend or build changes:

1. run or reason through `npm run build`;
2. verify the GitHub Pages workflow;
3. do not report success before the deployment state is known;
4. do not merge a Pull Request until the complete CI pipeline is green.

## Admin and data safety

- Admin-only functionality must never become publicly accessible.
- Changes to authentication, authorization, RLS, storage policies, or admin permissions require careful review.
- Archived releases should behave like current releases unless explicitly specified otherwise.
- Past releases must remain searchable and clearly labelled.

## Required template

When asked to create a release through ChatGPT, follow `docs/chatgpt-release-template.md` and request any genuinely missing required fields. If Supabase write access is unavailable, state that clearly and do not pretend a GitHub-only change has populated the productive database.
