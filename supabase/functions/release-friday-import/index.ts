import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.4";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const githubDispatchUrl = "https://api.github.com/repos/eddijanus-lgtm/Release-Friday/actions/workflows/import-spotify-release.yml/dispatches";
const inboxEnrichmentDispatchUrl = "https://api.github.com/repos/eddijanus-lgtm/Release-Friday/actions/workflows/enrich-release-inbox.yml/dispatches";

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

function spotifyInput(value: unknown) {
  if (typeof value !== "string") throw new Error("spotify_release is required");
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") throw new Error("invalid Spotify URL");
  const match = url.pathname.match(/^\/(album|prerelease)\/([A-Za-z0-9]{22})(?:\/|$)/);
  if (!match) throw new Error("only album and prerelease URLs are supported");
  return { type: match[1], id: match[2], url: `https://open.spotify.com/${match[1]}/${match[2]}` };
}

function dateInput(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("release_date must use YYYY-MM-DD");
  return value;
}

function textInput(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("text field must be a string");
  const text = value.trim();
  if (text.length > maxLength) throw new Error("text field is too long");
  return text || null;
}

function httpsUrl(value: unknown, field: string) {
  const text = optionalText(value, 2000);
  if (!text) return null;
  const url = new URL(text);
  if (url.protocol !== "https:") throw new Error(`${field} must use HTTPS`);
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error(`${field} host is not allowed`);
  return url.toString();
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("list field must be an array");
  return [...new Set(value.map((item) => {
    if (typeof item !== "string") throw new Error("list items must be strings");
    return item.trim();
  }).filter(Boolean))].slice(0, maxItems).map((item) => item.slice(0, maxLength));
}

function sourceList(value: unknown, fallbackUrl: string | null, fallbackName: string) {
  const raw = Array.isArray(value) ? value : [];
  const sources = raw.slice(0, 20).map((item) => {
    if (!item || typeof item !== "object") throw new Error("source must be an object");
    const source = item as Record<string, unknown>;
    return {
      name: optionalText(source.name, 120) ?? fallbackName,
      url: httpsUrl(source.url, "source url"),
      type: optionalText(source.type, 60),
    };
  }).filter((source) => source.url);
  if (fallbackUrl && !sources.some((source) => source.url === fallbackUrl)) {
    sources.unshift({ name: fallbackName, url: fallbackUrl, type: "discovery" });
  }
  return sources;
}

function candidateKey(candidate: Record<string, unknown>) {
  const normalize = (value: unknown) => String(value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/\s+(feat\.?|ft\.?|featuring|with|x|&|\+)\s+/gi, "")
    .replace(/[^a-z0-9]+/g, "");
  return `${candidate.release_date}|${normalize(candidate.artist)}|${normalize(candidate.title)}`;
}

function candidateInput(value: unknown, targetDate: string, defaultSource: string) {
  if (!value || typeof value !== "object") throw new Error("candidate must be an object");
  const candidate = value as Record<string, unknown>;
  const country = String(candidate.country ?? "").toUpperCase();
  const kind = String(candidate.kind ?? "").toLowerCase();
  if (!["DE", "US"].includes(country)) throw new Error("candidate country must be DE or US");
  if (!["album", "ep", "single", "mixtape"].includes(kind)) throw new Error("candidate kind is invalid");
  const releaseDate = dateInput(candidate.release_date) ?? targetDate;
  const sourceUrl = httpsUrl(candidate.source_url, "source_url");
  const primarySource = optionalText(candidate.primary_source, 120) ?? defaultSource;
  const coverUrl = httpsUrl(candidate.cover_url, "cover_url");
  const trackCount = candidate.track_count === undefined || candidate.track_count === null || candidate.track_count === ""
    ? null
    : Number(candidate.track_count);
  if (trackCount !== null && (!Number.isInteger(trackCount) || trackCount < 1 || trackCount > 999)) {
    throw new Error("track_count must be an integer between 1 and 999");
  }
  const confidence = String(candidate.confidence ?? "likely").toLowerCase();
  if (!["uncertain", "likely", "confirmed"].includes(confidence)) throw new Error("candidate confidence is invalid");
  const requestedCoverKind = String(candidate.cover_kind ?? (coverUrl ? "official" : "missing")).toLowerCase();
  if (!["official", "artist_fallback", "missing"].includes(requestedCoverKind)) throw new Error("candidate cover_kind is invalid");
  const warningCodes = stringList(candidate.warning_codes, 20, 80);
  if (!coverUrl && !warningCodes.includes("missing_stored_cover")) warningCodes.push("missing_stored_cover");

  return {
    artist: textInput(candidate.artist, "candidate artist", 200),
    title: textInput(candidate.title, "candidate title", 240),
    release_date: releaseDate,
    country,
    kind,
    track_count: trackCount,
    description: optionalText(candidate.description, 5000),
    genres: stringList(candidate.genres, 12, 80),
    spotify_url: httpsUrl(candidate.spotify_url, "spotify_url"),
    spotify_pre_save_url: httpsUrl(candidate.spotify_pre_save_url, "spotify_pre_save_url"),
    apple_music_url: httpsUrl(candidate.apple_music_url, "apple_music_url"),
    youtube_url: httpsUrl(candidate.youtube_url, "youtube_url"),
    source_url: sourceUrl,
    cover_url: coverUrl,
    storage_path: optionalText(candidate.storage_path, 500),
    cover_kind: requestedCoverKind,
    primary_source: primarySource,
    sources: sourceList(candidate.sources, sourceUrl, primarySource),
    confidence,
    warning_codes: warningCodes,
  };
}

