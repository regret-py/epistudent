import type { AvailabilitySlot, Language } from "./profile";

export type LocationPreference = "remote" | "onsite" | "any";
export type Ambition = "validation" | "bonus";

export type MatchProfile = {
  id: string;
  city: string;
  languages: Partial<Record<Language, number>>;
  availability: readonly AvailabilitySlot[];
  location: LocationPreference;
  ambition: Ambition;
};

export type MatchWeights = {
  schedule: number;
  level: number;
  location: number;
  ambition: number;
};

export const DEFAULT_WEIGHTS: MatchWeights = {
  schedule: 0.4,
  level: 0.3,
  location: 0.2,
  ambition: 0.1,
};

export type MatchBreakdown = MatchWeights;

export type MatchResult = {
  score: number;
  breakdown: MatchBreakdown;
  /** false when a hard constraint (on-site in different cities) rules the pair out */
  compatible: boolean;
};

const MIN_LEVEL = 1;
const MAX_LEVEL = 5;

/**
 * Skill level of a profile for a project. With `focus` languages, missing ones
 * count as the minimum level; otherwise the mean of the three best ratings.
 */
export function skillLevel(
  languages: MatchProfile["languages"],
  focus?: readonly Language[],
): number {
  if (focus && focus.length > 0) {
    const ratings = focus.map((lang) => languages[lang] ?? MIN_LEVEL);
    return mean(ratings);
  }
  const top = Object.values(languages)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => b - a)
    .slice(0, 3);
  return top.length > 0 ? mean(top) : MIN_LEVEL;
}

/** Jaccard similarity of availability slots. */
export function scheduleScore(
  a: readonly AvailabilitySlot[],
  b: readonly AvailabilitySlot[],
): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  let inter = 0;
  for (const slot of setA) if (setB.has(slot)) inter++;
  return inter / union.size;
}

export function levelScore(levelA: number, levelB: number): number {
  return 1 - Math.abs(levelA - levelB) / (MAX_LEVEL - MIN_LEVEL);
}

/**
 * 1 when both can meet in person, 0.8 when they'd work remotely across cities,
 * 0 when someone insists on on-site and they're not in the same city.
 */
export function locationScore(a: MatchProfile, b: MatchProfile): number {
  const sameCity = a.city.toLowerCase() === b.city.toLowerCase();
  if (sameCity) {
    // remote vs onsite in the same city still clashes on how they want to work
    if ((a.location === "remote" && b.location === "onsite") || (a.location === "onsite" && b.location === "remote")) {
      return 0.5;
    }
    return 1;
  }
  if (a.location === "onsite" || b.location === "onsite") return 0;
  return 0.8;
}

export function ambitionScore(a: Ambition, b: Ambition): number {
  return a === b ? 1 : 0.4;
}

export function scoreMatch(
  a: MatchProfile,
  b: MatchProfile,
  options: { weights?: MatchWeights; focus?: readonly Language[] } = {},
): MatchResult {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const totalWeight = weights.schedule + weights.level + weights.location + weights.ambition;
  if (totalWeight <= 0) throw new Error("Match weights must sum to a positive number");

  const breakdown: MatchBreakdown = {
    schedule: scheduleScore(a.availability, b.availability),
    level: levelScore(skillLevel(a.languages, options.focus), skillLevel(b.languages, options.focus)),
    location: locationScore(a, b),
    ambition: ambitionScore(a.ambition, b.ambition),
  };

  const weighted =
    breakdown.schedule * weights.schedule +
    breakdown.level * weights.level +
    breakdown.location * weights.location +
    breakdown.ambition * weights.ambition;

  const compatible = breakdown.location > 0 && breakdown.schedule > 0;
  return { score: round(weighted / totalWeight), breakdown, compatible };
}

export type RankedCandidate = MatchResult & { profile: MatchProfile };

export function rankCandidates(
  seeker: MatchProfile,
  candidates: readonly MatchProfile[],
  options: { weights?: MatchWeights; focus?: readonly Language[]; minScore?: number } = {},
): RankedCandidate[] {
  const minScore = options.minScore ?? 0;
  return candidates
    .filter((c) => c.id !== seeker.id)
    .map((profile) => ({ profile, ...scoreMatch(seeker, profile, options) }))
    .filter((r) => r.compatible && r.score >= minScore)
    .sort((x, y) => y.score - x.score || x.profile.id.localeCompare(y.profile.id));
}

/**
 * Greedy group formation: start from the seeker and repeatedly add the candidate
 * with the best average score against everyone already in the group. A candidate
 * incompatible with any current member is skipped.
 */
export function formGroup(
  seeker: MatchProfile,
  candidates: readonly MatchProfile[],
  size: number,
  options: { weights?: MatchWeights; focus?: readonly Language[]; minScore?: number } = {},
): { members: MatchProfile[]; cohesion: number } {
  if (!Number.isInteger(size) || size < 2) throw new Error("Group size must be an integer >= 2");
  const minScore = options.minScore ?? 0;
  const members: MatchProfile[] = [seeker];
  const pool = candidates.filter((c) => c.id !== seeker.id);

  while (members.length < size && pool.length > 0) {
    let bestIndex = -1;
    let bestScore = -1;
    pool.forEach((candidate, index) => {
      const results = members.map((m) => scoreMatch(m, candidate, options));
      if (results.some((r) => !r.compatible)) return;
      const avg = mean(results.map((r) => r.score));
      if (avg >= minScore && avg > bestScore) {
        bestScore = avg;
        bestIndex = index;
      }
    });
    if (bestIndex === -1) break;
    members.push(pool.splice(bestIndex, 1)[0]!);
  }

  return { members, cohesion: groupCohesion(members, options) };
}

/** Mean pairwise score of a group (1 for a single member). */
export function groupCohesion(
  members: readonly MatchProfile[],
  options: { weights?: MatchWeights; focus?: readonly Language[] } = {},
): number {
  const scores: number[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      scores.push(scoreMatch(members[i]!, members[j]!, options).score);
    }
  }
  return scores.length > 0 ? round(mean(scores)) : 1;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
