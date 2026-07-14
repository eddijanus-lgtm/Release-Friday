import type { Metadata, Viewport } from "next";
import { ReleaseTileCoverEnhancer } from "@/components/release-tile-cover-enhancer";
import "./globals.css";
import "./tablet.css";
import "./release-tile-covers.css";

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
      </body>
    </html>
  );
}
