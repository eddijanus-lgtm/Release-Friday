"use client";

import { useMemo, useState } from "react";
import type { MusicRelease, ReleaseCountry } from "@/types/release";
import { ReleaseCard } from "./release-card";

type Filter = "ALL" | ReleaseCountry;

type ReleaseFeedProps = {
  releases: MusicRelease[];
};

const filters: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "Alle" },
  { value: "DE", label: "Deutschland" },
  { value: "US", label: "USA" },
];

export function ReleaseFeed({ releases }: ReleaseFeedProps) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const visibleReleases = useMemo(
    () => releases.filter((release) => filter === "ALL" || release.country === filter),
    [filter, releases],
  );

  return (
    <>
      <nav className="filters" aria-label="Release-Filter">
        {filters.map((item) => (
          <button
            className={filter === item.value ? "active" : undefined}
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="releaseList" aria-label="Kommende Releases">
        {visibleReleases.map((release) => (
          <ReleaseCard key={release.id} release={release} />
        ))}
      </section>
    </>
  );
}
