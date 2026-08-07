import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedFields = new Set([
  "artist",
  "title",
  "release_date",
  "country",
  "kind",
  "track_count",
  "genres",
  "description",
  "spotify_url",
  "spotify_pre_save_url",
  "apple_music_url",
  "youtube_url",
  "source_url",
  "cover_url",
]);

type ReleaseDraft = {
  artist: string;
  title: string;
  release_date: string;
  country: "DE" | "US";
  kind: "album" | "ep" | "single" | "mixtape";
  track_count: number | null;
  genres: string[];
  description: string | null;
  spotify_url: string | null;
  spotify_pre_save_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  source_url: string | null;
  cover_url: string | null;
};

class InputError extends Error {}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function safelyMatches(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

function requiredString(input: Record<string, unknown>, field: string, maxLength: number) {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new InputError(`${field} is required.`);
  }
  const result = value.trim();
  if (result.length > maxLength) throw new InputError(`${field} is too long.`);
  return result;
}

function optionalString(input: Record<string, unknown>, field: string, maxLength: number) {
  const value = input[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InputError(`${field} must be a string.`);
  const result = value.trim();
  if (!result) return null;
  if (result.length > maxLength) throw new InputError(`${field} is too long.`);
  return result;
}

function optionalHttpsUrl(input: Record<string, unknown>, field: string) {
  const value = optionalString(input, field, 2048);
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new InputError(`${field} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:") throw new InputError(`${field} must use HTTPS.`);
  return parsed.toString();
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError("release_date must use YYYY-MM-DD.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new InputError("release_date is not a valid date.");
  }
  return value;
}

function validateInput(value: unknown): ReleaseDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("The request body must be a JSON object.");
  }
  const input = value as Record<string, unknown>;
  const unexpected = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unexpected.length) {
    throw new InputError(`Unsupported field${unexpected.length === 1 ? "" : "s"}: ${unexpected.join(", ")}.`);
  }

  const artist = requiredString(input, "artist", 200);
  const title = requiredString(input, "title", 240);
  const releaseDate = validateDate(requiredString(input, "release_date", 10));

  const country = input.country;
  if (country !== "DE" && country !== "US") {
    throw new InputError("country must be DE or US.");
  }

  const kind = input.kind;
  if (kind !== "album" && kind !== "ep" && kind !== "single" && kind !== "mixtape") {
    throw new InputError("kind must be album, ep, single, or mixtape.");
  }

  const trackCount = input.track_count;
  if (
    trackCount !== undefined &&
    trackCount !== null &&
    (!Number.isInteger(trackCount) || Number(trackCount) < 1 || Number(trackCount) > 999)
  ) {
    throw new InputError("track_count must be an integer between 1 and 999.");
  }

  const genresInput = input.genres;
  if (genresInput !== undefined && !Array.isArray(genresInput)) {
    throw new InputError("genres must be an array with at most 12 entries.");
  }
  const genreValues = Array.isArray(genresInput) ? genresInput : [];
  if (genreValues.length > 12) {
    throw new InputError("genres must be an array with at most 12 entries.");
  }
  const genres = Array.from(new Set(genreValues.map((genre) => {
    if (typeof genre !== "string" || !genre.trim() || genre.trim().length > 80) {
      throw new InputError("Each genre must be a non-empty string of at most 80 characters.");
    }
    return genre.trim();
  })));

  const spotifyUrl = optionalHttpsUrl(input, "spotify_url");
  if (spotifyUrl) {
    const parsed = new URL(spotifyUrl);
    if (parsed.hostname !== "open.spotify.com" || !parsed.pathname.startsWith("/album/")) {
      throw new InputError("spotify_url must be a Spotify album URL, not a pre-save URL.");
    }
  }

  const spotifyPreSaveUrl = optionalHttpsUrl(input, "spotify_pre_save_url");
  if (spotifyPreSaveUrl) {
    const parsed = new URL(spotifyPreSaveUrl);
    if (parsed.hostname !== "open.spotify.com" || !parsed.pathname.startsWith("/prerelease/")) {
      throw new InputError("spotify_pre_save_url must be a Spotify prerelease URL.");
    }
  }

  return {
    artist,
    title,
    release_date: releaseDate,
    country,
    kind,
    track_count: trackCount === undefined ? null : (trackCount as number | null),
    genres,
    description: optionalString(input, "description", 5000),
    spotify_url: spotifyUrl,
    spotify_pre_save_url: spotifyPreSaveUrl,
    apple_music_url: optionalHttpsUrl(input, "apple_music_url"),
    youtube_url: optionalHttpsUrl(input, "youtube_url"),
    source_url: optionalHttpsUrl(input, "source_url"),
    cover_url: optionalHttpsUrl(input, "cover_url"),
  };
}

function normalizeDuplicateKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(401, { error: "A Release Friday draft API key is required." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const configuredApiKey = Deno.env.get("CHATGPT_RELEASE_DRAFT_API_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !configuredApiKey) {
    console.error("Missing Supabase function environment configuration.");
    return json(503, { error: "The draft action is not configured yet." });
  }

  const suppliedApiKey = authorization.slice("Bearer ".length);
  if (!suppliedApiKey || !(await safelyMatches(suppliedApiKey, configuredApiKey))) {
    return json(401, { error: "The Release Friday draft API key is invalid." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: editor, error: editorError } = await supabase
    .from("release_admins")
    .select("user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (editorError || !editor) {
    console.error("Draft editor lookup failed", editorError?.code);
    return json(500, { error: "No Release Friday editor is configured." });
  }

  let requestText: string;
  try {
    requestText = await request.text();
    if (new TextEncoder().encode(requestText).byteLength > 20_000) {
      return json(413, { error: "Request body is too large." });
    }
  } catch {
    return json(400, { error: "Unable to read request body." });
  }

  let draft: ReleaseDraft;
  try {
    draft = validateInput(JSON.parse(requestText));
  } catch (error) {
    if (error instanceof InputError) return json(400, { error: error.message });
    return json(400, { error: "Request body must contain valid JSON." });
  }

  const { data: sameDate, error: duplicateQueryError } = await supabase
    .from("releases")
    .select("id,artist,title,release_date,status")
    .eq("release_date", draft.release_date);
  if (duplicateQueryError) {
    console.error("Duplicate query failed", duplicateQueryError.code);
    return json(500, { error: "Unable to check for an existing release." });
  }

  const artistKey = normalizeDuplicateKey(draft.artist);
  const titleKey = normalizeDuplicateKey(draft.title);
  const duplicate = sameDate?.find((release) =>
    normalizeDuplicateKey(release.artist) === artistKey &&
    normalizeDuplicateKey(release.title) === titleKey
  );
  if (duplicate) {
    return json(409, {
      error: "This release already exists.",
      duplicate: {
        id: duplicate.id,
        artist: duplicate.artist,
        title: duplicate.title,
        release_date: duplicate.release_date,
        status: duplicate.status,
      },
    });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("releases")
    .insert({
      ...draft,
      source: "ChatGPT Action (API key draft)",
      status: "draft",
      created_by: editor.user_id,
    })
    .select("id,artist,title,release_date,country,kind,track_count,genres,description,spotify_url,spotify_pre_save_url,apple_music_url,youtube_url,source_url,cover_url,source,status,created_at")
    .single();

  if (insertError || !inserted) {
    console.error("Draft insert failed", insertError?.code);
    return json(500, { error: "The release draft could not be created." });
  }

  const { data: verified, error: verifyError } = await supabase
    .from("releases")
    .select("id,artist,title,release_date,country,kind,track_count,genres,description,spotify_url,spotify_pre_save_url,apple_music_url,youtube_url,source_url,cover_url,source,status,created_at")
    .eq("id", inserted.id)
    .single();

  if (verifyError || !verified) {
    console.error("Draft verification failed", verifyError?.code);
    return json(500, { error: "The draft was created but could not be verified.", id: inserted.id });
  }

  console.info("ChatGPT release draft created", { release_id: verified.id, user_id: editor.user_id });
  return json(201, {
    action: "created",
    message: "Release draft created. It is not publicly visible until published in the admin editor.",
    release: verified,
  });
});
