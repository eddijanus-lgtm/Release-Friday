import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_FILE = path.join(ROOT, "lib/releases/real-releases.generated.ts");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing.");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function readGeneratedReleases() {
  const source = await readFile(GENERATED_FILE, "utf8");
  const marker = "export const realReleases: MusicRelease[] = ";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Generated release array was not found.");
  const jsonStart = start + marker.length;
  const jsonEnd = source.indexOf(";", jsonStart);
  if (jsonEnd < 0) throw new Error("Generated release array is incomplete.");
  return JSON.parse(source.slice(jsonStart, jsonEnd));
}

function toRow(release) {
  return {
    artist: release.artist,
    title: release.title,
    release_date: release.releaseDate,
    country: release.country,
    kind: release.kind,
    cover_url: release.coverUrl?.startsWith("embedded:") ? null : release.coverUrl ?? null,
    storage_path: null,
    spotify_url: release.spotifyUrl ?? null,
    spotify_pre_save_url: release.spotifyPreSaveUrl ?? null,
    apple_music_url: release.appleMusicUrl ?? null,
    youtube_url: release.youtubeUrl ?? null,
    source_url: release.sourceUrl ?? null,
    description: release.description ?? null,
    track_count: release.trackCount ?? null,
    genres: release.genres ?? [],
    source: release.source || "GitHub Import",
    status: "published",
    created_by: null,
  };
}

const releases = await readGeneratedReleases();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dates = [...new Set(releases.map((release) => release.releaseDate))];
const { data: existingRows, error: readError } = await supabase
  .from("releases")
  .select("id,artist,title,release_date")
  .in("release_date", dates);

if (readError) throw readError;

const existingKeys = new Set(
  (existingRows ?? []).map((row) => `${normalize(row.artist)}::${normalize(row.title)}::${row.release_date}`),
);

const newRows = releases
  .filter((release) => !existingKeys.has(`${normalize(release.artist)}::${normalize(release.title)}::${release.releaseDate}`))
  .map(toRow);

if (newRows.length === 0) {
  console.log(`No new releases to sync. ${releases.length} generated releases already exist in Supabase.`);
  process.exit(0);
}

const { error: insertError } = await supabase.from("releases").insert(newRows);
if (insertError) throw insertError;

console.log(`Synced ${newRows.length} new release(s) to Supabase. Existing entries were preserved for manual editing.`);
