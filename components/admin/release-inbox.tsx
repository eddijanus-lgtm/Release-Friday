"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { compressCover } from "@/lib/images/compress-cover";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ReleaseCandidate,
  ReleaseCandidateSource,
  ReleaseImportRun,
  ReleaseInboxBatchResult,
} from "@/types/admin";

type InboxFilter = "problems" | "all" | "processed";

type ReleaseImportRunRow = {
  id: string;
  target_date: string;
  region_scope: ReleaseImportRun["regionScope"];
  source: string;
  status: ReleaseImportRun["status"];
  stats: Record<string, number> | null;
  created_at: string;
  completed_at: string | null;
};

type ReleaseCandidateRow = {
  id: string;
  run_id: string;
  artist: string;
  title: string;
  release_date: string;
  country: ReleaseCandidate["country"];
  kind: ReleaseCandidate["kind"];
  track_count: number | null;
  description: string | null;
  genres: string[] | null;
  spotify_url: string | null;
  spotify_pre_save_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  source_url: string | null;
  cover_url: string | null;
  storage_path: string | null;
  cover_kind: ReleaseCandidate["coverKind"];
  primary_source: string;
  sources: ReleaseCandidateSource[] | null;
  confidence: ReleaseCandidate["confidence"];
  warning_codes: string[] | null;
  status: ReleaseCandidate["status"];
  matched_release_id: string | null;
  created_at: string;
};

type ReleaseInboxProps = {
  onLogout: () => Promise<void>;
  onReleasesChanged: () => Promise<void>;
};

const runSelect =
  "id,target_date,region_scope,source,status,stats,created_at,completed_at";
const candidateSelect =
  "id,run_id,artist,title,release_date,country,kind,track_count,description,genres,spotify_url,spotify_pre_save_url,apple_music_url,youtube_url,source_url,cover_url,storage_path,cover_kind,primary_source,sources,confidence,warning_codes,status,matched_release_id,created_at";

