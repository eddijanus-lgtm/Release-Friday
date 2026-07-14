const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export const supabaseUrl = configuredUrl.replace(/\/$/, "");
export const supabaseAnonKey = configuredKey;

export function isSupabaseConfigured() {
  return supabaseUrl.startsWith("https://") && supabaseAnonKey.length > 20;
}
