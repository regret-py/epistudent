"use client";

import { useEffect, useState } from "react";

/**
 * GitHub Pages can't send X-Frame-Options / frame-ancestors, so refuse to work inside a
 * frame (clickjacking) from the page itself.
 */
export function FrameGuard({ children }: { children: React.ReactNode }) {
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    try {
      setFramed(window.self !== window.top);
    } catch {
      setFramed(true);
    }
  }, []);
  if (framed) {
    return (
      <div role="alert" className="grid min-h-dvh place-items-center bg-ink p-6 text-center text-paper">
        <p className="max-w-xs text-[13px]">
          Pour ta sécurité, epistudent ne s&apos;affiche pas dans un autre site. Ouvre <strong>epistudent.fr</strong> directement.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
