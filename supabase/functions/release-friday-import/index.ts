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
        processing: "event-driven GitHub workflow dispatch",
        github_dispatch_configured: Boolean(Deno.env.get("GITHUB_ACTIONS_TOKEN")),
      });
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
