"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const STORAGE_KEY = "release-friday:saved";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readLocalStash() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeLocalStash(ids: Set<string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function toDatabaseId(id: string) {
  const candidate = id.startsWith("manual-") ? id.slice(7) : id;
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

function toInterfaceId(id: string) {
  return `manual-${id}`;
}

function setsEqual(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

export function AccountStashSync() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncState, setSyncState] = useState<"local" | "syncing" | "synced" | "error">("local");
  const lastLocal = useRef<Set<string>>(new Set());
  const initializedUser = useRef<string | null>(null);

  useEffect(() => {
    const ensureHost = () => {
      const screen = document.querySelector<HTMLElement>(".meScreen .screenInner");
      const identity = screen?.querySelector<HTMLElement>(".radarIdentity");
      if (!screen || !identity) {
        setHost(null);
        return;
      }

      let target = screen.querySelector<HTMLElement>(".accountPortalHost");
      if (!target) {
        target = document.createElement("div");
        target.className = "accountPortalHost";
        identity.insertAdjacentElement("afterend", target);
      }
      setHost(target);
    };

    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getBrowserSupabase();

    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || initializedUser.current === session.user.id) return;
    initializedUser.current = session.user.id;

    const initialize = async () => {
      setSyncState("syncing");
      const supabase = getBrowserSupabase();
      const local = readLocalStash();
      const { data, error } = await supabase.from("user_stash").select("release_id").eq("user_id", session.user.id);

      if (error) {
        setSyncState("error");
        return;
      }

      const cloud = new Set((data ?? []).map((row) => toInterfaceId(String(row.release_id))));
      const merged = new Set([...cloud, ...local]);
      const rows = [...merged]
        .map(toDatabaseId)
        .filter((releaseId): releaseId is string => Boolean(releaseId))
        .map((releaseId) => ({ user_id: session.user.id, release_id: releaseId }));

      if (rows.length) {
        const { error: upsertError } = await supabase.from("user_stash").upsert(rows, { onConflict: "user_id,release_id" });
        if (upsertError) {
          setSyncState("error");
          return;
        }
      }

      const changed = !setsEqual(local, merged);
      writeLocalStash(merged);
      lastLocal.current = merged;
      setSyncState("synced");

      if (changed) window.setTimeout(() => window.location.reload(), 150);
    };

    void initialize();
  }, [session]);

  useEffect(() => {
    lastLocal.current = readLocalStash();
    const timer = window.setInterval(() => {
      const current = readLocalStash();
      if (setsEqual(current, lastLocal.current)) return;

      const previous = lastLocal.current;
      lastLocal.current = current;
      if (!session) return;

      const added = [...current].filter((id) => !previous.has(id)).map(toDatabaseId).filter((id): id is string => Boolean(id));
      const removed = [...previous].filter((id) => !current.has(id)).map(toDatabaseId).filter((id): id is string => Boolean(id));
      const supabase = getBrowserSupabase();
      setSyncState("syncing");

      void (async () => {
        if (added.length) {
          const rows = added.map((releaseId) => ({ user_id: session.user.id, release_id: releaseId }));
          const { error } = await supabase.from("user_stash").upsert(rows, { onConflict: "user_id,release_id" });
          if (error) throw error;
        }
        if (removed.length) {
          const { error } = await supabase.from("user_stash").delete().eq("user_id", session.user.id).in("release_id", removed);
          if (error) throw error;
        }
        setSyncState("synced");
      })().catch(() => setSyncState("error"));
    }, 600);

    return () => window.clearInterval(timer);
  }, [session]);

  const requestMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setBusy(true);
    setMessage("");
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await getBrowserSupabase().auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setBusy(false);
    setMessage(error ? "LINK KONNTE NICHT GESENDET WERDEN." : "MAGIC LINK IST UNTERWEGS. E-MAIL ÖFFNEN UND ANTIPPEN.");
  };

  const signOut = async () => {
    setBusy(true);
    await getBrowserSupabase().auth.signOut();
    writeLocalStash(new Set());
    window.location.reload();
  };

  if (!host || !isSupabaseConfigured()) return null;

  return createPortal(
    <section className="accountCard" aria-label="Release-Friday-Konto">
      <p className="microHeading">ACCOUNT / CLOUD STASH</p>
      {session ? (
        <>
          <div className="accountIdentity">
            <span>SIGNED IN</span>
            <strong>{session.user.email}</strong>
            <small>{syncState === "syncing" ? "STASH WIRD SYNCHRONISIERT …" : syncState === "error" ? "SYNC-FEHLER · ERNEUT VERSUCHEN" : "STASH AUF ALLEN GERÄTEN GESPEICHERT"}</small>
          </div>
          <button type="button" className="accountAction secondary" onClick={() => void signOut()} disabled={busy}>ABMELDEN</button>
        </>
      ) : (
        <form onSubmit={requestMagicLink}>
          <label>
            <span>E-MAIL</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
          </label>
          <button type="submit" className="accountAction" disabled={busy}>{busy ? "WIRD GESENDET …" : "MAGIC LINK SENDEN"}</button>
          <small>KEIN PASSWORT. LINK IN DER E-MAIL ANTIPPEN UND DU BIST EINGELOGGT.</small>
          {message ? <p className="accountMessage" role="status">{message}</p> : null}
        </form>
      )}
    </section>,
    host,
  );
}
