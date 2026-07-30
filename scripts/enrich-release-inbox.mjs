import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  SPOTIFY_ARTIST_IMAGE_SOURCE,
  getSpotifyToken,
  searchAppleForRelease,
  searchSpotifyArtistImage,
  searchSpotifyForRelease,
  spotifyArtistImageFallbackEnabled,
} from "./fetch-releases.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const COVER_BUCKET = "release-covers";
const MAX_COVER_BYTES = 10 * 1024 * 1024;
const ACTIVE_RUN_STATUSES = ["collecting", "review"];

function requiredEnvironment(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function enabled(value) {
  return ["1", "true", "yes"].includes(String(value ?? "").trim().toLowerCase());
}

function imageFormat(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 8
    && bytes.slice(0, 8).every((byte, index) =>
      byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
  ) {
    return { extension: "png", contentType: "image/png" };
  }
  const signature = new TextDecoder().decode(bytes.slice(0, 16));
  if (signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  if (signature.slice(4, 12) === "ftypavif" || signature.slice(4, 12) === "ftypavis") {
    return { extension: "avif", contentType: "image/avif" };
  }
  throw new Error("cover is not a supported image");
}

function warningCodesAfterResolution(current, coverKind) {
  const warnings = new Set(Array.isArray(current) ? current : []);
  warnings.delete("missing_stored_cover");
  warnings.delete("cover_lookup_failed");
  if (coverKind === "artist_fallback") warnings.add("artist_image_fallback");
  else warnings.delete("artist_image_fallback");
  return [...warnings];
}

function warningCodesAfterFailure(current) {
  return [...new Set([
    ...(Array.isArray(current) ? current : []),
    "missing_stored_cover",
    "cover_lookup_failed",
  ])];
}

function mergeSources(current, additions) {
  const sources = [...(Array.isArray(current) ? current : []), ...additions]
    .filter((source) => source?.url);
  return [...new Map(sources.map((source) => [source.url, source])).values()].slice(0, 20);
}

function candidateToRelease(candidate) {
  return {
    artist: candidate.artist,
    title: candidate.title,
    releaseDate: candidate.release_date,
    country: candidate.country,
    kind: candidate.kind,
    coverUrl: candidate.cover_url ?? undefined,
    spotifyUrl: candidate.spotify_url ?? undefined,
    appleMusicUrl: candidate.apple_music_url ?? undefined,
    description: candidate.description ?? undefined,
    trackCount: candidate.track_count ?? undefined,
    source: candidate.primary_source,
  };
}

function resolutionDetails(resolved) {
  const artistFallback = String(resolved.source ?? "").includes(SPOTIFY_ARTIST_IMAGE_SOURCE);
  if (artistFallback) {
    return {
      coverKind: "artist_fallback",
      source: resolved.artistImageSourceUrl
        ? [{
            name: "Spotify Artist",
            url: resolved.artistImageSourceUrl,
            type: "artist_image_fallback",
          }]
        : [],
    };
  }
  const spotifyUrl = resolved.spotifyUrl ?? null;
  const appleMusicUrl = resolved.appleMusicUrl ?? null;
  const sourceUrl = spotifyUrl ?? appleMusicUrl;
  return {
    coverKind: "official",
    source: sourceUrl
      ? [{
          name: spotifyUrl ? "Spotify" : "Apple Music",
          url: sourceUrl,
          type: "catalog_match",
        }]
      : [],
  };
}

async function persistCover(supabase, coverUrl, targetDate) {
  const response = await fetch(coverUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg",
      "User-Agent": "Release-Friday-Inbox-Enrichment/1.0",
    },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`cover download failed with HTTP ${response.status}`);
  }
  if (!response.url.startsWith("https://")) throw new Error("cover redirect must use HTTPS");
  const declaredBytes = Number(response.headers.get("content-length") ?? 0);
  if (declaredBytes > MAX_COVER_BYTES) throw new Error("cover exceeds 10 MB");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) throw new Error("cover size is invalid");
  const format = imageFormat(bytes);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `inbox/${targetDate}/${hash.slice(0, 32)}.${format.extension}`;
  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(storagePath, bytes, {
      cacheControl: "31536000",
      contentType: format.contentType,
      upsert: false,
    });
  if (error && !/duplicate|already exists/i.test(error.message)) throw error;
  const publicUrl = supabase.storage.from(COVER_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  if (!publicUrl) throw new Error("public cover URL could not be created");
  return { coverUrl: publicUrl, storagePath };
}

