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
- automatischer Release-Import aus dem wöchentlichen r/GermanRap-Post und Musikplattformen über GitHub Actions
- harte Cover-Sperre: Automatik-Releases werden nur mit geprüftem, im eigenen Storage gesichertem Cover veröffentlicht
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
4. Bis zum Donnerstagabend veröffentlicht der automatische Import keinen Release ohne echtes Release-Cover.
5. Ab dem 18:30-Uhr-Lauf darf bei r/GermanRap-Singles ersatzweise das exakt zugeordnete Spotify-Profilbild des zuerst genannten Artists verwendet werden. Die Quelle wird eindeutig als Artist-Image-Fallback markiert; die Künstlerseite wird nicht als Spotify-Release-Link gespeichert.
6. Jedes externe Bild wird geprüft und in `release-covers` gesichert. Fehlt auch das Artist-Bild, erfolgt kein Upload.
7. Der Platzhalter bleibt ausschließlich die Darstellung für ältere oder manuell angelegte Datensätze ohne Bild.

## Sicherheit

- Nur Benutzer in `release_admins` erhalten Redaktionsrechte.
- RLS schützt Entwürfe und Schreiboperationen.
- Der öffentliche Supabase-Key ist absichtlich browserlesbar und besitzt keine Admin-Rechte.
- `SUPABASE_SERVICE_ROLE_KEY` existiert ausschließlich als GitHub-Actions-Secret für den Import.

## Wichtige Workflows

- `.github/workflows/pages.yml` baut und veröffentlicht die Website.
- `.github/workflows/sync-releases-to-supabase.yml` liest die r/GermanRap-Singleliste, löst offizielle Cover in rollenden Spotify-/Apple-Music-Märkten auf und fügt ausschließlich cover-geprüfte neue Datensätze in Supabase ein.

## Projektstatus

Das Projekt ist produktiv in Benutzung. Supabase ist die zentrale Release-Datenbank; GitHub bleibt Quellcode-, Dokumentations-, Automatisierungs- und Deployment-Plattform.
