import { HashTabBridge } from "@/app/hash-tab-bridge";
import { PrototypeClient } from "@/app/prototype-client";
import { realReleases, releaseDataMetadata } from "@/lib/releases/real-releases.generated";

export default function Home() {
  return (
    <>
      <HashTabBridge />
      <PrototypeClient releases={realReleases} metadata={releaseDataMetadata} />
    </>
  );
}
