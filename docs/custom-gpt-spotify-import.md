# Release Friday Custom GPT Action

## Zweck

Diese Action ermöglicht einem privaten Custom GPT:

- Spotify-Album- und Pre-Release-Links anzunehmen,
- den Importauftrag sicher in Supabase einzureihen,
- genau einen GitHub-Actions-Lauf pro tatsächlichem Import zu starten,
- den bestehenden GitHub-Actions-Importer zu verwenden,
- den Auftragsstatus und den verifizierten Supabase-Datensatz abzurufen.

## Architektur

```text
Custom GPT Action
  -> Supabase Edge Function: release-friday-import
  -> private Tabelle: release_import_requests
  -> sofortiger GitHub workflow_dispatch für genau diesen Auftrag
  -> bestehender Spotify-Importer
  -> public.releases
  -> Status zurück an release_import_requests
```

Es gibt keinen periodischen GitHub-Actions-Polling-Lauf. Ohne neuen Importauftrag wird kein Workflow gestartet und kein Actions-Kontingent verbraucht.

Die Spotify-Secrets und der Supabase-Service-Role-Key bleiben ausschließlich im bestehenden GitHub-Actions-Workflow. Die Edge Function erhält nur einen eingeschränkten GitHub-Token, der den Import-Workflow starten darf.

## Einmalige Einrichtung

### 1. Action-API-Schlüssel in Supabase setzen

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

### 2. GitHub-Dispatch-Token in Supabase setzen

Einen eingeschränkten GitHub-Token für das Repository `eddijanus-lgtm/Release-Friday` erstellen. Er muss den Workflow `.github/workflows/import-spotify-release.yml` über die GitHub API starten dürfen.

Den Token ausschließlich als Supabase Edge Function Secret speichern:

```text
GITHUB_ACTIONS_TOKEN
```

Der Token gehört niemals in GPT-Instructions, das OpenAPI-Schema, GitHub-Dateien oder Chat-Nachrichten.

### 3. Action im Custom GPT hinzufügen

Im GPT-Editor:

1. Configure
2. Actions
3. Create new action
4. Authentication: API Key
5. Auth Type: Bearer
6. Den Wert von `RELEASE_FRIDAY_ACTION_API_KEY` eintragen
7. Den Inhalt von `docs/release-friday-action.openapi.yaml` als Schema einfügen

### 4. Empfohlene GPT-Instructions

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

Nach dem Import-Aufruf:
- Merke dir request.id.
- Melde zunächst nur, dass der Import gestartet wurde.
- Behaupte noch nicht, dass er veröffentlicht wurde.
- Verwende getSpotifyReleaseImportStatus mit der Request-ID.
- Erfolg darf erst gemeldet werden, wenn request.status completed ist und ein release-Objekt zurückgegeben wird.
- Bei request.status failed nenne error_message.
- Bei queued oder processing erkläre, dass der ereignisgesteuerte GitHub-Actions-Lauf noch arbeitet.

Nach erfolgreichem Import nenne:
- Künstler und Titel
- Land
- Release-Datum
- Typ
- Status
- Supabase-ID

Verwende niemals oder zeige niemals den Action-API-Key, den GitHub-Dispatch-Token, Spotify-Secrets oder den Supabase-Service-Role-Key.
```

## Action-Endpunkte

- `POST /imports` – Importauftrag anlegen und den zugehörigen Workflow sofort starten
- `GET /imports/{requestId}` – Status und verifizierten Release abrufen
- `GET /health` – API-Verfügbarkeit und Dispatch-Konfiguration prüfen

## Statuswerte

- `queued` – Workflow wurde angefordert und wartet auf einen GitHub-Runner
- `processing` – Importer läuft
- `completed` – Supabase-Datensatz wurde verifiziert
- `failed` – Import oder Workflow-Dispatch ist fehlgeschlagen; `error_message` enthält die Ursache

## Betrieb

Der Workflow `.github/workflows/import-spotify-release.yml` besitzt keinen periodischen Zeitplan. Die Edge Function startet ihn mit `workflow_dispatch` und übergibt ausschließlich die UUID des neu angelegten Auftrags. Der Queue-Worker lädt genau diesen Datensatz und verarbeitet ihn einmal. Die bestehende Concurrency-Gruppe verhindert parallele Spotify-Importe.

Die Tabelle `release_import_requests` hat RLS aktiviert und keine öffentlichen Policies. Direkter Zugriff über den Browser-Publishable-Key ist daher nicht möglich.
