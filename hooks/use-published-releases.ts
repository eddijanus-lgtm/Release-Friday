"use client";

import { useEffect, useMemo, useState } from "react";
import type { MusicRelease } from "@/types/release";
import { fetchPublishedManualReleases } from "@/lib/releases/manual-releases";
import { mergeManualReleases } from "@/lib/releases/merge-manual-releases";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

type FeaturedScope = "ALL" | "DE" | "US";
type FeaturedMap = Partial<Record<FeaturedScope, string>>;

function newestIssue(releases: MusicRelease[]) {
  const latestDate = releases.reduce<string | undefined>((latest, release) =>
    !latest || release.releaseDate > latest ? release.releaseDate : latest, undefined);
  return latestDate ? releases.filter((release) => release.releaseDate === latestDate) : releases;
}

function putFeaturedFirst(releases: MusicRelease[], featuredId?: string) {
  if (!featuredId) return releases;
  const index = releases.findIndex((release) => release.id === featuredId);
  if (index <= 0) return releases;
  return [releases[index], ...releases.slice(0, index), ...releases.slice(index + 1)];
}

async function fetchFeatured(issueDate: string, signal: AbortSignal): Promise<FeaturedMap> {
  if (!isSupabaseConfigured()) return {};
  const query = new URLSearchParams({
    select: "scope,release_id",
    issue_date: `eq.${issueDate}`,
  });
  const headers: Record<string, string> = { Accept: "application/json", apikey: supabaseAnonKey };
  if (supabaseAnonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${supabaseAnonKey}`;
  const response = await fetch(`${supabaseUrl}/rest/v1/featured_releases?${query}`, { cache: "no-store", headers, signal });
  if (!response.ok) return {};
  const rows = await response.json() as Array<{ scope: FeaturedScope; release_id: string }>;
  return Object.fromEntries(rows.map((row) => [row.scope, `manual-${row.release_id}`])) as FeaturedMap;
}

export function usePublishedReleases(initialReleases: MusicRelease[], _targetDate?: string) {
  const [releases, setReleases] = useState(() => newestIssue(initialReleases));
  const [scope, setScope] = useState<FeaturedScope>("ALL");
  const [featured, setFeatured] = useState<FeaturedMap>({});

  useEffect(() => {
    const controller = new AbortController();
    setReleases(newestIssue(initialReleases));

    void fetchPublishedManualReleases(undefined, controller.signal)
      .then((manual) => setReleases(newestIssue(mergeManualReleases(initialReleases, manual))))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setReleases(newestIssue(initialReleases));
      });

    return () => controller.abort();
  }, [initialReleases]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(".regionSwitch button");
      const next = button?.textContent?.trim().toUpperCase();
      if (next === "ALL" || next === "DE" || next === "US") setScope(next);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const issueDate = releases[0]?.releaseDate;
    if (!issueDate) return;
    const controller = new AbortController();
    void fetchFeatured(issueDate, controller.signal).then(setFeatured).catch(() => setFeatured({}));
    return () => controller.abort();
  }, [releases]);

  return useMemo(() => putFeaturedFirst(releases, featured[scope]), [releases, featured, scope]);
}
