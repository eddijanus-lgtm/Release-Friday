"use client";

import { useState, type FormEvent } from "react";

export type MagazinePost = {
  id: string;
  title: string;
  slug: string;
  scope: "ALL" | "DE" | "US";
  excerpt: string;
  body: string;
  coverUrl?: string;
  sourceUrl?: string;
  authorName?: string;
  status: "draft" | "published";
  publishedAt?: string;
};

export type MagazinePostValues = Omit<MagazinePost, "id" | "publishedAt">;

type Props = {
  busy: boolean;
  posts: MagazinePost[];
  onSave: (values: MagazinePostValues, existing?: MagazinePost) => Promise<void>;
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
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [formKey, setFormKey] = useState(0);

  function newPost() {
    setEditing(undefined); setError(undefined); setNotice(undefined); setFormKey((key) => key + 1);
  }

  function edit(post: MagazinePost) {
    setEditing(post); setError(undefined); setNotice(undefined); setFormKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined); setNotice(undefined);
    const form = new FormData(event.currentTarget);
    const title = value(form, "title");
    const slug = toSlug(value(form, "slug") || title);
    if (!slug) { setError("Bitte Titel oder URL-Slug angeben."); return; }
    try {
      await onSave({ title, slug, scope: value(form, "scope") as MagazinePostValues["scope"], excerpt: value(form, "excerpt"), body: value(form, "body"), coverUrl: value(form, "coverUrl") || undefined, sourceUrl: value(form, "sourceUrl") || undefined, authorName: value(form, "authorName") || undefined, status: value(form, "status") as MagazinePostValues["status"] }, editing);
      setNotice(editing ? "BEITRAG AKTUALISIERT" : "BEITRAG GESPEICHERT");
      if (!editing) { event.currentTarget.reset(); setFormKey((key) => key + 1); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der Beitrag konnte nicht gespeichert werden."); }
  }

  async function remove(post: MagazinePost) {
    if (!window.confirm(`„${post.title}“ wirklich löschen?`)) return;
    try { await onDelete(post); if (editing?.id === post.id) newPost(); setNotice("BEITRAG GELÖSCHT"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Der Beitrag konnte nicht gelöscht werden."); }
  }

  return <div className="releaseEditorBody">
    <div className="adminEditorHeading"><div><p className="adminSectionLabel">PRIVATE REDAKTION</p><h1 className="adminTitle">MAGAZIN<br />EDITOR</h1></div><button type="button" className="adminTextButton" onClick={newPost} disabled={busy}>+ NEUER BEITRAG</button></div>
    <p className="adminIntro">Die drei späteren Startseiten-Bereiche sind bereits vorbereitet: ALL, DE und US. Aktuell bleiben alle Beiträge ausschließlich im Admin sichtbar.</p>
    <form key={`${editing?.id ?? "new"}-${formKey}`} className="releaseForm" onSubmit={(event) => void submit(event)}>
      <section className="adminFormSection"><div className="adminFormSectionTitle"><span>01</span><strong>ARTIKEL</strong></div><div className="adminFieldGrid">
        <label className="adminField adminFieldWide"><span>TITEL *</span><input name="title" required maxLength={180} defaultValue={editing?.title} disabled={busy} placeholder="z. B. Die Releases, die diese Woche zählen" /></label>
        <label className="adminField adminFieldWide"><span>URL-SLUG</span><input name="slug" maxLength={110} defaultValue={editing?.slug} disabled={busy} placeholder="wird aus dem Titel erzeugt" /><small>Nur für die spätere öffentliche Artikel-URL.</small></label>
        <label className="adminField"><span>BEREICH *</span><select name="scope" defaultValue={editing?.scope ?? "ALL"} disabled={busy}><option value="ALL">ALL</option><option value="DE">DE</option><option value="US">US</option></select></label>
        <label className="adminField"><span>STATUS *</span><select name="status" defaultValue={editing?.status ?? "draft"} disabled={busy}><option value="draft">ENTWURF</option><option value="published">FERTIG / SPÄTER PUBLIC</option></select></label>
        <label className="adminField adminFieldWide"><span>TEASER *</span><textarea name="excerpt" required rows={3} maxLength={500} defaultValue={editing?.excerpt} disabled={busy} placeholder="Kurztext für die Magazin-Kachel unter dem Cover …" /></label>
        <label className="adminField adminFieldWide"><span>ARTIKELTEXT *</span><textarea name="body" required rows={12} maxLength={20000} defaultValue={editing?.body} disabled={busy} placeholder="Dein Magazinbeitrag …" /></label>
      </div></section>
      <section className="adminFormSection"><div className="adminFormSectionTitle"><span>02</span><strong>OPTIONAL</strong></div><div className="adminFieldGrid">
        <label className="adminField adminFieldWide"><span>COVER-URL</span><input name="coverUrl" type="url" defaultValue={editing?.coverUrl} disabled={busy} placeholder="https://…" /></label>
        <label className="adminField adminFieldWide"><span>QUELLE</span><input name="sourceUrl" type="url" defaultValue={editing?.sourceUrl} disabled={busy} placeholder="https://…" /></label>
        <label className="adminField adminFieldWide"><span>AUTOR</span><input name="authorName" maxLength={120} defaultValue={editing?.authorName} disabled={busy} placeholder="Release Friday Redaktion" /></label>
      </div></section>
      {error ? <p className="adminError" role="alert">{error}</p> : null}{notice ? <div className="adminSuccess" role="status"><strong>{notice}</strong><span>Nur im Admin gespeichert – auf der Startseite noch nicht sichtbar.</span></div> : null}
      <div className="adminActions">{editing ? <button type="button" className="adminSecondaryButton" onClick={() => void remove(editing)} disabled={busy}>LÖSCHEN</button> : null}<button type="submit" className="adminPrimaryButton" disabled={busy}>{busy ? "SPEICHERT …" : editing ? "ÄNDERUNGEN SPEICHERN →" : "BEITRAG SPEICHERN →"}</button></div>
    </form>
    <section className="adminFormSection"><div className="adminFormSectionTitle"><span>03</span><strong>REDAKTIONS-ARCHIV ({posts.length})</strong></div><div className="releaseForm">{posts.length === 0 ? <p className="adminIntro">Noch keine Magazinbeiträge angelegt.</p> : posts.map((post) => <div className="adminSuccess" key={post.id}><strong>[{post.scope}] {post.title}</strong><span>{post.status === "published" ? "FERTIG / SPÄTER PUBLIC" : "ENTWURF"} · /magazin/{post.slug}</span><button type="button" className="adminTextButton" onClick={() => edit(post)} disabled={busy}>BEARBEITEN →</button></div>)}</div></section>
  </div>;
}
