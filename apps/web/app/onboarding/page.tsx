import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentProfile } from "@/lib/profile";
import { getDictionary } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage({ searchParams }: { searchParams: { next?: string } }) {
  const { profile } = await getCurrentProfile();
  const next = safeNextPath(searchParams.next);
  if (profile.onboarded_at) redirect(next);

  const dict = getDictionary();
  return (
    <main className="container max-w-xl py-6 pb-16">
      <Logo className="text-sm" />
      <h1 className="mt-8 text-3xl font-bold tracking-tight">{dict.onboarding.title}</h1>
      <p className="mt-2 text-muted-foreground">{dict.onboarding.subtitle}</p>
      <OnboardingForm next={next} />
    </main>
  );
}
