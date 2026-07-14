import { PrototypeClient } from "@/app/prototype-client";
import { azetDardanEurosport2Cover } from "@/lib/covers/azet-dardan-eurosport-2";
import { releaseDataMetadata } from "@/lib/releases/real-releases.generated";
import { getPublishedReleases } from "@/lib/releases/supabase-releases";

export const revalidate = 0;

export default async function Home() {
  const releases = await getPublishedReleases();
  const releasesWithLocalCovers = releases.map((release) =>
    release.artist === "Azet & Dardan" && release.title === "Eurosport 2" && !release.coverUrl
      ? { ...release, coverUrl: azetDardanEurosport2Cover }
      : release,
  );

  const metadata = {
    ...releaseDataMetadata,
    generatedAt: new Date().toISOString(),
    fetchedCount: releasesWithLocalCovers.length,
    curatedCount: releasesWithLocalCovers.length,
    sourceCounts: releasesWithLocalCovers.reduce<Record<string, number>>((counts, release) => {
      counts[release.source] = (counts[release.source] ?? 0) + 1;
      return counts;
    }, {}),
  };

  return <PrototypeClient releases={releasesWithLocalCovers} metadata={metadata} />;
}
