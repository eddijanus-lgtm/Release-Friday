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
  source: string;
}
