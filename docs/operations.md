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

- Donnerstag um 12:15 und 16:30 UTC sowie Freitag um 05:15 UTC
- manuell über GitHub Actions
- Änderungen an Importskripten oder Workflow

Benötigte Secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Ablauf:

1. `npm ci`
2. r/GermanRap-RSS lesen und Cover über Spotify NZ/AU beziehungsweise Apple Music NZ/AU auflösen
3. `node scripts/fetch-releases.mjs`
4. jedes gefundene Cover herunterladen und als unterstütztes Bild validieren
5. Cover in `release-covers` speichern
6. `node scripts/sync-releases-to-supabase.mjs`

Der Sync fügt nur neue Kombinationen aus Interpret, Titel und Release-Datum ein. Er überschreibt keine vorhandenen Datensätze. Eine Single ohne erfolgreich gefundenes und im eigenen Storage gespeichertes Cover wird übersprungen; die fehlenden Cover stehen im Workflow-Log und in `releaseDataMetadata.missingCovers`.

Für einen gezielten Lauf kann beim manuellen Start `release_date` im Format `YYYY-MM-DD` gesetzt werden. Ohne Eingabe wird der nächste Freitag in der Zeitzone `Europe/Berlin` verwendet.

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

### Reddit-Single wurde nicht automatisch importiert

1. Im Log von **Sync releases to Supabase** die Zeile `Cover lookup` und die abschließende `skipped`-Liste prüfen.
2. Sicherstellen, dass Interpret und Titel im r/GermanRap-Post korrekt geschrieben sind.
3. Prüfen, ob der Release in mindestens einer abgefragten Storefront bereits sichtbar ist und dort ein offizielles Cover besitzt.
4. Den Workflow später erneut ausführen. Sobald ein Cover exakt zugeordnet und gespeichert werden kann, wird der fehlende Datensatz nachgetragen.
5. Kein Ersatzbild und keine erfundene Cover-URL eintragen.

## Backup- und Änderungsprinzip

- Datenbankänderungen als Supabase-Migration dokumentieren.
- Vor riskanten RLS-Änderungen bestehende Policies lesen.
- Bestehende Releases nicht durch automatisierte Recherche überschreiben.
- Service-Role-Key niemals in Chat, Quellcode, README oder öffentliche Workflow-Variablen kopieren.
- Nach Änderungen zuerst Build und anschließend Live-Seite prüfen.
