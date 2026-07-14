"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { EditableRelease, ReleaseCreateResult, ReleaseFormValues, ReleaseWriteStatus } from "@/types/admin";
import type { ReleaseCountry, ReleaseKind } from "@/types/release";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxCoverBytes = 8 * 1024 * 1024;

type ReleaseFormProps = {
  targetDate: string;
  busy: boolean;
  releases: EditableRelease[];
  onSave: (values: ReleaseFormValues, cover: File | null, status: ReleaseWriteStatus, existing?: EditableRelease) => Promise<ReleaseCreateResult>;
  onDelete: (release: EditableRelease) => Promise<void>;
  onLogout: () => Promise<void>;
};

function optionalString(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  return value || undefined;
}

function parseGenres(value?: string) {
  if (!value) return [];
  return [...new Set(value.split(",").map((genre) => genre.trim()).filter(Boolean))].slice(0, 12);
}

export function ReleaseForm({ targetDate, busy, releases, onSave, onDelete, onLogout }: ReleaseFormProps) {
  const [editing, setEditing] = useState<EditableRelease>();
  const [formKey, setFormKey] = useState(0);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<ReleaseCreateResult>();

  useEffect(() => {
    if (!cover) {
      setCoverPreview(editing?.coverUrl);
      return;
    }
    const preview = URL.createObjectURL(cover);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [cover, editing]);

  function startNew() {
    setEditing(undefined);
    setCover(null);
    setError(undefined);
    setSuccess(undefined);
    setFormKey((value) => value + 1);
  }

  function startEditing(release: EditableRelease) {
    setEditing(release);
    setCover(null);
    setError(undefined);
    setSuccess(undefined);
    setFormKey((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(undefined);
    setSuccess(undefined);
    if (!file) {
      setCover(null);
      return;
    }
    if (!allowedImageTypes.has(file.type)) {
      event.target.value = "";
      setCover(null);
      setError("Bitte JPG, PNG, WebP oder AVIF als Cover verwenden.");
      return;
    }
    if (file.size > maxCoverBytes) {
      event.target.value = "";
      setCover(null);
      setError("Das Cover darf höchstens 8 MB groß sein.");
      return;
    }
    setCover(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status: ReleaseWriteStatus = submitter?.value === "draft" ? "draft" : "published";
    if (status === "published" && !cover && !editing?.coverUrl) {
      setError("Zum direkten Veröffentlichen wird ein Cover benötigt. Alternativ kannst du den Release als Entwurf speichern.");
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const trackCountRaw = optionalString(form, "trackCount");
    const values: ReleaseFormValues = {
      artist: String(form.get("artist") ?? "").trim(),
      title: String(form.get("title") ?? "").trim(),
      releaseDate: String(form.get("releaseDate") ?? ""),
      country: String(form.get("country") ?? "DE") as ReleaseCountry,
      kind: String(form.get("kind") ?? "album") as ReleaseKind,
      trackCount: trackCountRaw ? Number(trackCountRaw) : undefined,
      description: optionalString(form, "description"),
      genres: parseGenres(optionalString(form, "genres")),
      spotifyUrl: optionalString(form, "spotifyUrl"),
      spotifyPreSaveUrl: optionalString(form, "spotifyPreSaveUrl"),
      appleMusicUrl: optionalString(form, "appleMusicUrl"),
      youtubeUrl: optionalString(form, "youtubeUrl"),
      sourceUrl: optionalString(form, "sourceUrl"),
    };

    try {
      const result = await onSave(values, cover, status, editing);
      setSuccess(result);
      if (!editing) {
        formElement.reset();
        setCover(null);
        setFormKey((value) => value + 1);
      } else {
        setEditing((current) => current ? { ...current, ...values, status, coverUrl: coverPreview ?? current.coverUrl } : current);
        setCover(null);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Der Release konnte nicht gespeichert werden.");
    }
  }

  async function handleDelete(release: EditableRelease) {
    if (!window.confirm(`„${release.title}“ von ${release.artist} wirklich löschen?`)) return;
    setError(undefined);
    setSuccess(undefined);
    try {
      await onDelete(release);
      if (editing?.id === release.id) startNew();
      setSuccess({ id: release.id, status: release.status, releaseDate: release.releaseDate, action: "deleted" });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Der Release konnte nicht gelöscht werden.");
    }
  }

  return (
    <div className="releaseEditorBody">
      <div className="adminEditorHeading">
        <div>
          <p className="adminSectionLabel">{editing ? "EDIT ENTRY" : "NEW ENTRY"}</p>
          <h1 className="adminTitle">RELEASE<br />{editing ? "BEARBEITEN" : "ANLEGEN"}</h1>
        </div>
        <button type="button" className="adminTextButton" onClick={() => void onLogout()} disabled={busy}>ABMELDEN</button>
      </div>
      <p className="adminIntro">Alle Releases liegen zentral in Supabase. Du kannst Einträge erstellen, nachträglich bearbeiten, als Entwurf speichern oder löschen.</p>

      {editing ? (
        <div className="adminSuccess">
          <strong>BEARBEITUNGSMODUS</strong>
          <span>{editing.artist} — {editing.title}</span>
          <button type="button" className="adminTextButton" onClick={startNew} disabled={busy}>+ NEUEN RELEASE ANLEGEN</button>
        </div>
      ) : null}

      <form key={`${editing?.id ?? "new"}-${formKey}`} className="releaseForm" onSubmit={handleSubmit}>
        <section className="adminFormSection">
          <div className="adminFormSectionTitle"><span>01</span><strong>COVER</strong></div>
          <label className={`coverUpload ${coverPreview ? "hasPreview" : ""}`}>
            {coverPreview ? <img src={coverPreview} alt="Vorschau des ausgewählten Covers" /> : <div><strong>+ COVER AUSWÄHLEN</strong><span>JPG, PNG, WEBP ODER AVIF · MAX. 8 MB</span></div>}
            <input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleCoverChange} disabled={busy} />
          </label>
          {cover ? <p className="coverFileName">{cover.name} · {(cover.size / 1024 / 1024).toFixed(1)} MB</p> : editing?.coverUrl ? <p className="coverFileName">Vorhandenes Cover bleibt erhalten, solange du kein neues auswählst.</p> : null}
        </section>

        <section className="adminFormSection">
          <div className="adminFormSectionTitle"><span>02</span><strong>BASISDATEN</strong></div>
          <div className="adminFieldGrid">
            <label className="adminField adminFieldWide"><span>KÜNSTLER *</span><input name="artist" required maxLength={200} disabled={busy} defaultValue={editing?.artist} placeholder="z. B. Erabi" /></label>
            <label className="adminField adminFieldWide"><span>ALBUM / SINGLE / EP TITEL *</span><input name="title" required maxLength={240} disabled={busy} defaultValue={editing?.title} placeholder="z. B. Endgame" /></label>
            <label className="adminField"><span>TYP *</span><select name="kind" defaultValue={editing?.kind ?? "album"} required disabled={busy}><option value="album">ALBUM</option><option value="ep">EP</option><option value="single">SINGLE</option><option value="mixtape">MIXTAPE</option></select></label>
            <label className="adminField"><span>LAND *</span><select name="country" defaultValue={editing?.country ?? "DE"} required disabled={busy}><option value="DE">DEUTSCHLAND</option><option value="US">USA</option></select></label>
            <label className="adminField"><span>RELEASE-DATUM *</span><input name="releaseDate" type="date" defaultValue={editing?.releaseDate ?? targetDate} required disabled={busy} /></label>
            <label className="adminField"><span>TRACKS</span><input name="trackCount" type="number" inputMode="numeric" min={1} max={999} disabled={busy} defaultValue={editing?.trackCount} placeholder="12" /></label>
            <label className="adminField adminFieldWide"><span>GENRES</span><input name="genres" maxLength={300} disabled={busy} defaultValue={editing?.genres.join(", ")} placeholder="Deutschrap, Hip-Hop/Rap" /><small>Mehrere Genres mit Komma trennen.</small></label>
            <label className="adminField adminFieldWide"><span>BESCHREIBUNG</span><textarea name="description" rows={5} maxLength={5000} disabled={busy} defaultValue={editing?.description} placeholder="Kurzer redaktioneller Text zum Release …" /></label>
          </div>
        </section>

        <section className="adminFormSection">
          <div className="adminFormSectionTitle"><span>03</span><strong>LINKS</strong></div>
          <div className="adminFieldGrid">
            <label className="adminField adminFieldWide"><span>SPOTIFY</span><input name="spotifyUrl" type="url" inputMode="url" disabled={busy} defaultValue={editing?.spotifyUrl} placeholder="https://open.spotify.com/album/…" /></label>
            <label className="adminField adminFieldWide"><span>SPOTIFY PRE-SAVE</span><input name="spotifyPreSaveUrl" type="url" inputMode="url" disabled={busy} defaultValue={editing?.spotifyPreSaveUrl} placeholder="https://…" /></label>
            <label className="adminField adminFieldWide"><span>APPLE MUSIC</span><input name="appleMusicUrl" type="url" inputMode="url" disabled={busy} defaultValue={editing?.appleMusicUrl} placeholder="https://music.apple.com/…" /></label>
            <label className="adminField adminFieldWide"><span>YOUTUBE</span><input name="youtubeUrl" type="url" inputMode="url" disabled={busy} defaultValue={editing?.youtubeUrl} placeholder="https://youtube.com/…" /></label>
            <label className="adminField adminFieldWide"><span>QUELLEN-LINK</span><input name="sourceUrl" type="url" inputMode="url" disabled={busy} defaultValue={editing?.sourceUrl} placeholder="Offizielle Ankündigung oder Label-Seite" /></label>
          </div>
        </section>

        {error ? <p className="adminError" role="alert">{error}</p> : null}
        {success ? (
          <div className="adminSuccess" role="status">
            <strong>{success.action === "deleted" ? "RELEASE GELÖSCHT" : success.action === "updated" ? "ÄNDERUNGEN GESPEICHERT" : success.status === "published" ? "RELEASE IST VERÖFFENTLICHT" : "ENTWURF GESPEICHERT"}</strong>
            <span>{success.action === "deleted" ? "Der Eintrag wurde aus Supabase entfernt." : `Gespeichert für den ${success.releaseDate}.`}</span>
            {success.status === "published" && success.action !== "deleted" ? <Link href="/">ÖFFENTLICHEN FEED ÖFFNEN →</Link> : null}
          </div>
        ) : null}

        <div className="adminActions">
          {editing ? <button type="button" className="adminSecondaryButton" onClick={() => void handleDelete(editing)} disabled={busy}>LÖSCHEN</button> : null}
          <button type="submit" name="intent" value="draft" className="adminSecondaryButton" disabled={busy}>{busy ? "SPEICHERT …" : "ALS ENTWURF"}</button>
          <button type="submit" name="intent" value="published" className="adminPrimaryButton" disabled={busy}>{busy ? "SPEICHERT …" : editing ? "ÄNDERUNGEN SPEICHERN →" : "JETZT VERÖFFENTLICHEN →"}</button>
        </div>
      </form>

      <section className="adminFormSection">
        <div className="adminFormSectionTitle"><span>04</span><strong>ALLE RELEASES ({releases.length})</strong></div>
        <div className="releaseForm">
          {releases.length === 0 ? <p className="adminIntro">Noch keine Releases in Supabase gespeichert.</p> : releases.map((release) => (
            <div className="adminSuccess" key={release.id}>
              <strong>{release.artist} — {release.title}</strong>
              <span>{release.releaseDate} · {release.kind.toUpperCase()} · {release.status === "published" ? "VERÖFFENTLICHT" : "ENTWURF"}</span>
              <button type="button" className="adminTextButton" onClick={() => startEditing(release)} disabled={busy}>BEARBEITEN →</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
