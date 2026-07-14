"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { ReleaseCreateResult, ReleaseFormValues, ReleaseWriteStatus } from "@/types/admin";
import type { ReleaseCountry, ReleaseKind } from "@/types/release";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxCoverBytes = 8 * 1024 * 1024;

type ReleaseFormProps = {
  targetDate: string;
  busy: boolean;
  onCreate: (values: ReleaseFormValues, cover: File | null, status: ReleaseWriteStatus) => Promise<ReleaseCreateResult>;
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

export function ReleaseForm({ targetDate, busy, onCreate, onLogout }: ReleaseFormProps) {
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<ReleaseCreateResult>();

  useEffect(() => {
    if (!cover) {
      setCoverPreview(undefined);
      return;
    }
    const preview = URL.createObjectURL(cover);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [cover]);

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
    if (status === "published" && !cover) {
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
      const result = await onCreate(values, cover, status);
      setSuccess(result);
      formElement.reset();
      setCover(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Der Release konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="releaseEditorBody">
      <div className="adminEditorHeading">
        <div>
          <p className="adminSectionLabel">NEW ENTRY</p>
          <h1 className="adminTitle">RELEASE<br />ANLEGEN</h1>
        </div>
        <button type="button" className="adminTextButton" onClick={() => void onLogout()} disabled={busy}>ABMELDEN</button>
      </div>
      <p className="adminIntro">Fülle das Template aus, prüfe das Cover und veröffentliche den Drop direkt im aktuellen Freitag-Radar.</p>

      <form className="releaseForm" onSubmit={handleSubmit}>
        <section className="adminFormSection">
          <div className="adminFormSectionTitle"><span>01</span><strong>COVER</strong></div>
          <label className={`coverUpload ${coverPreview ? "hasPreview" : ""}`}>
            {coverPreview ? <img src={coverPreview} alt="Vorschau des ausgewählten Covers" /> : <div><strong>+ COVER AUSWÄHLEN</strong><span>JPG, PNG, WEBP ODER AVIF · MAX. 8 MB</span></div>}
            <input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleCoverChange} disabled={busy} />
          </label>
          {cover ? <p className="coverFileName">{cover.name} · {(cover.size / 1024 / 1024).toFixed(1)} MB</p> : null}
        </section>

        <section className="adminFormSection">
          <div className="adminFormSectionTitle"><span>02</span><strong>BASISDATEN</strong></div>
          <div className="adminFieldGrid">
            <label className="adminField adminFieldWide"><span>KÜNSTLER *</span><input name="artist" required maxLength={200} disabled={busy} placeholder="z. B. Erabi" /></label>
            <label className="adminField adminFieldWide"><span>ALBUM / SINGLE / EP TITEL *</span><input name="title" required maxLength={240} disabled={busy} placeholder="z. B. Endgame" /></label>
            <label className="adminField"><span>TYP *</span><select name="kind" defaultValue="album" required disabled={busy}><option value="album">ALBUM</option><option value="ep">EP</option><option value="single">SINGLE</option><option value="mixtape">MIXTAPE</option></select></label>
            <label className="adminField"><span>LAND *</span><select name="country" defaultValue="DE" required disabled={busy}><option value="DE">DEUTSCHLAND</option><option value="US">USA</option></select></label>
            <label className="adminField"><span>RELEASE-DATUM *</span><input name="releaseDate" type="date" defaultValue={targetDate} required disabled={busy} /></label>
            <label className="adminField"><span>TRACKS</span><input name="trackCount" type="number" inputMode="numeric" min={1} max={999} disabled={busy} placeholder="12" /></label>
            <label className="adminField adminFieldWide"><span>GENRES</span><input name="genres" maxLength={300} disabled={busy} placeholder="Deutschrap, Hip-Hop/Rap" /><small>Mehrere Genres mit Komma trennen.</small></label>
            <label className="adminField adminFieldWide"><span>BESCHREIBUNG</span><textarea name="description" rows={5} maxLength={5000} disabled={busy} placeholder="Kurzer redaktioneller Text zum Release …" /></label>
          </div>
        </section>

        <section className="adminFormSection">
          <div className="adminFormSectionTitle"><span>03</span><strong>LINKS</strong></div>
          <div className="adminFieldGrid">
            <label className="adminField adminFieldWide"><span>SPOTIFY</span><input name="spotifyUrl" type="url" inputMode="url" disabled={busy} placeholder="https://open.spotify.com/album/…" /></label>
            <label className="adminField adminFieldWide"><span>SPOTIFY PRE-SAVE</span><input name="spotifyPreSaveUrl" type="url" inputMode="url" disabled={busy} placeholder="https://…" /></label>
            <label className="adminField adminFieldWide"><span>APPLE MUSIC</span><input name="appleMusicUrl" type="url" inputMode="url" disabled={busy} placeholder="https://music.apple.com/…" /></label>
            <label className="adminField adminFieldWide"><span>YOUTUBE</span><input name="youtubeUrl" type="url" inputMode="url" disabled={busy} placeholder="https://youtube.com/…" /></label>
            <label className="adminField adminFieldWide"><span>QUELLEN-LINK</span><input name="sourceUrl" type="url" inputMode="url" disabled={busy} placeholder="Offizielle Ankündigung oder Label-Seite" /></label>
          </div>
        </section>

        {error ? <p className="adminError" role="alert">{error}</p> : null}
        {success ? (
          <div className="adminSuccess" role="status">
            <strong>{success.status === "published" ? "RELEASE IST VERÖFFENTLICHT" : "ENTWURF GESPEICHERT"}</strong>
            <span>{success.status === "published" && success.releaseDate === targetDate ? "Der Eintrag erscheint jetzt im aktuellen Release-Radar." : `Gespeichert für den ${success.releaseDate}.`}</span>
            {success.status === "published" ? <Link href="/">ÖFFENTLICHEN FEED ÖFFNEN →</Link> : null}
          </div>
        ) : null}

        <div className="adminActions">
          <button type="submit" name="intent" value="draft" className="adminSecondaryButton" disabled={busy}>{busy ? "SPEICHERT …" : "ALS ENTWURF"}</button>
          <button type="submit" name="intent" value="published" className="adminPrimaryButton" disabled={busy}>{busy ? "VERÖFFENTLICHT …" : "JETZT VERÖFFENTLICHEN →"}</button>
        </div>
      </form>
    </div>
  );
}
