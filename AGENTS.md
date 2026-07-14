# Repository instructions for AI agents

## Project source of truth

Before changing Release Friday, read:

1. `README.md`
2. `docs/architecture.md`
3. `docs/operations.md`
4. For release creation: `docs/chatgpt-release-template.md`

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
3. do not report success before the deployment state is known.

## Required template

When asked to create a release through ChatGPT, follow `docs/chatgpt-release-template.md` and request any genuinely missing required fields. If Supabase write access is unavailable, state that clearly and do not pretend a GitHub-only change has populated the productive database.