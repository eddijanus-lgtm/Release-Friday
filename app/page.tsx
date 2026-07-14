import { PrototypeClient } from "@/app/prototype-client";
import { azetDardanEurosport2Cover } from "@/lib/covers/azet-dardan-eurosport-2";
import { realReleases, releaseDataMetadata } from "@/lib/releases/real-releases.generated";

const releasesWithLocalCovers = realReleases.map((release) =>
  release.id === "curated-azet-dardan-eurosport-2"
    ? { ...release, coverUrl: azetDardanEurosport2Cover }
    : release,
);

export default function Home() {
  return <PrototypeClient releases={releasesWithLocalCovers} metadata={releaseDataMetadata} />;
}
