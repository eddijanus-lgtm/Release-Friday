"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Scope = "ALL" | "DE" | "US";
type ReleaseOption = { id: string; artist: string; title: string; country: "DE" | "US"; release_date: string };

type Selection = Partial<Record<Scope, string>>;

const scopes: Scope[] = ["ALL", "DE", "US"];

export function FeaturedReleaseSelector() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [releases, setReleases] = useState<ReleaseOption[]>([]);
  const [issueDate, setIssueDate] = useState<string>();
  const [selection, setSelection] = useState<Selection>({});
  const [saving, setSaving] = useState<Scope | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ensureHost = () => {
      const body = document.querySelector<HTMLElement>(".releaseEditorBody");
      if (!body) return setHost(null);
      let target = body.querySelector<HTMLElement>(".featuredReleasePortal");
      if (!target) {
        target = document.createElement("div");
        target.className = "featuredReleasePortal";
        const intro = body.querySelector(".adminIntro");
        intro?.insertAdjacentElement("afterend", target);
      }
      setHost(target);
    };
    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !session || !host) return;
    let active = true;
    void (async () => {
      const { data: admin } = await client.from("release_admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!admin || !active) return;
      const { data: rows } = await client
        .from("releases")
        .select("id,artist,title,country,release_date")
        .eq("status", "published")
        .order("release_date", { ascending: false })
        .order("created_at", { ascending: true });
      const options = (rows ?? []) as ReleaseOption[];
      setReleases(options);
      setIssueDate((current) => current && options.some((release) => release.release_date === current) ? current : options[0]?.release_date);
    })();
    return () => { active = false; };
  }, [host, session]);

  const issueDates = useMemo(() => [...new Set(releases.map((release) => release.release_date))], [releases]);
  const issueReleases = useMemo(() => releases.filter((release) => release.release_date === issueDate), [releases, issueDate]);
  const optionsByScope = useMemo(() => ({
    ALL: issueReleases,
    DE: issueReleases.filter((release) => release.country === "DE"),
    US: issueReleases.filter((release) => release.country === "US"),
  }), [issueReleases]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !session || !issueDate) return;
    let active = true;
    void client.from("featured_releases").select("scope,release_id").eq("issue_date", issueDate).then(({ data }) => {
      if (active) setSelection(Object.fromEntries((data ?? []).map((row) => [row.scope, row.release_id])) as Selection);
    });
    return () => { active = false; };
  }, [issueDate, session]);

  async function save(scope: Scope) {
    const client = getSupabaseBrowserClient();
    const releaseId = selection[scope];
    if (!client || !session || !issueDate || !releaseId) return;
    setSaving(scope);
    setMessage("");
    const { error } = await client.from("featured_releases").upsert({
      issue_date: issueDate,
      scope,
      release_id: releaseId,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "issue_date,scope" });
    setSaving(null);
    setMessage(error ? "AUSWAHL KONNTE NICHT GESPEICHERT WERDEN" : `${scope} STARTSEITE GESPEICHERT`);
  }

  if (!host || !session || !issueDate) return null;

  return createPortal(
    <section style={{ border: "1px solid #33402f", background: "#0d120c", padding: 16, margin: "18px 0" }}>
      <p className="adminSectionLabel">STARTSEITEN-AUSWAHL</p>
      <h2 style={{ margin: "8px 0 6px", fontSize: 24, lineHeight: 1 }}>FEATURED<br />RELEASES</h2>
      <p className="adminIntro" style={{ marginBottom: 10 }}>Lege getrennt fest, welches Cover bei ALL, DE und US groß auf der Startseite erscheint.</p>
      <label className="adminField" style={{ marginBottom: 16 }}><span>AUSGABE</span><select value={issueDate} onChange={(event) => setIssueDate(event.target.value)}>{issueDates.map((date) => <option key={date} value={date}>{date}</option>)}</select></label>
      <div style={{ display: "grid", gap: 12 }}>
        {scopes.map((scope) => (
          <div key={scope} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 8, alignItems: "center" }}>
            <strong style={{ color: "var(--lime)", fontSize: 11 }}>{scope}</strong>
            <select
              value={selection[scope] ?? ""}
              onChange={(event) => setSelection((current) => ({ ...current, [scope]: event.target.value }))}
              style={{ minWidth: 0, height: 44, background: "#080c08", color: "#f2f5ee", border: "1px solid #33402f", padding: "0 8px", font: "inherit", fontSize: 10 }}
            >
              <option value="">RELEASE AUSWÄHLEN</option>
              {optionsByScope[scope].map((release) => <option key={release.id} value={release.id}>{release.artist} — {release.title}</option>)}
            </select>
            <button type="button" className="adminSecondaryButton" disabled={!selection[scope] || saving !== null} onClick={() => void save(scope)} style={{ minHeight: 44, padding: "0 12px" }}>
              {saving === scope ? "…" : "SETZEN"}
            </button>
          </div>
        ))}
      </div>
      {message ? <p className="adminSuccess" style={{ marginTop: 12 }}>{message}</p> : null}
    </section>,
    host,
  );
}
