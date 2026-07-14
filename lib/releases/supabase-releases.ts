import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import type { MusicRelease } from "@/types/release";

type ReleaseRow = {
  id: string;
  artist: string;
  title: string;
  release_date: string;
  country: MusicRelease["country"];
  kind: MusicRelease["kind"];
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

function optional(value: string | null) {
  return value || undefined;
}

export async function getPublishedReleases(): Promise<MusicRelease[]> {
  if (!isSupabaseConfigured()) return [];

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("releases")
    .select("id,artist,title,release_date,country,kind,cover_url,spotify_url,spotify_pre_save_url,apple_music_url,youtube_url,source_url,description,track_count,genres,source")
    .eq("status", "published")
    .order("release_date", { ascending: false })
    .order("artist", { ascending: true });

  if (error) {
    console.error("Published releases could not be loaded from Supabase", error);
    return [];
  }

  return ((data ?? []) as ReleaseRow[]).map((row) => ({
    id: row.id,
    artist: row.artist,
    title: row.title,
    releaseDate: row.release_date,
    country: row.country,
    kind: row.kind,
    coverUrl: optional(row.cover_url),
    spotifyUrl: optional(row.spotify_url),
    spotifyPreSaveUrl: optional(row.spotify_pre_save_url),
    appleMusicUrl: optional(row.apple_music_url),
    youtubeUrl: optional(row.youtube_url),
    sourceUrl: optional(row.source_url),
    description: optional(row.description),
    trackCount: row.track_count ?? undefined,
    genres: row.genres ?? [],
    source: row.source,
  }));
}
