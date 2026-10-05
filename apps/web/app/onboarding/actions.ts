"use server";

import { redirect } from "next/navigation";
import { onboardingSchema, type OnboardingInput } from "@studybuddy/db";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string | null };

export async function saveOnboarding(input: OnboardingInput, next?: string): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "generic" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { promo, city, languages, availability, matchmakingOptIn } = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      promo,
      city,
      languages,
      availability,
      matchmaking_opt_in: matchmakingOptIn,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("onboarding update failed", error);
    return { error: "generic" };
  }

  redirect(safeNextPath(next));
}
