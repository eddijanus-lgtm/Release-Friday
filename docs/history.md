# Entwicklungsgeschichte

Diese Übersicht fasst die fachlich relevanten Entwicklungsschritte aus der Git-Historie zusammen. Automatische reine Daten-Refresh-Commits sind zu Themenblöcken gebündelt.

## 1. Projektstart

Das Repository wurde als mobile Web-App für kommende deutsche und US-amerikanische Hip-Hop- und Rap-Releases angelegt.

Frühe Grundlagen:

- Next.js, React und TypeScript
- mobile Release-Liste
- Länderfilter Deutschland/USA
- GitHub Pages als Hostingziel
- GitHub Actions für Build und Datenaktualisierung

Wichtige Commits:

- `4652195` – Initialize Release Friday project
- `2c80b2c` – Add initial mobile release feed
- `d0db979` – Build interactive Release Friday prototype

## 2. Reale und kuratierte Release-Daten

Das Projekt wechselte von reinen Beispieldaten zu recherchierten Release-Daten. Provider, Normalisierung, Deduplizierung, Fallbacks und regelmäßige Refreshes wurden eingeführt.

Wichtige Schritte:

- reale Datenquellen und kuratierter Fallback
- kommende Freitage automatisch bestimmen
- Wochen ohne bestätigte Releases abfangen
- Streaming- und Quellenlinks ergänzen
- Datenqualität und QA verbessern
- deutsche und US-amerikanische Test-Releases veröffentlichen

Wichtige Commits:

- `1cc0a05` – Connect real weekly hip-hop release data
- `52671b9` – Harden Release Friday with real data and expert QA
- `f4587ee` – Add researched cover and source for Friday release
- `dc23e36` – Add verified US releases for Friday editorial test
- `5e577f0` – Publish verified Friday editorial test releases

## 3. Midnight-Tape-Redesign

Die ursprüngliche Oberfläche wurde durch das visuell deutlich eigenständigere „Midnight Tape“-Design ersetzt.

Erhalten beziehungsweise verbessert wurden:

- Drop-Übersicht
- Find-Suche
- Stash im Local Storage
- Detailseite
- Länderfilter
- externe Streaminglinks
- Countdown zum Release

Wichtiger Commit:

- `8427012` – Implement approved Midnight Tape redesign

## 4. Kuratierte Sonderfälle und Pre-Saves

Für einzelne Releases wurden offizielle Cover, Quellen und Pre-Save-Kampagnen ergänzt. Das lokal eingebettete Cover für Azet & Dardan – „Eurosport 2“ dient weiterhin als kuratierter Medien-Fallback.

Wichtige Commits:

- `71c413b` – Add official Spotify pre-save for Steve Lacy — Oh Yeah?
- `37f66ae` – Use direct Spotify authorization link for Oh Yeah? pre-save
- `fbb60df` – Add Azet & Dardan — Eurosport 2 with supplied cover

## 5. Supabase und geschützter Editor

Das Projekt entwickelte sich von einer rein dateibasierten Seite zu einem System mit zentraler Datenbank und Redaktionsoberfläche.

Eingeführt wurden:

- Supabase Auth
- Tabellen `releases` und `release_admins`
- Row Level Security
- Storage-Bucket `release-covers`
- geschützter `/admin/`-Bereich
- manuelles Anlegen und Veröffentlichen
- später Bearbeiten, Entwürfe und Löschen
- browserseitiges Laden veröffentlichter Releases

Wichtige Commits:

- `b01e614` – Add secure manual release editor
- `fdf21cf` – Connect the release editor to Supabase
- `1283738` – Load published releases from Supabase
- `6e7001d` – Use Supabase as release source

## 6. Automatische Synchronisation nach Supabase

Die Recherche-Pipeline wurde mit der produktiven Datenbank verbunden.

Regeln:

- neue Releases werden hinzugefügt
- bestehende Kombinationen aus Interpret, Titel und Datum werden übersprungen
- manuelle Änderungen werden nicht überschrieben
- der Service-Role-Key bleibt ein GitHub-Actions-Secret

Wichtige Commits:

- `a11029a` – Sync automated releases to Supabase
- `d75a7c8` – Add Supabase release sync workflow
- `d4ed54d` – Run Supabase sync after workflow changes

## 7. GitHub-Pages-Stabilisierung

Eine serverseitige Supabase-Abfrage war nicht mit dem statischen GitHub-Pages-Export kompatibel. Die Architektur wurde wieder auf einen statischen Export mit browserseitigem Datenladen umgestellt.

Zusätzlich wurde verhindert, dass leere Supabase-Felder kuratierte Cover und Links löschen.

Wichtige Commits:

- `1700591` – Fix GitHub Pages static export with client-side Supabase feed
- `7470532` – Restore static page architecture
- `987bac2` – Preserve curated media when Supabase fields are empty

## 8. Admin- und Medienverbesserungen

Der Editor erhielt eine vollständige Release-Liste sowie Bearbeiten- und Löschen-Funktionen. Leserechte und Abfragen wurden korrigiert. Cover werden vor dem Upload automatisch komprimiert.

Wichtige Änderungen:

- vorhandene Releases im Admin anzeigen
- Release bearbeiten und löschen
- Storage-Dateien ersetzen und aufräumen
- Cover lokal als WebP komprimieren
- maximal 1600 × 1600 Pixel

Wichtiger Commit:

- `a65c3ca` – Compress cover images before upload

## 9. iPad-Unterstützung

Die ursprünglich bewusst schmale iPhone-Oberfläche wurde um ein echtes Tablet-Layout erweitert, ohne die iPhone-Ansicht zu verändern.

Wichtige Commits:

- `d4e1834` – Add responsive iPad layout
- `6048164` – Load responsive iPad styles

## 10. Release-Kacheln und Link-Fallbacks

Die aktuelle Oberfläche zeigt in Drop und Find kleine Cover vor dem Titel. Fehlt ein Cover, erscheint der zweizeilige Release-Friday-Platzhalter. Neben dem Interpreten wird der Typ wie Album, EP, Single oder Mixtape angezeigt.

Außerdem werden bei fehlenden Spotify-, Apple-Music- oder YouTube-Links Suchlinks aus Interpret und Titel verwendet. Pre-Save und Quellen-Link bleiben ohne echten Link deaktiviert.

Wichtige Commits:

- `7b0980e` – Fix release tile cover loading
- `f0e88d0` – Style Release Friday cover fallback
- `d6b73c8` – Show release type beside artist in tiles
- `3f579dc` – Style release type badges in tiles

## Heutiger Stand

Release Friday ist heute:

- eine produktive statische GitHub-Pages-App,
- eine browserseitig mit Supabase verbundene Release-Datenbank,
- eine mobile und tabletoptimierte Redaktion,
- ein automatisierter wöchentlicher Import,
- ein kuratierter Release-Radar mit sicheren Fallbacks.

Die Historie enthält zahlreiche kleine Daten-Refreshes und Reparaturen. Für Architekturentscheidungen sind die oben dokumentierten Themenblöcke maßgeblich.