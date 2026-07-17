"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { ReleaseForm } from "@/components/admin/release-form";
import { MagazineEditor, type MagazinePost, type MagazinePostValues } from "@/components/admin/magazine-editor";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { EditableRelease, ReleaseCreateResult, ReleaseFormValues, ReleaseWriteStatus } from "@/types/admin";

type AccessState = "loading" | "signed-out" | "checking" | "admin" | "denied" | "unconfigured";

type ReleaseRow = {
  id: string;
  artist: string;
  title: string;
  release_date: string;
  country: EditableRelease["country"];
  kind: EditableRelease["kind"];
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
  source: string;
  status: ReleaseWriteStatus;
};

type MagazineRow = {
  id: string; title: string; slug: string; scope: MagazinePost["scope"]; excerpt: string; body: string;
  cover_url: string | null; source_url: string | null; author_name: string | null;
  status: MagazinePost["status"]; published_at: string | null;
};

function mapMagazinePost(row: MagazineRow): MagazinePost {
  return { id: row.id, title: row.title, slug: row.slug, scope: row.scope, excerpt: row.excerpt, body: row.body, coverUrl: row.cover_url ?? undefined, sourceUrl: row.source_url ?? undefined, authorName: row.author_name ?? undefined, status: row.status, publishedAt: row.published_at ?? undefined };
}

function safeFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("en-US");
  if (extension && /^[a-z0-9]{2,5}$/.test(extension)) return extension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/avif") return "avif";
  return "jpg";
}

function nullable(value?: string) {
  return value || null;
}

function mapRelease(row: ReleaseRow): EditableRelease {
  return {
    id: row.id,
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
    source: row.source,
    status: row.status,
  };
}

