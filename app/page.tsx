import { PrototypeClient } from "@/app/prototype-client";
import { mockReleases } from "@/lib/releases/mock-releases";

export default function Home() {
  return <PrototypeClient releases={mockReleases} />;
}
