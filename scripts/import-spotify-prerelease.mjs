import { createClient } from "@supabase/supabase-js";

const spotifyInput = process.argv[2] || process.env.SPOTIFY_RELEASE;
const country = String(process.env.RELEASE_COUNTRY || "DE").toUpperCase();
const status = String(process.env.RELEASE_STATUS || "published").toLowerCase();
const requestedReleaseDate = String(process.env.RELEASE_DATE || "").trim();
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!spotifyInput) throw new Error("Provide a Spotify prerelease URL.");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials are missing.");
if (!["DE", "US"].includes(country)) throw new Error("RELEASE_COUNTRY must be DE or US.");
if (!["draft", "published"].includes(status)) throw new Error("RELEASE_STATUS must be draft or published.");
if (requestedReleaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedReleaseDate)) {
  throw new Error("RELEASE_DATE must use YYYY-MM-DD.");
}

const prereleaseMatch = String(spotifyInput).match(/\/prerelease\/([A-Za-z0-9]{22})(?:[/?#]|$)/);
if (!prereleaseMatch) throw new Error("Could not extract a Spotify prerelease ID.");

const prereleaseId = prereleaseMatch[1];
const prereleaseUrl = `https://open.spotify.com/prerelease/${prereleaseId}`;
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

function decode(value) {
  return String(value ?? "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseTitle(rawTitle) {
  const clean = decode(rawTitle)
    .replace(/\s*\|\s*Spotify\s*$/i, "")
    .replace(/^Spotify\s*[–—-]\s*/i, "")
    .trim();

  const upcoming = clean.match(/^(.*?)\s+-\s+Upcoming (Album|Single|EP|Mixtape) by (.*?)$/i);
  if (upcoming) {
    return {
      title: upcoming[1].trim(),
      kind: upcoming[2].toLowerCase(),
      artist: upcoming[3].trim(),
    };
  }

  const fallback = clean.match(/^(.*?)\s+(?:-|—)\s+(?:Pre-?save by|by)\s+(.*?)$/i)
    || clean.match(/^Pre-?save (.*?) by (.*?)$/i)
    || clean.match(/^(.*?)\s+by\s+(.*?)$/i);
  if (!fallback) return null;
  return { title: fallback[1].trim(), artist: fallback[2].trim(), kind: "album" };
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const before = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i");
  const after = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i");
  return html.match(before)?.[1] ?? html.match(after)?.[1] ?? null;
}

function extractReleaseDate(html) {
  if (requestedReleaseDate) return requestedReleaseDate;

  const candidates = [];
  const patterns = [
    /["'](?:releaseDate|release_date|releaseDateTime|release_date_time|availableFrom)["']\s*:\s*["'](\d{4}-\d{2}-\d{2})(?:T[^"']*)?["']/gi,
    /(?:releaseDate|release_date|availableFrom)[^0-9]{0,100}(\d{4}-\d{2}-\d{2})/gi,
    /<time[^>]+datetime=["'](\d{4}-\d{2}-\d{2})(?:T[^"']*)?["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) candidates.push(match[1]);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const oldest = new Date(today);
  oldest.setUTCDate(oldest.getUTCDate() - 7);
  const newest = new Date(today);
  newest.setUTCFullYear(newest.getUTCFullYear() + 2);

  const valid = [...new Set(candidates)]
    .map((value) => ({ value, date: new Date(`${value}T00:00:00Z`) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()) && date >= oldest && date <= newest)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return valid.find(({ date }) => date >= today)?.value ?? valid.at(-1)?.value ?? null;
}

async function writeLog(logStatus, message, details = {}) {
  const { error } = await supabase.from("spotify_import_logs").insert({
    spotify_input: prereleaseUrl,
    status: logStatus,
    message,
    details,
  });
  if (error) console.error(`Could not write spotify_import_logs entry: ${error.message}`);
}

async function fetchMetadata() {
  const oembedResponse = await fetch(`https://open.spotify.com/oembed?${new URLSearchParams({ url: prereleaseUrl })}`, {
    headers: { "User-Agent": "Mozilla/5.0 ReleaseFridayBot/1.0" },
  });
  const oembed = oembedResponse.ok ? await oembedResponse.json() : {};

  const pageResponse = await fetch(prereleaseUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36 ReleaseFridayBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!pageResponse.ok) throw new Error(`Spotify prerelease page request failed (${pageResponse.status}).`);
  const html = await pageResponse.text();

  const titleCandidates = [
    oembed.title,
    metaContent(html, "og:title"),
    html.match(/<title>([^<]+)<\/title>/i)?.[1],
  ].filter(Boolean);

  const identity = titleCandidates.map(parseTitle).find(Boolean);
  if (!identity) {
    throw new Error(`Spotify prerelease title could not be resolved: ${decode(titleCandidates[0] || "missing")}`);
  }

  const releaseDate = extractReleaseDate(html);
  if (!releaseDate) {
    throw new Error(
      `Spotify prerelease date could not be resolved for ${identity.artist} — ${identity.title}. `
      + "Add release_date to imports/spotify-release-request.json when Spotify does not expose it.",
    );
  }

  return {
    ...identity,
    releaseDate,
    coverUrl: decode(oembed.thumbnail_url || metaContent(html, "og:image") || "") || null,
    metadataSource: oembed.title ? "oembed+html" : "html",
  };
}

async function run() {
  const metadata = await fetchMetadata();
  const { data: admins, error: adminError } = await supabase.from("release_admins").select("user_id").limit(1);
  if (adminError) throw adminError;
  const createdBy = admins?.[0]?.user_id;
  if (!createdBy) throw new Error("No release admin is configured in Supabase.");

  const { data: existingRows, error: readError } = await supabase
    .from("releases")
    .select("id,artist,title,release_date,spotify_pre_save_url")
    .limit(500);
  if (readError) throw readError;

  const duplicate = (existingRows || []).find((row) =>
    row.spotify_pre_save_url === prereleaseUrl
    || (
      row.release_date === metadata.releaseDate
      && normalize(row.artist) === normalize(metadata.artist)
      && normalize(row.title) === normalize(metadata.title)
    ),
  );

  const row = {
    artist: metadata.artist,
    title: metadata.title,
    release_date: metadata.releaseDate,
    country,
    kind: metadata.kind,
    track_count: null,
    cover_url: metadata.coverUrl,
    storage_path: null,
    description: `${metadata.artist} veröffentlicht ${metadata.kind === "single" ? "die Single" : metadata.kind === "ep" ? "die EP" : "das Album"} „${metadata.title}“.`,
    genres: [],
    spotify_url: null,
    spotify_pre_save_url: prereleaseUrl,
    apple_music_url: null,
    youtube_url: null,
    source_url: prereleaseUrl,
    source: "Spotify Pre-Release",
    status,
    created_by: createdBy,
  };

  if (duplicate) {
    const { data, error } = await supabase.from("releases").update(row).eq("id", duplicate.id).select("*").single();
    if (error) throw error;
    await writeLog("duplicate", `${metadata.artist} — ${metadata.title} updated`, {
      result: "updated",
      metadataSource: metadata.metadataSource,
      release: data,
    });
    console.log(JSON.stringify({ result: "updated", release: data }, null, 2));
    return;
  }

  const { data, error } = await supabase.from("releases").insert(row).select("*").single();
  if (error) throw error;
  await writeLog("created", `${metadata.artist} — ${metadata.title} imported`, {
    result: "created",
    metadataSource: metadata.metadataSource,
    release: data,
  });
  console.log(JSON.stringify({ result: "created", release: data }, null, 2));
}

try {
  await run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeLog("failed", message, {
    country,
    requestedStatus: status,
    requestedReleaseDate: requestedReleaseDate || null,
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.error(message);
  process.exit(1);
}
