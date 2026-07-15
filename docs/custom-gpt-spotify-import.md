# Release Friday Custom GPT Action

## Zweck

Diese Action ermöglicht einem privaten Custom GPT:

- Spotify-Album- und Pre-Release-Links anzunehmen,
- den Importauftrag sicher in Supabase einzureihen,
- den bestehenden GitHub-Actions-Importer zu verwenden,
- den Auftragsstatus und den verifizierten Supabase-Datensatz abzurufen.

## Architektur

```text
Custom GPT Action
  -> Supabase Edge Function: release-friday-import
  -> private Tabelle: release_import_requests
  -> GitHub Actions alle 10 Minuten
  -> bestehender Spotify-Importer
  -> public.releases
  -> Status zurück an release_import_requests
```

Die Action besitzt keinen GitHub-Token und keine Spotify-Secrets. Diese bleiben ausschließlich im bestehenden GitHub-Actions-Workflow.

## Einmalige Einrichtung

### 1. API-Schlüssel in Supabase setzen

In Supabase öffnen:

1. Project Settings
2. Edge Functions
3. Secrets
4. neues Secret anlegen

Name:

```text
RELEASE_FRIDAY_ACTION_API_KEY
```

Wert: einen langen zufälligen Schlüssel verwenden. Derselbe Wert wird danach im GPT-Editor als Bearer API Key eingetragen.

Nach dem Setzen des Secrets die Edge Function `release-friday-import` erneut deployen, falls Supabase dies nicht automatisch für laufende Functions übernimmt.

### 2. Action im Custom GPT hinzufügen

Im GPT-Editor:

1. Configure
2. Actions
3. Create new action
4. Authentication: API Key
5. Auth Type: Bearer
6. Den Wert von `RELEASE_FRIDAY_ACTION_API_KEY` eintragen
7. Den Inhalt von `docs/release-friday-action.openapi.yaml` als Schema einfügen

### 3. Empfohlene GPT-Instructions

```text
Du bist der Release Friday Manager.

Wenn der Nutzer einen Spotify-Album- oder Pre-Release-Link sendet, verwende queueSpotifyReleaseImport.

Pflicht:
- country muss DE oder US sein.
- Wenn der Nutzer kein Land nennt und kein eindeutiger Wert im Gespräch existiert, frage nach DE oder US.
- status ist standardmäßig published.
- Tracking-Parameter werden von der API entfernt.
- Bei einem Pre-Release soll release_date mitgesendet werden, wenn es sicher bekannt ist.
- Kein Release-Datum erfinden. Wenn Spotify kein Datum liefert und der Nutzer keines nennt, frage danach.

Nach dem Queue-Aufruf:
- Merke dir request.id.
- Melde zunächst nur, dass der Import eingereiht wurde.
- Behaupte noch nicht, dass er veröffentlicht wurde.
- Verwende getSpotifyReleaseImportStatus mit der Request-ID.
- Erfolg darf erst gemeldet werden, wenn request.status completed ist und ein release-Objekt zurückgegeben wird.
- Bei request.status failed nenne error_message.
- Bei queued oder processing erkläre, dass GitHub Actions die Warteschlange normalerweise innerhalb von zehn Minuten verarbeitet.

Nach erfolgreichem Import nenne:
- Künstler und Titel
- Land
- Release-Datum
- Typ
- Status
- Supabase-ID

Verwende niemals oder zeige niemals den Action-API-Key, Spotify-Secrets oder den Supabase-Service-Role-Key.
```

## Action-Endpunkte

- `POST /imports` – Import einreihen oder vorhandenen Release erkennen
- `GET /imports/{requestId}` – Status und verifizierten Release abrufen
- `GET /health` – API-Verfügbarkeit prüfen

## Statuswerte

- `queued` – wartet auf den nächsten GitHub-Actions-Lauf
- `processing` – Importer läuft
- `completed` – Supabase-Datensatz wurde verifiziert
- `failed` – Import fehlgeschlagen; `error_message` enthält die Ursache

## Betrieb

Der Workflow `.github/workflows/import-spotify-release.yml` verarbeitet bis zu fünf Aufträge pro geplantem Lauf. Die bestehende Concurrency-Gruppe verhindert parallele Spotify-Importe.

Die Tabelle `release_import_requests` hat RLS aktiviert und keine öffentlichen Policies. Direkter Zugriff über den Browser-Publishable-Key ist daher nicht möglich.
