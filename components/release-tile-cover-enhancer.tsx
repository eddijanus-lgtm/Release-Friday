"use client";

import { useEffect } from "react";
import { azetDardanEurosport2Cover } from "@/lib/covers/azet-dardan-eurosport-2";
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
  const title = row.querySelector<HTMLElement>(".rowCopy strong")?.textContent?.trim();
  const artist = row.querySelector<HTMLElement>(".rowCopy span")?.textContent?.trim();
  return title && artist ? identity(artist, title) : undefined;
}

export function ReleaseTileCoverEnhancer() {
  useEffect(() => {
    let active = true;
    const covers = new Map<string, string>();
    covers.set(identity("Azet & Dardan", "Eurosport 2"), azetDardanEurosport2Cover);

    const decorateRows = () => {
      document.querySelectorAll<HTMLElement>(".tapeRowMain").forEach((row) => {
        const rowIdentity = getRowIdentity(row);
        if (!rowIdentity) return;

        let thumb = row.querySelector<HTMLElement>(".rowCoverThumb");
        if (!thumb) {
          thumb = document.createElement("span");
          thumb.className = "rowCoverThumb isFallback";
          thumb.textContent = "RF";
          const copy = row.querySelector(".rowCopy");
          row.insertBefore(thumb, copy);
        }

        const coverUrl = covers.get(rowIdentity);
        if (!coverUrl || thumb.dataset.coverUrl === coverUrl) return;

        const image = document.createElement("img");
        image.src = coverUrl;
        image.alt = "";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("load", () => {
          if (!active) return;
          thumb!.replaceChildren(image);
          thumb!.classList.remove("isFallback");
          thumb!.dataset.coverUrl = coverUrl;
        });
        image.addEventListener("error", () => {
          thumb!.classList.add("isFallback");
          thumb!.textContent = "RF";
        });
      });
    };

    decorateRows();
    const observer = new MutationObserver(decorateRows);
    observer.observe(document.body, { childList: true, subtree: true });

    void getPublishedReleases().then((releases) => {
      if (!active) return;
      releases.forEach((release) => {
        if (release.coverUrl) covers.set(identity(release.artist, release.title), release.coverUrl);
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
