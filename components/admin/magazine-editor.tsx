"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";

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
  onSave: (values: MagazinePostValues, cover: File | null, bodyImages: BodyImage[], existing?: MagazinePost) => Promise<MagazinePost>;
  onDelete: (post: MagazinePost) => Promise<void>;
};

export type BodyImage = {
  id: string;
  file: File;
  previewUrl: string;
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
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState<MagazinePost["category"]>("IN_SCOPE");
  const [region, setRegion] = useState<MagazinePost["region"]>("GLOBAL");
  const [body, setBody] = useState("");
  const [factsInput, setFactsInput] = useState("");
  const [bodyImages, setBodyImages] = useState<BodyImage[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [formKey, setFormKey] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function newPost() {
    setEditing(undefined); setCover(null); setCoverPreview(undefined); setTitle(""); setExcerpt(""); setCategory("IN_SCOPE"); setRegion("GLOBAL"); setBody(""); setFactsInput(""); setBodyImages([]); setError(undefined); setNotice(undefined); setFormKey((key) => key + 1);
  }

  function edit(post: MagazinePost) {
    setEditing(post); setCover(null); setCoverPreview(undefined); setTitle(post.title); setExcerpt(post.excerpt); setCategory(post.category); setRegion(post.region); setBody(post.body); setFactsInput(post.facts.join("\n")); setBodyImages([]); setError(undefined); setNotice(undefined); setFormKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectCover(file?: File) {
    setCover(file ?? null);
    setCoverPreview(file ? URL.createObjectURL(file) : undefined);
  }

  function insertAtCursor(text: string) {
    const field = bodyRef.current;
    if (!field) {
      setBody((current) => `${current}${text}`);
      return;
    }
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const next = `${body.slice(0, start)}${text}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      field.focus();
      field.selectionStart = start + text.length;
      field.selectionEnd = start + text.length;
    });
  }

  function addBodyImages(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    const nextImages = images.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setBodyImages((current) => [...current, ...nextImages]);
    insertAtCursor(`\n\n${nextImages.map((image) => `![Bild](local:${image.id})`).join("\n\n")}\n\n`);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    event.preventDefault();
    addBodyImages(images);
  }

  function handleDrop(event: DragEvent<HTMLTextAreaElement>) {
    const images = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    event.preventDefault();
    addBodyImages(images);
  }

  function removeBodyImage(image: BodyImage) {
    setBodyImages((current) => current.filter((item) => item.id !== image.id));
    setBody((current) => current.replaceAll(`![Bild](local:${image.id})`, "").replace(/\n{3,}/g, "\n\n"));
  }

  const facts = factsInput.split("\n").map((fact) => fact.trim()).filter(Boolean).slice(0, 6);
  const draftPreview: MagazinePost = {
    id: editing?.id ?? "preview",
    title: title || "Unbenannter Artikel",
    slug: editing?.slug ?? toSlug(title || "preview"),
    scope: editing?.scope ?? "ALL",
    category,
    region,
    excerpt: excerpt || "Teaser erscheint hier, sobald du ihn einfügst.",
    body: body || "Schreib deinen Artikel links. Die Vorschau aktualisiert sich direkt beim Tippen.",
    facts,
    coverUrl: coverPreview || editing?.coverUrl,
    sourceUrl: editing?.sourceUrl,
    authorName: editing?.authorName,
    status: editing?.status ?? "draft",
    releaseWeek: editing?.releaseWeek,
    publishAt: editing?.publishAt,
    featured: editing?.featured ?? false,
    publishedAt: editing?.publishedAt,
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined); setNotice(undefined);
    const form = new FormData(event.currentTarget);
    const slug = toSlug(value(form, "slug") || title);
    if (!slug) { setError("Bitte Titel oder URL-Slug angeben."); return; }
    try {
      const saved = await onSave({
        title,
        slug,
        scope: value(form, "scope") as MagazinePostValues["scope"],
        category,
        region,
        excerpt,
        body,
        facts,
        coverUrl: value(form, "coverUrl") || editing?.coverUrl,
        storagePath: editing?.storagePath,
        sourceUrl: value(form, "sourceUrl") || undefined,
        authorName: value(form, "authorName") || undefined,
        status: value(form, "status") as MagazinePostValues["status"],
        releaseWeek: value(form, "releaseWeek") || undefined,
        publishAt: value(form, "publishAt") || undefined,
        featured: form.get("featured") === "on",
      }, cover, bodyImages, editing);
      setEditing(saved);
      setTitle(saved.title);
      setExcerpt(saved.excerpt);
      setCategory(saved.category);
      setRegion(saved.region);
      setBody(saved.body);
      setFactsInput(saved.facts.join("\n"));
      setCover(null);
      setCoverPreview(undefined);
      setNotice(editing ? "BEITRAG AKTUALISIERT" : "BEITRAG GESPEICHERT");
      setBodyImages([]);
      if (!editing) { setFormKey((key) => key + 1); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der Beitrag konnte nicht gespeichert werden."); }
  }

  async function remove(post: MagazinePost) {
    if (!window.confirm(`„${post.title}“ wirklich löschen?`)) return;
    try { await onDelete(post); if (editing?.id === post.id) newPost(); setNotice("BEITRAG GELÖSCHT"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Der Beitrag konnte nicht gelöscht werden."); }
  }

  return <div className="releaseEditorBody">
    {previewing ? <MagazinePreview post={previewing} onClose={() => setPreviewing(undefined)} /> : null}
    <div className="adminEditorHeading"><div><p className="adminSectionLabel">PRIVATE REDAKTION</p><h1 className="adminTitle">MAGAZIN<br />STUDIO</h1></div><button type="button" className="adminTextButton" onClick={newPost} disabled={busy}>+ NEUER BEITRAG</button></div>
    <p className="adminIntro">Schreib den Artikel wie einen Post: Titel, Teaser, Cover, Text. Publishing und technische Felder sind nur noch Nebenbereiche.</p>
    <form key={`${editing?.id ?? "new"}-${formKey}`} className="magazineStudio" onSubmit={(event) => void submit(event)}>
      <div className="magazineStudioBar">
        <label><span>Status</span><select name="status" defaultValue={editing?.status ?? "draft"} disabled={busy}><option value="draft">Entwurf</option><option value="preview">Admin Preview</option><option value="published">Public</option><option value="archived">Archiv</option></select></label>
        <label><span>Rubrik</span><select name="category" value={category} onChange={(event) => setCategory(event.currentTarget.value as MagazinePost["category"])} disabled={busy}><option value="IN_SCOPE">IN SCOPE</option><option value="US_RADAR">US Radar</option><option value="DE_FOCUS">Deutschrap Fokus</option><option value="MUST_HEAR">Must Hear</option><option value="FIRST_LISTEN">First Listen</option><option value="COVER_CHECK">Cover Check</option><option value="FEATURE_WATCH">Feature Watch</option></select></label>
        <label><span>Region</span><select name="region" value={region} onChange={(event) => setRegion(event.currentTarget.value as MagazinePost["region"])} disabled={busy}><option value="GLOBAL">Global</option><option value="DE">DE</option><option value="US">US</option></select></label>
        <button type="button" className="adminSecondaryButton" onClick={() => setPreviewing(draftPreview)} disabled={busy}>VOLLBILD-PREVIEW</button>
        <button type="submit" className="adminPrimaryButton" disabled={busy}>{busy ? "SPEICHERT ..." : editing ? "SPEICHERN" : "ANLEGEN"}</button>
      </div>
      <section className="magazineStudioGrid">
        <div className="magazineWriterPane">
          <label className="magazineTitleField">
            <span>Titel</span>
            <input name="title" required maxLength={180} value={title} onChange={(event) => setTitle(event.currentTarget.value)} disabled={busy} placeholder="Was ist die Story?" />
          </label>
          <label className="magazineTeaserField">
            <span>Teaser</span>
            <textarea name="excerpt" required rows={3} maxLength={500} value={excerpt} onChange={(event) => setExcerpt(event.currentTarget.value)} disabled={busy} placeholder="2-3 Sätze für die Kachel und den Einstieg." />
          </label>
          <label className={`magazineHeroDrop ${(coverPreview || editing?.coverUrl) ? "hasPreview" : ""}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={busy} onChange={(event) => selectCover(event.target.files?.[0])} />
            {coverPreview || editing?.coverUrl ? <img src={coverPreview || editing?.coverUrl} alt="" /> : <div><strong>Cover reinziehen oder antippen</strong><span>Optional, aber für Magazin-Kacheln wichtig</span></div>}
          </label>
          <div className="magazineComposer">
            <div className="magazineComposerToolbar" aria-label="Formatierung">
              <button type="button" onClick={() => insertAtCursor("\n\n## Zwischenheadline\n\n")} disabled={busy}>Headline</button>
              <button type="button" onClick={() => insertAtCursor("\n\n- Punkt\n")} disabled={busy}>Liste</button>
              <button type="button" onClick={() => insertAtCursor("\n\n> Zitat oder Quelle\n\n")} disabled={busy}>Quote</button>
              <button type="button" onClick={() => bodyRef.current?.focus()} disabled={busy}>Einfügen</button>
            </div>
            <textarea
              ref={bodyRef}
              name="body"
              required
              rows={18}
              maxLength={30000}
              value={body}
              disabled={busy}
              onChange={(event) => setBody(event.currentTarget.value)}
              onPaste={handlePaste}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              placeholder={"Artikel hier schreiben oder fertigen Text einfügen.\n\nBilder kannst du direkt in dieses Feld kopieren oder hier ablegen."}
            />
            {bodyImages.length > 0 ? (
              <div className="magazineInlineImages" aria-label="Neue eingefügte Bilder">
                {bodyImages.map((image) => (
                  <div className="magazineInlineImage" key={image.id}>
                    <img src={image.previewUrl} alt="" />
                    <button type="button" onClick={() => removeBodyImage(image)} disabled={busy}>ENTFERNEN</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <aside className="magazineSidePane">
          <div className="magazineLivePreview">
            <div className="magazineLivePreviewHeader"><span>Live Preview</span><button type="button" onClick={() => setPreviewing(draftPreview)} disabled={busy}>Öffnen</button></div>
            <MiniMagazinePreview post={draftPreview} />
          </div>
          <details className="magazineDetailBox" open>
            <summary>Quick Facts</summary>
            <textarea name="facts" rows={6} maxLength={1000} value={factsInput} onChange={(event) => setFactsInput(event.currentTarget.value)} disabled={busy} placeholder={"Ein Fact pro Zeile\nz. B. Produzent, Feature, Kontext"} />
          </details>
          <details className="magazineDetailBox">
            <summary>Veröffentlichung</summary>
            <label><span>Bereich</span><select name="scope" defaultValue={editing?.scope ?? "ALL"} disabled={busy}><option value="ALL">ALL</option><option value="DE">DE</option><option value="US">US</option></select></label>
            <label><span>Release-Woche</span><input name="releaseWeek" type="date" defaultValue={editing?.releaseWeek} disabled={busy} /></label>
            <label><span>Public ab</span><input name="publishAt" type="datetime-local" defaultValue={editing?.publishAt?.slice(0, 16)} disabled={busy} /></label>
            <label className="adminCheckField"><input name="featured" type="checkbox" defaultChecked={editing?.featured ?? false} disabled={busy} /><span>Startseite hervorheben</span></label>
          </details>
          <details className="magazineDetailBox">
            <summary>Feineinstellungen</summary>
            <label><span>URL-Slug</span><input name="slug" maxLength={110} defaultValue={editing?.slug} disabled={busy} placeholder="automatisch aus Titel" /></label>
            <label><span>Cover-URL</span><input name="coverUrl" type="url" defaultValue={editing?.coverUrl} disabled={busy} placeholder="https://..." /></label>
            <label><span>Quelle</span><input name="sourceUrl" type="url" defaultValue={editing?.sourceUrl} disabled={busy} placeholder="https://..." /></label>
            <label><span>Autor</span><input name="authorName" maxLength={120} defaultValue={editing?.authorName} disabled={busy} placeholder="Release Friday Redaktion" /></label>
          </details>
        </aside>
      </section>
      {error ? <p className="adminError" role="alert">{error}</p> : null}{notice ? <div className="adminSuccess" role="status"><strong>{notice}</strong><span>Nur im Admin gespeichert – auf der Startseite noch nicht sichtbar.</span></div> : null}
      <div className="adminActions">{editing ? <button type="button" className="adminSecondaryButton" onClick={() => void remove(editing)} disabled={busy}>LÖSCHEN</button> : null}<button type="submit" className="adminPrimaryButton" disabled={busy}>{busy ? "SPEICHERT ..." : editing ? "ÄNDERUNGEN SPEICHERN" : "BEITRAG SPEICHERN"}</button></div>
    </form>
    <section className="adminFormSection"><div className="adminFormSectionTitle"><span>03</span><strong>REDAKTIONS-ARCHIV ({posts.length})</strong></div><div className="releaseForm">{posts.length === 0 ? <p className="adminIntro">Noch keine Magazinbeiträge angelegt.</p> : posts.map((post) => <div className="adminSuccess magazineArchiveItem" key={post.id}><strong>[{post.region} · {post.category.replace(/_/g, " ")}] {post.title}</strong><span>{post.status.toUpperCase()} · {post.releaseWeek ?? "ohne Woche"} · /magazin/{post.slug}</span><div className="magazineArchiveActions"><button type="button" className="adminTextButton" onClick={() => setPreviewing(post)} disabled={busy}>PREVIEW →</button><button type="button" className="adminTextButton" onClick={() => edit(post)} disabled={busy}>BEARBEITEN →</button></div></div>)}</div></section>
  </div>;
}

function MiniMagazinePreview({ post }: { post: MagazinePost }) {
  return (
    <article className="magazineMiniPreview">
      {post.coverUrl ? <img src={post.coverUrl} alt="" /> : <div className="magazineMiniPreviewEmpty">Cover</div>}
      <div>
        <span>{post.category.replace(/_/g, " ")} · {post.region}</span>
        <h2>{post.title}</h2>
        <p>{post.excerpt}</p>
        {post.facts.length > 0 ? <ul>{post.facts.slice(0, 3).map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
      </div>
    </article>
  );
}

function MagazinePreview({ post, onClose }: { post: MagazinePost; onClose: () => void }) {
  const blocks = post.body.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
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
            {blocks.length > 0 ? blocks.map((block) => <MagazinePreviewBlock block={block} key={block} />) : <p>{post.body}</p>}
          </div>
          {post.sourceUrl ? <a className="magazinePreviewSource" href={post.sourceUrl} target="_blank" rel="noreferrer">QUELLE ÖFFNEN →</a> : null}
        </div>
      </article>
    </div>
  );
}

function MagazinePreviewBlock({ block }: { block: string }) {
  const image = block.match(/^!\[(.*?)\]\((.*?)\)$/);
  if (image) return <img className="magazinePreviewInlineImage" src={image[2]} alt={image[1] || ""} />;
  if (block.startsWith("## ")) return <h2>{block.replace(/^##\s+/, "")}</h2>;
  if (block.startsWith("> ")) return <blockquote>{block.replace(/^>\s+/, "")}</blockquote>;
  if (block.split("\n").every((line) => line.startsWith("- "))) {
    return <ul>{block.split("\n").map((line) => <li key={line}>{line.replace(/^-\s+/, "")}</li>)}</ul>;
  }
  return <p>{block}</p>;
}
