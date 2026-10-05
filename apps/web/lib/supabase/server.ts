import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@studybuddy/db";
import { env } from "../env";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there and the
          // middleware takes care of refreshing the session.
        }
      },
    },
  });
}
