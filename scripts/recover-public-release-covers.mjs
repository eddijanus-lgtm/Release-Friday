const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const TIME_ZONE = "Europe/Berlin";

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

function currentOrUpcomingFriday(date = new Date()) {
  const { year, month, day } = datePartsInBerlin(date);
  const berlinDay = new Date(Date.UTC(year, month - 1, day));
  const daysUntilFriday = (5 - berlinDay.getUTCDay() + 7) % 7;
  berlinDay.setUTCDate(berlinDay.getUTCDate() + daysUntilFriday);
  return berlinDay.toISOString().slice(0, 10);
}

const RELEASE_DATE = String(process.env.RELEASE_DATE || "").trim() || currentOrUpcomingFriday();
const ITUNES_SEARCH = "https://itunes.apple.com/search";
const REQUEST_INTERVAL_MS = Number(process.env.APPLE_REQUEST_INTERVAL_MS || 1200);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function splitArtists(value) {
  return String(value ?? "")
    .split(/\s*(?:,|&|\bx\b|\bfeat\.?\b|\bft\.?\b)\s*/i)
    .map(compact)
    .filter(Boolean);
}

function artistMatches(expected, candidate) {
  const expectedArtists = splitArtists(expected);
  const candidateArtists = splitArtists(candidate);
  return expectedArtists.length > 0 && candidateArtists.length > 0
    && expectedArtists.some((artist) => candidateArtists.includes(artist));
}

function titleVariants(value) {
  const title = String(value ?? "").replace(/\s+-\s+(single|ep|mixtape)$/i, "").trim();
  const withoutBrackets = title.replace(/\s*[\[(][^\])]+[\])]\s*/g, " ").replace(/\s+/g, " ").trim();
  const slashParts = title.split(/\s*\/\s*/).filter(Boolean);
  return [...new Set([title, withoutBrackets, ...slashParts].map(compact).filter(Boolean))];
}

function titleMatches(expected, ...candidates) {
  const expectedVariants = titleVariants(expected);
  const candidateVariants = candidates.flatMap(titleVariants);
  return expectedVariants.some((expectedTitle) => candidateVariants.includes(expectedTitle));
}

function artworkUrl(value) {
  if (!value) return null;
  return String(value).replace(/\d+x\d+bb/, "1200x1200bb");
}

async function supabase(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response;
}

async function loadCandidates() {
  const params = new URLSearchParams({
    select: "id,artist,title,release_date,country,source",
    release_date: `eq.${RELEASE_DATE}`,
    status: "eq.published",
    source: "ilike.*Spotify artist image fallback*",
    order: "artist.asc",
  });
  const response = await supabase(`releases?${params}`);
  return response.json();
}

async function searchItunes(release) {
  const terms = [
    `${release.artist} ${release.title}`,
    `${release.title} ${release.artist}`,
    `${splitArtists(release.artist)[0] || release.artist} ${release.title}`,
  ];
  const storefronts = [...new Set([String(release.country || "DE").toUpperCase(), "DE", "US"])]
    .filter((country) => country === "DE" || country === "US");

  for (const country of storefronts) {
    for (const term of terms) {
      const url = new URL(ITUNES_SEARCH);
      url.searchParams.set("term", term);
      url.searchParams.set("country", country);
      url.searchParams.set("media", "music");
      url.searchParams.set("entity", "song");
      url.searchParams.set("limit", "200");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`iTunes ${response.status} for ${term}`);
      const payload = await response.json();
      const match = (payload.results || []).find((item) => {
        const date = String(item.releaseDate || "").slice(0, 10);
        return titleMatches(release.title, item.trackName, item.collectionName)
          && artistMatches(release.artist, item.artistName)
          && date === release.release_date
          && artworkUrl(item.artworkUrl100);
      });
      if (match) return { match, country };
      await sleep(REQUEST_INTERVAL_MS);
    }
  }
  return null;
}

async function updateRelease(release, result) {
  const { match, country } = result;
  const body = {
    cover_url: artworkUrl(match.artworkUrl100),
    apple_music_url: match.trackViewUrl || match.collectionViewUrl,
    source: `r/GermanRap + Apple Music ${country}`,
    updated_at: new Date().toISOString(),
  };
  await supabase(`releases?id=eq.${encodeURIComponent(release.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

const candidates = await loadCandidates();
let recovered = 0;
const missing = [];

for (const [index, release] of candidates.entries()) {
  try {
    const result = await searchItunes(release);
    if (!result) {
      missing.push(`${release.artist} — ${release.title}`);
      console.log(`[${index + 1}/${candidates.length}] no exact public match: ${release.artist} — ${release.title}`);
      continue;
    }
    await updateRelease(release, result);
    recovered += 1;
    console.log(`[${index + 1}/${candidates.length}] recovered: ${release.artist} — ${release.title}`);
  } catch (error) {
    missing.push(`${release.artist} — ${release.title}`);
    console.warn(`[${index + 1}/${candidates.length}] failed: ${release.artist} — ${release.title}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await sleep(REQUEST_INTERVAL_MS);
}

console.log(JSON.stringify({ releaseDate: RELEASE_DATE, candidates: candidates.length, recovered, missing }, null, 2));