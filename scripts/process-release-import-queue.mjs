import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const batchSize = Math.max(1, Math.min(Number(process.env.IMPORT_QUEUE_BATCH_SIZE || 5), 10));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase queue credentials are missing.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function runNodeScript(script, spotifyRelease, request) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, spotifyRelease], {
      env: {
        ...process.env,
        RELEASE_COUNTRY: request.country,
        RELEASE_STATUS: request.requested_status,
        RELEASE_DATE: request.release_date || "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-200_000);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-200_000);
      process.stderr.write(chunk);
    });
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function claimNextRequest() {
  const { data: candidate, error: selectError } = await supabase
    .from("release_import_requests")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!candidate) return null;

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("release_import_requests")
    .update({ status: "processing", started_at: now, updated_at: now, error_message: null })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (claimError) throw claimError;
  return claimed;
}

async function findImportedRelease(request) {
  const fields = ["spotify_url", "spotify_pre_save_url", "source_url"];
  for (const field of fields) {
    const { data, error } = await supabase
      .from("releases")
      .select("id,artist,title,release_date,country,kind,status,cover_url,spotify_url,spotify_pre_save_url,source")
      .eq(field, request.spotify_release)
      .eq("country", request.country)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

async function completeRequest(request, release) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("release_import_requests")
    .update({
      status: "completed",
      release_id: release.id,
      completed_at: now,
      updated_at: now,
      error_message: null,
    })
    .eq("id", request.id);
  if (error) throw error;
}

async function failRequest(request, message) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("release_import_requests")
    .update({
      status: "failed",
      completed_at: now,
      updated_at: now,
      error_message: String(message || "Import failed").slice(0, 4000),
    })
    .eq("id", request.id);
  if (error) throw error;
}

let processed = 0;
let failed = 0;

for (let index = 0; index < batchSize; index += 1) {
  const request = await claimNextRequest();
  if (!request) break;

  processed += 1;
  console.log(`Processing queued Spotify import ${request.id}: ${request.spotify_release} (${request.country})`);

  const script = request.spotify_type === "prerelease"
    ? "scripts/import-spotify-prerelease.mjs"
    : "scripts/import-spotify-release.mjs";
  const result = await runNodeScript(script, request.spotify_release, request);

  if (result.code !== 0) {
    failed += 1;
    await failRequest(request, result.stderr.trim() || result.stdout.trim() || `Importer exited with code ${result.code}`);
    continue;
  }

  const release = await findImportedRelease(request);
  if (!release) {
    failed += 1;
    await failRequest(request, "Importer completed without a verifiable Supabase release record.");
    continue;
  }

  await completeRequest(request, release);
  console.log(`Completed queued import ${request.id}: ${release.artist} — ${release.title}`);
}

console.log(JSON.stringify({ processed, failed }, null, 2));
if (failed > 0) process.exitCode = 1;
