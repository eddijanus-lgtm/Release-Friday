"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { ReleaseForm } from "@/components/admin/release-form";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ReleaseCreateResult, ReleaseFormValues, ReleaseWriteStatus } from "@/types/admin";

type AccessState = "loading" | "signed-out" | "checking" | "admin" | "denied" | "unconfigured";

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

export function AdminClient({ targetDate }: { targetDate: string }) {
  const [session, setSession] = useState<Session | null>();
  const [access, setAccess] = useState<AccessState>("loading");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string>();

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
      return;
    }

    let active = true;
    setAccess("checking");
    void client
      .from("release_admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setAccess(!error && data ? "admin" : "denied");
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

  async function createRelease(values: ReleaseFormValues, cover: File | null, status: ReleaseWriteStatus): Promise<ReleaseCreateResult> {
    const client = getSupabaseBrowserClient();
    if (!client || !session) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
    setBusy(true);
    let storagePath: string | null = null;

    try {
      let coverUrl: string | null = null;
      if (cover) {
        storagePath = `${session.user.id}/${crypto.randomUUID()}.${safeFileExtension(cover)}`;
        const { error: uploadError } = await client.storage.from("release-covers").upload(storagePath, cover, {
          cacheControl: "31536000",
          contentType: cover.type,
          upsert: false,
        });
        if (uploadError) throw new Error("Das Cover konnte nicht hochgeladen werden.");
        coverUrl = client.storage.from("release-covers").getPublicUrl(storagePath).data.publicUrl;
      }

      const { data, error } = await client
        .from("releases")
        .insert({
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
          source: "Manuell veröffentlicht",
          status,
          created_by: session.user.id,
        })
        .select("id")
        .single();

      if (error || !data) {
        if (error?.code === "23505") throw new Error("Dieser Spotify-Release ist bereits angelegt.");
        throw new Error("Der Release konnte nicht gespeichert werden. Bitte prüfe die Angaben und versuche es erneut.");
      }

      return { id: String(data.id), status, releaseDate: values.releaseDate };
    } catch (error) {
      if (storagePath) await client.storage.from("release-covers").remove([storagePath]);
      throw error;
    } finally {
      setBusy(false);
    }
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
        {access === "admin" ? <ReleaseForm targetDate={targetDate} busy={busy} onCreate={createRelease} onLogout={logout} /> : null}
      </section>
    </main>
  );
}
