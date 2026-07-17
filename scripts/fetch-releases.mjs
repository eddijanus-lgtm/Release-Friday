import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const OUTPUT_FILE = path.join(ROOT, "lib/releases/real-releases.generated.ts");
const CURATED_FILE = path.join(ROOT, "lib/releases/curated-releases.json");
const REDDIT_SOURCE_FILE = path.join(ROOT, "lib/releases/reddit-source.json");
const TIME_ZONE = "Europe/Berlin";
const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2/release/";
const ITUNES_BASE = "https://itunes.apple.com/search";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const USER_AGENT = "ReleaseFriday/0.5 (https://github.com/eddijanus-lgtm/Release-Friday)";
const TAGS = ["hip hop", "rap", "trap", "drill", "german hip hop", "deutschrap"];
const COUNTRIES = ["DE", "US"];
const APPLE_TERMS = {
  DE: ["deutschrap", "german rap", "hip hop", "rap", "trap"],
  US: ["hip hop", "rap", "trap", "drill"],
};
const ROLLING_RELEASE_MARKETS = ["NZ", "AU"];
const APPLE_REQUEST_INTERVAL_MS = Number(process.env.APPLE_REQUEST_INTERVAL_MS || 3200);
const SPOTIFY_REQUEST_INTERVAL_MS = Number(process.env.SPOTIFY_REQUEST_INTERVAL_MS || 6000);
const SPOTIFY_RATE_LIMIT_MAX_WAIT_MS = Number(process.env.SPOTIFY_RATE_LIMIT_MAX_WAIT_MS || 120000);
const MAX_COVER_CANDIDATES = Number(process.env.MAX_COVER_CANDIDATES || 0);
const DISCOVERY_ENABLED = !["1", "true"].includes(String(process.env.SKIP_DISCOVERY || "").toLowerCase());
const REFRESH_ARTIST_IMAGE_COVERS = ["1", "true"].includes(
  String(process.env.REFRESH_ARTIST_IMAGE_COVERS || "").toLowerCase(),
);
const FAST_FAIL_RATE_LIMITS = REFRESH_ARTIST_IMAGE_COVERS;
const MAX_RETRY_WAIT_MS = Number(process.env.MAX_RETRY_WAIT_MS || 15000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SPOTIFY_ARTIST_IMAGE_FALLBACK_REQUESTED = ["1", "true"].includes(
  String(process.env.ALLOW_SPOTIFY_ARTIST_IMAGE_FALLBACK || "").toLowerCase(),
);
const SPOTIFY_ARTIST_IMAGE_SOURCE = "Spotify artist image fallback";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let lastAppleRequestAt = 0;
let lastSpotifyRequestAt = 0;

function responseError(response) {
  const retryAfterSeconds = Number(response.headers.get("retry-after") || 0);
  const retryDetails = response.status === 429
    ? ` (Retry-After: ${retryAfterSeconds > 0 ? `${retryAfterSeconds}s` : "missing"})`
    : "";
  const error = new Error(`${response.status} ${response.statusText}${retryDetails}`);
  error.status = response.status;
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function isSpotifyApiUrl(value) {
  try {
    return new URL(String(value)).hostname === "api.spotify.com";
  } catch {
    return false;
  }
}

function spotifyRateLimitWaitMs(error) {
  const retryAfterSeconds = Number(error?.retryAfterSeconds || 0);
  const waitMs = (retryAfterSeconds > 0 ? retryAfterSeconds : 30) * 1000;
  return waitMs > 0 && waitMs <= SPOTIFY_RATE_LIMIT_MAX_WAIT_MS ? waitMs : 0;
}

async function waitForSpotifyRequestSlot(url) {
  if (!isSpotifyApiUrl(url) || SPOTIFY_REQUEST_INTERVAL_MS <= 0) return;
  const elapsed = Date.now() - lastSpotifyRequestAt;
  const waitMs = Math.max(0, SPOTIFY_REQUEST_INTERVAL_MS - elapsed);
  if (waitMs > 0) await sleep(waitMs);
  lastSpotifyRequestAt = Date.now();
}

function datePartsInBerlin(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function berlinDate(date = new Date()) {
  const { year, month, day } = datePartsInBerlin(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function artistFallbackCutoffOpen(targetDate, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentDate = `${values.year}-${values.month}-${values.day}`;
  const cutoff = new Date(`${targetDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  if (currentDate > cutoffDate) return true;
  if (currentDate < cutoffDate) return false;
  const minutes = Number(values.hour) * 60 + Number(values.minute);
  return minutes >= 18 * 60 + 30;
}

function spotifyArtistImageFallbackEnabled(targetDate, date = new Date()) {
  return SPOTIFY_ARTIST_IMAGE_FALLBACK_REQUESTED || artistFallbackCutoffOpen(targetDate, date);
}

function getCurrentOrUpcomingFriday(date = new Date()) {
  const { year, month, day } = datePartsInBerlin(date);
  const today = new Date(Date.UTC(year, month - 1, day));
  const weekday = today.getUTCDay();
  let daysUntilFriday = (5 - weekday + 7) % 7;
  today.setUTCDate(today.getUTCDate() + daysUntilFriday);
  return today.toISOString().slice(0, 10);
}

function releaseLookupMarkets(targetDate, country, currentBerlinDate = berlinDate()) {
  const rollingMarkets = [...ROLLING_RELEASE_MARKETS];
  return targetDate <= currentBerlinDate
    ? [...new Set([country, ...rollingMarkets])]
    : rollingMarkets;
}

function candidatesNeedingCoverLookup(candidates, storedReleases) {
  if (!Array.isArray(storedReleases)) return candidates;
  const storedByKey = new Map(storedReleases.map((release) => [releaseKey(release), release]));
  return candidates.filter((release) => {
    const stored = storedByKey.get(releaseKey(release));
    return !stored
      || !validCoverUrl(stored.coverUrl)
      || String(stored.source || "").includes(SPOTIFY_ARTIST_IMAGE_SOURCE);
  });
}

function storedRowToRelease(row) {
  return {
    artist: row.artist,
    title: row.title,
    releaseDate: row.release_date,
    country: row.country,
    kind: row.kind,
    coverUrl: row.cover_url,
    spotifyUrl: row.spotify_url ?? undefined,
    spotifyPreSaveUrl: row.spotify_pre_save_url ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    description: row.description ?? undefined,
    trackCount: row.track_count ?? undefined,
    genres: row.genres ?? [],
    source: row.source || "Supabase",
  };
}

async function loadStoredReleases(targetDate) {
  if (!REFRESH_ARTIST_IMAGE_COVERS || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const url = new URL(`${SUPABASE_URL}/rest/v1/releases`);
  url.searchParams.set("select", "artist,title,release_date,country,kind,cover_url,spotify_url,spotify_pre_save_url,apple_music_url,youtube_url,source_url,description,track_count,genres,source");
  url.searchParams.set("release_date", `eq.${targetDate}`);
  url.searchParams.set("status", "eq.published");
  const response = await fetchResponse(url, {
    headers: {
      Accept: "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }, 2);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Supabase returned an invalid release payload.");
  return rows.map(storedRowToRelease);
}

async function fetchResponse(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForSpotifyRequestSlot(url);
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": USER_AGENT,
          ...options.headers,
        },
      });
      if (response.status === 404) return response;
      if (response.status === 429 || response.status >= 500) {
        const requestError = responseError(response);
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        if (response.status === 429 && FAST_FAIL_RATE_LIMITS) {
          const spotifyWaitMs = isSpotifyApiUrl(url) ? spotifyRateLimitWaitMs(requestError) : 0;
          if (attempt < attempts && spotifyWaitMs > 0) {
            console.warn(`Spotify rate limit reached; retrying in ${Math.ceil(spotifyWaitMs / 1000)} second(s).`);
            await sleep(spotifyWaitMs);
            lastError = requestError;
            continue;
          }
          throw requestError;
        }
        const requestedWaitMs = retryAfter > 0 ? retryAfter * 1000 : attempt * 3000;
        const waitMs = Math.min(requestedWaitMs, MAX_RETRY_WAIT_MS);
        if (attempt < attempts) {
          await sleep(waitMs);
          continue;
        }
      }
      if (!response.ok) throw responseError(response);
      return response;
    } catch (error) {
      if (FAST_FAIL_RATE_LIMITS && error?.status === 429) throw error;
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 2500);
    }
  }
  throw lastError ?? new Error(`Request failed for ${url}`);
}

async function fetchJson(url, attempts = 4) {
  const response = await fetchResponse(url, { headers: { Accept: "application/json" } }, attempts);
  if (response.status === 404) return null;
  return response.json();
}

async function fetchText(url, attempts = 4) {
  const response = await fetchResponse(url, { headers: { Accept: "application/atom+xml,text/html;q=0.9" } }, attempts);
  if (response.status === 404) return null;
  return response.text();
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value) {
  return normalize(value).replace(/\s+/g, "");
}

function releaseKey(release) {
  return `${normalize(release.artist)}::${normalize(release.title)}::${release.releaseDate}`;
}

function stripReleaseSuffix(value) {
  return String(value ?? "")
    .replace(/\s+-\s+(single|ep|mixtape)$/i, "")
    .trim();
}

function splitArtists(value) {
  return String(value ?? "")
    .split(/\s*(?:,|&|\bx\b|\bfeat\.?\b|\bft\.?\b)\s*/i)
    .map((artist) => compact(artist))
    .filter(Boolean);
}

function primaryArtistName(value) {
  return String(value ?? "")
    .split(/\s*(?:,|&|\bx\b|\bfeat\.?\b|\bft\.?\b)\s*/i)[0]
    ?.trim() ?? "";
}

function artistMatches(expectedArtist, candidateArtists) {
  const expected = splitArtists(expectedArtist);
  const candidates = candidateArtists.flatMap((artist) => splitArtists(artist));
  return expected.length > 0 && candidates.length > 0 && expected.some((artist) => candidates.includes(artist));
}

function titleMatches(expectedTitle, ...candidateTitles) {
  const expected = titleVariants(expectedTitle).map(compact).filter(Boolean);
  const candidates = candidateTitles.flatMap((title) => titleVariants(stripReleaseSuffix(title))).map(compact).filter(Boolean);
  return expected.length > 0 && candidates.some((candidate) =>
    expected.some((expectedTitleVariant) => candidate === expectedTitleVariant),
  );
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function titleVariants(value) {
  const title = stripReleaseSuffix(value);
  const withoutParentheses = title.replace(/\s*[\[(][^\])]+[\])]\s*/g, " ").replace(/\s+/g, " ").trim();
  const withoutFeaturing = withoutParentheses
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const slashParts = title.split(/\s*\/\s*/).filter(Boolean);
  return uniqueValues([
    title,
    withoutParentheses,
    withoutFeaturing,
    ...slashParts,
    ...slashParts.map((part) => part.replace(/\s*[\[(][^\])]+[\])]\s*/g, " ").trim()),
  ]);
}

function artistQueryVariants(artist) {
  const primary = primaryArtistName(artist);
  return uniqueValues([primary, artist]);
}

function releaseQueryVariants(release) {
  const artists = artistQueryVariants(release.artist);
  const titles = titleVariants(release.title);
  return uniqueValues(artists.flatMap((artist) =>
    titles.flatMap((title) => [
      `track:${title} artist:${artist}`,
      `${artist} ${title}`,
      `${title} ${artist}`,
    ]),
  ));
}

function dateSupportsCandidate(candidateDate, targetDate) {
  const candidate = String(candidateDate ?? "").slice(0, 10);
  if (!candidate) return true;
  if (candidate < targetDate) return false;
  const latest = new Date(`${targetDate}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + 180);
  return candidate <= latest.toISOString().slice(0, 10);
}

function validCoverUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) && !url.pathname.includes("/search/");
  } catch {
    return false;
  }
}

function serviceSearchUrls(artist, title) {
  const query = `${artist} ${title}`;
  return {
    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
    appleMusicUrl: `https://music.apple.com/de/search?term=${encodeURIComponent(query)}`,
    youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  };
}

function mapMusicBrainzKind(release) {
  const group = release["release-group"] ?? {};
  const secondaryTypes = group["secondary-types"] ?? [];
  if (secondaryTypes.includes("Mixtape/Street")) return "mixtape";
  const primaryType = String(group["primary-type"] ?? "Single").toLowerCase();
  if (primaryType === "album") return "album";
  if (primaryType === "ep") return "ep";
  return "single";
}

function mapAppleKind(result) {
  const title = String(result.collectionName ?? "").toLowerCase();
  if (title.includes("mixtape")) return "mixtape";
  if (title.includes(" - ep") || title.endsWith(" ep")) return "ep";
  if (Number(result.trackCount) === 1 || title.includes(" - single") || title.endsWith(" single")) return "single";
  return "album";
}

function artistName(release) {
  const credits = release["artist-credit"] ?? [];
  if (!credits.length) return "Unbekannter Artist";
  return credits.map((credit) => `${credit.name ?? credit.artist?.name ?? ""}${credit.joinphrase ?? ""}`).join("").trim();
}

function artistCountry(release, fallbackCountry) {
  const country = release["artist-credit"]?.[0]?.artist?.country;
  return country === "DE" || country === "US" ? country : fallbackCountry;
}

async function coverUrlForRelease(releaseId) {
  try {
    const data = await fetchJson(`https://coverartarchive.org/release/${releaseId}`);
    const image = data?.images?.find((candidate) => candidate.front) ?? data?.images?.[0];
    return image?.thumbnails?.["500"] ?? image?.thumbnails?.large ?? image?.image;
  } catch {
    return undefined;
  }
}

async function searchMusicBrainz(targetDate) {
  const collected = new Map();
  for (const country of COUNTRIES) {
    for (const tag of TAGS) {
      const query = `date:${targetDate} AND status:official AND country:${country} AND tag:"${tag}"`;
      const url = new URL(MUSICBRAINZ_BASE);
      url.searchParams.set("query", query);
      url.searchParams.set("fmt", "json");
      url.searchParams.set("limit", "100");
      const payload = await fetchJson(url);
      for (const release of payload?.releases ?? []) {
        const group = release["release-group"] ?? {};
        if (!["Album", "EP", "Single"].includes(group["primary-type"])) continue;
        if (release.date !== targetDate) continue;
        const key = group.id ?? release.id;
        if (collected.has(key)) continue;
        const artist = artistName(release);
        collected.set(key, {
          id: `mb-${key}`,
          title: release.title,
          artist,
          releaseDate: targetDate,
          country: artistCountry(release, country),
          kind: mapMusicBrainzKind(release),
          ...serviceSearchUrls(artist, release.title),
          sourceUrl: `https://musicbrainz.org/release/${release.id}`,
          source: "MusicBrainz",
          _releaseId: release.id,
        });
      }
      await sleep(1050);
    }
  }

  const enriched = [];
  for (const release of collected.values()) {
    const coverUrl = await coverUrlForRelease(release._releaseId);
    const { _releaseId, ...cleanRelease } = release;
    enriched.push(coverUrl ? { ...cleanRelease, coverUrl } : cleanRelease);
    await sleep(220);
  }
  return enriched;
}

function appleArtwork(url) {
  if (!url) return undefined;
  return String(url).replace(/\d+x\d+bb/, "1200x1200bb");
}

async function waitForAppleRateLimit() {
  const waitMs = Math.max(0, lastAppleRequestAt + APPLE_REQUEST_INTERVAL_MS - Date.now());
  if (waitMs > 0) await sleep(waitMs);
  lastAppleRequestAt = Date.now();
}

async function fetchAppleSearch(url) {
  await waitForAppleRateLimit();
  return fetchJson(url);
}

function appleResultToRelease(result, country, targetDate) {
  const artist = result.artistName;
  const title = stripReleaseSuffix(result.collectionName);
  if (!artist || !title) return null;
  const genre = String(result.primaryGenreName ?? "");
  if (!/(hip.?hop|rap|trap|drill)/i.test(genre)) return null;
  const releaseDate = String(result.releaseDate ?? "").slice(0, 10);
  if (releaseDate !== targetDate) return null;
  return {
    id: `apple-${result.collectionId}`,
    title,
    artist,
    releaseDate: targetDate,
    country,
    kind: mapAppleKind(result),
    coverUrl: appleArtwork(result.artworkUrl100),
    spotifyUrl: serviceSearchUrls(artist, title).spotifyUrl,
    appleMusicUrl: result.collectionViewUrl ?? serviceSearchUrls(artist, title).appleMusicUrl,
    youtubeUrl: serviceSearchUrls(artist, title).youtubeUrl,
    sourceUrl: result.collectionViewUrl,
    description: `${artist} veröffentlicht ${mapAppleKind(result) === "single" ? "eine neue Single" : "ein neues Projekt"} am kommenden Freitag.`,
    trackCount: Number(result.trackCount) || undefined,
    genres: genre ? [genre] : undefined,
    source: "Apple Music",
  };
}

async function searchApple(targetDate) {
  const collected = new Map();
  for (const country of COUNTRIES) {
    for (const term of APPLE_TERMS[country]) {
      const url = new URL(ITUNES_BASE);
      url.searchParams.set("term", term);
      url.searchParams.set("country", country);
      url.searchParams.set("media", "music");
      url.searchParams.set("entity", "album");
      url.searchParams.set("limit", "200");
      const payload = await fetchAppleSearch(url);
      for (const result of payload?.results ?? []) {
        const release = appleResultToRelease(result, country, targetDate);
        if (!release || !validCoverUrl(release.coverUrl)) continue;
        collected.set(releaseKey(release), release);
      }
    }
  }
  return [...collected.values()];
}

function decodeEntities(value) {
  let decoded = String(value ?? "");
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;|&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }
  return decoded;
}

function plainText(value) {
  return decodeEntities(String(value ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function targetDateLabel(targetDate) {
  const [year, month, day] = targetDate.split("-");
  return `${day}.${month}.${year}`;
}

function redditRssUrl(postUrl) {
  const url = new URL(postUrl);
  url.search = "";
  url.hash = "";
  url.pathname = `${url.pathname.replace(/\/?$/, "/")}.rss`;
  url.searchParams.set("raw_json", "1");
  return url.toString();
}

function parseAtomEntries(xml) {
  return [...String(xml ?? "").matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const entry = match[1];
    const title = plainText(entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    const content = decodeEntities(entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1]);
    const linkTags = [...entry.matchAll(/<link\b[^>]*>/gi)].map((candidate) => candidate[0]);
    const alternateTag = linkTags.find((candidate) => /\brel=["']alternate["']/i.test(candidate))
      ?? linkTags.find((candidate) => /\bhref=["']/i.test(candidate));
    const alternate = decodeEntities(alternateTag?.match(/\bhref=["']([^"']+)/i)?.[1]);
    return { title, content, url: alternate };
  });
}

function parseRedditSingles(entry, targetDate, configuredSourceUrl) {
  const marker = entry.content.match(/<p><strong>Singles<\/strong><\/p>/i);
  if (!marker) return [];
  const remainder = entry.content.slice((marker.index ?? 0) + marker[0].length);
  const table = remainder.match(/<table>([\s\S]*?)<\/table>/i)?.[1] ?? "";
  const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? table;
  const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  const sourceUrl = entry.url || configuredSourceUrl || "https://www.reddit.com/r/GermanRap/";

  return rows.flatMap((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => plainText(cell[1]));
    const [artist, title, info = ""] = cells;
    if (!artist || !title || /bereits erschienen/i.test(info)) return [];
    const digest = createHash("sha256").update(`${artist}\n${title}\n${targetDate}`).digest("hex").slice(0, 16);
    return [{
      id: `reddit-${digest}`,
      artist,
      title,
      releaseDate: targetDate,
      country: "DE",
      kind: "single",
      sourceUrl,
      description: `${artist} veröffentlicht die Single „${title}“.`,
      genres: ["Deutschrap", "Hip-Hop/Rap"],
      source: "r/GermanRap",
    }];
  });
}

async function loadRedditCandidates(targetDate) {
  let config;
  try {
    config = JSON.parse(await readFile(REDDIT_SOURCE_FILE, "utf8"));
  } catch {
    return [];
  }

  const expectedTitle = `Die Releases am ${targetDateLabel(targetDate)}`;
  const fallbackMatches = config.fallbackReleaseDate === targetDate && config.fallbackPostUrl;
  const sourceUrl = fallbackMatches
    ? redditRssUrl(config.fallbackPostUrl)
    : `https://www.reddit.com/r/${encodeURIComponent(config.subreddit || "GermanRap")}/new/.rss?limit=25`;
  const xml = await fetchText(sourceUrl);
  const entries = parseAtomEntries(xml);
  const entry = entries.find((candidate) => normalize(candidate.title).includes(normalize(expectedTitle)))
    ?? (fallbackMatches ? entries[0] : null);
  if (!entry) throw new Error(`Reddit release post was not found for ${targetDate}.`);
  const releases = parseRedditSingles(entry, targetDate, fallbackMatches ? config.fallbackPostUrl : null);
  if (releases.length === 0) throw new Error(`Reddit release post contained no parseable singles for ${targetDate}.`);
  return releases;
}

async function getSpotifyToken() {
  const clientId = String(process.env.SPOTIFY_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.SPOTIFY_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchResponse("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  return (await response.json()).access_token;
}

function spotifyItemMatch(item, release, targetDate) {
  const artists = item.artists ?? item.album?.artists ?? [];
  const candidateDate = item.release_date ?? item.album?.release_date;
  return titleMatches(release.title, item.name)
    && artistMatches(release.artist, artists.map((artist) => artist.name))
    && dateSupportsCandidate(candidateDate, targetDate);
}

async function searchSpotifyForRelease(release, targetDate, accessToken) {
  if (!accessToken) return null;
  const markets = releaseLookupMarkets(targetDate, release.country);
  const queries = releaseQueryVariants(release).slice(0, 8);

  for (const market of markets) {
    for (const query of queries) {
      const url = new URL(`${SPOTIFY_API_BASE}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("type", "track,album");
      url.searchParams.set("market", market);
      url.searchParams.set("limit", "20");
      const response = await fetchResponse(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
      const payload = await response.json();
      const track = (payload.tracks?.items ?? []).find((item) => spotifyItemMatch(item, release, targetDate));
      const album = (payload.albums?.items ?? []).find((item) => spotifyItemMatch(item, release, targetDate));
      const item = track ?? album;
      const artwork = track?.album?.images?.[0]?.url ?? album?.images?.[0]?.url;
      if (!item || !validCoverUrl(artwork)) continue;
      return {
        ...release,
        coverUrl: artwork,
        spotifyUrl: item.external_urls?.spotify,
        source: `${release.source} + Spotify ${market}`,
      };
    }
  }
  return null;
}

async function searchSpotifyArtistImage(release, accessToken, fallbackEnabled = SPOTIFY_ARTIST_IMAGE_FALLBACK_REQUESTED) {
  if (!fallbackEnabled || !accessToken) return null;
  if (release.kind !== "single" || release.source !== "r/GermanRap") return null;

  const primaryArtist = primaryArtistName(release.artist);
  if (!primaryArtist) return null;
  const url = new URL(`${SPOTIFY_API_BASE}/search`);
  url.searchParams.set("q", `artist:${primaryArtist}`);
  url.searchParams.set("type", "artist");
  url.searchParams.set("limit", "10");
  const response = await fetchResponse(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const payload = await response.json();
  const artist = (payload.artists?.items ?? []).find((candidate) =>
    compact(candidate.name) === compact(primaryArtist)
    && validCoverUrl(candidate.images?.[0]?.url)
    && validCoverUrl(candidate.external_urls?.spotify),
  );
  if (!artist) return null;

  return {
    ...release,
    coverUrl: artist.images[0].url,
    // The artist URL verifies the matched profile, but it is not a release URL.
    // Keep spotifyUrl empty so the UI can use its normal release-search fallback.
    spotifyUrl: undefined,
    description: release.description,
    source: `${release.source} + ${SPOTIFY_ARTIST_IMAGE_SOURCE}`,
  };
}

async function searchAppleForRelease(release, targetDate) {
  const storefronts = releaseLookupMarkets(targetDate, release.country);
  const queries = releaseQueryVariants(release).filter((query) => !query.includes(":")).slice(0, 4);

  for (const storefront of storefronts) {
    for (const query of queries) {
      const url = new URL(ITUNES_BASE);
      url.searchParams.set("term", query);
      url.searchParams.set("country", storefront);
      url.searchParams.set("media", "music");
      url.searchParams.set("entity", "song");
      url.searchParams.set("limit", "50");
      const payload = await fetchAppleSearch(url);
      const match = (payload?.results ?? []).find((result) =>
        titleMatches(release.title, result.trackName, result.collectionName)
        && artistMatches(release.artist, [result.artistName])
        && dateSupportsCandidate(result.releaseDate, targetDate)
        && validCoverUrl(result.artworkUrl100),
      );
      if (!match) continue;
      return {
        ...release,
        coverUrl: appleArtwork(match.artworkUrl100),
        appleMusicUrl: match.trackViewUrl ?? match.collectionViewUrl,
        trackCount: release.trackCount ?? 1,
        source: `${release.source} + Apple Music ${storefront}`,
      };
    }
  }
  return null;
}

async function enrichCandidatesWithCovers(candidates, targetDate) {
  let accessToken = null;
  try {
    accessToken = await getSpotifyToken();
  } catch (error) {
    console.warn(`Spotify authentication unavailable for this run: ${error instanceof Error ? error.message : String(error)}`);
  }
  let spotifyLookupAvailable = Boolean(accessToken);
  const artistImageFallbackEnabled = spotifyArtistImageFallbackEnabled(targetDate);
  const selected = MAX_COVER_CANDIDATES > 0 ? candidates.slice(0, MAX_COVER_CANDIDATES) : candidates;
  const qualified = [];
  const missing = [];

  for (const [index, release] of selected.entries()) {
    if (validCoverUrl(release.coverUrl)) {
      qualified.push(release);
      continue;
    }

    let resolved = null;
    if (spotifyLookupAvailable) {
      try {
        resolved = await searchSpotifyForRelease(release, targetDate, accessToken);
      } catch (error) {
        if (error?.status === 429) {
          spotifyLookupAvailable = false;
          console.warn("Spotify rate limit reached; using Apple Music for the remaining cover lookups.");
        }
        console.warn(`Spotify cover lookup failed for ${release.artist} — ${release.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!resolved) {
      try {
        resolved = await searchAppleForRelease(release, targetDate);
      } catch (error) {
        console.warn(`Apple cover lookup failed for ${release.artist} — ${release.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!resolved && spotifyLookupAvailable) {
      try {
        resolved = await searchSpotifyArtistImage(release, accessToken, artistImageFallbackEnabled);
      } catch (error) {
        if (error?.status === 429) {
          spotifyLookupAvailable = false;
          console.warn("Spotify rate limit reached; skipping further artist-image lookups in this run.");
        }
        console.warn(`Spotify artist image lookup failed for ${release.artist}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (resolved && validCoverUrl(resolved.coverUrl)) qualified.push(resolved);
    else missing.push(release);
    const resolution = !resolved
      ? "missing"
      : resolved.source.includes(SPOTIFY_ARTIST_IMAGE_SOURCE) ? "artist-image" : "release-cover";
    console.log(`Cover lookup ${index + 1}/${selected.length}: ${release.artist} — ${release.title} [${resolution}]`);
  }

  if (selected.length < candidates.length) missing.push(...candidates.slice(selected.length));
  return { qualified, missing, spotifyEnabled: spotifyLookupAvailable, artistImageFallbackEnabled };
}

async function loadCurated(targetDate) {
  try {
    const payload = JSON.parse(await readFile(CURATED_FILE, "utf8"));
    return (payload.releases ?? []).filter((release) => release.releaseDate === targetDate);
  } catch {
    return [];
  }
}

function sortReleases(releases) {
  const kindRank = { album: 0, mixtape: 1, ep: 2, single: 3 };
  return releases.sort((left, right) => {
    if (left.country !== right.country) return left.country === "DE" ? -1 : 1;
    if (left.kind !== right.kind) return kindRank[left.kind] - kindRank[right.kind];
    return `${left.artist} ${left.title}`.localeCompare(`${right.artist} ${right.title}`, "de");
  });
}

function mergeReleases(...groups) {
  const merged = new Map();
  for (const release of groups.flat()) {
    const key = releaseKey(release);
    const current = merged.get(key);
    merged.set(key, current ? {
      ...current,
      ...release,
      coverUrl: release.coverUrl ?? current.coverUrl,
      trackCount: release.trackCount ?? current.trackCount,
    } : release);
  }
  return sortReleases([...merged.values()]);
}

function countSources(releases) {
  return Object.fromEntries([...releases.reduce((map, release) => map.set(release.source, (map.get(release.source) ?? 0) + 1), new Map()).entries()]);
}

async function main() {
  const requestedDate = String(process.env.RELEASE_DATE ?? "").trim();
  const targetDate = requestedDate || getCurrentOrUpcomingFriday();
  const fetchErrors = [];
  const rawCurated = await loadCurated(targetDate);
  let reddit = [];
  let musicBrainz = [];
  let apple = [];
  let storedReleases = null;

  try { reddit = await loadRedditCandidates(targetDate); }
  catch (error) { fetchErrors.push(`Reddit: ${error instanceof Error ? error.message : String(error)}`); }

  const candidates = mergeReleases(rawCurated, reddit);
  try { storedReleases = await loadStoredReleases(targetDate); }
  catch (error) { fetchErrors.push(`Supabase refresh state: ${error instanceof Error ? error.message : String(error)}`); }
  const coverLookupCandidates = candidatesNeedingCoverLookup(candidates, storedReleases);
  const coverResolution = await enrichCandidatesWithCovers(coverLookupCandidates, targetDate);

  if (DISCOVERY_ENABLED) {
    try { musicBrainz = await searchMusicBrainz(targetDate); }
    catch (error) { fetchErrors.push(`MusicBrainz: ${error instanceof Error ? error.message : String(error)}`); }

    try { apple = await searchApple(targetDate); }
    catch (error) { fetchErrors.push(`Apple Music: ${error instanceof Error ? error.message : String(error)}`); }
  }

  const merged = mergeReleases(storedReleases ?? [], musicBrainz, apple, coverResolution.qualified);
  const releases = merged.filter((release) => validCoverUrl(release.coverUrl));
  const qualifiedKeys = new Set(releases.map(releaseKey));
  const missingCovers = candidates
    .filter((release) => !qualifiedKeys.has(releaseKey(release)))
    .map((release) => ({ artist: release.artist, title: release.title, sourceUrl: release.sourceUrl ?? null }));
  const generatedAt = new Date().toISOString();
  const metadata = {
    targetDate,
    generatedAt,
    coverRequired: true,
    spotifyCoverLookupEnabled: coverResolution.spotifyEnabled,
    spotifyArtistImageFallbackEnabled: coverResolution.artistImageFallbackEnabled,
    spotifyArtistImageFallbackCount: releases.filter((release) => release.source.includes(SPOTIFY_ARTIST_IMAGE_SOURCE)).length,
    fetchedCount: musicBrainz.length + apple.length,
    curatedCount: rawCurated.length,
    redditSingleCount: reddit.length,
    candidateCount: candidates.length,
    storedReleaseCount: storedReleases?.length ?? 0,
    coverLookupCandidateCount: coverLookupCandidates.length,
    coverQualifiedCount: releases.length,
    skippedMissingCoverCount: missingCovers.length,
    missingCovers,
    fetchError: fetchErrors.length ? fetchErrors.join(" | ") : null,
    sourceCounts: countSources(releases),
  };
  const content = `// This file is generated by scripts/fetch-releases.mjs.\n// Do not edit it manually.\n\nimport type { MusicRelease } from "@/types/release";\n\nexport const releaseDataMetadata = ${JSON.stringify(metadata, null, 2)} as const;\n\nexport const realReleases: MusicRelease[] = ${JSON.stringify(releases, null, 2)};\n`;
  await writeFile(OUTPUT_FILE, content, "utf8");
  console.log(`Wrote ${releases.length} cover-qualified releases for ${targetDate}; skipped ${missingCovers.length} candidate(s) without a verified cover.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) await main();

export { artistFallbackCutoffOpen, candidatesNeedingCoverLookup, getCurrentOrUpcomingFriday, loadStoredReleases, primaryArtistName, releaseLookupMarkets, searchSpotifyArtistImage, spotifyRateLimitWaitMs };
