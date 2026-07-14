"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fetchPublishedManualReleases } from "@/lib/releases/manual-releases";
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

export function DropArchiveSwitch() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<"current" | "archive">("current");
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ensureHost = () => {
      const screen = document.querySelector<HTMLElement>(".dropScreen");
      const strip = screen?.querySelector<HTMLElement>(".tapeStrip");
      if (!screen || !strip) {
        setHost(null);
        return;
      }

      let target = screen.querySelector<HTMLElement>(".dropArchivePortalHost");
      if (!target) {
        target = document.createElement("div");
        target.className = "dropArchivePortalHost";
        strip.insertAdjacentElement("afterend", target);
      }
      setHost(target);
    };

    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const screen = document.querySelector<HTMLElement>(".dropScreen");
    screen?.classList.toggle("showInlineArchive", mode === "archive");
    return () => screen?.classList.remove("showInlineArchive");
  }, [mode, host]);

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

  const groups = useMemo(() => {
    const dates = [...new Set(releases.map((release) => release.releaseDate))].sort().reverse();
    return dates.slice(1).map((date) => ({
      date,
      releases: releases.filter((release) => release.releaseDate === date),
    }));
  }, [releases]);

  if (!host) return null;

  return createPortal(
    <>
      <div className="issueArchiveSwitch" role="tablist" aria-label="Drop-Ausgabe auswählen">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "current"}
          className={mode === "current" ? "active" : undefined}
          onClick={() => setMode("current")}
        >
          <span aria-hidden="true">◉</span> CURRENT ISSUE
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "archive"}
          className={mode === "archive" ? "active" : undefined}
          onClick={() => void openArchive()}
        >
          ARCHIVE
        </button>
      </div>

      {mode === "archive" ? (
        <div className="inlineArchive" role="tabpanel">
          <h1 className="posterTitle">THE<br />ARCHIVE</h1>
          {loading ? <p className="inlineArchiveState">ARCHIVE WIRD GELADEN …</p> : null}
          {!loading && groups.length === 0 ? <p className="inlineArchiveState">NO PAST ISSUES YET.</p> : null}
          {groups.map((group) => (
            <section className="inlineArchiveIssue" key={group.date}>
              <header>
                <span>ISSUE</span>
                <strong>{formatDate(group.date)}</strong>
                <small>{group.releases.length} RELEASES</small>
              </header>
              <div className="inlineArchiveGrid">
                {group.releases.map((release) => (
                  <article className="inlineArchiveCard" key={release.id}>
                    <div className="inlineArchiveCover">
                      {release.coverUrl ? (
                        <img src={release.coverUrl} alt={`Cover von ${release.title}`} loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <div>RELEASE<br />FRIDAY</div>
                      )}
                    </div>
                    <div className="inlineArchiveCopy">
                      <strong>{release.title}</strong>
                      <span>{release.artist} · {kindLabels[release.kind]}</span>
                    </div>
                    <div className="inlineArchiveLinks">
                      {release.spotifyUrl ? <a href={release.spotifyUrl} target="_blank" rel="noreferrer">SPOTIFY</a> : null}
                      {release.appleMusicUrl ? <a href={release.appleMusicUrl} target="_blank" rel="noreferrer">APPLE</a> : null}
                      {release.youtubeUrl ? <a href={release.youtubeUrl} target="_blank" rel="noreferrer">YOUTUBE</a> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </>,
    host,
  );
}
