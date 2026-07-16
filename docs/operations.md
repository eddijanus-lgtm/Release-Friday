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

- Donnerstag um 12:15 und 16:30 UTC, Freitag um 00:02 Uhr deutscher Zeit sowie Freitag um 05:15 UTC
- manuell über GitHub Actions
- Änderungen an Importskripten oder Workflow

Benötigte Secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Ablauf:

1. `npm ci`
2. r/GermanRap-RSS lesen und Cover über Spotify NZ/AU beziehungsweise Apple Music NZ/AU auflösen
3. ab Donnerstag 18:30 Uhr bei weiterhin fehlendem Release-Cover das exakt passende Spotify-Profilbild des zuerst genannten Artists verwenden
4. `node scripts/fetch-releases.mjs`
5. jedes gefundene Bild herunterladen und als unterstütztes Bild validieren
6. Bild in `release-covers` speichern
7. `node scripts/sync-releases-to-supabase.mjs`

Der 00:02-Uhr-Lauf prüft die Singles mit einem als `Spotify artist image fallback` markierten Bild erneut. Sobald Spotify oder Apple Music ein exakt passendes Release-Cover liefert, speichert der Workflow das neue Bild im eigenen Storage und ersetzt das Artist-Bild im bestehenden Datensatz. Manuelle Releases und alle anderen bestehenden Datensätze werden nicht verändert. Zwei UTC-Cron-Termine mit einer Prüfung der Zeitzone `Europe/Berlin` stellen sicher, dass 00:02 Uhr sowohl in Sommer- als auch Winterzeit korrekt getroffen wird.

Der Sync fügt nur neue Kombinationen aus Interpret, Titel und Release-Datum ein. Er überschreibt keine vorhandenen Datensätze. Der Artist-Image-Fallback ist beim ersten Donnerstagslauf deaktiviert und ab Donnerstag 18:30 Uhr deutscher Zeit aktiviert. Die Berliner Uhrzeit dient zusätzlich zum Cron-Auslöser als Freigabe, damit eine GitHub-Schedule-Verzögerung den Fallback nicht blockiert. Das Spotify-Profil muss exakt zum ersten genannten Artist passen; Profilbild und Profil-Link werden gemeinsam gespeichert und die Quelle enthält `Spotify artist image fallback`. Fehlt auch dieses Bild, wird die Single übersprungen. Fehlende Bilder stehen im Workflow-Log und in `releaseDataMetadata.missingCovers`.

Für einen gezielten Lauf kann beim manuellen Start `release_date` im Format `YYYY-MM-DD` gesetzt werden. `allow_spotify_artist_image_fallback` schaltet den Fallback bei einem manuellen Lauf ausdrücklich frei. Ohne Datum wird der nächste Freitag in der Zeitzone `Europe/Berlin` verwendet.

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
