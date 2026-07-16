# Systemarchitektur

## Überblick

Release Friday besteht aus vier Bereichen:

1. **Öffentliches Frontend** – Next.js/React, statisch über GitHub Pages ausgeliefert.
2. **Redaktionsoberfläche** – geschützter Client-Bereich unter `/admin/`.
3. **Datenplattform** – Supabase Auth, Postgres und Storage.
4. **Automatisierung** – GitHub Actions für Recherche, Synchronisation und Deployment.

## Laufzeitarchitektur

```text
Besucher auf iPhone/iPad
        |
        v
GitHub Pages: statischer Next.js-Export
        |
        +--> generierter lokaler Fallback
        |
        +--> browserseitige Supabase-Abfrage
                  |
                  +--> public.releases
                  +--> Storage: release-covers
```

Die Startseite muss statisch exportierbar bleiben. Produktive Supabase-Abfragen finden deshalb browserseitig statt und dürfen den GitHub-Pages-Export nicht von einem Server-Request abhängig machen.

## Datenfluss

### Öffentlicher Feed

1. Beim ersten Rendern steht die generierte Release-Liste als Fallback zur Verfügung.
2. Der Browser lädt veröffentlichte Datensätze aus Supabase.
3. Supabase-Datensätze werden mit kuratierten Fallback-Medien zusammengeführt.
4. Leere manuelle Felder dürfen vorhandene kuratierte Cover oder Links nicht löschen.

### Manuelle Redaktion

1. Benutzer meldet sich über Supabase Auth an.
2. `release_admins` entscheidet über Redaktionsrechte.
3. Admins können Releases erstellen, bearbeiten, als Entwurf speichern, veröffentlichen oder löschen.
4. Cover werden lokal auf maximal 1600 × 1600 Pixel verkleinert und als WebP komprimiert.
5. Bilder werden im Bucket `release-covers` gespeichert.

### Automatischer Import

1. GitHub Actions startet `scripts/fetch-releases.mjs` am Donnerstag, sobald Neuseeland den Freitag erreicht hat, sowie in zwei späteren Wiederholungsläufen.
2. Das Skript liest die Single-Tabelle aus dem konfigurierten r/GermanRap-Post per RSS und löst Cover mit exaktem Interpret-/Titelabgleich zuerst über Spotify, danach über Apple Music auf. NZ und AU dienen als frühe Storefronts; ab Freitag wird zusätzlich der Heimatmarkt geprüft.
3. Der frühe Donnerstagslauf akzeptiert ausschließlich Release-Cover. Ab dem 18:30-Uhr-Lauf darf für weiterhin ungelöste r/GermanRap-Singles das Spotify-Profilbild des zuerst genannten Artists dienen. Der Artist muss exakt passen, ein echtes Bild und ein Spotify-Profil besitzen; Quelle, Beschreibung und Spotify-Link kennzeichnen den Fallback.
4. Nur Kandidaten mit einer gültigen Bild-URL gelangen in `lib/releases/real-releases.generated.ts`. Fehlende Bilder werden in den Metadaten protokolliert.
5. `scripts/sync-releases-to-supabase.mjs` vergleicht Interpret, Titel und Release-Datum mit Supabase.
6. Vor dem Insert wird jedes externe Bild heruntergeladen, über seine Dateisignatur geprüft und deterministisch im Bucket `release-covers` gespeichert.
7. Nur neue Datensätze mit bestätigtem `cover_url` und `storage_path` werden als `published` eingefügt und anschließend verifiziert.
8. Bestehende Datensätze und manuelle Änderungen werden nicht überschrieben.

## Datenmodell

### `releases`

Wichtige Felder:

- `id`, `artist`, `title`, `release_date`
- `country`: `DE` oder `US`
- `kind`: `album`, `ep`, `single` oder `mixtape`
- `track_count`, `description`, `genres`
- `spotify_url`, `spotify_pre_save_url`, `apple_music_url`, `youtube_url`, `source_url`
- `cover_url`, `storage_path`
- `source`, `status`, `created_by` und Zeitstempel

Fehlen Spotify, Apple Music oder YouTube, können Suchlinks aus Interpret und Titel verwendet werden. Pre-Save und Quellen-Link bleiben ohne echten Link deaktiviert beziehungsweise leer.

### `release_admins`

Explizite Allowlist aus Supabase-User-IDs. Eine erfolgreiche Anmeldung allein verleiht keine Redaktionsrechte.

## Sicherheitsmodell

- Anonyme Benutzer dürfen nur `published` Releases lesen.
- Freigeschaltete Admins dürfen alle Releases lesen und verwalten.
- Cover-Schreibrechte sind auf Admins und deren Benutzerordner beschränkt.
- Der Publishable Key darf im Browser verwendet werden.
- Der Service-Role-Key liegt ausschließlich im GitHub-Actions-Secret `SUPABASE_SERVICE_ROLE_KEY`.
- Es gibt keine öffentliche Registrierung für Redakteure.

## Frontend-Struktur

- `app/page.tsx` – Einstieg des öffentlichen Feeds
- `app/prototype-client.tsx` – Drop, Find, Stash, Detail und Profil
- `app/admin/` – Adminroute und Auth-/CRUD-Client
- `components/admin/` – Adminformulare
- `components/release-tile-cover-enhancer.tsx` – kleine Cover und Release-Typen in Drop/Find
- `hooks/use-published-releases.ts` – browserseitiges Laden und Zusammenführen
- `lib/releases/` – Supabase-Mapping, Merge-Logik und generierter Fallback
- `lib/images/compress-cover.ts` – Cover-Komprimierung
- `app/globals.css` – Basissystem und iPhone-Layout
- `app/tablet.css` – iPad-Layout
- `app/release-tile-covers.css` – Kachelcover und Typ-Badges

## Responsive Verhalten

- iPhone bleibt die primäre mobile Ansicht.
- Ab Tablet-Breite werden breitere Container, größere Cover und mehrspaltige Bereiche genutzt.
- Tablet-Regeln dürfen das iPhone-Layout unterhalb des Breakpoints nicht verändern.

## Deployment

`.github/workflows/pages.yml` checkt das Repository aus, installiert Abhängigkeiten, baut den statischen Export, lädt `out/` als Pages-Artefakt hoch und veröffentlicht ihn.

## Architekturregeln

- Supabase ist die zentrale produktive Datenquelle.
- GitHub Pages bleibt ein statisches Hostingziel.
- Manuelle Daten haben Vorrang vor automatischer Recherche.
- Automatisierung überschreibt keine bestehenden Releases blind.
- Automatisierung veröffentlicht niemals einen Release ohne geprüftes Release- oder freigegebenes Spotify-Artist-Bild im eigenen Storage.
- Secrets gehören weder in Commits noch in Browservariablen.
- Schema- und RLS-Änderungen werden als Migration dokumentiert.
