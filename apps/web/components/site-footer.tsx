"use client";

import { useI18n } from "@/lib/i18n/client";
import { PrefsLinks } from "./prefs-links";

export function SiteFooter() {
  const { dict } = useI18n();
  return (
    <footer className="container mt-16 pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground py-4 text-[11px] lowercase text-muted-foreground">
        <span>© {new Date().getFullYear()} epistudent — {dict.login.tagline}</span>
        <PrefsLinks />
      </div>
    </footer>
  );
}
