import type { MusicRelease, ReleaseCountry } from "@/types/release";

export interface ReleaseQuery {
  releaseDate: string;
  countries: ReleaseCountry[];
}

export interface ReleaseSource {
  readonly name: string;
  getReleases(query: ReleaseQuery): Promise<MusicRelease[]>;
}
