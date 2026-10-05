import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@studybuddy/db";
import { env } from "../env";

export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
