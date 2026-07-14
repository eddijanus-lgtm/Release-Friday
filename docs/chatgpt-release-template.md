# ChatGPT-Template: Release anlegen

Dieses Template ist für Unterhaltungen mit ChatGPT gedacht, in denen GitHub und – für die produktive Datenbank – Supabase verbunden sind.

## Schnellvorlage

Den folgenden Block kopieren, ausfüllen und an ChatGPT senden:

```text
Arbeite im Projekt eddijanus-lgtm/Release-Friday.

Lege folgenden Release produktiv an:

Interpret: [INTERPRET]
Titel: [TITEL]
Typ: [album | ep | single | mixtape]
Land: [DE | US]
Release-Datum: [YYYY-MM-DD]
Trackzahl: [ZAHL ODER LEER]
Genres: [KOMMAGETRENNT ODER LEER]
Beschreibung: [TEXT ODER LEER]
Spotify: [URL ODER LEER]
Spotify Pre-Save: [URL ODER LEER]
Apple Music: [URL ODER LEER]
YouTube: [URL ODER LEER]
Quellen-Link: [URL ODER LEER]
Cover: [ANGEHÄNGTES BILD | DIREKTE BILD-URL | LEER]
Status: [published | draft]

Vorgehen:
1. Lies zuerst README.md, docs/architecture.md und docs/operations.md.
2. Prüfe, ob der Release bereits anhand von Interpret, Titel und Release-Datum existiert. Keine Dublette anlegen.
3. Verwende Supabase als produktive Datenquelle. Ändere nicht nur die generierte Fallback-Datei und behaupte danach nicht, der Release sei produktiv gespeichert.
4. Bestehende manuelle Daten niemals ungefragt überschreiben.
5. Prüfe bereitgestellte Links auf Plausibilität. Erfinde keine URLs.
6. Wenn Spotify, Apple Music oder YouTube leer sind, dürfen die vorgesehenen Suchlinks greifen.
7. Spotify Pre-Save und Quellen-Link nur speichern, wenn echte URLs vorliegen.
8. Ein hochgeladenes Cover vor dem Storage-Upload als WebP komprimieren oder den bestehenden Admin-Uploadweg verwenden.
9. Bei einem externen Cover nur eine dauerhaft erreichbare direkte Bild-URL verwenden.
10. Nach dem Anlegen den gespeicherten Datensatz erneut lesen und die Felder kontrollieren.
11. Falls Code oder Dokumentation geändert wurden, den GitHub-Pages-Build prüfen.
12. Berichte konkret: Datensatz-ID, Status, Release-Datum, verwendetes Cover und welche Links echte Links beziehungsweise Such-Fallbacks sind.

Wenn nur GitHub verbunden ist, aber kein schreibender Supabase-Zugriff besteht:
- Lege nicht so dar, als sei der Release bereits produktiv veröffentlicht.
- Erstelle stattdessen eine klar gekennzeichnete Release-Anfrage anhand dieses Templates oder erkläre den fehlenden Datenbankzugriff.
- Schreibe keinen Service-Role-Key in Dateien, Issues, Commits oder den Chat.
```

## Minimalvorlage

Für einen bereits eindeutig bekannten Release genügt:

```text
@GitHub Arbeite in eddijanus-lgtm/Release-Friday und beachte docs/chatgpt-release-template.md.
Lege diesen Release produktiv in Supabase an, nachdem du auf Dubletten geprüft hast:

[INTERPRET] – [TITEL]
Typ: [TYP]
Land: [DE/US]
Datum: [YYYY-MM-DD]
Spotify: [URL/LEER]
Cover: [ANGEHÄNGT/URL/LEER]
Status: published
```

## Beispiel

```text
Arbeite im Projekt eddijanus-lgtm/Release-Friday und beachte docs/chatgpt-release-template.md.

Interpret: Beispiel Artist
Titel: Freitag Nacht
Typ: album
Land: DE
Release-Datum: 2026-07-17
Trackzahl: 12
Genres: Deutschrap, Hip-Hop/Rap
Beschreibung: Neues Studioalbum von Beispiel Artist.
Spotify: https://open.spotify.com/album/BEISPIEL
Spotify Pre-Save:
Apple Music:
YouTube:
Quellen-Link: https://label.example/release
Cover: angehängtes Bild
Status: published
```

## Erwartetes Verhalten von ChatGPT

ChatGPT soll:

- zuerst den bestehenden Stand lesen,
- Dubletten vermeiden,
- die produktive Quelle korrekt wählen,
- niemals Secrets offenlegen,
- keine erfundenen Links eintragen,
- den tatsächlichen Schreibvorgang verifizieren,
- Fehler transparent melden.

## Felder und erlaubte Werte

| Feld | Werte / Format |
|---|---|
| `artist` | Text, erforderlich |
| `title` | Text, erforderlich |
| `kind` | `album`, `ep`, `single`, `mixtape` |
| `country` | `DE`, `US` |
| `release_date` | `YYYY-MM-DD` |
| `track_count` | positive Ganzzahl oder leer |
| `genres` | Liste oder kommaseparierter Text |
| `status` | `draft`, `published` |
| Links | vollständige `https://`-URLs oder leer |
| Cover | Upload, direkte Bild-URL oder leer |

## Qualitätscheck vor Abschluss

- [ ] Interpret korrekt geschrieben
- [ ] Titel korrekt geschrieben
- [ ] Typ korrekt
- [ ] Land korrekt
- [ ] Release-Datum geprüft
- [ ] keine Dublette
- [ ] keine erfundenen Links
- [ ] Pre-Save ist wirklich ein Pre-Save
- [ ] Quellen-Link ist eine belastbare Quelle
- [ ] Cover lädt oder Platzhalter ist beabsichtigt
- [ ] Status stimmt
- [ ] Datensatz nach dem Schreiben erneut gelesen
- [ ] keine Secrets offengelegt

## Warum das Template Supabase ausdrücklich nennt

Die Website lädt produktive Releases aus Supabase. Eine alleinige Änderung an `lib/releases/real-releases.generated.ts` ist nur ein statischer Fallback und kann durch die nächste automatische Recherche überschrieben werden. Ein Release gilt daher erst dann als produktiv angelegt, wenn der Supabase-Datensatz existiert.