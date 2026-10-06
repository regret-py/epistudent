"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  // the browser chrome (address bar on phones) follows the site's theme, not the OS one
  useEffect(() => {
    if (!mounted) return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#ffffff");
  }, [dark, mounted]);

  return (
    <button
      type="button"
      className="link -mr-2 min-h-11 px-2 text-[12px] lowercase"
      data-testid="theme-toggle"
      aria-label={dark ? "passer en thème clair" : "passer en thème sombre"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? "◐ clair" : "◑ sombre"}
    </button>
  );
}
