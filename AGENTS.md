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

## Spotify release import

This workflow is mandatory for future Spotify imports unless the user explicitly requests a different process.

### Default behavior

- If the user sends only a Spotify link or Spotify ID without additional instructions, assume they want the release imported.
- Do not ask for confirmation when the link or ID can be processed and all required data can be retrieved.
- Ask only for genuinely missing information that cannot be obtained from Spotify or the existing project data.

### Published Spotify releases

When the user provides a Spotify album link such as `https://open.spotify.com/album/...` or an album ID:

- Treat it as a published Spotify release.
- Use the existing Spotify import workflow or GitHub Action rather than manually inventing metadata.
- Import the artist, title, release date, release type, track count, genres when available, Spotify URL and cover supplied by Spotify.
- Store the real album URL in `spotify_url`.
- Leave `spotify_pre_save_url` empty.
- Check for an existing release before inserting to prevent duplicates.
- Verify the resulting Supabase record after the import.

### Spotify pre-save releases

When the user provides a supported Spotify pre-release or pre-save link, including a `/prerelease/` link:

- Treat it as an unreleased release.
- Store the original link in `spotify_pre_save_url`.
- Never copy a pre-save link into `spotify_url`.
- Leave `spotify_url` empty until a real Spotify album URL exists.
- Do not invent an album ID, album URL, cover, release date or other missing metadata.
- When the release becomes available, replace or supplement the pre-save data with the real Spotify album URL only when requested by the user or performed by an approved release-day automation.
- Verify the resulting Supabase record after writing.

### Link and ID detection

- `https://open.spotify.com/album/...` means a published Spotify release.
- A supported Spotify URL containing `/prerelease/` means a pre-save release.
- When only an ID is supplied, use the conversation context to determine whether it originated from an album or pre-release URL.
- If the type cannot be determined safely, ask one concise clarification instead of guessing.

### Missing platform links

- Missing Spotify, Apple Music or YouTube destinations may use the project's existing search fallbacks.
- Never generate a fake Spotify album URL.
- Never generate a fake Spotify pre-save URL.
- A missing pre-save or source URL must remain empty.

### Verification after import

After every import:

1. verify that the release exists in Supabase;
2. verify artist, title, release date, country and kind;
3. verify that `spotify_url` and `spotify_pre_save_url` are stored in the correct fields;
4. verify that no duplicate record was created;
5. report success only after the stored record has been checked.

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
