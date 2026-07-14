import { createClient } from "@supabase/supabase-js";

const inputValue = String(process.argv[2] || process.env.SPOTIFY_RELEASE || "").trim();
const country = String(process.env.RELEASE_COUNTRY || "US").toUpperCase();
const status = String(process.env.RELEASE_STATUS || "published").toLowerCase();
const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!/^[A-Za-z0-9]{22}$|open\.spotify\.com\/(?:album|prerelease)\/[A-Za-z0-9]{22}/.test(inputValue)) throw new Error("Invalid Spotify ID or URL.");
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Import credentials are missing.");

const match = inputValue.match(/\/(album|prerelease)\/([A-Za-z0-9]{22})/) || inputValue.match(/^([A-Za-z0-9]{22})$/);
const explicitType = match?.[1] === "album" || match?.[1] === "prerelease" ? match[1] : "unknown";
const spotifyId = explicitType === "unknown" ? match[1] : match[2];
const prereleaseUrl = `https://open.spotify.com/prerelease/${spotifyId}`;

const clean = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const decode = (value) => String(value || "").replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"');
const nextFriday = () => {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + ((5 - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
};
const meta = (html, key) => {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"));
  return decode(a?.[1] || b?.[1] || "").trim() || null;
};

async function token() {
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!response.ok) throw new Error(`Spotify token failed (${response.status}).`);
  return (await response.json()).access_token;
}

async function album(id, accessToken) {
  const response = await fetch(`https://api.spotify.com/v1/albums/${id}?market=DE`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Spotify album failed (${response.status}).`);
  return response.json();
}

async function prerelease(id) {
  const response = await fetch(`https://open.spotify.com/prerelease/${id}`, { headers: { "User-Agent": "Mozilla/5.0 ReleaseFridayBot/2.0", Accept: "text/html" }, redirect: "follow" });
  if (!response.ok) throw new Error(`Spotify prerelease failed (${response.status}).`);
  const html = await response.text();
  const pageTitle = meta(html, "og:title") || decode(html.match(/<title>([^<]+)<\/title>/i)?.[1]);
  const parsed = pageTitle.match(/^(.*?)\s+-\s+Upcoming\s+(Album|Single|EP)\s+by\s+(.*?)\s*\|\s*Spotify$/i);
  if (!parsed) throw new Error(`Prerelease title could not be parsed: ${pageTitle}`);
  const date = html.match(/["'](?:releaseDate|release_date|datePublished)["']\s*:\s*["'](\d{4}-\d{2}-\d{2})["']/i)?.[1] || nextFriday();
  const tracks = Number(html.match(/["'](?:trackCount|total_tracks|numberOfTracks)["']\s*:\s*(\d+)/i)?.[1] || 0) || null;
  const kind = parsed[2].toLowerCase() === "ep" ? "ep" : parsed[2].toLowerCase();
  return { id, name: decode(parsed[1]).trim(), album_type: kind === "album" ? "album" : "single", kind, release_date: date, total_tracks: tracks, images: meta(html, "og:image") ? [{ url: meta(html, "og:image") }] : [], artists: [{ name: decode(parsed[3]).trim(), genres: [] }], external_urls: {} };
}

const accessToken = await token();
let data = explicitType === "prerelease" ? null : await album(spotifyId, accessToken);
let isPrerelease = explicitType === "prerelease";
if (!data) { data = await prerelease(spotifyId); isPrerelease = true; }

const artist = data.artists.map((item) => item.name).join(" & ");
const title = data.name;
const releaseDate = data.release_date.length === 4 ? `${data.release_date}-01-01` : data.release_date.length === 7 ? `${data.release_date}-01` : data.release_date;
const future = releaseDate > new Date().toISOString().slice(0, 10);
const kind = data.kind || (data.album_type === "single" ? (data.total_tracks >= 4 ? "ep" : "single") : "album");
const canonical = data.external_urls?.spotify || null;
const supplied = inputValue.startsWith("http") ? inputValue : isPrerelease ? prereleaseUrl : canonical;
const preSave = future ? (isPrerelease ? prereleaseUrl : supplied) : null;
const spotify = future ? null : canonical;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: admins, error: adminError } = await supabase.from("release_admins").select("user_id").limit(1);
if (adminError || !admins?.[0]) throw adminError || new Error("No release admin configured.");
const { data: rows, error: readError } = await supabase.from("releases").select("id,artist,title,release_date,spotify_url,spotify_pre_save_url").eq("release_date", releaseDate).limit(50);
if (readError) throw readError;
const duplicate = (rows || []).find((row) => (spotify && row.spotify_url === spotify) || (preSave && row.spotify_pre_save_url === preSave) || (clean(row.artist) === clean(artist) && clean(row.title) === clean(title)));
const row = { artist, title, release_date: releaseDate, country, kind, track_count: data.total_tracks || null, cover_url: data.images?.[0]?.url || null, storage_path: null, description: `${artist} veröffentlicht ${kind === "single" ? "die Single" : kind === "ep" ? "die EP" : "das Album"} „${title}“.`, genres: [...new Set(data.artists.flatMap((item) => item.genres || []))], spotify_url: spotify, spotify_pre_save_url: preSave, apple_music_url: null, youtube_url: null, source_url: supplied || prereleaseUrl, source: isPrerelease ? "Spotify Pre-Release" : "Spotify Web API", status, created_by: admins[0].user_id };
const query = duplicate ? supabase.from("releases").update(row).eq("id", duplicate.id) : supabase.from("releases").insert(row);
const { data: saved, error: saveError } = await query.select("id,artist,title,release_date,country,kind,track_count,cover_url,spotify_url,spotify_pre_save_url,status").single();
if (saveError) throw saveError;
console.log(JSON.stringify({ result: duplicate ? "updated" : "created", spotifyId, isPrerelease, future, release: saved }, null, 2));