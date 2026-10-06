import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  PROFILES,
  buildPlan,
  checkAmount,
  cleanShares,
  cleanTracker,
  daysLeftInMonth,
  decodeShare,
  encodeShare,
  euro,
  matchProfile,
  mealsPerWeek,
  monthsToGoal,
  parseEuros,
  planToText,
  withShares,
} from "./plan";

const sumCents = (lines: { month: number }[]) => lines.reduce((s, l) => s + Math.round(l.month * 100), 0);

describe("buildPlan", () => {
  it("splits what's left after rent and savings, summing exactly", () => {
    const p = buildPlan({ budget: 900, savings: 100, rent: 400 });
    if (!p.ok) throw new Error("expected a plan");
    expect(p.spendable).toBe(400);
    expect(p.lines.find((l) => l.key === "bouffe")!.month).toBe(160);
    expect(sumCents(p.lines)).toBe(40000);
    expect(p.savingsRate).toBe(11.11);
  });

  it("keeps cents exact with awkward amounts and avoids float drift", () => {
    const p = buildPlan({ budget: 333.33, savings: 0.1, rent: 0.2 });
    if (!p.ok) throw new Error();
    expect(p.spendable).toBe(333.03);
    expect(sumCents(p.lines)).toBe(33303);
  });

  it("gives weekly and daily amounts", () => {
    const p = buildPlan({ budget: 1000, savings: 0, rent: 0 });
    if (!p.ok) throw new Error();
    const food = p.lines.find((l) => l.key === "bouffe")!;
    expect(food.week).toBeCloseTo(400 / (52 / 12), 2);
    expect(food.day).toBeCloseTo(400 / (365 / 12), 2);
  });

  it("works with custom shares that don't add up to 100", () => {
    const shares = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
    shares.bouffe = 30;
    shares.sorties = 10;
    const p = buildPlan({ budget: 400, savings: 0, rent: 0 }, withShares(shares));
    if (!p.ok) throw new Error();
    expect(p.lines.find((l) => l.key === "bouffe")).toMatchObject({ month: 300, percent: 75 });
    expect(p.lines.find((l) => l.key === "transport")!.month).toBe(0);
  });

  it("refuses impossible plans", () => {
    expect(buildPlan({ budget: 0, savings: 0, rent: 0 })).toEqual({ ok: false, reason: "empty", missing: 0 });
    expect(buildPlan({ budget: 500, savings: 200, rent: 400 })).toEqual({ ok: false, reason: "too-much", missing: 100 });
    expect(buildPlan({ budget: 500, savings: 500, rent: 0 })).toEqual({ ok: false, reason: "nothing-left", missing: 0 });
    expect(buildPlan({ budget: 900, savings: 400, rent: 500 })).toEqual({ ok: false, reason: "nothing-left", missing: 0 });
    const zero = withShares(Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])));
    expect(buildPlan({ budget: 500, savings: 0, rent: 0 }, zero)).toMatchObject({ ok: false, reason: "no-share" });
  });

  it("default shares sum to 100", () => {
    expect(CATEGORIES.reduce((s, c) => s + c.share, 0)).toBe(100);
  });
});

describe("parseEuros", () => {
  it.each([
    ["800", 800],
    ["1 200,50 €", 1200.5],
    ["1\u00a0200,50", 1200.5],
    ["1.200,50", 1200.5],
    ["1.200", 1200],
    ["1.000.000", 1000000],
    ["12.5", 12.5],
    ["900,", 900],
    ["900.", 900],
    [",5", 0.5],
    ["0", 0],
    ["", 0],
    ["  ", 0],
  ])("%j -> %s", (i, o) => expect(parseEuros(i)).toBe(o));
  it.each(["abc", "-5", "1e3", "1,234", "1,5.2", "12.50,3", "Infinity", ",", "1.2.3"])("rejects %j", (i) => expect(parseEuros(i)).toBeNull());

  it("tells a too-large amount from a malformed one", () => {
    expect(checkAmount("2000000").error).toBe("max");
    expect(checkAmount("99999999").error).toBe("max");
    expect(checkAmount("abc").error).toBe("invalid");
    expect(checkAmount("1 000 000").error).toBeNull();
  });
});

