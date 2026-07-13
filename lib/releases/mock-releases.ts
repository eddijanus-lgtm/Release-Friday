import type { MusicRelease } from "@/types/release";

export const mockReleases: MusicRelease[] = [
  {
    id: "de-example-single",
    title: "Freitag Nacht",
    artist: "Beispiel Artist DE",
    releaseDate: "2026-07-17",
    country: "DE",
    kind: "single",
    source: "mock",
  },
  {
    id: "us-example-album",
    title: "Next Up",
    artist: "Example Artist US",
    releaseDate: "2026-07-17",
    country: "US",
    kind: "album",
    source: "mock",
  },
];
