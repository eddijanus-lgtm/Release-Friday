import { createClient } from "@supabase/supabase-js";

const spotifyInput = process.argv[2] || process.env.SPOTIFY_RELEASE;
const country = String(process.env.RELEASE_COUNTRY || "DE").toUpperCase();
const status = String(process.env.RELEASE_STATUS || "published").toLowerCase();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!spotifyInput) throw new Error("Provide a Spotify album URL or album ID.");
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) throw new Error("Spotify API credentials are missing.");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials are missing.");
if (!["DE", "US"].includes(country)) throw new Error("RELEASE_COUNTRY must be DE or US.");
if (!["draft", "published"].includes(status)) throw new Error("RELEASE_STATUS must be draft or published.");

function extractAlbumId(value) {
  const trimmed = String(value).trim();
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/album\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
  if (!match) throw new Error("Could not extract a Spotify album ID.");
  return match[1];
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  const data = await response.json();
  return data.access_token;
}

async function getSpotifyAlbum(albumId, token) {
  const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}?market=DE`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Spotify album request failed (${response.status}).`);
  return response.json();
}

const albumId = extractAlbumId(spotifyInput);
const submittedPreSaveUrl = String(spotifyInput).startsWith("http")
  ? String(spotifyInput).trim()
  : `https://open.spotify.com/album/${albumId}`;
const token = await getSpotifyToken();
const album = await getSpotifyAlbum(albumId, token);

const artist = album.artists.map((item) => item.name).join(" & ");
const title = album.name;
const releaseDate = normalizeReleaseDate(album.release_date, album.release_date_precision);
const coverUrl = album.images?.[0]?.url || null;
const kind = inferKind(album);
const genres = [...new Set(album.artists.flatMap((item) => item.genres || []))];
const description = `${artist} veröffentlicht ${kind === "single" ? "die Single" : kind === "ep" ? "die EP" : "das Album"} „${title}“.`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: readError } = await supabase
  .from("releases")
  .select("id,artist,title,release_date,spotify_pre_save_url,status")
  .or(`spotify_pre_save_url.eq.${submittedPreSaveUrl},and(release_date.eq.${releaseDate},artist.ilike.${artist},title.ilike.${title})`)
  .limit(10);

if (readError) throw readError;

const duplicate = (existing || []).find((row) =>
  row.spotify_pre_save_url === submittedPreSaveUrl ||
  (row.release_date === releaseDate && normalize(row.artist) === normalize(artist) && normalize(row.title) === normalize(title)),
);

if (duplicate) {
  console.log(JSON.stringify({ result: "duplicate", release: duplicate }, null, 2));
  process.exit(0);
}

const { data: admins, error: adminError } = await supabase
  .from("release_admins")
  .select("user_id")
  .limit(1);

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
  spotify_url: null,
  spotify_pre_save_url: submittedPreSaveUrl,
  apple_music_url: null,
  youtube_url: null,
  source_url: submittedPreSaveUrl,
  source: "Spotify Web API",
  status,
  created_by: createdBy,
};

const { data: inserted, error: insertError } = await supabase
  .from("releases")
  .insert(row)
  .select("id,artist,title,release_date,country,kind,track_count,cover_url,spotify_pre_save_url,status")
  .single();

if (insertError) throw insertError;

console.log(JSON.stringify({ result: "created", spotifyAlbumId: albumId, release: inserted }, null, 2));