function imageFormat(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) {
    return { extension: "png", contentType: "image/png" };
  }
  const signature = new TextDecoder().decode(bytes.slice(0, 16));
  if (signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  if (signature.slice(4, 12) === "ftypavif" || signature.slice(4, 12) === "ftypavis") {
    return { extension: "avif", contentType: "image/avif" };
  }
  throw new Error("cover is not a supported image");
}

async function persistCandidateCover(
  supabase: ReturnType<typeof createClient>,
  candidate: ReturnType<typeof candidateInput>,
  targetDate: string,
) {
  if (!candidate.cover_url || candidate.storage_path) return candidate;
  try {
    const response = await fetch(candidate.cover_url, {
      headers: { "Accept": "image/avif,image/webp,image/png,image/jpeg", "User-Agent": "Release-Friday-Inbox/1.0" },
      redirect: "follow",
    });
    if (!response.ok || !response.body) throw new Error(`cover download failed with HTTP ${response.status}`);
    if (!response.url.startsWith("https://")) throw new Error("cover redirect must use HTTPS");
    const declaredBytes = Number(response.headers.get("content-length") ?? 0);
    if (declaredBytes > 10 * 1024 * 1024) throw new Error("cover exceeds 10 MB");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new Error("cover size is invalid");
    const format = imageFormat(bytes);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const storagePath = `inbox/${targetDate}/${hash.slice(0, 32)}.${format.extension}`;
    const { error } = await supabase.storage
      .from("release-covers")
      .upload(storagePath, new Blob([bytes], { type: format.contentType }), {
        cacheControl: "31536000",
        contentType: format.contentType,
        upsert: false,
      });
    if (error && !/duplicate|already exists/i.test(error.message)) throw error;
    const publicUrl = supabase.storage.from("release-covers").getPublicUrl(storagePath).data.publicUrl;
    return {
      ...candidate,
      cover_url: publicUrl,
      storage_path: storagePath,
      warning_codes: candidate.warning_codes.filter((warning) => warning !== "missing_stored_cover"),
    };
  } catch (error) {
    console.warn(`Cover could not be stored for ${candidate.artist} - ${candidate.title}:`, error);
    return {
      ...candidate,
      storage_path: null,
      warning_codes: [...new Set([...candidate.warning_codes, "missing_stored_cover"])],
    };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function dispatchImport(requestId: string, token: string) {
  const response = await fetch(githubDispatchUrl, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "release-friday-import-action",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: { queue_request_id: requestId },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`GitHub workflow dispatch failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

async function dispatchInboxEnrichment(runId: string, targetDate: string, token: string) {
  const response = await fetch(inboxEnrichmentDispatchUrl, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "release-friday-inbox-enrichment",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        run_id: runId,
        release_date: targetDate,
        allow_artist_image_fallback: "false",
      },
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Inbox enrichment dispatch failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  const configured = Deno.env.get("RELEASE_FRIDAY_ACTION_API_KEY") ?? "";
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || supplied !== configured) return reply(401, { error: "Unauthorized" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const path = new URL(request.url).pathname.replace("/functions/v1/release-friday-import", "") || "/";

  try {
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      return reply(200, {
        status: "ok",
        processing: "release inbox batches plus legacy event-driven Spotify imports",
        github_dispatch_configured: Boolean(Deno.env.get("GITHUB_ACTIONS_TOKEN")),
      });
    }

    if (request.method === "POST" && path === "/inbox/runs") {
      const input = await request.json();
      if (!input || typeof input !== "object") throw new Error("request body must be an object");
      const payload = input as Record<string, unknown>;
      const targetDate = dateInput(payload.target_date);
      if (!targetDate) throw new Error("target_date is required");
      const regionScope = String(payload.region_scope ?? "ALL").toUpperCase();
      if (!["ALL", "DE", "US"].includes(regionScope)) throw new Error("region_scope must be ALL, DE or US");
      const source = optionalText(payload.source, 120) ?? "multi_source_research";
      if (!Array.isArray(payload.candidates) || payload.candidates.length === 0 || payload.candidates.length > 300) {
        throw new Error("candidates must contain between 1 and 300 items");
      }

      const deduplicated = new Map<string, ReturnType<typeof candidateInput>>();
      for (const item of payload.candidates) {
        const candidate = candidateInput(item, targetDate, source);
        const key = candidateKey(candidate);
        const existing = deduplicated.get(key);
        if (!existing) {
          deduplicated.set(key, candidate);
          continue;
        }
        deduplicated.set(key, {
          ...existing,
          ...candidate,
          description: candidate.description ?? existing.description,
          cover_url: candidate.cover_url ?? existing.cover_url,
          storage_path: candidate.storage_path ?? existing.storage_path,
          sources: [...new Map([...existing.sources, ...candidate.sources].map((entry) => [entry.url, entry])).values()],
          warning_codes: [...new Set([...existing.warning_codes, ...candidate.warning_codes])],
        });
      }

      const { data: activeRuns, error: activeError } = await supabase
        .from("release_import_runs")
        .select("*")
        .eq("target_date", targetDate)
        .eq("region_scope", regionScope)
        .in("status", ["collecting", "review", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (activeError) throw activeError;
      let run = activeRuns?.[0] ?? null;
      if (run?.status === "processing") return reply(409, { error: "This inbox run is currently being published. Retry shortly." });
      if (!run) {
        const { data, error } = await supabase
          .from("release_import_runs")
          .insert({ target_date: targetDate, region_scope: regionScope, source, status: "collecting" })
          .select("*")
          .single();
        if (error) throw error;
        run = data;
      }

      const storedCandidates = await mapWithConcurrency(
        [...deduplicated.values()],
        4,
        (candidate) => persistCandidateCover(supabase, candidate, targetDate),
      );
      const { data: ingestResult, error: ingestError } = await supabase.rpc("ingest_release_candidates", {
        p_run_id: run.id,
        p_candidates: storedCandidates,
      });
      if (ingestError) throw ingestError;
      let enrichmentStatus = "not_configured";
      const githubToken = Deno.env.get("GITHUB_ACTIONS_TOKEN") ?? "";
      if (githubToken) {
        try {
          await dispatchInboxEnrichment(run.id, targetDate, githubToken);
          enrichmentStatus = "dispatched";
        } catch (error) {
          enrichmentStatus = "dispatch_failed";
          console.warn(error);
        }
      }

      return reply(202, {
        action: "inbox_ready",
        run_id: run.id,
        target_date: targetDate,
        received: payload.candidates.length,
        deduplicated: storedCandidates.length,
        unresolved_covers: storedCandidates.filter((candidate) => !candidate.storage_path).length,
        enrichment_status: enrichmentStatus,
        result: ingestResult,
        review_url: "https://eddijanus-lgtm.github.io/Release-Friday/admin/",
      });
    }

    const enrichMatch = path.match(/^\/inbox\/runs\/([0-9a-fA-F-]{36})\/enrich$/);
    if (request.method === "POST" && enrichMatch) {
      const { data: run, error } = await supabase
        .from("release_import_runs")
        .select("id,target_date,status")
        .eq("id", enrichMatch[1])
        .maybeSingle();
      if (error) throw error;
      if (!run) return reply(404, { error: "Inbox run not found" });
      if (!["collecting", "review"].includes(run.status)) {
        return reply(409, { error: "Only active Inbox runs can be enriched" });
      }
      const githubToken = Deno.env.get("GITHUB_ACTIONS_TOKEN") ?? "";
      if (!githubToken) return reply(503, { error: "Inbox enrichment is not configured" });
      await dispatchInboxEnrichment(run.id, run.target_date, githubToken);
      return reply(202, {
        action: "inbox_enrichment_dispatched",
        run_id: run.id,
        target_date: run.target_date,
      });
    }

    const inboxMatch = path.match(/^\/inbox\/runs\/([0-9a-fA-F-]{36})$/);
    if (request.method === "GET" && inboxMatch) {
      const [runResult, candidateResult] = await Promise.all([
        supabase.from("release_import_runs").select("*").eq("id", inboxMatch[1]).maybeSingle(),
        supabase.from("release_candidates").select("*").eq("run_id", inboxMatch[1]).order("created_at"),
      ]);
      if (runResult.error) throw runResult.error;
      if (candidateResult.error) throw candidateResult.error;
      if (!runResult.data) return reply(404, { error: "Inbox run not found" });
      return reply(200, { action: "inbox_status", run: runResult.data, candidates: candidateResult.data ?? [] });
    }

    if (request.method === "POST" && path === "/imports") {
      const input = await request.json();
      const spotify = spotifyInput(input.spotify_release);
      const country = String(input.country ?? "").toUpperCase();
      const requestedStatus = String(input.status ?? "published").toLowerCase();
      if (!["DE", "US"].includes(country)) throw new Error("country must be DE or US");
      if (!["draft", "published"].includes(requestedStatus)) throw new Error("status must be draft or published");
      const releaseDate = dateInput(input.release_date);

      for (const field of ["spotify_url", "spotify_pre_save_url", "source_url"]) {
        const { data, error } = await supabase
          .from("releases")
          .select("id,artist,title,release_date,country,kind,status,cover_url,spotify_url,spotify_pre_save_url,source")
          .eq(field, spotify.url)
          .eq("country", country)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) return reply(200, { action: "already_exists", release: data });
      }

      const { data: active, error: activeError } = await supabase
        .from("release_import_requests")
        .select("*")
        .eq("spotify_release", spotify.url)
        .eq("country", country)
        .in("status", ["queued", "processing"])
        .limit(1)
        .maybeSingle();
      if (activeError) throw activeError;
      if (active) return reply(200, { action: "already_queued", request: active });

      const githubToken = Deno.env.get("GITHUB_ACTIONS_TOKEN") ?? "";
      if (!githubToken) {
        return reply(503, { error: "GitHub workflow dispatch is not configured" });
      }

      const { data, error } = await supabase
        .from("release_import_requests")
        .insert({
          spotify_release: spotify.url,
          spotify_id: spotify.id,
          spotify_type: spotify.type,
          country,
          requested_status: requestedStatus,
          release_date: releaseDate,
          status: "queued",
          source: "custom_gpt_action",
        })
        .select("*")
        .single();
      if (error) throw error;

      try {
        await dispatchImport(data.id, githubToken);
      } catch (error) {
        const message = error instanceof Error ? error.message : "GitHub workflow dispatch failed";
        const now = new Date().toISOString();
        await supabase
          .from("release_import_requests")
          .update({ status: "failed", error_message: message.slice(0, 4000), completed_at: now, updated_at: now })
          .eq("id", data.id);
        return reply(502, { error: message, request_id: data.id });
      }

      return reply(202, { action: "dispatched", request: data });
    }

    const match = path.match(/^\/imports\/([0-9a-fA-F-]{36})$/);
    if (request.method === "GET" && match) {
      const { data: item, error } = await supabase
        .from("release_import_requests")
        .select("*")
        .eq("id", match[1])
        .maybeSingle();
      if (error) throw error;
      if (!item) return reply(404, { error: "Import request not found" });
      let release = null;
      if (item.release_id) {
        const result = await supabase
          .from("releases")
          .select("id,artist,title,release_date,country,kind,status,cover_url,spotify_url,spotify_pre_save_url,source")
          .eq("id", item.release_id)
          .maybeSingle();
        if (result.error) throw result.error;
        release = result.data;
      }
      return reply(200, { action: "status", request: item, release });
    }

    return reply(404, { error: "Endpoint not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    return reply(400, { error: message });
  }
});
