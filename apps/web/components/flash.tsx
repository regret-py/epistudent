"use client";

import { useEffect } from "react";

export type FlashMoment = { id: number; words: string[]; word: string };

const STEP = 180; // ms per hard-cut word
const HOLD = 600; // the boxed word stays up
const LIFT = 450; // curtain

/** How long a moment stays on screen, in ms (mirrors the CSS timings below in globals.css). */
export const flashDuration = (words: number) => 60 + words * STEP + HOLD + LIFT;

/** A short replay of the intro for big moments; respects reduced motion and stays out of the intro's way. */
export function canFlash() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !document.documentElement.classList.contains("intro-on");
}

/**
 * Same language as the intro: words hard-cut on black, a boxed word punches in, the curtain lifts.
 * Click or Escape ends it early.
 */
export function Flash({ moment, onDone }: { moment: FlashMoment; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, flashDuration(moment.words.length));
    const skip = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, [moment, onDone]);

  return (
    <div className={`flash flash-n${Math.min(3, moment.words.length)} no-print`} data-testid="flash" aria-hidden onClick={onDone}>
      <div className="intro-words">
        {moment.words.slice(0, 3).map((w, i) => (
          <span key={i} className="flash-word intro-word">
            {w}
          </span>
        ))}
      </div>
      <span className="flash-box box-logo">{moment.word}</span>
    </div>
  );
}
