"use client";

import { useEffect } from "react";

const WORDS = ["bouffe.", "loyer.", "sorties.", "épargne."];
const DURATION = 2900;

/**
 * Supreme-style entrance: hard-cut words on black, then the box logo, then the curtain lifts.
 * Rendered in the static HTML but only shown when /intro.js put `intro-on` on <html>.
 */
export function Intro() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("intro-on")) return;
    const end = () => root.classList.remove("intro-on");
    const t = setTimeout(end, DURATION);
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && !["Escape", "Enter", " "].includes(e.key)) return;
      end();
    };
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  return (
    <div
      className="intro"
      data-testid="intro"
      aria-hidden
      onClick={() => document.documentElement.classList.remove("intro-on")}
    >
      <div className="intro-words">
        {WORDS.map((w, i) => (
          <span key={w} className={`intro-word intro-word-${i}`}>
            {w}
          </span>
        ))}
      </div>
      <span className="intro-logo box-logo">epistudent</span>
      <span className="intro-tag">budget étudiant — epistudent.fr</span>
      <span className="intro-skip">passer →</span>
    </div>
  );
}
