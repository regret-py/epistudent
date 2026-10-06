"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button type="button" className="link text-[11px] lowercase" data-testid="theme-toggle" onClick={() => setTheme(dark ? "light" : "dark")}>
      thème : {dark ? "sombre" : "clair"}
    </button>
  );
}