export function AdminClient({ targetDate }: { targetDate: string }) {
  const [session, setSession] = useState<Session | null>();
  const [access, setAccess] = useState<AccessState>("loading");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string>();
  const [releases, setReleases] = useState<EditableRelease[]>([]);
  const [magazinePosts, setMagazinePosts] = useState<MagazinePost[]>([]);
  const [editor, setEditor] = useState<"releases" | "magazine">("releases");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setAccess("unconfigured");
      setSession(null);
      return;
    }

    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || session === undefined) return;
    if (!session) {
      setAccess("signed-out");
      setReleases([]);
      setMagazinePosts([]);
      return;
    }

    let active = true;
    setAccess("checking");
    void client
      .from("release_admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setAccess("denied");
          return;
        }
        setAccess("admin");
        const { data: releaseRows } = await client
          .from("releases")
          .select("id,artist,title,release_date,country,kind,track_count,description,genres,spotify_url,spotify_pre_save_url,apple_music_url,youtube_url,source_url,cover_url,storage_path,source,status")
          .order("release_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (active) setReleases(((releaseRows ?? []) as ReleaseRow[]).map(mapRelease));
        const { data: magazineRows } = await client
          .from("magazine_posts")
          .select("id,title,slug,scope,excerpt,body,cover_url,source_url,author_name,status,published_at")
          .order("created_at", { ascending: false });
        if (active) setMagazinePosts(((magazineRows ?? []) as MagazineRow[]).map(mapMagazinePost));
      });
    return () => { active = false; };
  }, [session]);

  async function login(email: string, password: string) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setLoginError(undefined);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) setLoginError("E-Mail oder Passwort stimmen nicht.");
    setBusy(false);
  }

  async function logout() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    await client.auth.signOut();
    setBusy(false);
  }

  async function saveRelease(values: ReleaseFormValues, cover: File | null, status: ReleaseWriteStatus, existing?: EditableRelease): Promise<ReleaseCreateResult> {
    const client = getSupabaseBrowserClient();
    if (!client || !session) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
    setBusy(true);
    let newStoragePath: string | null = null;

    try {
      let coverUrl = existing?.coverUrl ?? null;
      let storagePath = existing?.storagePath ?? null;
      if (cover) {
        newStoragePath = `${session.user.id}/${crypto.randomUUID()}.${safeFileExtension(cover)}`;
        const { error: uploadError } = await client.storage.from("release-covers").upload(newStoragePath, cover, {
          cacheControl: "31536000",
          contentType: cover.type,
          upsert: false,
        });
        if (uploadError) throw new Error("Das Cover konnte nicht hochgeladen werden.");
        coverUrl = client.storage.from("release-covers").getPublicUrl(newStoragePath).data.publicUrl;
        storagePath = newStoragePath;
      }

      const payload = {
        artist: values.artist,
        title: values.title,
        release_date: values.releaseDate,
        country: values.country,
        kind: values.kind,
        track_count: values.trackCount ?? null,
        cover_url: coverUrl,
        storage_path: storagePath,
        description: nullable(values.description),
        genres: values.genres,
        spotify_url: nullable(values.spotifyUrl),
        spotify_pre_save_url: nullable(values.spotifyPreSaveUrl),
        apple_music_url: nullable(values.appleMusicUrl),
        youtube_url: nullable(values.youtubeUrl),
        source_url: nullable(values.sourceUrl),
        source: existing?.source ?? "Manuell veröffentlicht",
        status,
      };

      const query = existing
        ? client.from("releases").update(payload).eq("id", existing.id)
        : client.from("releases").insert({ ...payload, created_by: session.user.id });
      const { data, error } = await query.select("id,artist,title,release_date,country,kind,track_count,description,genres,spotify_url,spotify_pre_save_url,apple_music_url,youtube_url,source_url,cover_url,storage_path,source,status").single();

      if (error || !data) {
        if (error?.code === "23505") throw new Error("Dieser Spotify-Release ist bereits angelegt.");
        throw new Error("Der Release konnte nicht gespeichert werden. Bitte prüfe die Angaben und versuche es erneut.");
      }

      const mapped = mapRelease(data as ReleaseRow);
      setReleases((current) => existing
        ? current.map((release) => release.id === existing.id ? mapped : release)
        : [mapped, ...current]);

      if (newStoragePath && existing?.storagePath && existing.storagePath !== newStoragePath) {
        await client.storage.from("release-covers").remove([existing.storagePath]);
      }

      return { id: mapped.id, status, releaseDate: values.releaseDate, action: existing ? "updated" : "created" };
    } catch (error) {
      if (newStoragePath) await client.storage.from("release-covers").remove([newStoragePath]);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function deleteRelease(release: EditableRelease) {
    const client = getSupabaseBrowserClient();
    if (!client || !session) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
    setBusy(true);
    try {
      const { error } = await client.from("releases").delete().eq("id", release.id);
      if (error) throw new Error("Der Release konnte nicht gelöscht werden.");
      if (release.storagePath) await client.storage.from("release-covers").remove([release.storagePath]);
      setReleases((current) => current.filter((item) => item.id !== release.id));
    } finally {
      setBusy(false);
    }
  }

  async function saveMagazinePost(values: MagazinePostValues, existing?: MagazinePost) {
    const client = getSupabaseBrowserClient();
    if (!client || !session) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
    setBusy(true);
    try {
      const payload = { title: values.title, slug: values.slug, scope: values.scope, excerpt: values.excerpt, body: values.body, cover_url: nullable(values.coverUrl), source_url: nullable(values.sourceUrl), author_name: nullable(values.authorName), status: values.status };
      const query = existing ? client.from("magazine_posts").update(payload).eq("id", existing.id) : client.from("magazine_posts").insert({ ...payload, created_by: session.user.id });
      const { data, error } = await query.select("id,title,slug,scope,excerpt,body,cover_url,source_url,author_name,status,published_at").single();
      if (error || !data) {
        if (error?.code === "23505") throw new Error("Dieser URL-Slug existiert bereits. Bitte passe ihn an.");
        throw new Error("Der Magazinbeitrag konnte nicht gespeichert werden.");
      }
      const mapped = mapMagazinePost(data as MagazineRow);
      setMagazinePosts((current) => existing ? current.map((post) => post.id === mapped.id ? mapped : post) : [mapped, ...current]);
    } finally { setBusy(false); }
  }

  async function deleteMagazinePost(post: MagazinePost) {
    const client = getSupabaseBrowserClient();
    if (!client || !session) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
    setBusy(true);
    try {
      const { error } = await client.from("magazine_posts").delete().eq("id", post.id);
      if (error) throw new Error("Der Magazinbeitrag konnte nicht gelöscht werden.");
      setMagazinePosts((current) => current.filter((item) => item.id !== post.id));
    } finally { setBusy(false); }
  }

  const configured = isSupabaseConfigured();
  const showLogin = access === "signed-out" || access === "unconfigured";

  return (
    <main className="adminPage">
      <section className="adminPhone">
        <AdminHeader email={access === "admin" ? session?.user.email : undefined} />
        {showLogin ? <AdminLoginForm configured={configured} busy={busy} error={loginError} onSubmit={login} /> : null}
        {access === "loading" || access === "checking" ? <div className="adminLoading" role="status"><span /><strong>ADMIN-ZUGANG WIRD GEPRÜFT</strong></div> : null}
        {access === "denied" ? (
          <div className="adminDenied" role="alert">
            <p className="adminSectionLabel">ACCESS DENIED</p>
            <h1 className="adminTitle">NICHT<br />FREIGESCHALTET</h1>
            <p className="adminIntro">Dieses Konto besitzt keine Redaktionsrechte.</p>
            <button className="adminSecondaryButton" type="button" onClick={() => void logout()} disabled={busy}>ABMELDEN</button>
          </div>
        ) : null}
        {access === "admin" ? <>
          <nav className="adminEditorTabs" aria-label="Admin-Bereich">
            <button type="button" className={editor === "releases" ? "active" : ""} onClick={() => setEditor("releases")}>RELEASES</button>
            <button type="button" className={editor === "magazine" ? "active" : ""} onClick={() => setEditor("magazine")}>MAGAZIN</button>
          </nav>
          {editor === "releases" ? <ReleaseForm targetDate={targetDate} busy={busy} releases={releases} onSave={saveRelease} onDelete={deleteRelease} onLogout={logout} /> : <MagazineEditor busy={busy} posts={magazinePosts} onSave={saveMagazinePost} onDelete={deleteMagazinePost} />}
        </> : null}
      </section>
    </main>
  );
}
