import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "@playwright/test";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasSupabase = Boolean(anonKey && serviceRoleKey);

const AUTH_STORAGE_KEY = "epistudent-auth";
const PASSWORD = "e2e-password-123";

export function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; session: unknown };

/** Creates a confirmed @epitech.eu user, optionally pre-onboarded, and returns a live session. */
export async function createUser(
  opts: { name?: string; onboarded?: boolean; profile?: Record<string, unknown> } = {},
): Promise<TestUser> {
  const email = `e2e-${randomUUID().slice(0, 8)}@epitech.eu`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: opts.name ?? "Ada Lovelace" },
  });
  if (error) throw error;
  if (opts.onboarded !== false) {
    const { error: e } = await admin
      .from("profiles")
      .update({
        promo: "tek2",
        city: "paris",
        languages: { c: 4 },
        availability: ["evening"],
        matchmaking_opt_in: true,
        onboarded_at: new Date().toISOString(),
        ...opts.profile,
      })
      .eq("id", data.user.id);
    if (e) throw e;
  }
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, session: signIn.session };
}

/** Puts the session where supabase-js looks for it, before any page script runs. */
export async function signIn(context: BrowserContext, user: TestUser) {
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_STORAGE_KEY, JSON.stringify(user.session)] as const,
  );
}

export async function newSignedInPage(context: BrowserContext, user: TestUser): Promise<Page> {
  await signIn(context, user);
  return context.newPage();
}
