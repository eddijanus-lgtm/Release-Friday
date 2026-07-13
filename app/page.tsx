import { PrototypeClient } from "@/app/prototype-client";
import { realReleases } from "@/lib/releases/real-releases.generated";

export default function Home() {
  return <PrototypeClient releases={realReleases} />;
}
