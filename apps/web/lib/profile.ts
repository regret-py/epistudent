import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

/** Current user + profile, memoised per request. Redirects to /login when signed out. */
export const getCurrentProfile = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error || !profile) throw new Error(`Profile not found for ${user.id}: ${error?.message ?? "no row"}`);

  return { user, profile };
});
