import { createClient } from "@supabase/supabase-js";

const spotifyInput = process.argv[2] || process.env.SPOTIFY_RELEASE;
const country = String(process.env.RELEASE_COUNTRY || "US").toUpperCase();
const status = String(process.env.RELEASE_STATUS || "published").toLowerCase();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!spotifyInput) throw new Error("Provide a Spotify album/prerelease URL or 22-character ID.");
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) throw new Error("Spotify API credentials are missing.");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials are missing.");
if (!["DE", "US"].includes(country)) throw new Error("RELEASE_COUNTRY must be DE or US.");
if (!["draft", "published"].includes(status)) throw new Error("RELEASE_STATUS must be draft or published.");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseInput(value) {
  const trimmed = String(value).trim();
  const prereleaseMatch = trimmed.match(/\/prerelease\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
  if (prereleaseMatch) return { id: prereleaseMatch[1], type: "prerelease", submittedUrl: trimmed };
  const albumMatch = trimmed.match(/\/album\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
  if (albumMatch) return { id: albumMatch[1], type: "album", submittedUrl: trimmed };
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return { id: trimmed, type: "unknown", submittedUrl: null };
  throw new Error("Could not extract a Spotify album or prerelease ID.");
}

function normalizeReleaseDate(value, precision) {
  if (precision === "day") return value;
  if (precision === "month") return `${value}-01`;
  return `${value}-01-01`;
}

function inferKind(album) {
  if (album.album_type === "single") {
    if (album.total_tracks >= 4 && album.total_tracks <= 7) return "ep";
    return "single";
  }
  return "album";
}

function isFutureDate(date) {
  const today = new Date().toISOString().slice(0, 10);
  return date > today;
}

async function getSpotifyToken() {
  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`Spotify token request failed (${response.status}).`);
  return (await response.json()).access_token;
}

async function getSpotifyAlbum(albumId, token) {
  const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}?market=DE`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Spotify album request failed (${response.status}).`);
  return response.json();
}

async function getPrereleaseIdentity(prereleaseId) {
  const url = `https://open.spotify.com/prerelease/${prereleaseId}`;
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 ReleaseFridayBot/1.0" },
  });
  if (!response.ok) throw new Error(`Spotify prerelease page request failed (${response.status}).`);

  const finalAlbumMatch = response.url.match(/\/album\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
  if (finalAlbumMatch) return { albumId: finalAlbumMatch[1], prereleaseUrl: url };

  const html = await response.text();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    || html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const pageTitle = titleMatch?.[1]
    ?.replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .trim();
  const parsed = pageTitle?.match(/^(.*?)\s+-\s+Upcoming (?:Album|Single|EP) by (.*?)\s*\|\s*Spotify$/i);
  if (!parsed) throw new Error("Spotify prerelease metadata could not be resolved.");
  return { title: parsed[1].trim(), artist: parsed[2].trim(), prereleaseUrl: url };
}

async function searchSpotifyAlbum(title, artist, token) {
  const query = `album:${title} artist:${artist}`;
  const response = await fetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: "album", market: "DE", limit: "20" })}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Spotify album search failed (${response.status}).`);
  const items = (await response.json()).albums?.items ?? [];
  const exact = items.find((item) =>
    normalize(item.name) === normalize(title)
    && item.artists?.some((entry) => normalize(entry.name) === normalize(artist)),
  );
  if (!exact) throw new Error(`No matching Spotify album found for ${artist} — ${title}.`);
  return getSpotifyAlbum(exact.id, token);
}

const input = parseInput(spotifyInput);
const token = await getSpotifyToken();
let album = null;
let prereleaseUrl = input.type === "prerelease" ? input.submittedUrl : null;

if (input.type !== "prerelease") album = await getSpotifyAlbum(input.id, token);

if (!album) {
  const prerelease = await getPrereleaseIdentity(input.id);
  prereleaseUrl = input.submittedUrl || prerelease.prereleaseUrl;
  album = prerelease.albumId
    ? await getSpotifyAlbum(prerelease.albumId, token)
    : await searchSpotifyAlbum(prerelease.title, prerelease.artist, token);
}

if (!album) throw new Error("Spotify release metadata could not be loaded.");

const artist = album.artists.map((item) => item.name).join(" & ");
const title = album.name;
const releaseDate = normalizeReleaseDate(album.release_date, album.release_date_precision);
const futureRelease = isFutureDate(releaseDate);
const canonicalAlbumUrl = album.external_urls?.spotify || `https://open.spotify.com/album/${album.id}`;
const submittedUrl = input.submittedUrl || (prereleaseUrl ?? canonicalAlbumUrl);
const spotifyUrl = futureRelease ? null : canonicalAlbumUrl;
const spotifyPreSaveUrl = futureRelease ? submittedUrl : null;
const coverUrl = album.images?.[0]?.url || null;
const kind = inferKind(album);
const genres = [...new Set(album.artists.flatMap((item) => item.genres || []))];
const description = `${artist} veröffentlicht ${kind === "single" ? "die Single" : kind === "ep" ? "die EP" : "das Album"} „${title}“.`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existingRows, error: readError } = await supabase
  .from("releases")
  .select("id,artist,title,release_date,spotify_url,spotify_pre_save_url,status")
  .eq("release_date", releaseDate)
  .limit(50);
if (readError) throw readError;

const duplicate = (existingRows || []).find((row) =>
  row.spotify_url === canonicalAlbumUrl
  || row.spotify_pre_save_url === submittedUrl
  || (normalize(row.artist) === normalize(artist) && normalize(row.title) === normalize(title)),
);

const { data: admins, error: adminError } = await supabase.from("release_admins").select("user_id").limit(1);
if (adminError) throw adminError;
const createdBy = admins?.[0]?.user_id;
if (!createdBy) throw new Error("No release admin is configured in Supabase.");

const row = {
  artist,
  title,
  release_date: releaseDate,
  country,
  kind,
  track_count: album.total_tracks || null,
  cover_url: coverUrl,
  storage_path: null,
  description,
  genres,
  spotify_url: spotifyUrl,
  spotify_pre_save_url: spotifyPreSaveUrl,
  apple_music_url: null,
  youtube_url: null,
  source_url: submittedUrl,
  source: prereleaseUrl ? "Spotify Pre-Release" : "Spotify Web API",
  status,
  created_by: createdBy,
};

if (duplicate) {
  const { data: updated, error: updateError } = await supabase
    .from("releases")
    .update(row)
    .eq("id", duplicate.id)
    .select("id,artist,title,release_date,country,kind,track_count,cover_url,spotify_url,spotify_pre_save_url,status")
    .single();
  if (updateError) throw updateError;
  console.log(JSON.stringify({ result: "updated", spotifyId: input.id, futureRelease, release: updated }, null, 2));
  process.exit(0);
}

const { data: inserted, error: insertError } = await supabase
  .from("releases")
  .insert(row)
  .select("id,artist,title,release_date,country,kind,track_count,cover_url,spotify_url,spotify_pre_save_url,status")
  .single();
if (insertError) throw insertError;

console.log(JSON.stringify({ result: "created", spotifyId: input.id, futureRelease, release: inserted }, null, 2));
