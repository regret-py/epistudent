import { describe, expect, it } from "vitest";
import {
  formGroup,
  groupCohesion,
  levelScore,
  locationScore,
  rankCandidates,
  scheduleScore,
  scoreMatch,
  skillLevel,
  type MatchProfile,
} from "./matching";

function profile(overrides: Partial<MatchProfile> & { id: string }): MatchProfile {
  return {
    city: "paris",
    languages: { c: 3 },
    availability: ["weekday"],
    location: "any",
    ambition: "validation",
    ...overrides,
  };
}

describe("skillLevel", () => {
  it("averages the three best ratings without focus", () => {
    expect(skillLevel({ c: 5, python: 4, rust: 3, haskell: 1 })).toBe(4);
  });

  it("uses focus languages and counts missing ones as level 1", () => {
    expect(skillLevel({ c: 5 }, ["c", "haskell"])).toBe(3);
  });

  it("defaults to 1 with no languages", () => {
    expect(skillLevel({})).toBe(1);
  });
});

describe("component scores", () => {
  it("scheduleScore is the Jaccard index of slots", () => {
    expect(scheduleScore(["weekday", "evening"], ["evening", "weekend"])).toBeCloseTo(1 / 3);
    expect(scheduleScore(["weekend"], ["weekend"])).toBe(1);
    expect(scheduleScore([], [])).toBe(0);
  });

  it("levelScore is 1 for equal levels and 0 for 1 vs 5", () => {
    expect(levelScore(3, 3)).toBe(1);
    expect(levelScore(1, 5)).toBe(0);
  });

  it("locationScore forbids on-site across cities", () => {
    const a = profile({ id: "a", city: "paris", location: "onsite" });
    const b = profile({ id: "b", city: "lyon", location: "any" });
    expect(locationScore(a, b)).toBe(0);
  });

  it("locationScore allows remote across cities with a penalty", () => {
    const a = profile({ id: "a", city: "paris", location: "remote" });
    const b = profile({ id: "b", city: "Lyon", location: "any" });
    expect(locationScore(a, b)).toBe(0.8);
  });

  it("locationScore is case-insensitive on city", () => {
    const a = profile({ id: "a", city: "Paris" });
    const b = profile({ id: "b", city: "paris" });
    expect(locationScore(a, b)).toBe(1);
  });
});

describe("scoreMatch", () => {
  it("gives a perfect score to identical profiles", () => {
    const a = profile({ id: "a" });
    const result = scoreMatch(a, profile({ id: "b" }));
    expect(result.score).toBe(1);
    expect(result.compatible).toBe(true);
  });

  it("is symmetric", () => {
    const a = profile({ id: "a", languages: { c: 5 }, availability: ["weekday", "evening"], ambition: "bonus" });
    const b = profile({ id: "b", languages: { c: 2 }, availability: ["evening"], location: "remote" });
    expect(scoreMatch(a, b).score).toBe(scoreMatch(b, a).score);
  });

  it("marks pairs with no common slot as incompatible", () => {
    const a = profile({ id: "a", availability: ["weekday"] });
    const b = profile({ id: "b", availability: ["weekend"] });
    expect(scoreMatch(a, b).compatible).toBe(false);
  });

  it("respects custom weights", () => {
    const a = profile({ id: "a", languages: { c: 1 } });
    const b = profile({ id: "b", languages: { c: 5 } });
    const levelOnly = scoreMatch(a, b, { weights: { schedule: 0, level: 1, location: 0, ambition: 0 } });
    expect(levelOnly.score).toBe(0);
  });

  it("rejects all-zero weights", () => {
    expect(() =>
      scoreMatch(profile({ id: "a" }), profile({ id: "b" }), {
        weights: { schedule: 0, level: 0, location: 0, ambition: 0 },
      }),
    ).toThrow();
  });
});

describe("rankCandidates", () => {
  const seeker = profile({ id: "seeker", languages: { c: 4 }, availability: ["weekday", "evening"] });
  const candidates = [
    profile({ id: "close", languages: { c: 4 }, availability: ["weekday", "evening"] }),
    profile({ id: "partial", languages: { c: 2 }, availability: ["evening"] }),
    profile({ id: "far", city: "lyon", location: "onsite", availability: ["weekday"] }),
    profile({ id: "seeker" }),
  ];

  it("sorts by score, drops the seeker and incompatible candidates", () => {
    const ranked = rankCandidates(seeker, candidates);
    expect(ranked.map((r) => r.profile.id)).toEqual(["close", "partial"]);
  });

  it("applies minScore", () => {
    const ranked = rankCandidates(seeker, candidates, { minScore: 0.99 });
    expect(ranked.map((r) => r.profile.id)).toEqual(["close"]);
  });
});

describe("formGroup", () => {
  it("builds a group of the requested size from the best mutual fits", () => {
    const seeker = profile({ id: "s", languages: { c: 3 } });
    const pool = [
      profile({ id: "a", languages: { c: 3 } }),
      profile({ id: "b", languages: { c: 3 }, ambition: "bonus" }),
      profile({ id: "c", languages: { c: 1 }, availability: ["weekday", "weekend"] }),
    ];
    const { members, cohesion } = formGroup(seeker, pool, 3);
    expect(members.map((m) => m.id)).toEqual(["s", "a", "b"]);
    expect(cohesion).toBeGreaterThan(0.8);
  });

  it("never adds someone incompatible with an existing member", () => {
    const seeker = profile({ id: "s", city: "paris", location: "any" });
    const pool = [
      profile({ id: "remote-lyon", city: "lyon", location: "remote" }),
      profile({ id: "onsite-paris", city: "paris", location: "onsite" }),
    ];
    const { members } = formGroup(seeker, pool, 3);
    // onsite-paris cannot work with someone in Lyon, so only one of them can join
    expect(members).toHaveLength(2);
  });

  it("returns a partial group when the pool runs out", () => {
    const { members } = formGroup(profile({ id: "s" }), [], 4);
    expect(members).toHaveLength(1);
  });

  it("rejects invalid sizes", () => {
    expect(() => formGroup(profile({ id: "s" }), [], 1)).toThrow();
  });
});

describe("groupCohesion", () => {
  it("is 1 for a single member", () => {
    expect(groupCohesion([profile({ id: "s" })])).toBe(1);
  });
});
