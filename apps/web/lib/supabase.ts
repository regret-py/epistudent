import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@studybuddy/db";
import { env } from "./env";

export const AUTH_STORAGE_KEY = "epistudent-auth";

let client: SupabaseClient<Database> | null = null;

/** Browser-side Supabase client (PKCE OAuth, session in localStorage). */
export function supabase(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(env.supabaseUrl || "http://localhost", env.supabaseAnonKey || "missing", {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
  }
  return client;
}
