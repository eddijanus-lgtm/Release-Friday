import type { Metadata } from "next";
import { ArchiveClient } from "@/app/archive/archive-client";

export const metadata: Metadata = {
  title: "Archive — Release Friday",
  description: "Archiv vergangener Release-Friday-Ausgaben.",
};

export default function ArchivePage() {
  return <ArchiveClient />;
}
