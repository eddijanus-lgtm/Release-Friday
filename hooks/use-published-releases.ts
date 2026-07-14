"use client";

import { useEffect, useState } from "react";
import type { MusicRelease } from "@/types/release";
import { fetchPublishedManualReleases } from "@/lib/releases/manual-releases";
import { mergeManualReleases } from "@/lib/releases/merge-manual-releases";

function newestIssue(releases: MusicRelease[]) {
  const latestDate = releases.reduce<string | undefined>((latest, release) =>
    !latest || release.releaseDate > latest ? release.releaseDate : latest, undefined);
  return latestDate ? releases.filter((release) => release.releaseDate === latestDate) : releases;
}

export function usePublishedReleases(initialReleases: MusicRelease[], _targetDate?: string) {
  const [releases, setReleases] = useState(() => newestIssue(initialReleases));

  useEffect(() => {
    const controller = new AbortController();
    setReleases(newestIssue(initialReleases));

    void fetchPublishedManualReleases(undefined, controller.signal)
      .then((manual) => setReleases(newestIssue(mergeManualReleases(initialReleases, manual))))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setReleases(newestIssue(initialReleases));
        }
      });

    return () => controller.abort();
  }, [initialReleases]);

  return releases;
}
