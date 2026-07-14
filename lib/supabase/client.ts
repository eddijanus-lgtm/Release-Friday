import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;

  browserClient ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}
