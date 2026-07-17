import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RELEASE_DATE = process.env.RELEASE_DATE;

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing.");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");

function berlinDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function previousFriday() {
  const berlinMidday = new Date(`${berlinDate()}T12:00:00Z`);
  berlinMidday.setUTCDate(berlinMidday.getUTCDate() - ((berlinMidday.getUTCDay() + 2) % 7));
  return berlinDate(berlinMidday);
}

const releaseDate = RELEASE_DATE || previousFriday();
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) throw new Error("RELEASE_DATE must be YYYY-MM-DD.");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase
  .from("releases")
  .update({ archived_at: new Date().toISOString() })
  .eq("release_date", releaseDate)
  .eq("status", "published")
  .is("archived_at", null)
  .select("id,artist,title,release_date,archived_at");
if (error) throw error;

console.log(JSON.stringify({ archiveDate: releaseDate, archived: data?.length ?? 0, releases: data ?? [] }, null, 2));
