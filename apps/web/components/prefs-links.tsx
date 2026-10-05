"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useTheme } from "./theme-provider";

/** Tiny text links: language + theme, Supreme-footer style. */
export function PrefsLinks() {
  const { locale, setLocale, dict } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-3 text-[11px] lowercase text-muted-foreground">
      <button
        type="button"
        className="link"
        data-testid="locale-switcher"
        onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
      >
        {locale === "fr" ? "english" : "français"}
      </button>
      <button type="button" className="link" data-testid="theme-toggle" onClick={() => setTheme(dark ? "light" : "dark")}>
        {dict.common.theme}: {dark ? dict.common.dark : dict.common.light}
      </button>
    </div>
  );
}
