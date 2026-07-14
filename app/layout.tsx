import type { Metadata, Viewport } from "next";
import { AccountStashSync } from "@/components/account-stash-sync";
import { ArchiveSearchEnhancer } from "@/components/archive-search-enhancer";
import { CloudStashRehydrator } from "@/components/cloud-stash-rehydrator";
import { DropArchiveSwitch } from "@/components/drop-archive-switch";
import { FeaturedReleaseSelector } from "@/components/admin/featured-release-selector";
import { ReleaseDetailOverlay } from "@/components/release-detail-overlay";
import { ReleaseTileCoverEnhancer } from "@/components/release-tile-cover-enhancer";
import { TabDeepLink } from "@/components/tab-deep-link";
import "./globals.css";
import "./tablet.css";
import "./release-tile-covers.css";
import "./archive.css";
import "./drop-archive-switch.css";
import "./archive-interactions.css";
import "./account.css";

export const metadata: Metadata = {
  title: "Release Friday — Midnight Tape",
  description: "Kuratiertes Deutschrap- und US-Rap-Release-Radar für den kommenden Freitag.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050805",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        {children}
        <ReleaseTileCoverEnhancer />
        <DropArchiveSwitch />
        <ArchiveSearchEnhancer />
        <ReleaseDetailOverlay />
        <CloudStashRehydrator />
        <AccountStashSync />
        <FeaturedReleaseSelector />
        <TabDeepLink />
      </body>
    </html>
  );
}