async function selectRun(supabase) {
  const requestedRunId = String(process.env.RELEASE_IMPORT_RUN_ID ?? "").trim();
  const requestedDate = String(process.env.RELEASE_DATE ?? "").trim();
  let query = supabase
    .from("release_import_runs")
    .select("id,target_date,region_scope,status,stats,created_at")
    .in("status", ACTIVE_RUN_STATUSES)
    .order("target_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (requestedRunId) query = query.eq("id", requestedRunId);
  if (requestedDate) query = query.eq("target_date", requestedDate);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No active Release Inbox run matched the request.");
  return data;
}

async function loadCandidates(supabase, runId) {
  const { data, error } = await supabase
    .from("release_candidates")
    .select("id,run_id,artist,title,release_date,country,kind,track_count,description,spotify_url,apple_music_url,cover_url,storage_path,cover_kind,primary_source,sources,warning_codes,status,updated_at")
    .eq("run_id", runId)
    .eq("status", "pending")
    .is("storage_path", null)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

async function resolveCandidate(candidate, targetDate, spotifyState, allowArtistFallback) {
  const release = candidateToRelease(candidate);
  let resolved = null;
  if (spotifyState.available) {
    try {
      resolved = await searchSpotifyForRelease(release, targetDate, spotifyState.token);
    } catch (error) {
      if (error?.status === 429) spotifyState.available = false;
      console.warn(`Spotify lookup failed for ${candidate.artist} — ${candidate.title}: ${error.message}`);
    }
  }
  if (!resolved) {
    try {
      resolved = await searchAppleForRelease(release, targetDate);
    } catch (error) {
      console.warn(`Apple lookup failed for ${candidate.artist} — ${candidate.title}: ${error.message}`);
    }
  }
  if (!resolved && spotifyState.available && allowArtistFallback) {
    try {
      resolved = await searchSpotifyArtistImage(release, spotifyState.token, true, {
        allowAnyCandidate: true,
      });
    } catch (error) {
      if (error?.status === 429) spotifyState.available = false;
      console.warn(`Spotify artist lookup failed for ${candidate.artist}: ${error.message}`);
    }
  }
  return resolved;
}

async function enrichCandidate(supabase, candidate, run, spotifyState, allowArtistFallback) {
  const resolved = await resolveCandidate(
    candidate,
    run.target_date,
    spotifyState,
    allowArtistFallback,
  );
  if (!resolved?.coverUrl) {
    const { error } = await supabase
      .from("release_candidates")
      .update({
        warning_codes: warningCodesAfterFailure(candidate.warning_codes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id)
      .eq("updated_at", candidate.updated_at)
      .is("storage_path", null);
    if (error) throw error;
    return { status: "unresolved" };
  }

  const stored = await persistCover(supabase, resolved.coverUrl, run.target_date);
  const details = resolutionDetails(resolved);
  const values = {
    cover_url: stored.coverUrl,
    storage_path: stored.storagePath,
    cover_kind: details.coverKind,
    warning_codes: warningCodesAfterResolution(candidate.warning_codes, details.coverKind),
    sources: mergeSources(candidate.sources, details.source),
    spotify_url: candidate.spotify_url ?? resolved.spotifyUrl ?? null,
    apple_music_url: candidate.apple_music_url ?? resolved.appleMusicUrl ?? null,
    track_count: candidate.track_count ?? resolved.trackCount ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("release_candidates")
    .update(values)
    .eq("id", candidate.id)
    .eq("updated_at", candidate.updated_at)
    .is("storage_path", null)
    .select("id,cover_kind,cover_url,storage_path")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: "skipped_manual_change" };
  return { status: details.coverKind };
}

async function main() {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const run = await selectRun(supabase);
  const candidates = await loadCandidates(supabase, run.id);
  let spotifyToken = null;
  try {
    spotifyToken = await getSpotifyToken();
  } catch (error) {
    console.warn(`Spotify authentication unavailable: ${error.message}`);
  }
  const spotifyState = { available: Boolean(spotifyToken), token: spotifyToken };
  const allowArtistFallback = enabled(process.env.ALLOW_SPOTIFY_ARTIST_IMAGE_FALLBACK)
    || spotifyArtistImageFallbackEnabled(run.target_date);
  const counts = {
    candidates: candidates.length,
    official: 0,
    artist_fallback: 0,
    unresolved: 0,
    skipped_manual_change: 0,
    failed: 0,
  };

  for (const [index, candidate] of candidates.entries()) {
    try {
      const result = await enrichCandidate(
        supabase,
        candidate,
        run,
        spotifyState,
        allowArtistFallback,
      );
      counts[result.status] += 1;
      console.log(
        `Inbox cover ${index + 1}/${candidates.length}: ${candidate.artist} — ${candidate.title} [${result.status}]`,
      );
    } catch (error) {
      counts.failed += 1;
      console.error(`Inbox cover failed for ${candidate.artist} — ${candidate.title}: ${error.message}`);
    }
  }

  const stats = {
    ...(run.stats ?? {}),
    cover_enrichment: {
      ...counts,
      spotify_available: Boolean(spotifyToken),
      spotify_still_available: spotifyState.available,
      artist_fallback_enabled: allowArtistFallback,
      completed_at: new Date().toISOString(),
    },
  };
  const { error: statsError } = await supabase
    .from("release_import_runs")
    .update({ stats, updated_at: new Date().toISOString() })
    .eq("id", run.id);
  if (statsError) throw statsError;

  const { count: storedCount, error: verifyError } = await supabase
    .from("release_candidates")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .not("storage_path", "is", null);
  if (verifyError) throw verifyError;
  console.log(JSON.stringify({
    run_id: run.id,
    target_date: run.target_date,
    ...counts,
    stored_total: storedCount ?? 0,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) await main();

export {
  candidateToRelease,
  imageFormat,
  mergeSources,
  resolutionDetails,
  warningCodesAfterFailure,
  warningCodesAfterResolution,
};
