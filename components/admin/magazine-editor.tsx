"use client";

import { useState, type FormEvent } from "react";

export type MagazinePost = {
  id: string;
  title: string;
  slug: string;
  scope: "ALL" | "DE" | "US";
  category: "IN_SCOPE" | "US_RADAR" | "DE_FOCUS" | "MUST_HEAR" | "FIRST_LISTEN" | "COVER_CHECK" | "FEATURE_WATCH";
  region: "DE" | "US" | "GLOBAL";
  excerpt: string;
  body: string;
  facts: string[];
  coverUrl?: string;
  storagePath?: string;
  sourceUrl?: string;
  authorName?: string;
  status: "draft" | "preview" | "published" | "archived";
  releaseWeek?: string;
  publishAt?: string;
  featured: boolean;
  publishedAt?: string;
};

export type MagazinePostValues = Omit<MagazinePost, "id" | "publishedAt">;

type Props = {
  busy: boolean;
  posts: MagazinePost[];
  onSave: (values: MagazinePostValues, cover: File | null, existing?: MagazinePost) => Promise<void>;
  onDelete: (post: MagazinePost) => Promise<void>;
};

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function toSlug(input: string) {
  return input.toLocaleLowerCase("de-DE").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export function MagazineEditor({ busy, posts, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<MagazinePost>();
  const [previewing, setPreviewing] = useState<MagazinePost>();
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [formKey, setFormKey] = useState(0);

  function newPost() {
    setEditing(undefined); setCover(null); setCoverPreview(undefined); setError(undefined); setNotice(undefined); setFormKey((key) => key + 1);
  }

  function edit(post: MagazinePost) {
    setEditing(post); setCover(null); setCoverPreview(undefined); setError(undefined); setNotice(undefined); setFormKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectCover(file?: File) {
    setCover(file ?? null);
    setCoverPreview(file ? URL.createObjectURL(file) : undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined); setNotice(undefined);
    const form = new FormData(event.currentTarget);
    const title = value(form, "title");
    const slug = toSlug(value(form, "slug") || title);
    const facts = value(form, "facts").split("\n").map((fact) => fact.trim()).filter(Boolean).slice(0, 6);
    if (!slug) { setError("Bitte Titel oder URL-Slug angeben."); return; }
    try {
      await onSave({
        title,
        slug,
        scope: value(form, "scope") as MagazinePostValues["scope"],
        category: value(form, "category") as MagazinePostValues["category"],
        region: value(form, "region") as MagazinePostValues["region"],
        excerpt: value(form, "excerpt"),
        body: value(form, "body"),
        facts,
        coverUrl: value(form, "coverUrl") || editing?.coverUrl,
        storagePath: editing?.storagePath,
        sourceUrl: value(form, "sourceUrl") || undefined,
        authorName: value(form, "authorName") || undefined,
        status: value(form, "status") as MagazinePostValues["status"],
        releaseWeek: value(form, "releaseWeek") || undefined,
        publishAt: value(form, "publishAt") || undefined,
        featured: form.get("featured") === "on",
      }, cover, editing);
      setNotice(editing ? "BEITRAG AKTUALISIERT" : "BEITRAG GESPEICHERT");
      if (!editing) { event.currentTarget.reset(); setCover(null); setCoverPreview(undefined); setFormKey((key) => key + 1); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der Beitrag konnte nicht gespeichert werden."); }
  }

  async function remove(post: MagazinePost) {
    if (!window.confirm(`„${post.title}“ wirklich löschen?`)) return;
    try { await onDelete(post); if (editing?.id === post.id) newPost(); setNotice("BEITRAG GELÖSCHT"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Der Beitrag konnte nicht gelöscht werden."); }
  }

  return <div className="releaseEditorBody">
    {previewing ? <MagazinePreview post={previewing} onClose={() => setPreviewing(undefined)} /> : null}
    <div className="adminEditorHeading"><div><p className="adminSectionLabel">PRIVATE REDAKTION</p><h1 className="adminTitle">MAGAZIN<br />EDITOR</h1></div><button type="button" className="adminTextButton" onClick={newPost} disabled={busy}>+ NEUER BEITRAG</button></div>
    <p className="adminIntro">Magazin-Inhalte liegen in Supabase. Das Repo liefert nur Layout und Logik; Bilder landen als URL oder Upload im Storage.</p>
    <form key={`${editing?.id ?? "new"}-${formKey}`} className="releaseForm" onSubmit={(event) => void submit(event)}>
      <section className="adminFormSection"><div className="adminFormSectionTitle"><span>01</span><strong>ARTIKEL</strong></div><div className="adminFieldGrid">
        <label className="adminField adminFieldWide"><span>TITEL *</span><input name="title" required maxLength={180} defaultValue={editing?.title} disabled={busy} placeholder="z. B. Die Releases, die diese Woche zählen" /></label>
        <label className="adminField adminFieldWide"><span>URL-SLUG</span><input name="slug" maxLength={110} defaultValue={editing?.slug} disabled={busy} placeholder="wird aus dem Titel erzeugt" /><small>Nur für die spätere öffentliche Artikel-URL.</small></label>
        <label className="adminField"><span>BEREICH *</span><select name="scope" defaultValue={editing?.scope ?? "ALL"} disabled={busy}><option value="ALL">ALL</option><option value="DE">DE</option><option value="US">US</option></select></label>
        <label className="adminField"><span>RUBRIK *</span><select name="category" defaultValue={editing?.category ?? "IN_SCOPE"} disabled={busy}><option value="IN_SCOPE">IN SCOPE</option><option value="US_RADAR">US RADAR</option><option value="DE_FOCUS">DEUTSCHRAP FOKUS</option><option value="MUST_HEAR">MUST HEAR</option><option value="FIRST_LISTEN">FIRST LISTEN</option><option value="COVER_CHECK">COVER CHECK</option><option value="FEATURE_WATCH">FEATURE WATCH</option></select></label>
        <label className="adminField"><span>REGION *</span><select name="region" defaultValue={editing?.region ?? "GLOBAL"} disabled={busy}><option value="GLOBAL">GLOBAL</option><option value="DE">DE</option><option value="US">US</option></select></label>
        <label className="adminField"><span>STATUS *</span><select name="status" defaultValue={editing?.status ?? "draft"} disabled={busy}><option value="draft">ENTWURF</option><option value="preview">ADMIN PREVIEW</option><option value="published">PUBLIC</option><option value="archived">ARCHIV</option></select></label>
        <label className="adminField"><span>RELEASE-WOCHE</span><input name="releaseWeek" type="date" defaultValue={editing?.releaseWeek} disabled={busy} /></label>
        <label className="adminField"><span>PUBLIC AB</span><input name="publishAt" type="datetime-local" defaultValue={editing?.publishAt?.slice(0, 16)} disabled={busy} /></label>
        <label className="adminCheckField"><input name="featured" type="checkbox" defaultChecked={editing?.featured ?? false} disabled={busy} /><span>Auf Startseite hervorheben</span></label>
        <label className="adminField adminFieldWide"><span>TEASER *</span><textarea name="excerpt" required rows={3} maxLength={500} defaultValue={editing?.excerpt} disabled={busy} placeholder="Kurztext für die Magazin-Kachel unter dem Cover …" /></label>
        <label className="adminField adminFieldWide"><span>FACTS</span><textarea name="facts" rows={5} maxLength={1000} defaultValue={editing?.facts.join("\n")} disabled={busy} placeholder={"Ein Fact pro Zeile\nmaximal 6 Facts"} /></label>
        <label className="adminField adminFieldWide"><span>ARTIKELTEXT *</span><textarea name="body" required rows={12} maxLength={20000} defaultValue={editing?.body} disabled={busy} placeholder="Dein Magazinbeitrag …" /></label>
      </div></section>
      <section className="adminFormSection"><div className="adminFormSectionTitle"><span>02</span><strong>OPTIONAL</strong></div><div className="adminFieldGrid">
        <label className={`coverUpload adminFieldWide ${(coverPreview || editing?.coverUrl) ? "hasPreview" : ""}`}><input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={busy} onChange={(event) => selectCover(event.target.files?.[0])} />{coverPreview || editing?.coverUrl ? <img src={coverPreview || editing?.coverUrl} alt="" /> : <div><strong>COVER HOCHLADEN</strong><span>JPG, PNG, WEBP oder AVIF bis 5 MB</span></div>}</label>
        <label className="adminField adminFieldWide"><span>COVER-URL</span><input name="coverUrl" type="url" defaultValue={editing?.coverUrl} disabled={busy} placeholder="https://…" /></label>
        <label className="adminField adminFieldWide"><span>QUELLE</span><input name="sourceUrl" type="url" defaultValue={editing?.sourceUrl} disabled={busy} placeholder="https://…" /></label>
        <label className="adminField adminFieldWide"><span>AUTOR</span><input name="authorName" maxLength={120} defaultValue={editing?.authorName} disabled={busy} placeholder="Release Friday Redaktion" /></label>
      </div></section>
      {error ? <p className="adminError" role="alert">{error}</p> : null}{notice ? <div className="adminSuccess" role="status"><strong>{notice}</strong><span>Nur im Admin gespeichert – auf der Startseite noch nicht sichtbar.</span></div> : null}
      <div className="adminActions">{editing ? <button type="button" className="adminSecondaryButton" onClick={() => void remove(editing)} disabled={busy}>LÖSCHEN</button> : null}<button type="submit" className="adminPrimaryButton" disabled={busy}>{busy ? "SPEICHERT …" : editing ? "ÄNDERUNGEN SPEICHERN →" : "BEITRAG SPEICHERN →"}</button></div>
    </form>
    <section className="adminFormSection"><div className="adminFormSectionTitle"><span>03</span><strong>REDAKTIONS-ARCHIV ({posts.length})</strong></div><div className="releaseForm">{posts.length === 0 ? <p className="adminIntro">Noch keine Magazinbeiträge angelegt.</p> : posts.map((post) => <div className="adminSuccess magazineArchiveItem" key={post.id}><strong>[{post.region} · {post.category.replace(/_/g, " ")}] {post.title}</strong><span>{post.status.toUpperCase()} · {post.releaseWeek ?? "ohne Woche"} · /magazin/{post.slug}</span><div className="magazineArchiveActions"><button type="button" className="adminTextButton" onClick={() => setPreviewing(post)} disabled={busy}>PREVIEW →</button><button type="button" className="adminTextButton" onClick={() => edit(post)} disabled={busy}>BEARBEITEN →</button></div></div>)}</div></section>
  </div>;
}

function MagazinePreview({ post, onClose }: { post: MagazinePost; onClose: () => void }) {
  const paragraphs = post.body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const date = post.publishedAt ? new Date(post.publishedAt) : undefined;
  const formattedDate = date ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "PREVIEW";

  return (
    <div className="magazinePreviewOverlay" role="dialog" aria-modal="true" aria-label={`${post.title} Vorschau`}>
      <article className="magazinePreviewSheet">
        <div className="detailToolbar magazinePreviewToolbar">
          <button type="button" onClick={onClose}>← ZURÜCK</button>
          <span>ADMIN PREVIEW</span>
        </div>
        {post.coverUrl ? (
          <div className="detailCover"><div className="tapeCover"><img src={post.coverUrl} alt="" /></div></div>
        ) : null}
        <div className="magazinePreviewBody">
          <span className="confirmedLabel">{post.category.replace(/_/g, " ")} · {post.region}</span>
          <p className="magazinePreviewMeta">{formattedDate} · {post.authorName || "Release Friday Redaktion"}</p>
          <h1>{post.title}</h1>
          <p className="magazinePreviewExcerpt">{post.excerpt}</p>
          {post.facts.length > 0 ? <ul className="magazineFactList">{post.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
          <div className="magazinePreviewCopy">
            {paragraphs.length > 0 ? paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p>{post.body}</p>}
          </div>
          {post.sourceUrl ? <a className="magazinePreviewSource" href={post.sourceUrl} target="_blank" rel="noreferrer">QUELLE ÖFFNEN →</a> : null}
        </div>
      </article>
    </div>
  );
}
