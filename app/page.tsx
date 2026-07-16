import { HashTabBridge } from "@/app/hash-tab-bridge";
import { PrototypeClient } from "@/app/prototype-client";
import { realReleases, releaseDataMetadata } from "@/lib/releases/real-releases.generated";

// Deployment refresh after fully removing the local Eurosport 2 release and cover.
export default function Home() {
  return (
    <>
      <HashTabBridge />
      <PrototypeClient releases={realReleases} metadata={releaseDataMetadata} />
    </>
  );
}
