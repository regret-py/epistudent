"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BoxLogo } from "@/components/box-logo";
import { ProfileForm } from "@/components/profile-form";
import { Protected } from "@/components/protected";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import { safeNextPath } from "@/lib/safe-redirect";

function Onboarding() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const { dict } = useI18n();
  const next = () => safeNextPath(new URLSearchParams(window.location.search).get("next"));

  useEffect(() => {
    if (profile?.onboarded_at) router.replace(next());
  }, [profile, router]);

  if (!profile || profile.onboarded_at) return null;

  return (
    <main className="container max-w-3xl py-6 pb-16">
      <BoxLogo />
      <h1 className="mt-10 font-display text-5xl font-black italic">{dict.onboarding.title}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">{dict.onboarding.subtitle}</p>
      <ProfileForm
        profile={profile}
        submitLabel={dict.onboarding.submit}
        onSaved={async () => {
          await refreshProfile();
          router.replace(next());
        }}
      />
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Protected requireOnboarded={false}>
      <Onboarding />
    </Protected>
  );
}
