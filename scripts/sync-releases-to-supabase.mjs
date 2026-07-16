import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { isArtistImageFallbackReplacement } from "./release-sync-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_FILE = path.join(ROOT, "lib/releases/real-releases.generated.ts");
const COVER_BUCKET = "release-covers";
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";
const REFRESH_ARTIST_IMAGE_COVERS = ["1", "true"].includes(String(process.env.REFRESH_ARTIST_IMAGE_COVERS || "").toLowerCase());
const USER_AGENT = "ReleaseFriday/0.5 (https://github.com/eddijanus-lgtm/Release-Friday)";

if (!DRY_RUN && !SUPABASE_URL) throw new Error("SUPABASE_URL is missing.");
if (!DRY_RUN && !SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function releaseKey(release) {
  const date = release.releaseDate ?? release.release_date;
  return `${normalize(release.artist)}::${normalize(release.title)}::${date}`;
}

function validExternalCover(value) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol)
      && !String(value).startsWith("embedded:")
      && !url.pathname.includes("/search/");
  } catch {
    return false;
  }
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

function detectImage(buffer, headerMime) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  if (buffer.length >= 16 && buffer.subarray(4, 12).toString("ascii").includes("ftyp") && buffer.subarray(8, 16).toString("ascii").includes("avif")) {
    return { mime: "image/avif", extension: "avif" };
  }
  throw new Error(`Cover response is not a supported image (${headerMime || "unknown content type"}).`);
}

function existingStorageReference(coverUrl) {
  if (!SUPABASE_URL) return null;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${COVER_BUCKET}/`;
  if (!String(coverUrl).startsWith(prefix)) return null;
  return { coverUrl, storagePath: decodeURIComponent(String(coverUrl).slice(prefix.length)) };
}

async function downloadCover(coverUrl) {
  const response = await fetch(coverUrl, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`Cover download failed (${response.status} ${response.statusText}).`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_COVER_BYTES) throw new Error(`Cover exceeds ${MAX_COVER_BYTES} bytes.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_COVER_BYTES) throw new Error("Cover is empty or exceeds the bucket limit.");
  const headerMime = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return { buffer, ...detectImage(buffer, headerMime) };
}

