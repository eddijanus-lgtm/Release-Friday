import type { Metadata, Viewport } from "next";
import { ArchiveNavLink } from "@/components/archive-nav-link";
import { ReleaseTileCoverEnhancer } from "@/components/release-tile-cover-enhancer";
import "./globals.css";
import "./tablet.css";
import "./release-tile-covers.css";
import "./archive.css";

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
        <ArchiveNavLink />
      </body>
    </html>
  );
}
