"use client";

import { useEffect, useState } from "react";
import type { MusicRelease } from "@/types/release";
import { fetchPublishedManualReleases } from "@/lib/releases/manual-releases";
import { mergeManualReleases } from "@/lib/releases/merge-manual-releases";

export function usePublishedReleases(initialReleases: MusicRelease[], targetDate?: string) {
  const [releases, setReleases] = useState(initialReleases);

  useEffect(() => {
    const controller = new AbortController();
    setReleases(initialReleases);

    if (!targetDate) return () => controller.abort();

    void fetchPublishedManualReleases(targetDate, controller.signal)
      .then((manual) => setReleases(mergeManualReleases(initialReleases, manual)))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setReleases(initialReleases);
        }
      });

    return () => controller.abort();
  }, [initialReleases, targetDate]);

  return releases;
}
