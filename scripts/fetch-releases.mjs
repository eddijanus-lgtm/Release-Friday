import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_FILE = path.join(ROOT, "lib/releases/real-releases.generated.ts");
const CURATED_FILE = path.join(ROOT, "lib/releases/curated-releases.json");
const TIME_ZONE = "Europe/Berlin";
const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2/release/";
const ITUNES_BASE = "https://itunes.apple.com/search";
const USER_AGENT = "ReleaseFriday/0.4 (https://github.com/eddijanus-lgtm/Release-Friday)";
const TAGS = ["hip hop", "rap", "trap", "drill", "german hip hop", "deutschrap"];
const COUNTRIES = ["DE", "US"];
const APPLE_TERMS = {
  DE: ["deutschrap", "german rap", "hip hop", "rap", "trap"],
  US: ["hip hop", "rap", "trap", "drill"],
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

function getUpcomingFriday() {
  const { year, month, day } = datePartsInBerlin();
  const today = new Date(Date.UTC(year, month - 1, day));
  const weekday = today.getUTCDay();
  let daysUntilFriday = (5 - weekday + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  today.setUTCDate(today.getUTCDate() + daysUntilFriday);
  return today.toISOString().slice(0, 10);
}

async function fetchJson(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1200);
    }
  }
  throw lastError;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  return String(url).replace(/\d+x\d+bb/, "600x600bb");
}

function appleResultToRelease(result, country, targetDate) {
  const artist = result.artistName;
  const title = result.collectionName;
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
      const payload = await fetchJson(url);
      for (const result of payload?.results ?? []) {
        const release = appleResultToRelease(result, country, targetDate);
        if (!release) continue;
        collected.set(`${normalize(release.artist)}::${normalize(release.title)}::${release.releaseDate}`, release);
      }
      await sleep(350);
    }
  }
  return [...collected.values()];
}

async function enrichCuratedWithApple(curated, targetDate) {
  const enriched = [];
  for (const release of curated) {
    try {
      const url = new URL(ITUNES_BASE);
      url.searchParams.set("term", `${release.artist} ${release.title}`);
      url.searchParams.set("country", release.country);
      url.searchParams.set("media", "music");
      url.searchParams.set("entity", "album");
      url.searchParams.set("limit", "25");
      const payload = await fetchJson(url);
      const match = (payload?.results ?? [])
        .map((result) => appleResultToRelease(result, release.country, targetDate))
        .find((candidate) => candidate && normalize(candidate.artist) === normalize(release.artist) && normalize(candidate.title) === normalize(release.title));
      enriched.push(match ? { ...match, ...release, coverUrl: release.coverUrl ?? match.coverUrl, appleMusicUrl: release.appleMusicUrl ?? match.appleMusicUrl, trackCount: release.trackCount ?? match.trackCount, genres: release.genres ?? match.genres } : release);
    } catch {
      enriched.push(release);
    }
    await sleep(300);
  }
  return enriched;
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
    const key = `${normalize(release.artist)}::${normalize(release.title)}::${release.releaseDate}`;
    const current = merged.get(key);
    merged.set(key, current ? { ...current, ...release, coverUrl: release.coverUrl ?? current.coverUrl, trackCount: release.trackCount ?? current.trackCount } : release);
  }
  return sortReleases([...merged.values()]);
}

function countSources(releases) {
  return Object.fromEntries([...releases.reduce((map, release) => map.set(release.source, (map.get(release.source) ?? 0) + 1), new Map()).entries()]);
}

async function main() {
  const requestedDate = String(process.env.RELEASE_DATE ?? "").trim();
  const targetDate = requestedDate || getUpcomingFriday();
  const rawCurated = await loadCurated(targetDate);
  const curated = await enrichCuratedWithApple(rawCurated, targetDate);
  const fetchErrors = [];
  let musicBrainz = [];
  let apple = [];

  try { musicBrainz = await searchMusicBrainz(targetDate); }
  catch (error) { fetchErrors.push(`MusicBrainz: ${error instanceof Error ? error.message : String(error)}`); }

  try { apple = await searchApple(targetDate); }
  catch (error) { fetchErrors.push(`Apple Music: ${error instanceof Error ? error.message : String(error)}`); }

  const releases = mergeReleases(musicBrainz, apple, curated);
  const generatedAt = new Date().toISOString();
  const metadata = {
    targetDate,
    generatedAt,
    fetchedCount: musicBrainz.length + apple.length,
    curatedCount: curated.length,
    fetchError: fetchErrors.length ? fetchErrors.join(" | ") : null,
    sourceCounts: countSources(releases),
  };
  const content = `// This file is generated by scripts/fetch-releases.mjs.\n// Do not edit it manually.\n\nimport type { MusicRelease } from "@/types/release";\n\nexport const releaseDataMetadata = ${JSON.stringify(metadata, null, 2)} as const;\n\nexport const realReleases: MusicRelease[] = ${JSON.stringify(releases, null, 2)};\n`;
  await writeFile(OUTPUT_FILE, content, "utf8");
  console.log(`Wrote ${releases.length} releases for ${targetDate}: ${JSON.stringify(metadata.sourceCounts)}.`);
}

await main();
