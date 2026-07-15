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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function canonicalPrereleaseUrl(id) {
  return `https://open.spotify.com/prerelease/${id}`;
}

function parseInput(value) {
  const trimmed = String(value).trim();
  const prereleaseMatch = trimmed.match(/\/prerelease\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
  if (prereleaseMatch) {
    return {
      id: prereleaseMatch[1],
      type: "prerelease",
      submittedUrl: canonicalPrereleaseUrl(prereleaseMatch[1]),
    };
  }
  const albumMatch = trimmed.match(/\/album\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
  if (albumMatch) return { id: albumMatch[1], type: "album", submittedUrl: `https://open.spotify.com/album/${albumMatch[1]}` };
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

function parsePrereleaseTitle(rawTitle) {
  const title = decodeHtml(rawTitle)
    .replace(/\s*\|\s*Spotify\s*$/i, "")
    .replace(/^Spotify\s*[–—-]\s*/i, "")
    .trim();

  const patterns = [
    /^(.*?)\s+-\s+Upcoming (?:Album|Single|EP|Mixtape) by (.*?)$/i,
    /^(.*?)\s+-\s+Pre-?save by (.*?)$/i,
    /^Pre-?save (.*?) by (.*?)$/i,
    /^(.*?)\s+by\s+(.*?)$/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return { title: match[1].trim(), artist: match[2].trim() };
  }
  return null;
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
  const url = canonicalPrereleaseUrl(prereleaseId);

  const oembedResponse = await fetch(`https://open.spotify.com/oembed?${new URLSearchParams({ url })}`, {
    headers: { "User-Agent": "Mozilla/5.0 ReleaseFridayBot/1.0" },
  });
  if (oembedResponse.ok) {
    const oembed = await oembedResponse.json();
    const parsed = parsePrereleaseTitle(oembed.title);
    if (parsed) return { ...parsed, prereleaseUrl: url, metadataSource: "oembed" };
  }

  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36 ReleaseFridayBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`Spotify prerelease page request failed (${response.status}).`);

  const finalAlbumMatch = response.url.match(/\/album\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
  if (finalAlbumMatch) return { albumId: finalAlbumMatch[1], prereleaseUrl: url, metadataSource: "redirect" };

  const html = await response.text();
  const albumPatterns = [
    /https:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]{22})/i,
    /https:\\u002F\\u002Fopen\.spotify\.com\\u002Falbum\\u002F([A-Za-z0-9]{22})/i,
    /spotify:album:([A-Za-z0-9]{22})/i,
  ];
  for (const pattern of albumPatterns) {
    const match = html.match(pattern);
    if (match) return { albumId: match[1], prereleaseUrl: url, metadataSource: "html-album-id" };
  }

  const titleCandidates = [
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1],
    html.match(/<title>([^<]+)<\/title>/i)?.[1],
    html.match(/["']title["']\s*:\s*["']([^"']+)["']/i)?.[1],
  ].filter(Boolean);

  for (const candidate of titleCandidates) {
    const parsed = parsePrereleaseTitle(candidate);
    if (parsed) return { ...parsed, prereleaseUrl: url, metadataSource: "html-title" };
  }

  throw new Error(`Spotify prerelease metadata could not be resolved. Page title: ${decodeHtml(titleCandidates[0] || "missing")}`);
}

async function searchSpotifyAlbum(title, artist, token) {
  const queries = [
    `album:${title} artist:${artist}`,
    `${title} ${artist}`,
  ];

  for (const query of queries) {
    const params = new URLSearchParams({ q: query, type: "album", market: "DE", limit: "10" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`Spotify album search failed (${response.status}) for ${query}: ${responseBody.slice(0, 300)}`);
    }
    const items = (await response.json()).albums?.items ?? [];
    const exact = items.find((item) =>
      normalize(item.name) === normalize(title)
      && item.artists?.some((entry) => normalize(entry.name) === normalize(artist)),
    );
    if (exact) return getSpotifyAlbum(exact.id, token);
  }

  throw new Error(`No matching Spotify album found for ${artist} — ${title}.`);
}

async function writeImportLog(logStatus, message, details = {}) {
  try {
    await supabase.from("spotify_import_logs").insert({
      spotify_input: spotifyInput,
      status: logStatus,
      message,
      details,
    });
  } catch (logError) {
    console.error("Could not write spotify_import_logs entry:", logError);
  }
}

async function run() {
  const input = parseInput(spotifyInput);
  const token = await getSpotifyToken();
  let album = null;
  let prereleaseUrl = input.type === "prerelease" ? input.submittedUrl : null;
  let prereleaseMetadataSource = null;

  if (input.type !== "prerelease") album = await getSpotifyAlbum(input.id, token);

  if (!album) {
    const prerelease = await getPrereleaseIdentity(input.id);
    prereleaseUrl = input.submittedUrl || prerelease.prereleaseUrl;
    prereleaseMetadataSource = prerelease.metadataSource || null;
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

  let result;
  if (duplicate) {
    const { data: updated, error: updateError } = await supabase
      .from("releases")
      .update(row)
      .eq("id", duplicate.id)
      .select("id,artist,title,release_date,country,kind,track_count,cover_url,spotify_url,spotify_pre_save_url,status")
      .single();
    if (updateError) throw updateError;
    result = { result: "updated", spotifyId: input.id, futureRelease, prereleaseMetadataSource, release: updated };
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("releases")
      .insert(row)
      .select("id,artist,title,release_date,country,kind,track_count,cover_url,spotify_url,spotify_pre_save_url,status")
      .single();
    if (insertError) throw insertError;
    result = { result: "created", spotifyId: input.id, futureRelease, prereleaseMetadataSource, release: inserted };
  }

  await writeImportLog("success", `${artist} — ${title} imported`, result);
  console.log(JSON.stringify(result, null, 2));
}

try {
  await run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeImportLog("failed", message, {
    country,
    requestedStatus: status,
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.error(message);
  process.exit(1);
}