function mapRun(row: ReleaseImportRunRow): ReleaseImportRun {
  return {
    id: row.id,
    targetDate: row.target_date,
    regionScope: row.region_scope,
    source: row.source,
    status: row.status,
    stats: row.stats ?? {},
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function mapCandidate(row: ReleaseCandidateRow): ReleaseCandidate {
  return {
    id: row.id,
    runId: row.run_id,
    artist: row.artist,
    title: row.title,
    releaseDate: row.release_date,
    country: row.country,
    kind: row.kind,
    trackCount: row.track_count ?? undefined,
    description: row.description ?? undefined,
    genres: row.genres ?? [],
    spotifyUrl: row.spotify_url ?? undefined,
    spotifyPreSaveUrl: row.spotify_pre_save_url ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    storagePath: row.storage_path ?? undefined,
    coverKind: row.cover_kind,
    primarySource: row.primary_source,
    sources: row.sources ?? [],
    confidence: row.confidence,
    warningCodes: row.warning_codes ?? [],
    status: row.status,
    matchedReleaseId: row.matched_release_id ?? undefined,
    createdAt: row.created_at,
  };
}

function optionalString(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  return value || null;
}

function isProblem(candidate: ReleaseCandidate) {
  return candidate.status === "pending" && (
    candidate.warningCodes.length > 0
    || candidate.confidence === "uncertain"
    || !candidate.coverUrl
    || !candidate.storagePath
  );
}

function isReady(candidate: ReleaseCandidate) {
  return candidate.status === "pending"
    && Boolean(candidate.coverUrl)
    && Boolean(candidate.storagePath)
    && !candidate.warningCodes.includes("possible_duplicate");
}

function warningLabel(code: string) {
  const labels: Record<string, string> = {
    artist_image_fallback: "Artist-Bild",
    missing_stored_cover: "Cover fehlt",
    possible_duplicate: "Mögliche Dublette",
    uncertain_date: "Datum prüfen",
    uncertain_kind: "Typ prüfen",
    weak_source: "Quelle prüfen",
  };
  return labels[code] ?? code.replaceAll("_", " ");
}

function formatBatch(result: ReleaseInboxBatchResult) {
  const parts = [
    result.inserted ? `${result.inserted} neu` : "",
    result.updated ? `${result.updated} ergänzt` : "",
    result.rejected ? `${result.rejected} verworfen` : "",
    result.restored ? `${result.restored} zurückgenommen` : "",
    result.skipped ? `${result.skipped} offen` : "",
    result.failed ? `${result.failed} fehlgeschlagen` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "Keine Änderung";
}

export function ReleaseInbox({ onLogout, onReleasesChanged }: ReleaseInboxProps) {
  const [runs, setRuns] = useState<ReleaseImportRun[]>([]);
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([]);
  const [activeRunId, setActiveRunId] = useState<string>();
  const [filter, setFilter] = useState<InboxFilter>("problems");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const loadInbox = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true);
    setError(undefined);

    const [runResult, candidateResult] = await Promise.all([
      client
        .from("release_import_runs")
        .select(runSelect)
        .order("target_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12),
      client
        .from("release_candidates")
        .select(candidateSelect)
        .order("created_at", { ascending: false })
        .limit(1200),
    ]);

    if (runResult.error || candidateResult.error) {
      setError("Die Release-Inbox ist noch nicht erreichbar. Bitte prüfe die Supabase-Migration.");
      setLoading(false);
      return;
    }

    const nextRuns = ((runResult.data ?? []) as ReleaseImportRunRow[]).map(mapRun);
    const nextCandidates = ((candidateResult.data ?? []) as ReleaseCandidateRow[]).map(mapCandidate);
    setRuns(nextRuns);
    setCandidates(nextCandidates);
    setActiveRunId((current) => (
      current && nextRuns.some((run) => run.id === current)
        ? current
        : nextRuns[0]?.id
    ));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const activeRun = useMemo(
    () => runs.find((run) => run.id === activeRunId),
    [activeRunId, runs],
  );

  const activeCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.runId === activeRunId),
    [activeRunId, candidates],
  );

  const problemCount = useMemo(
    () => activeCandidates.filter(isProblem).length,
    [activeCandidates],
  );

  const visibleCandidates = useMemo(() => {
    if (filter === "problems") return activeCandidates.filter(isProblem);
    if (filter === "processed") return activeCandidates.filter((candidate) => candidate.status !== "pending");
    return activeCandidates;
  }, [activeCandidates, filter]);

  const selectedPendingIds = useMemo(
    () => activeCandidates
      .filter((candidate) => candidate.status === "pending" && selected.has(candidate.id))
      .map((candidate) => candidate.id),
    [activeCandidates, selected],
  );

  useEffect(() => {
    if (!activeRunId) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(activeCandidates.filter(isReady).map((candidate) => candidate.id)));
    setFilter(activeCandidates.some(isProblem) ? "problems" : "all");
    setEditingId(undefined);
  }, [activeRunId]);

  function toggleCandidate(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectReady() {
    setSelected(new Set(activeCandidates.filter(isReady).map((candidate) => candidate.id)));
  }

  async function acceptSelected() {
    const client = getSupabaseBrowserClient();
    if (!client || !activeRun || selectedPendingIds.length === 0) return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    const { data, error: batchError } = await client.rpc("accept_release_candidates", {
      p_run_id: activeRun.id,
      p_candidate_ids: selectedPendingIds,
      p_status: "published",
    });
    if (batchError) {
      setError("Die Sammelfreigabe ist fehlgeschlagen. Es wurde kein unvollständiger Batch bestätigt.");
    } else {
      setNotice(`${formatBatch((data ?? {}) as ReleaseInboxBatchResult)} · Veröffentlichung vorbereitet.`);
      await Promise.all([loadInbox(), onReleasesChanged()]);
    }
    setSaving(false);
  }

  async function rejectSelected() {
    const client = getSupabaseBrowserClient();
    if (!client || !activeRun || selectedPendingIds.length === 0) return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    const { data, error: rejectError } = await client.rpc("reject_release_candidates", {
      p_run_id: activeRun.id,
      p_candidate_ids: selectedPendingIds,
    });
    if (rejectError) setError("Die Auswahl konnte nicht verworfen werden.");
    else {
      setNotice(formatBatch((data ?? {}) as ReleaseInboxBatchResult));
      await loadInbox();
    }
    setSaving(false);
  }

  async function rollbackRun() {
    const client = getSupabaseBrowserClient();
    if (!client || !activeRun) return;
    if (!window.confirm(`Import für den ${activeRun.targetDate} zurücknehmen? Spätere manuelle Änderungen bleiben geschützt.`)) return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    const { data, error: rollbackError } = await client.rpc("rollback_release_import", {
      p_run_id: activeRun.id,
    });
    if (rollbackError) setError("Der Wochenimport konnte nicht vollständig zurückgenommen werden.");
    else {
      setNotice(formatBatch((data ?? {}) as ReleaseInboxBatchResult));
      await Promise.all([loadInbox(), onReleasesChanged()]);
    }
    setSaving(false);
  }

  async function saveCandidate(event: FormEvent<HTMLFormElement>, candidate: ReleaseCandidate) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const form = new FormData(event.currentTarget);
    const cover = form.get("cover");
    let uploadedPath: string | undefined;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);

    try {
      let coverUrl = candidate.coverUrl ?? null;
      let storagePath = candidate.storagePath ?? null;
      let coverKind = candidate.coverKind;
      let warningCodes = candidate.warningCodes;

      if (cover instanceof File && cover.size > 0) {
        const optimized = await compressCover(cover);
        const { data: authData } = await client.auth.getUser();
        if (!authData.user) throw new Error("Deine Sitzung ist abgelaufen.");
        uploadedPath = `${authData.user.id}/inbox/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await client.storage
          .from("release-covers")
          .upload(uploadedPath, optimized, {
            cacheControl: "31536000",
            contentType: optimized.type || "image/webp",
            upsert: false,
          });
        if (uploadError) throw new Error("Das neue Cover konnte nicht hochgeladen werden.");
        coverUrl = client.storage.from("release-covers").getPublicUrl(uploadedPath).data.publicUrl;
        storagePath = uploadedPath;
        coverKind = "official";
        warningCodes = warningCodes.filter((code) => code !== "missing_stored_cover");
      }

      const trackCountValue = optionalString(form, "trackCount");
      const payload = {
        artist: String(form.get("artist") ?? "").trim(),
        title: String(form.get("title") ?? "").trim(),
        release_date: String(form.get("releaseDate") ?? ""),
        country: String(form.get("country") ?? ""),
        kind: String(form.get("kind") ?? ""),
        track_count: trackCountValue ? Number(trackCountValue) : null,
        description: optionalString(form, "description"),
        spotify_url: optionalString(form, "spotifyUrl"),
        spotify_pre_save_url: optionalString(form, "spotifyPreSaveUrl"),
        apple_music_url: optionalString(form, "appleMusicUrl"),
        youtube_url: optionalString(form, "youtubeUrl"),
        source_url: optionalString(form, "sourceUrl"),
        cover_url: coverUrl,
        storage_path: storagePath,
        cover_kind: coverKind,
        warning_codes: warningCodes,
      };

      const { error: updateError } = await client
        .from("release_candidates")
        .update(payload)
        .eq("id", candidate.id)
        .eq("status", "pending");
      if (updateError) {
        if (updateError.code === "23505") throw new Error("Dieser Kandidat ist bereits in demselben Suchlauf vorhanden.");
        throw new Error("Die Korrekturen konnten nicht gespeichert werden.");
      }

      setNotice(`${candidate.artist} — ${candidate.title} wurde aktualisiert.`);
      setEditingId(undefined);
      await loadInbox();
    } catch (saveError) {
      if (uploadedPath) await client.storage.from("release-covers").remove([uploadedPath]);
      setError(saveError instanceof Error ? saveError.message : "Die Korrekturen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  const readyCount = activeCandidates.filter(isReady).length;
  const processedCount = activeCandidates.filter((candidate) => candidate.status !== "pending").length;
  const canRollback = activeCandidates.some((candidate) => candidate.status === "accepted" || candidate.status === "duplicate");

  return (
    <div className="releaseEditorBody releaseInbox">
      <div className="adminEditorHeading">
        <div>
          <p className="adminSectionLabel">RELEASE-INBOX</p>
          <h1 className="adminTitle">PRÜFEN.<br />FREIGEBEN.</h1>
        </div>
        <button type="button" className="adminTextButton" onClick={() => void onLogout()} disabled={saving}>ABMELDEN</button>
      </div>
      <p className="adminIntro">Die Suche sammelt DE- und US-Releases hier. Vollständige Treffer sind vorausgewählt; zuerst siehst du nur Fälle, die deine Entscheidung brauchen.</p>

      {loading ? <div className="adminLoading" role="status"><span /><strong>INBOX WIRD GELADEN</strong></div> : null}
      {error ? <p className="adminError" role="alert">{error}</p> : null}
      {notice ? <div className="adminSuccess" role="status"><strong>INBOX AKTUALISIERT</strong><span>{notice}</span></div> : null}

      {!loading && runs.length === 0 ? (
        <section className="inboxEmpty">
          <strong>NOCH KEIN SUCHLAUF</strong>
          <span>Nach dem nächsten Multi-Source-Lauf erscheinen hier alle Kandidaten gesammelt.</span>
        </section>
      ) : null}

      {activeRun ? (
        <>
          <section className="inboxRunBar">
            <label className="adminField">
              <span>SUCHLAUF</span>
              <select value={activeRun.id} onChange={(event) => setActiveRunId(event.target.value)} disabled={saving}>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.targetDate} · {run.regionScope} · {run.status.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <div className="inboxStats" aria-label="Zusammenfassung des Suchlaufs">
              <span><strong>{activeCandidates.length}</strong> gefunden</span>
              <span><strong>{readyCount}</strong> bereit</span>
              <span className={problemCount > 0 ? "hasProblems" : ""}><strong>{problemCount}</strong> prüfen</span>
            </div>
          </section>

          <div className="inboxToolbar">
            <div className="inboxFilters" role="tablist" aria-label="Inbox filtern">
              <button type="button" className={filter === "problems" ? "active" : ""} onClick={() => setFilter("problems")}>PRÜFEN {problemCount}</button>
              <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>ALLE {activeCandidates.length}</button>
              <button type="button" className={filter === "processed" ? "active" : ""} onClick={() => setFilter("processed")}>ERLEDIGT {processedCount}</button>
            </div>
            <button type="button" className="adminTextButton" onClick={selectReady} disabled={saving}>BEREITE AUSWÄHLEN</button>
          </div>

          <div className="inboxCandidateList">
            {visibleCandidates.length === 0 ? (
              <section className="inboxEmpty">
                <strong>ALLES SAUBER</strong>
                <span>In diesem Filter gibt es keine Kandidaten.</span>
              </section>
            ) : visibleCandidates.map((candidate) => {
              const editing = editingId === candidate.id;
              return (
                <article className={`inboxCandidate ${isProblem(candidate) ? "hasProblem" : ""}`} key={candidate.id}>
                  <div className="inboxCandidateMain">
                    <label className="inboxSelect" aria-label={`${candidate.artist} auswählen`}>
                      <input
                        type="checkbox"
                        checked={selected.has(candidate.id)}
                        onChange={() => toggleCandidate(candidate.id)}
                        disabled={saving || candidate.status !== "pending"}
                      />
                    </label>
                    <div className="inboxCover">
                      {candidate.coverUrl ? <img src={candidate.coverUrl} alt="" /> : <span>NO<br />COVER</span>}
                    </div>
                    <div className="inboxCandidateCopy">
                      <span className="inboxMeta">{candidate.country} · {candidate.kind.toUpperCase()} · {candidate.releaseDate}</span>
                      <strong>{candidate.artist}</strong>
                      <h2>{candidate.title}</h2>
                      <span className={`inboxStatus status-${candidate.status}`}>{candidate.status.replace("_", " ")}</span>
                    </div>
                  </div>

                  <div className="inboxWarnings">
                    {candidate.confidence === "uncertain" ? <span>Unsicher</span> : null}
                    {candidate.warningCodes.map((code) => <span key={code}>{warningLabel(code)}</span>)}
                    {!candidate.storagePath && candidate.status === "pending" && !candidate.warningCodes.includes("missing_stored_cover") ? <span>Cover nicht gespeichert</span> : null}
                  </div>

                  <div className="inboxSources">
                    <span>{candidate.primarySource}</span>
                    {candidate.sources.slice(0, 3).map((source, index) => (
                      <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">{source.name || `Quelle ${index + 1}`} ↗</a>
                    ))}
                  </div>

                  {candidate.status === "pending" ? (
                    <button type="button" className="inboxEditButton" onClick={() => setEditingId(editing ? undefined : candidate.id)} disabled={saving}>
                      {editing ? "SCHLIESSEN" : "KORRIGIEREN"}
                    </button>
                  ) : null}

                  {editing ? (
                    <form className="inboxEditForm" onSubmit={(event) => void saveCandidate(event, candidate)}>
                      <div className="adminFieldGrid">
                        <label className="adminField adminFieldWide"><span>KÜNSTLER</span><input name="artist" defaultValue={candidate.artist} required maxLength={200} /></label>
                        <label className="adminField adminFieldWide"><span>TITEL</span><input name="title" defaultValue={candidate.title} required maxLength={240} /></label>
                        <label className="adminField"><span>LAND</span><select name="country" defaultValue={candidate.country}><option value="DE">DE</option><option value="US">US</option></select></label>
                        <label className="adminField"><span>TYP</span><select name="kind" defaultValue={candidate.kind}><option value="single">SINGLE</option><option value="ep">EP</option><option value="album">ALBUM</option><option value="mixtape">MIXTAPE</option></select></label>
                        <label className="adminField"><span>DATUM</span><input name="releaseDate" type="date" defaultValue={candidate.releaseDate} required /></label>
                        <label className="adminField"><span>TRACKS</span><input name="trackCount" type="number" min={1} max={999} defaultValue={candidate.trackCount} /></label>
                        <label className="adminField adminFieldWide"><span>NEUES COVER</span><input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
                        <label className="adminField adminFieldWide"><span>BESCHREIBUNG</span><textarea name="description" rows={4} defaultValue={candidate.description} /></label>
                        <label className="adminField adminFieldWide"><span>SPOTIFY</span><input name="spotifyUrl" type="url" defaultValue={candidate.spotifyUrl} /></label>
                        <label className="adminField adminFieldWide"><span>SPOTIFY PRE-SAVE</span><input name="spotifyPreSaveUrl" type="url" defaultValue={candidate.spotifyPreSaveUrl} /></label>
                        <label className="adminField adminFieldWide"><span>APPLE MUSIC</span><input name="appleMusicUrl" type="url" defaultValue={candidate.appleMusicUrl} /></label>
                        <label className="adminField adminFieldWide"><span>YOUTUBE</span><input name="youtubeUrl" type="url" defaultValue={candidate.youtubeUrl} /></label>
                        <label className="adminField adminFieldWide"><span>QUELLE</span><input name="sourceUrl" type="url" defaultValue={candidate.sourceUrl} /></label>
                      </div>
                      <button type="submit" className="adminPrimaryButton" disabled={saving}>{saving ? "SPEICHERT …" : "KORREKTUR SPEICHERN"}</button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>

          {canRollback ? (
            <button type="button" className="inboxRollback" onClick={() => void rollbackRun()} disabled={saving}>
              LETZTEN WOCHENIMPORT ZURÜCKNEHMEN
            </button>
          ) : null}

          <div className="inboxBatchBar">
            <span><strong>{selectedPendingIds.length}</strong> ausgewählt</span>
            <button type="button" className="adminSecondaryButton" onClick={() => void rejectSelected()} disabled={saving || selectedPendingIds.length === 0}>VERWERFEN</button>
            <button type="button" className="adminPrimaryButton" onClick={() => void acceptSelected()} disabled={saving || selectedPendingIds.length === 0}>
              {saving ? "VERARBEITET …" : `${selectedPendingIds.length} ÜBERNEHMEN`}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
