"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fetchPublishedManualReleases } from "@/lib/releases/manual-releases";
import { ReleaseRowCover } from "@/components/release-row-cover";
import type { MusicRelease } from "@/types/release";

const kindLabels: Record<MusicRelease["kind"], string> = {
  album: "ALBUM",
  ep: "EP",
  mixtape: "MIXTAPE",
  single: "SINGLE",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`)).toUpperCase();
}

function openRelease(release: MusicRelease) {
  window.dispatchEvent(new CustomEvent<MusicRelease>("release-friday:open-release", { detail: release }));
}

function readSaved() {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem("release-friday:saved") ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

export function DropArchiveSwitch() {
  const [switchHost, setSwitchHost] = useState<HTMLElement | null>(null);
  const [archiveHost, setArchiveHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<"current" | "archive">("current");
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ensureHosts = () => {
      const screen = document.querySelector<HTMLElement>(".dropScreen");
      const headerMeta = screen?.querySelector<HTMLElement>(".issueMeta");
      const strip = screen?.querySelector<HTMLElement>(".tapeStrip");
      if (!screen || !headerMeta || !strip) {
        setSwitchHost(null);
        setArchiveHost(null);
        return;
      }

      let nextSwitchHost = screen.querySelector<HTMLElement>(".dropArchiveSwitchHost");
      if (!nextSwitchHost) {
        nextSwitchHost = document.createElement("div");
        nextSwitchHost.className = "dropArchiveSwitchHost";
        headerMeta.prepend(nextSwitchHost);
      }

      let nextArchiveHost = screen.querySelector<HTMLElement>(".dropArchiveContentHost");
      if (!nextArchiveHost) {
        nextArchiveHost = document.createElement("div");
        nextArchiveHost.className = "dropArchiveContentHost";
        strip.insertAdjacentElement("afterend", nextArchiveHost);
      }

      setSwitchHost(nextSwitchHost);
      setArchiveHost(nextArchiveHost);
    };

    ensureHosts();
    const observer = new MutationObserver(ensureHosts);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSavedIds(readSaved());
  }, []);

  useEffect(() => {
    const screen = document.querySelector<HTMLElement>(".dropScreen");
    screen?.classList.toggle("showInlineArchive", mode === "archive");
    return () => screen?.classList.remove("showInlineArchive");
  }, [mode, archiveHost]);

  const openArchive = async () => {
    setMode("archive");
    if (releases.length || loading) return;
    setLoading(true);
    try {
      setReleases(await fetchPublishedManualReleases(undefined));
    } finally {
      setLoading(false);
    }
  };

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      window.localStorage.setItem("release-friday:saved", JSON.stringify([...next]));
      return next;
    });
  };

  const groups = useMemo(() => {
    const dates = [...new Set(releases.map((release) => release.releaseDate))].sort().reverse();
    return dates.slice(1).map((date) => ({
      date,
      releases: releases.filter((release) => release.releaseDate === date),
    }));
  }, [releases]);

  return (
    <>
      {switchHost ? createPortal(
        <div className="issueArchiveSwitch" role="tablist" aria-label="Drop-Ausgabe auswählen">
          <button type="button" role="tab" aria-selected={mode === "current"} className={mode === "current" ? "active" : undefined} onClick={() => setMode("current")}>ISSUE 29</button>
          <span aria-hidden="true">/</span>
          <button type="button" role="tab" aria-selected={mode === "archive"} className={mode === "archive" ? "active" : undefined} onClick={() => void openArchive()}>ARCHIV</button>
        </div>,
        switchHost,
      ) : null}

      {archiveHost && mode === "archive" ? createPortal(
        <div className="inlineArchive" role="tabpanel">
          <h1 className="posterTitle">THE<br />ARCHIVE</h1>
          {loading ? <p className="inlineArchiveState">ARCHIVE WIRD GELADEN …</p> : null}
          {!loading && groups.length === 0 ? <p className="inlineArchiveState">NO PAST ISSUES YET.</p> : null}
          {groups.map((group) => (
            <section className="inlineArchiveIssue" key={group.date}>
              <header><span>ISSUE</span><strong>{formatDate(group.date)}</strong><small>{group.releases.length} RELEASES</small></header>
              <div className="homeRows inlineArchiveRows">
                {group.releases.map((release, index) => (
                  <article className="tapeRow" key={release.id}>
                    <button type="button" className="tapeRowMain" onClick={() => openRelease(release)} aria-label={`${release.artist} – ${release.title} öffnen`}>
                      <span className="rowNumber">{String(index + 1).padStart(2, "0")}</span>
                      <ReleaseRowCover release={release} />
                      <div className="rowCopy"><strong>{release.title}</strong><span>{release.artist} · {kindLabels[release.kind]}</span></div>
                      <span className="rowArrow">→</span>
                    </button>
                    <button type="button" className={`rowSave ${savedIds.has(release.id) ? "saved" : ""}`} onClick={() => toggleSaved(release.id)} aria-pressed={savedIds.has(release.id)} aria-label={savedIds.has(release.id) ? "Aus Stash entfernen" : "In Stash speichern"}>+</button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>,
        archiveHost,
      ) : null}
    </>
  );
}