async function persistCover(supabase, release) {
  const existing = existingStorageReference(release.coverUrl);
  if (existing) return existing;

  const image = await downloadCover(release.coverUrl);
  const digest = createHash("sha256").update(image.buffer).digest("hex");
  const storagePath = `imports/${release.releaseDate}/${digest}.${image.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(storagePath, image.buffer, {
      cacheControl: "31536000",
      contentType: image.mime,
      upsert: false,
    });

  const duplicate = uploadError && (
    Number(uploadError.statusCode) === 409
    || uploadError.name === "Duplicate"
    || /duplicate|already exists/i.test(uploadError.message)
  );
  if (uploadError && !duplicate) throw uploadError;

  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error(`Public cover URL could not be created for ${storagePath}.`);
  return { coverUrl: data.publicUrl, storagePath };
}

function toRow(release, storedCover, createdBy) {
  return {
    artist: release.artist,
    title: release.title,
    release_date: release.releaseDate,
    country: release.country,
    kind: release.kind,
    cover_url: storedCover.coverUrl,
    storage_path: storedCover.storagePath,
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
    created_by: createdBy,
  };
}

const releases = await readGeneratedReleases();
const coverQualified = releases.filter((release) => validExternalCover(release.coverUrl));
const rejectedWithoutCover = releases.filter((release) => !validExternalCover(release.coverUrl));

if (DRY_RUN) {
  console.log(JSON.stringify({
    dryRun: true,
    generatedCount: releases.length,
    coverQualifiedCount: coverQualified.length,
    rejectedWithoutCover: rejectedWithoutCover.map((release) => ({ artist: release.artist, title: release.title })),
  }, null, 2));
  process.exit(0);
}

if (coverQualified.length === 0) {
  console.log(JSON.stringify({
    synced: 0,
    existing: 0,
    skipped: rejectedWithoutCover.map((release) => ({
      artist: release.artist,
      title: release.title,
      reason: "missing cover URL",
    })),
    message: "No cover-qualified releases were available to sync.",
  }, null, 2));
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: admins, error: adminError } = await supabase.from("release_admins").select("user_id").limit(1);
if (adminError) throw adminError;
const createdBy = admins?.[0]?.user_id;
if (!createdBy) throw new Error("No release admin is configured in Supabase.");

const dates = [...new Set(coverQualified.map((release) => release.releaseDate))];
const { data: existingRows, error: readError } = await supabase
  .from("releases")
  .select("id,artist,title,release_date,source")
  .in("release_date", dates);
if (readError) throw readError;

const existingByKey = new Map((existingRows ?? []).map((release) => [releaseKey(release), release]));
const existingKeys = new Set(existingByKey.keys());
const candidates = coverQualified.filter((release) => !existingKeys.has(releaseKey(release)));
const replacementCandidates = REFRESH_ARTIST_IMAGE_COVERS
  ? coverQualified.filter((release) => {
    const existing = existingByKey.get(releaseKey(release));
    return existing && isArtistImageFallbackReplacement(existing, release);
  })
  : [];
const newRows = [];
const replacementRows = [];
const skipped = rejectedWithoutCover.map((release) => ({ artist: release.artist, title: release.title, reason: "missing cover URL" }));

for (const release of candidates) {
  try {
    const storedCover = await persistCover(supabase, release);
    newRows.push(toRow(release, storedCover, createdBy));
  } catch (error) {
    skipped.push({
      artist: release.artist,
      title: release.title,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

for (const release of replacementCandidates) {
  try {
    const storedCover = await persistCover(supabase, release);
    replacementRows.push({
      id: existingByKey.get(releaseKey(release)).id,
      release,
      values: {
        cover_url: storedCover.coverUrl,
        storage_path: storedCover.storagePath,
        spotify_url: release.spotifyUrl ?? null,
        apple_music_url: release.appleMusicUrl ?? null,
        description: release.description ?? null,
        source: release.source,
      },
    });
  } catch (error) {
    skipped.push({
      artist: release.artist,
      title: release.title,
      reason: `replacement failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

if (newRows.length === 0 && replacementRows.length === 0) {
  console.log(JSON.stringify({
    synced: 0,
    existing: coverQualified.length - candidates.length,
    skipped,
    replacements: 0,
    message: "No cover-qualified new releases or artist-image replacements were available to sync.",
  }, null, 2));
  process.exit(0);
}

let inserted = [];
if (newRows.length > 0) {
  const { data, error: insertError } = await supabase
    .from("releases")
    .insert(newRows)
    .select("id,artist,title,release_date,cover_url,storage_path,status");
  if (insertError) throw insertError;
  inserted = data ?? [];
  if (inserted.length !== newRows.length) throw new Error(`Verification failed: expected ${newRows.length} inserts, received ${inserted.length}.`);
  if (inserted.some((row) => !row.cover_url || !row.storage_path || row.status !== "published")) {
    throw new Error("Verification failed: an inserted release is missing its stored cover or published status.");
  }
}

const replaced = [];
for (const replacement of replacementRows) {
  const { data, error } = await supabase
    .from("releases")
    .update(replacement.values)
    .eq("id", replacement.id)
    .select("id,artist,title,release_date,cover_url,storage_path,source,status")
    .single();
  if (error) throw error;
  if (!data?.cover_url || !data.storage_path || data.status !== "published" || data.source.includes("Spotify artist image fallback")) {
    throw new Error(`Verification failed for replacement ${replacement.release.artist} — ${replacement.release.title}.`);
  }
  replaced.push(data);
}

console.log(JSON.stringify({
  synced: inserted.length,
  replacements: replaced.length,
  existing: coverQualified.length - candidates.length,
  skipped,
  releases: inserted,
  replacedReleases: replaced,
}, null, 2));
