# Spotify Pre-Release Import

Spotify Pre-Release links can become public before the corresponding album is available through the Spotify Web API. These links are handled by `scripts/import-spotify-prerelease.mjs`.

## Metadata sources

The importer reads the public Spotify oEmbed response and Pre-Release page to resolve:

- artist
- release title
- release type
- cover image
- release date, when Spotify exposes it

## Missing release dates

Some Spotify Pre-Release pages do not expose a machine-readable date. In that case, add an explicit `release_date` in `imports/spotify-release-request.json` using `YYYY-MM-DD`:

```json
{
  "spotify_release": "https://open.spotify.com/prerelease/…",
  "country": "DE",
  "status": "published",
  "release_date": "2026-07-17",
  "requested_at": "2026-07-15T18:31:30Z"
}
```

The workflow passes this value as `RELEASE_DATE`. Album URLs continue to use the regular Spotify Web API importer.

## Verification

After every import, verify both:

1. the newest entry in `public.spotify_import_logs`;
2. the stored row in `public.releases`.

A successful new import uses log status `created`. Updating an existing matching release uses `duplicate`.
