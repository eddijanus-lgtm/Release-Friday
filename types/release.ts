export type ReleaseCountry = "DE" | "US";
export type ReleaseKind = "single" | "ep" | "album" | "mixtape";

export interface MusicRelease {
  id: string;
  title: string;
  artist: string;
  releaseDate: string;
  country: ReleaseCountry;
  kind: ReleaseKind;
  coverUrl?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
  sourceUrl?: string;
  description?: string;
  trackCount?: number;
  genres?: string[];
  source: string;
}

export interface ReleaseDataMetadata {
  targetDate: string;
  generatedAt: string;
  fetchedCount: number;
  curatedCount: number;
  fetchError?: string | null;
  sourceCounts?: Record<string, number>;
}
