import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

export const AUTH_STORAGE_KEY = "epistudent-auth";

let client: SupabaseClient | null = null;

/** Browser client: Microsoft OAuth with PKCE, session kept in localStorage. */
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
  });
  return client;
}
