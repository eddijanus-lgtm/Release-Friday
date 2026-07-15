# Release Friday

Release Friday ist ein responsiver Release-Radar für deutsche und US-amerikanische Hip-Hop- und Rap-Veröffentlichungen. Die öffentliche Website wird statisch über GitHub Pages ausgeliefert; veröffentlichte Releases, Entwürfe und hochgeladene Cover werden zentral in Supabase verwaltet.

## Live-System

- Öffentliche Website: `https://eddijanus-lgtm.github.io/Release-Friday/`
- Redaktion: `https://eddijanus-lgtm.github.io/Release-Friday/admin/`
- Repository: `eddijanus-lgtm/Release-Friday`
- Hauptbranch: `main`

## Funktionsumfang

- Release-Übersicht für Deutschland und USA
- Filter nach Region sowie Suche nach Interpret und Titel
- Detailansichten mit Spotify-, Apple-Music-, YouTube- und Pre-Save-Links
- automatische Suchlinks, wenn Spotify, Apple Music oder YouTube nicht manuell gepflegt wurden
- persönlicher Stash im lokalen Browser-Speicher
- responsive iPhone- und iPad-Oberflächen
- geschützter Admin-Bereich zum Anlegen, Bearbeiten, Veröffentlichen, als Entwurf Speichern und Löschen
- automatische WebP-Komprimierung hochgeladener Cover vor dem Upload
- Supabase Auth, Postgres, Row Level Security und Storage
- automatischer Release-Import über GitHub Actions
- statischer Next.js-Export und Deployment über GitHub Pages

## Architektur in einem Satz

GitHub Pages liefert die statische Next.js-App aus; der Browser lädt veröffentlichte Releases aus Supabase, während eine generierte lokale Release-Liste als Ausfall-Fallback dient.

## Technologie

- Next.js 15
- React 19
- TypeScript
- Supabase JavaScript Client
- Supabase Auth, Postgres und Storage
- GitHub Actions
- GitHub Pages

## Dokumentation

- [Systemarchitektur](docs/architecture.md)
- [Betrieb und Administration](docs/operations.md)
- [Entwicklungsgeschichte](docs/history.md)
- [ChatGPT-Template zum Anlegen eines Releases](docs/chatgpt-release-template.md)
- [ChatGPT-Entwurfstest mit einer eingeschränkten GPT Action](docs/chatgpt-release-draft-poc.md)
- [Supabase-Admin-Setup](docs/admin-setup.md)

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Danach `http://localhost:3000` öffnen. Für echte Supabase-Daten werden folgende öffentliche Browser-Variablen benötigt:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
```

Der Service-Role-Key darf niemals in Frontend-Code, einer öffentlichen Datei oder einer `NEXT_PUBLIC_*`-Variable stehen.

## Build

```bash
npm run build
```

Bei `DEPLOY_TARGET=github-pages` wird ein statischer Export im Verzeichnis `out/` erzeugt.

## Datenquellen und Priorität

1. Veröffentlichte Supabase-Datensätze sind die primäre Quelle.
2. Manuelle Änderungen in Supabase dürfen vom automatischen Import nicht überschrieben werden.
3. Die generierte Datei `lib/releases/real-releases.generated.ts` ist ein statischer Fallback.
4. Cover kommen bevorzugt aus `cover_url`; fehlt ein Bild, wird der Release-Friday-Platzhalter dargestellt.

## Sicherheit

- Nur Benutzer in `release_admins` erhalten Redaktionsrechte.
- RLS schützt Entwürfe und Schreiboperationen.
- Der öffentliche Supabase-Key ist absichtlich browserlesbar und besitzt keine Admin-Rechte.
- `SUPABASE_SERVICE_ROLE_KEY` existiert ausschließlich als GitHub-Actions-Secret für den Import.

## Wichtige Workflows

- `.github/workflows/pages.yml` baut und veröffentlicht die Website.
- `.github/workflows/sync-releases-to-supabase.yml` recherchiert Releases und fügt ausschließlich neue Datensätze in Supabase ein.

## Projektstatus

Das Projekt ist produktiv in Benutzung. Supabase ist die zentrale Release-Datenbank; GitHub bleibt Quellcode-, Dokumentations-, Automatisierungs- und Deployment-Plattform.
