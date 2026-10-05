"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import { BoxLogo } from "./box-logo";

/** Client-side guard (no server on GitHub Pages; RLS is the real protection). */
export function Protected({ children, requireOnboarded = true }: { children: React.ReactNode; requireOnboarded?: boolean }) {
  const { status, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { dict } = useI18n();

  const needsLogin = status === "signedOut";
  const needsOnboarding = status === "signedIn" && requireOnboarded && !profile?.onboarded_at;

  useEffect(() => {
    if (needsLogin) router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
    else if (needsOnboarding) router.replace(`/onboarding/?next=${encodeURIComponent(pathname)}`);
  }, [needsLogin, needsOnboarding, pathname, router]);

  if (status !== "signedIn" || needsOnboarding || !profile) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <BoxLogo className="animate-pulse text-4xl" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{dict.common.loading}</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
