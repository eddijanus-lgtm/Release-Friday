import type { Metadata, Viewport } from "next";
import { AccountStashSync } from "@/components/account-stash-sync";
import { ArchiveSearchEnhancer } from "@/components/archive-search-enhancer";
import { CloudStashRehydrator } from "@/components/cloud-stash-rehydrator";
import { DropArchiveSwitch } from "@/components/drop-archive-switch";
import { FeaturedReleaseSelector } from "@/components/admin/featured-release-selector";
import { ReleaseDetailOverlay } from "@/components/release-detail-overlay";
import { SpotifyCountdownEnhancer } from "@/components/spotify-countdown-enhancer";
import { TabDeepLink } from "@/components/tab-deep-link";
import "./globals.css";
import "./tablet.css";
import "./release-tile-covers.css";
import "./archive.css";
import "./drop-archive-switch.css";
import "./archive-interactions.css";
import "./account.css";
import "./spotify-countdown.css";
import "./home-cleanup.css";
import "./desktop-fluid.css";

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

const legacyCacheCleanup = String.raw`
(() => {
  const marker = "release-friday:legacy-cache-cleanup:v2";
  try {
    if (window.sessionStorage.getItem(marker)) return;
    window.sessionStorage.setItem(marker, "done");

    const appPath = "/Release-Friday/";
    let changed = false;
    const tasks = [];

    if ("serviceWorker" in navigator) {
      tasks.push(
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) => {
                const scriptUrl =
                  registration.active?.scriptURL ??
                  registration.waiting?.scriptURL ??
                  registration.installing?.scriptURL ??
                  "";
                return registration.scope.includes(appPath) || scriptUrl.includes(appPath);
              })
              .map((registration) =>
                registration.unregister().then((removed) => {
                  changed = changed || removed;
                }),
              ),
          ),
        ),
      );
    }

    if ("caches" in window) {
      tasks.push(
        window.caches.keys().then((names) =>
          Promise.all(
            names
              .filter((name) => /release[-_ ]?friday|next-pwa|workbox/i.test(name))
              .map((name) =>
                window.caches.delete(name).then((removed) => {
                  changed = changed || removed;
                }),
              ),
          ),
        ),
      );
    }

    Promise.all(tasks).finally(() => {
      const controllerUrl = navigator.serviceWorker?.controller?.scriptURL ?? "";
      if (changed || controllerUrl.includes(appPath)) window.location.reload();
    });
  } catch {
    // Cache cleanup is best-effort and must never block the application.
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head>
        <script dangerouslySetInnerHTML={{ __html: legacyCacheCleanup }} />
      </head>
      <body>
        {children}
        <DropArchiveSwitch />
        <ArchiveSearchEnhancer />
        <ReleaseDetailOverlay />
        <CloudStashRehydrator />
        <AccountStashSync />
        <FeaturedReleaseSelector />
        <SpotifyCountdownEnhancer />
        <TabDeepLink />
      </body>
    </html>
  );
}