describe("euro", () => {
  it("shows no decimals for whole euros and always two otherwise", () => {
    expect(euro(400)).toMatch(/^400\s€$/);
    expect(euro(1000.5)).toMatch(/^1\s000,50\s€$/);
    expect(euro(12.34)).toMatch(/^12,34\s€$/);
    expect(euro(-0)).toMatch(/^0\s€$/);
  });
});

describe("cleanShares (untrusted storage)", () => {
  it("keeps known keys only, clamps and rounds", () => {
    const raw = JSON.parse('{"bouffe":45.6,"sorties":-3,"shopping":500,"__proto__":{"x":1},"evil":7,"transport":"12"}');
    expect(cleanShares(raw)).toEqual({ bouffe: 46, sorties: 0, shopping: 100 });
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
  it("ignores garbage", () => {
    for (const raw of [null, 3, "x", [1, 2]]) expect(cleanShares(raw)).toEqual({});
  });
  it("drops an all-zero split so nobody gets stuck", () => {
    expect(cleanShares(Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])))).toEqual({});
    expect(cleanShares({ ...Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])), sorties: 1 })).toMatchObject({ sorties: 1 });
  });
});

describe("planToText", () => {
  it("summarises the plan", () => {
    const input = { budget: 900, savings: 100, rent: 400 };
    const p = buildPlan(input);
    if (!p.ok) throw new Error();
    const text = planToText(input, p);
    expect(text).toContain("À dépenser : 400");
    expect(text).toMatch(/bouffe : 160\s€\/mois/);
  });
});


describe("profiles", () => {
  it("each profile sums to 100 and is recognised", () => {
    for (const p of PROFILES) {
      expect(withShares(p.shares).reduce((s, c) => s + c.share, 0)).toBe(100);
      expect(matchProfile(p.shares)).toBe(p.key);
    }
    expect(matchProfile({ bouffe: 41 })).toBeNull();
  });
});

describe("tracker", () => {
  const now = new Date(2026, 9, 22);
  it("keeps this month's valid amounts only", () => {
    expect(cleanTracker({ month: "2026-10", spent: { bouffe: 12.345, sorties: -3, evil: 5, shopping: "9" } }, now)).toEqual({ month: "2026-10", spent: { bouffe: 12.35 } });
  });
  it("starts fresh in a new month or on garbage", () => {
    expect(cleanTracker({ month: "2026-09", spent: { bouffe: 50 } }, now)).toEqual({ month: "2026-10", spent: {} });
    expect(cleanTracker("x", now)).toEqual({ month: "2026-10", spent: {} });
  });
  it("counts days left, today included", () => {
    expect(daysLeftInMonth(now)).toBe(10);
    expect(daysLeftInMonth(new Date(2026, 1, 28))).toBe(1);
  });
});

describe("goal", () => {
  it("computes months to reach a target", () => {
    expect(monthsToGoal(600, 100)).toBe(6);
    expect(monthsToGoal(601, 100)).toBe(7);
    expect(monthsToGoal(0.3, 0.1)).toBe(3);
    expect(monthsToGoal(600, 0)).toBeNull();
  });
});

describe("equivalences", () => {
  it("counts meals", () => expect(mealsPerWeek(36.92)).toBe(10));
});

describe("share link", () => {
  it("round-trips amounts and split", () => {
    const s = { budget: "900", savings: "100,50", rent: "", shares: { bouffe: 50 } };
    const hash = encodeShare(s);
    expect(hash).toBe("b=900&s=100.5&p=50.12.15.8.8.9.8");
    expect(decodeShare(`#${hash}`)).toEqual({ budget: "900", savings: "100,5", rent: "", shares: { bouffe: 50, transport: 12, sorties: 15, abonnements: 8, hygiene: 8, shopping: 9, imprevus: 8 } });
  });
  it("rejects tampered links", () => {
    expect(decodeShare("#b=abc")).toBeNull();
    expect(decodeShare("#p=1.2.3")).toBeNull();
    expect(decodeShare("#p=999.0.0.0.0.0.0")).toEqual({ budget: "", savings: "", rent: "", shares: { bouffe: 100, transport: 0, sorties: 0, abonnements: 0, hygiene: 0, shopping: 0, imprevus: 0 } });
    expect(decodeShare("#x=1")).toBeNull();
    expect(decodeShare("")).toBeNull();
  });
});
