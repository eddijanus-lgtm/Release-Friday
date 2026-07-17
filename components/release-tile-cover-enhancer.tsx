"use client";

import { useEffect } from "react";
import { getPublishedReleases } from "@/lib/releases/supabase-releases";

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function identity(artist: string, title: string) {
  return `${normalize(artist)}::${normalize(title)}`;
}

function getRowIdentity(row: HTMLElement) {
  if (row.dataset.releaseIdentity) return row.dataset.releaseIdentity;
  const title = row.querySelector<HTMLElement>(".rowCopy strong")?.textContent?.trim();
  const artist = row.querySelector<HTMLElement>(".rowCopy > span")?.childNodes[0]?.textContent?.trim()
    ?? row.querySelector<HTMLElement>(".rowCopy > span")?.textContent?.trim();
  if (!title || !artist) return undefined;
  const value = identity(artist, title);
  row.dataset.releaseIdentity = value;
  return value;
}

function renderFallback(thumb: HTMLElement) {
  const release = document.createElement("span");
  release.textContent = "RELEASE";
  const friday = document.createElement("span");
  friday.textContent = "FRIDAY";
  thumb.replaceChildren(release, friday);
  thumb.classList.add("isFallback");
  delete thumb.dataset.coverUrl;
}

export function ReleaseTileCoverEnhancer() {
  useEffect(() => {
    let active = true;
    const covers = new Map<string, string>();
    const kinds = new Map<string, string>();

    const decorateRows = () => {
      document.querySelectorAll<HTMLElement>(".tapeRowMain").forEach((row) => {
        const rowIdentity = getRowIdentity(row);
        if (!rowIdentity) return;

        let thumb = row.querySelector<HTMLElement>(".rowCoverThumb");
        if (!thumb) {
          thumb = document.createElement("span");
          thumb.className = "rowCoverThumb";
          renderFallback(thumb);
          const copy = row.querySelector(".rowCopy");
          row.insertBefore(thumb, copy);
        }

        const artistLine = row.querySelector<HTMLElement>(".rowCopy > span");
        const kind = kinds.get(rowIdentity);
        if (artistLine && kind && !artistLine.querySelector(".rowKindBadge")) {
          const badge = document.createElement("em");
          badge.className = "rowKindBadge";
          badge.textContent = kind.toUpperCase();
          artistLine.append(" · ", badge);
        }

        const coverUrl = covers.get(rowIdentity);
        if (!coverUrl || thumb.dataset.coverUrl === coverUrl) return;

        const image = document.createElement("img");
        image.src = coverUrl;
        image.alt = "";
        image.loading = "eager";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("load", () => {
          if (!active) return;
          thumb!.replaceChildren(image);
          thumb!.classList.remove("isFallback");
          thumb!.dataset.coverUrl = coverUrl;
        });
        image.addEventListener("error", () => renderFallback(thumb!));
      });
    };

    decorateRows();
    const observer = new MutationObserver(decorateRows);
    observer.observe(document.body, { childList: true, subtree: true });

    void getPublishedReleases().then((releases) => {
      if (!active) return;
      releases.forEach((release) => {
        const key = identity(release.artist, release.title);
        if (release.coverUrl) covers.set(key, release.coverUrl);
        kinds.set(key, release.kind);
      });
      decorateRows();
    });

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return null;
}
