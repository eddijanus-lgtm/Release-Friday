import type { ReleaseCountry, ReleaseKind } from "@/types/release";

export type ReleaseWriteStatus = "draft" | "published";

export type ReleaseFormValues = {
  artist: string;
  title: string;
  releaseDate: string;
  country: ReleaseCountry;
  kind: ReleaseKind;
  trackCount?: number;
  description?: string;
  genres: string[];
  spotifyUrl?: string;
  spotifyPreSaveUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
  sourceUrl?: string;
};

export type ReleaseCreateResult = {
  id: string;
  status: ReleaseWriteStatus;
  releaseDate: string;
};
