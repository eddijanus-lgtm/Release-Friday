import type { MusicRelease, ReleaseCountry, ReleaseKind } from "@/types/release";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

type ManualReleaseRow = {
  id: string;
  artist: string;
  title: string;
  release_date: string;
  country: ReleaseCountry;
  kind: ReleaseKind;
  cover_url: string | null;
  spotify_url: string | null;
  spotify_pre_save_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  source_url: string | null;
  description: string | null;
  track_count: number | null;
  genres: string[] | null;
  source: string;
};

const releaseColumns = [
  "id",
  "artist",
  "title",
  "release_date",
  "country",
  "kind",
  "cover_url",
  "spotify_url",
  "spotify_pre_save_url",
  "apple_music_url",
  "youtube_url",
  "source_url",
  "description",
  "track_count",
  "genres",
  "source",
].join(",");

function toMusicRelease(row: ManualReleaseRow): MusicRelease {
  return {
    id: `manual-${row.id}`,
    artist: row.artist,
    title: row.title,
    releaseDate: row.release_date,
    country: row.country,
    kind: row.kind,
    coverUrl: row.cover_url ?? undefined,
    spotifyUrl: row.spotify_url ?? undefined,
    spotifyPreSaveUrl: row.spotify_pre_save_url ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    description: row.description ?? undefined,
    trackCount: row.track_count ?? undefined,
    genres: row.genres?.length ? row.genres : undefined,
    source: row.source,
  };
}

export async function fetchPublishedManualReleases(targetDate?: string, signal?: AbortSignal) {
  if (!isSupabaseConfigured()) return [];

  const query = new URLSearchParams({
    select: releaseColumns,
    status: "eq.published",
    order: "release_date.desc,created_at.asc",
  });
  if (targetDate) query.set("release_date", `eq.${targetDate}`);

  const headers: Record<string, string> = {
    Accept: "application/json",
    apikey: supabaseAnonKey,
  };
  if (supabaseAnonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${supabaseAnonKey}`;

  const response = await fetch(`${supabaseUrl}/rest/v1/releases?${query}`, {
    cache: "no-store",
    headers,
    signal,
  });

  if (!response.ok) throw new Error(`Manual releases could not be loaded (${response.status}).`);
  const rows = await response.json() as ManualReleaseRow[];
  return rows.map(toMusicRelease);
}
