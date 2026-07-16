"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useReleaseDetailHistory } from "@/hooks/use-release-detail-history";
import { useSwipeBack } from "@/hooks/use-swipe-back";
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
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`)).toUpperCase();
}

function readSaved() {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem("release-friday:saved") ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

export function ReleaseDetailOverlay() {
  const [release, setRelease] = useState<MusicRelease | null>(null);
  const [saved, setSaved] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const clearRelease = useCallback(() => setRelease(null), []);
  const {
    beginDetailNavigation,
    closeDetailNavigation: closeRelease,
  } = useReleaseDetailHistory({
    isOpen: Boolean(release),
    owner: "overlay",
    onClose: clearRelease,
  });
  const swipeBackHandlers = useSwipeBack(closeRelease);

  useEffect(() => {
    const findHost = () => setHost(document.querySelector<HTMLElement>(".prototypePhone"));
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<MusicRelease>).detail;
      if (!next) return;
      beginDetailNavigation();
      setRelease(next);
      setSaved(readSaved().has(next.id));
    };
    window.addEventListener("release-friday:open-release", open);
    return () => window.removeEventListener("release-friday:open-release", open);
  }, [beginDetailNavigation]);

  if (!host || !release) return null;

  const live = Date.now() >= new Date(`${release.releaseDate}T00:00:00`).getTime();
  const trackText = release.trackCount ? ` · ${release.trackCount} ${release.trackCount === 1 ? "TRACK" : "TRACKS"}` : "";

  const toggleSaved = () => {
    const ids = readSaved();
    if (ids.has(release.id)) ids.delete(release.id); else ids.add(release.id);
    window.localStorage.setItem("release-friday:saved", JSON.stringify([...ids]));
    setSaved(ids.has(release.id));
  };

  return createPortal(
    <section className="releaseDetailOverlay tapeScreen detailScreen" data-swipe-back="true" {...swipeBackHandlers} role="dialog" aria-modal="true" aria-label={`${release.artist} – ${release.title}`}>
      <div className="detailToolbar">
        <button type="button" onClick={closeRelease}>← BACK TO TAPE</button>
        <button type="button" className={saved ? "saved" : undefined} onClick={toggleSaved}>{saved ? "✓ STASHED" : "+ STASH"}</button>
      </div>
      <div className="detailCover">
        <div className="tapeCover">
          {release.coverUrl ? <img src={release.coverUrl} alt={`Cover von ${release.title}`} /> : <div className="coverFallback"><span>{release.artist}</span><strong>{release.title}</strong><i>RF</i></div>}
        </div>
      </div>
      <div className="detailBody">
        <span className="confirmedLabel isLive">PAST RELEASE</span>
        <span className="artistTag">{release.artist}</span>
        <h1>{release.title}</h1>
        <p className="detailMeta">{release.country} · {kindLabels[release.kind]}{trackText} · {formatDate(release.releaseDate)}</p>
        <p className="detailDescription">{release.description ?? `${release.artist} mit ${release.title} im Release-Friday-Archiv.`}</p>
        <div className="streamGrid">
          {!live && release.spotifyPreSaveUrl ? <a className="spotifyPreSave" href={release.spotifyPreSaveUrl} target="_blank" rel="noreferrer"><strong>PRE-SAVE ON SPOTIFY</strong><small>OFFICIAL COUNTDOWN</small></a> : null}
          {release.spotifyUrl ? <a className="primary" href={release.spotifyUrl} target="_blank" rel="noreferrer">OPEN SPOTIFY</a> : <span className="disabled">SPOTIFY UNAVAILABLE</span>}
          {release.appleMusicUrl ? <a href={release.appleMusicUrl} target="_blank" rel="noreferrer">APPLE MUSIC</a> : <span className="disabled">APPLE MUSIC</span>}
          {release.youtubeUrl ? <a href={release.youtubeUrl} target="_blank" rel="noreferrer">YOUTUBE</a> : <span className="disabled">YOUTUBE</span>}
        </div>
        <p className="sourceNote">SOURCE · {release.source}</p>
      </div>
    </section>,
    host,
  );
}
