"use client";

import { useEffect, useMemo, useState } from "react";
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

export function ArchiveClient() {
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPublishedManualReleases(undefined, controller.signal)
      .then(setReleases)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    const archivedReleases = releases.filter((release) => release.archivedAt);
    const dates = [...new Set(archivedReleases.map((release) => release.releaseDate))].sort().reverse();
    return dates.map((date) => ({
      date,
      releases: archivedReleases.filter((release) => release.releaseDate === date),
    }));
  }, [releases]);

  return (
    <main className="archivePage">
      <section className="archiveShell">
        <header className="archiveHeader">
          <a href="../">← DROP</a>
          <div className="wordmark">RELEASE<br />FRIDAY</div>
          <span>ARCHIVE</span>
        </header>
        <div className="tapeStrip">PAST ISSUES · EVERY FRIDAY SAVED ON TAPE</div>
        <div className="archiveInner">
          <h1 className="posterTitle">THE<br />ARCHIVE</h1>
          {loading ? <p className="archiveState">ARCHIVE WIRD GELADEN …</p> : null}
          {!loading && groups.length === 0 ? <p className="archiveState">NO PAST ISSUES YET.</p> : null}
          {groups.map((group) => (
            <section className="archiveIssue" key={group.date}>
              <div className="archiveIssueTitle">
                <span>ISSUE</span>
                <strong>{formatDate(group.date)}</strong>
                <small>{group.releases.length} RELEASES</small>
              </div>
              <div className="archiveGrid">
                {group.releases.map((release) => (
                  <article className="archiveCard" key={release.id}>
                    <div className="archiveCover">
                      {release.coverUrl ? <img src={release.coverUrl} alt={`Cover von ${release.title}`} loading="lazy" referrerPolicy="no-referrer" /> : <div>RELEASE<br />FRIDAY</div>}
                    </div>
                    <div className="archiveCopy">
                      <strong>{release.title}</strong>
                      <span>{release.artist} · {kindLabels[release.kind]}</span>
                    </div>
                    <div className="archiveLinks">
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
        <nav className="archiveBottomNav" aria-label="Hauptnavigation">
          <a href="../">DROP</a>
          <a href="../#find">FIND</a>
          <a className="active" href="./" aria-current="page">ARCHIVE</a>
          <a href="../#me">ME</a>
        </nav>
      </section>
    </main>
  );
}
