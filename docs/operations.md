# Betrieb und Administration

## Öffentliche Anwendung

Die produktive Website läuft unter:

`https://eddijanus-lgtm.github.io/Release-Friday/`

Der geschützte Editor läuft unter:

`https://eddijanus-lgtm.github.io/Release-Friday/admin/`

## Release manuell verwalten

1. `/admin/` öffnen.
2. Mit einem in Supabase Auth vorhandenen und in `release_admins` freigeschalteten Konto anmelden.
3. Release-Daten eintragen.
4. Optional ein Cover auswählen. Das Bild wird auf dem Gerät automatisch als WebP komprimiert.
5. Als Entwurf speichern oder direkt veröffentlichen.
6. Bestehende Releases erscheinen unter **Alle Releases** und können bearbeitet oder gelöscht werden.

## Pflicht- und optionale Felder

Pflicht:

- Interpret
- Titel
- Typ
- Land
- Release-Datum

Optional:

- Cover
- Trackzahl
- Genres
- Beschreibung
- Spotify
- Spotify Pre-Save
- Apple Music
- YouTube
- Quellen-Link

Spotify, Apple Music und YouTube dürfen leer bleiben; die Anwendung kann dann Suchlinks nach `Interpret + Titel` verwenden. Pre-Save und Quellen-Link werden nur aktiviert, wenn ein echter Link hinterlegt ist.

## Cover-Verarbeitung

Neue Cover werden vor dem Upload:

- auf maximal 1600 × 1600 Pixel begrenzt,
- nach WebP konvertiert,
- zunächst mit hoher Qualität gespeichert,
- bei zu großer Datei stufenweise stärker komprimiert.

Das reduziert Supabase-Storage, Uploadzeit und mobilen Datenverbrauch.

## GitHub-Pages-Deployment

Workflow: `.github/workflows/pages.yml`

Auslöser:

- Push auf `main`
- manueller Start über `workflow_dispatch`

Ein erfolgreicher Build erzeugt `out/` und veröffentlicht dieses Verzeichnis über GitHub Pages.

### Kritische Regel

Die öffentliche Startseite muss statisch exportierbar bleiben. Supabase-Daten werden im Browser geladen. Eine serverseitige, dynamische Supabase-Abfrage in der statisch exportierten Startseite kann das Deployment blockieren.

## Automatischer Release-Import

Workflow: `.github/workflows/sync-releases-to-supabase.yml`

Auslöser:

- Donnerstag und Freitag nach Zeitplan
- manuell über GitHub Actions
- Änderungen an Importskripten oder Workflow

Benötigtes Secret:

- `SUPABASE_SERVICE_ROLE_KEY`

Ablauf:

1. `npm ci`
2. `node scripts/fetch-releases.mjs`
3. `node scripts/sync-releases-to-supabase.mjs`

Der Sync fügt nur neue Kombinationen aus Interpret, Titel und Release-Datum ein. Er überschreibt keine vorhandenen Datensätze.

## Supabase

Projektname: `Release Friday`

Verwendete Komponenten:

- Auth
- Postgres
- Storage
- Row Level Security

Wichtige Tabellen und Buckets:

- `public.releases`
- `public.release_admins`
- Bucket `release-covers`

## Neuen Admin hinzufügen

1. Benutzer in Supabase Auth anlegen.
2. User-ID ermitteln.
3. User-ID in `release_admins` einfügen.
4. Keine öffentliche Registrierung aktivieren.

## Fehlerdiagnose

### Website nicht erreichbar

1. GitHub Actions öffnen.
2. Workflow **Deploy Release Friday to GitHub Pages** prüfen.
3. Build-Log nach TypeScript-, Next.js- oder Static-Export-Fehlern durchsuchen.
4. Letzte Änderung an `app/page.tsx`, Layout und CSS prüfen.

### Öffentliche Releases fehlen

1. Prüfen, ob Datensätze `status = published` besitzen.
2. Browser-Konsole auf Supabase-Fehler prüfen.
3. RLS-Policy für anonymes Lesen kontrollieren.
4. Generierten Fallback prüfen.

### Admin-Liste ist leer

1. Sicherstellen, dass das Konto in `release_admins` steht.
2. Supabase-Abfragefehler sichtbar machen und nicht als leere Liste behandeln.
3. SELECT-Rechte beziehungsweise RLS für alle abgefragten Spalten prüfen.

### Cover fehlt

1. `cover_url` im Datensatz prüfen.
2. Storage-Datei und öffentliche URL prüfen.
3. Bei externen URLs CORS, Referrer-Schutz und Erreichbarkeit prüfen.
4. Ohne gültiges Cover wird der Release-Friday-Platzhalter angezeigt.

## Backup- und Änderungsprinzip

- Datenbankänderungen als Supabase-Migration dokumentieren.
- Vor riskanten RLS-Änderungen bestehende Policies lesen.
- Bestehende Releases nicht durch automatisierte Recherche überschreiben.
- Service-Role-Key niemals in Chat, Quellcode, README oder öffentliche Workflow-Variablen kopieren.
- Nach Änderungen zuerst Build und anschließend Live-Seite prüfen.