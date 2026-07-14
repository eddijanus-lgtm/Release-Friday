import type { Metadata } from "next";
import { AdminClient } from "@/app/admin/admin-client";
import { releaseDataMetadata } from "@/lib/releases/real-releases.generated";

export const metadata: Metadata = {
  title: "Release anlegen — Release Friday",
  description: "Geschützter Release-Friday-Editor für manuelle Releases.",
};

export default function AdminPage() {
  return <AdminClient targetDate={releaseDataMetadata.targetDate} />;
}
