import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_FILE = path.join(ROOT, "lib/releases/real-releases.generated.ts");
const CURATED_FILE = path.join(ROOT, "lib/releases/curated-releases.json");
const TIME_ZONE = "Europe/Berlin";
const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2/release/";
const USER_AGENT = "ReleaseFriday/0.3 (https://github.com/eddijanus-lgtm/Release-Friday)";
const TAGS = ["hip hop", "rap", "trap", "drill", "german hip hop", "deutschrap"];
const COUNTRIES = ["DE", "US"];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function datePartsInBerlin(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
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
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

function mapKind(release) {
  const group = release["release-group"] ?? {};
  const secondaryTypes = group["secondary-types"] ?? [];
  if (secondaryTypes.includes("Mixtape/Street")) return "mixtape";

  const primaryType = String(group["primary-type"] ?? "Single").toLowerCase();
  if (primaryType === "album") return "album";
  if (primaryType === "ep") return "ep";
  return "single";
}

function artistName(release) {
  const credits = release["artist-credit"] ?? [];
  if (!credits.length) return "Unbekannter Artist";
  return credits
    .map((credit) => `${credit.name ?? credit.artist?.name ?? ""}${credit.joinphrase ?? ""}`)
    .join("")
    .trim();
}

function artistCountry(release, fallbackCountry) {
  const country = release["artist-credit"]?.[0]?.artist?.country;
  return country === "DE" || country === "US" ? country : fallbackCountry;
}

function serviceSearchUrls(artist, title) {
  const query = `${artist} ${title}`;
  return {
    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
    appleMusicUrl: `https://music.apple.com/de/search?term=${encodeURIComponent(query)}`,
    youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  };
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
      const releases = payload?.releases ?? [];

      for (const release of releases) {
        const group = release["release-group"] ?? {};
        const primaryType = group["primary-type"];
        if (!["Album", "EP", "Single"].includes(primaryType)) continue;
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
          kind: mapKind(release),
          ...serviceSearchUrls(artist, release.title),
          source: "MusicBrainz",
          _releaseId: release.id,
        });
      }

      await sleep(1100);
    }
  }

  const enriched = [];
  for (const release of collected.values()) {
    const coverUrl = await coverUrlForRelease(release._releaseId);
    const { _releaseId, ...cleanRelease } = release;
    enriched.push(coverUrl ? { ...cleanRelease, coverUrl } : cleanRelease);
    await sleep(250);
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

function mergeReleases(curated, fetched) {
  const merged = new Map();
  for (const release of [...fetched, ...curated]) {
    const key = `${release.artist.toLowerCase()}::${release.title.toLowerCase()}::${release.releaseDate}`;
    merged.set(key, release);
  }
  return sortReleases([...merged.values()]);
}

async function main() {
  const targetDate = process.env.RELEASE_DATE?.trim() || getUpcomingFriday();
  const curated = await loadCurated(targetDate);
  let fetched = [];
  let fetchError = null;

  try {
    fetched = await searchMusicBrainz(targetDate);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : String(error);
    console.error(`MusicBrainz fetch failed: ${fetchError}`);
  }

  const releases = mergeReleases(curated, fetched);
  const generatedAt = new Date().toISOString();
  const content = `// This file is generated by scripts/fetch-releases.mjs.\n// Do not edit it manually.\n\nimport type { MusicRelease } from \"@/types/release\";\n\nexport const releaseDataMetadata = ${JSON.stringify({ targetDate, generatedAt, fetchedCount: fetched.length, curatedCount: curated.length, fetchError }, null, 2)} as const;\n\nexport const realReleases: MusicRelease[] = ${JSON.stringify(releases, null, 2)};\n`;

  await writeFile(OUTPUT_FILE, content, "utf8");
  console.log(`Wrote ${releases.length} releases for ${targetDate}.`);
}

await main();
