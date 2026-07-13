# Release Friday architecture

## Goal

Every Thursday, Release Friday presents the hip-hop and rap releases scheduled for the coming Friday in Germany and the United States.

## Initial architecture

- **Frontend:** Next.js App Router, React and TypeScript
- **Domain model:** shared release types in `types/`
- **Business logic:** release-date calculation and aggregation in `lib/releases/`
- **Providers:** isolated source adapters in `lib/sources/`
- **UI:** reusable components grouped by feature in `components/`
- **Delivery:** GitHub Actions validates every push and pull request

## Data flow

1. Determine the upcoming Friday.
2. Query all configured release sources.
3. Normalize provider data into `MusicRelease`.
4. De-duplicate releases.
5. Filter by Germany or USA.
6. Render the mobile-first release list.

## Boundaries

The UI must not depend directly on Spotify, Apple Music or scraper response formats. Every provider implements the `ReleaseSource` contract and returns normalized releases.

## Planned folders

```text
app/                 Routes, layouts and API endpoints
components/ui/       Generic UI primitives
components/releases/ Release-specific UI
lib/releases/        Aggregation and release-date logic
lib/sources/         External provider adapters
hooks/               Client-side reusable behavior
types/               Shared TypeScript domain types
tests/               Unit and integration tests
docs/                Architecture and product documentation
.github/              CI and contribution templates
```
