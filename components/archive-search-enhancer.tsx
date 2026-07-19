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

export function ArchiveSearchEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSavedIds(readSaved());
    const controller = new AbortController();
    void fetchPublishedManualReleases(undefined, controller.signal).then(setReleases).catch(() => setReleases([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let input: HTMLInputElement | null = null;
    const onInput = () => setQuery(input?.value ?? "");

    const ensureHost = () => {
      const screen = document.querySelector<HTMLElement>(".findScreen");
      const list = screen?.querySelector<HTMLElement>(".finderList");
      input = screen?.querySelector<HTMLInputElement>(".tapeSearch input") ?? null;
      if (!screen || !list || !input) {
        setHost(null);
        return;
      }
      let target = screen.querySelector<HTMLElement>(".archiveSearchHost");
      if (!target) {
        target = document.createElement("div");
        target.className = "archiveSearchHost";
        list.insertAdjacentElement("afterend", target);
      }
      input.removeEventListener("input", onInput);
      input.addEventListener("input", onInput);
      setQuery(input.value);
      setHost(target);
    };

    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      input?.removeEventListener("input", onInput);
    };
  }, []);

  const past = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    return releases.filter((release) => {
      const matches = !needle || `${release.title} ${release.artist}`.toLocaleLowerCase("de-DE").includes(needle);
      return Boolean(release.archivedAt) && matches;
    });
  }, [query, releases]);

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      window.localStorage.setItem("release-friday:saved", JSON.stringify([...next]));
      return next;
    });
  };

  if (!host || past.length === 0) return null;

  return createPortal(
    <section className="pastSearchResults" aria-label="Vergangene Releases">
      <p className="microHeading">PAST RELEASES</p>
      <div className="finderList">
        {past.map((release, index) => (
          <article className="tapeRow pastSearchRow" key={release.id}>
            <button type="button" className="tapeRowMain" onClick={() => openRelease(release)} aria-label={`${release.title} öffnen`}>
              <span className="rowNumber">{String(index + 1).padStart(2, "0")}</span>
              <ReleaseRowCover release={release} />
              <div className="rowCopy">
                <strong>{release.title}</strong>
                <span>{release.artist} · <em className="rowKindBadge">{kindLabels[release.kind]}</em></span>
                <small className="pastReleaseLabel">PAST RELEASE</small>
              </div>
              <span className="rowArrow">→</span>
            </button>
            <button type="button" className={`rowSave ${savedIds.has(release.id) ? "saved" : ""}`} onClick={() => toggleSaved(release.id)} aria-pressed={savedIds.has(release.id)} aria-label={savedIds.has(release.id) ? "Aus Stash entfernen" : "In Stash speichern"}>+</button>
          </article>
        ))}
      </div>
    </section>,
    host,
  );
}
