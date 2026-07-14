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

export function ReleaseTileCoverEnhancer() {
  useEffect(() => {
    let active = true;
    let observer: MutationObserver | undefined;

    void getPublishedReleases().then((releases) => {
      if (!active) return;

      const covers = new Map(
        releases.map((release) => [
          identity(release.artist, release.title),
          release.coverUrl || (identity(release.artist, release.title) === identity("Azet & Dardan", "Eurosport 2") ? azetDardanEurosport2Cover : undefined),
        ]),
      );

      const decorateRows = () => {
        document.querySelectorAll<HTMLElement>(".tapeRowMain").forEach((row) => {
          if (row.querySelector(".rowCoverThumb")) return;
          const title = row.querySelector<HTMLElement>(".rowCopy strong")?.textContent?.trim();
          const artist = row.querySelector<HTMLElement>(".rowCopy span")?.textContent?.trim();
          if (!title || !artist) return;

          const thumb = document.createElement("span");
          thumb.className = "rowCoverThumb";
          const coverUrl = covers.get(identity(artist, title));

          if (coverUrl) {
            const image = document.createElement("img");
            image.src = coverUrl;
            image.alt = "";
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";
            thumb.appendChild(image);
          } else {
            thumb.classList.add("isFallback");
            thumb.textContent = "RF";
          }

          const copy = row.querySelector(".rowCopy");
          row.insertBefore(thumb, copy);
        });
      };

      decorateRows();
      observer = new MutationObserver(decorateRows);
      observer.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, []);

  return null;
}
