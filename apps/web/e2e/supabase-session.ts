import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasSupabase = Boolean(anonKey && serviceRoleKey);

export function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createTestUser(email: string, password = "e2e-password-123") {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Ada Lovelace" },
  });
  if (error) throw error;
  return { user: data.user, password };
}

/**
 * Signs in with @supabase/ssr exactly like the app would, and copies the auth
 * cookies it writes into the Playwright context. Avoids driving the real
 * Microsoft login page in tests.
 */
export async function signInContext(context: BrowserContext, baseURL: string, email: string, password: string) {
  const jar = new Map<string, string>();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { hostname } = new URL(baseURL);
  await context.addCookies(
    [...jar].map(([name, value]) => ({ name, value, domain: hostname, path: "/", sameSite: "Lax" as const })),
  );
}
