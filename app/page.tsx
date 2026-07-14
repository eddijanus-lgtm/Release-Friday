"use client";

import { useEffect, useMemo, useState } from "react";
import { PrototypeClient } from "@/app/prototype-client";
import { azetDardanEurosport2Cover } from "@/lib/covers/azet-dardan-eurosport-2";
import { realReleases, releaseDataMetadata } from "@/lib/releases/real-releases.generated";
import { getPublishedReleases } from "@/lib/releases/supabase-releases";
import type { MusicRelease } from "@/types/release";

function withLocalCover(releases: MusicRelease[]) {
  return releases.map((release) =>
    release.artist === "Azet & Dardan" && release.title === "Eurosport 2" && !release.coverUrl
      ? { ...release, coverUrl: azetDardanEurosport2Cover }
      : release,
  );
}

export default function Home() {
  const [releases, setReleases] = useState<MusicRelease[]>(() => withLocalCover(realReleases));

  useEffect(() => {
    let active = true;
    void getPublishedReleases().then((supabaseReleases) => {
      if (active && supabaseReleases.length > 0) setReleases(withLocalCover(supabaseReleases));
    });
    return () => { active = false; };
  }, []);

  const metadata = useMemo(() => ({
    ...releaseDataMetadata,
    generatedAt: new Date().toISOString(),
    fetchedCount: releases.length,
    curatedCount: releases.length,
    sourceCounts: releases.reduce<Record<string, number>>((counts, release) => {
      counts[release.source] = (counts[release.source] ?? 0) + 1;
      return counts;
    }, {}),
  }), [releases]);

  return <PrototypeClient releases={releases} metadata={metadata} />;
}
