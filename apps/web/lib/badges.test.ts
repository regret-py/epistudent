import { describe, expect, it } from "vitest";
import { BADGES, addVisit, cleanBadges, cleanVisits, newlyEarned, type BadgeContext } from "./badges";

const base: BadgeContext = {
  budget: 0,
  savings: 0,
  savingsRate: 0,
  goalTarget: 0,
  customized: false,
  spent: {},
  lines: [],
  spendable: 0,
  visits: 1,
  signedIn: false,
  events: new Set(),
  hour: 14,
};
const keys = (c: Partial<BadgeContext>, owned: Record<string, string> = {}) => newlyEarned({ ...base, ...c }, owned).map((b) => b.key);

describe("badges", () => {
  it("nothing for an empty visit", () => expect(keys({})).toEqual([]));

  it("budget, savings and the 10 % rule", () => {
    expect(keys({ budget: 900, savings: 50, savingsRate: 5.5 })).toEqual(["premier-budget", "epargnant"]);
    expect(keys({ budget: 900, savings: 100, savingsRate: 11.1 })).toContain("dix-pourcent");
  });

  it("never re-awards an owned badge", () => {
    expect(keys({ budget: 900 }, { "premier-budget": "2026-10-01" })).toEqual([]);
  });

  it("dans les clous: half spent, no category over", () => {
    const lines = [
      { key: "bouffe", month: 160 },
      { key: "sorties", month: 60 },
    ];
    expect(keys({ budget: 1, lines, spendable: 220, spent: { bouffe: 100, sorties: 20 } })).toContain("dans-les-clous");
    expect(keys({ budget: 1, lines, spendable: 220, spent: { bouffe: 100, sorties: 61 } })).not.toContain("dans-les-clous");
    expect(keys({ budget: 1, lines, spendable: 220, spent: { bouffe: 20 } })).not.toContain("dans-les-clous");
  });

  it("events, account, visits and night owls", () => {
    expect(keys({ events: new Set(["share"]) })).toEqual(["partageur"]);
    expect(keys({ signedIn: true })).toEqual(["connecte"]);
    expect(keys({ visits: 7 })).toEqual(["habitue", "fidele"]);
    expect(keys({ budget: 500, hour: 2 })).toContain("oiseau-de-nuit");
  });

  it("has 12 distinct badges", () => {
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(12);
  });
});

describe("storage cleaning", () => {
  it("keeps known badges with a date only", () => {
    const raw = JSON.parse('{"epargnant":"2026-10-07","fake":"2026-10-07","objectif":"hier","__proto__":{"x":1}}');
    expect(cleanBadges(raw)).toEqual({ epargnant: "2026-10-07" });
  });
  it("dedupes and caps visits", () => {
    expect(cleanVisits(["2026-10-02", "2026-10-01", "2026-10-02", 3, "nope"])).toEqual(["2026-10-01", "2026-10-02"]);
    expect(cleanVisits(Array.from({ length: 90 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, "0")}`)).length).toBe(28);
    expect(addVisit(["2026-10-01"], "2026-10-01")).toEqual(["2026-10-01"]);
    expect(addVisit(["2026-10-01"], "2026-10-02")).toEqual(["2026-10-01", "2026-10-02"]);
  });
});
