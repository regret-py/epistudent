"use client";

import { useEffect, useRef, useState } from "react";
import { addVisit, cleanBadges, cleanVisits } from "./badges";
import { cleanShares, cleanTracker, decodeShare, type Tracker } from "./plan";
import { cleanProfile, emptyProfile, type Profile } from "./profile";

const KEY = "epistudent-plan";

export type Saved = {
  budget: string;
  savings: string;
  rent: string;
  shares: Record<string, number>;
  tracker: Tracker;
  goal: { label: string; target: string };
  /** badge key → day earned (YYYY-MM-DD) */
  badges: Record<string, string>;
  /** distinct days the site was opened */
  visits: string[];
  /** nickname and photo, shown in the account (never put in share links) */
  profile: Profile;
};

export const emptySaved = (): Saved => ({
  budget: "",
  savings: "",
  rent: "",
  shares: {},
  tracker: cleanTracker(null),
  goal: { label: "", target: "" },
  badges: {},
  visits: [],
  profile: emptyProfile(),
});

function clip(v: unknown, max = 20): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Validates saved data from localStorage or from the account (both untrusted). */
export function cleanSaved(raw: unknown): Saved {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptySaved();
  const r = raw as Record<string, unknown>;
  const g = (r.goal && typeof r.goal === "object" && !Array.isArray(r.goal) ? r.goal : {}) as Record<string, unknown>;
  return {
    budget: clip(r.budget),
    savings: clip(r.savings),
    rent: clip(r.rent),
    shares: cleanShares(r.shares),
    tracker: cleanTracker(r.tracker),
    goal: { label: clip(g.label, 40), target: clip(g.target) },
    badges: cleanBadges(r.badges),
    visits: cleanVisits(r.visits),
    profile: cleanProfile(r.profile),
  };
}

/** Inputs remembered in this browser (and in the account when signed in). */
export function useSaved() {
  const [saved, setSaved] = useState<Saved>(emptySaved);
  const [loaded, setLoaded] = useState(false);
  const [fromLink, setFromLink] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    let next = emptySaved();
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        next = cleanSaved(raw);
      }
    } catch {
      // corrupted or blocked storage: start fresh
    }
    // a shared link (#b=900&s=100…) wins over what was stored, then the fragment is removed
    const shared = decodeShare(window.location.hash);
    if (shared) {
      next = { ...next, ...shared };
      setFromLink(true);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    // the static HTML is usable before the JS loads: keep anything typed in the meantime
    for (const field of ["budget", "savings", "rent"] as const) {
      const typed = (document.getElementById(field) as HTMLInputElement | null)?.value ?? "";
      if (typed.trim()) {
        next = { ...next, [field]: clip(typed) };
      }
    }
    // count today's visit (for the "habitué" / "fidèle" badges)
    next = { ...next, visits: addVisit(next.visits) };
    first.current = false;
    setSaved(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // storage full or blocked: still works for this visit
    }
  }, [saved, loaded]);

  /** "tout effacer": the budget goes, the profile (nickname, photo) stays. */
  const reset = () => setSaved((s) => ({ ...emptySaved(), profile: s.profile }));

  /** Wipes this device's copy (used on sign-out so a shared computer keeps nothing). */
  const forget = () => {
    first.current = true;
    setSaved(emptySaved());
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nothing stored
    }
  };

  return { saved, setSaved, loaded, reset, forget, fromLink };
}
