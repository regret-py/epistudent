import { describe, expect, it } from "vitest";
import {
  EMPTY_STATE,
  appliesTo,
  daysInMonth,
  entriesForMonth,
  history,
  parseAmount,
  parseState,
  shiftMonth,
  summarize,
  type Entry,
} from "./budget";

let n = 0;
const e = (o: Partial<Entry>): Entry => ({
  id: `id-${n++}`,
  kind: "expense",
  label: "x",
  amount: 10,
  category: "autre",
  month: "2026-10",
  recurring: false,
  ...o,
});
const st = (entries: Entry[], extra: Partial<typeof EMPTY_STATE> = {}) => ({ ...EMPTY_STATE, entries, ...extra });

describe("months", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-03", -14)).toBe("2025-01");
  });
  it("counts days, leap years included", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-12")).toBe(31);
  });
});

describe("recurring entries", () => {
  const rent = e({ recurring: true, month: "2026-09", endMonth: "2026-12" });
  it("apply from their start month to their end month inclusive", () => {
    expect(appliesTo(rent, "2026-08")).toBe(false);
    expect(appliesTo(rent, "2026-09")).toBe(true);
    expect(appliesTo(rent, "2026-12")).toBe(true);
    expect(appliesTo(rent, "2027-01")).toBe(false);
  });
  it("one-offs only count in their month", () => {
    const once = e({ month: "2026-09" });
    expect(entriesForMonth([rent, once], "2026-09")).toHaveLength(2);
    expect(entriesForMonth([rent, once], "2026-10")).toEqual([rent]);
  });
});

describe("summarize", () => {
  const entries = [
    e({ kind: "income", amount: 600, category: "bourse", recurring: true, month: "2026-09" }),
    e({ amount: 400, category: "loyer", recurring: true, month: "2026-09" }),
    e({ amount: 45.5, category: "courses" }),
    e({ amount: 4.5, category: "courses" }),
  ];
  const today = new Date(2026, 9, 22);

  it("totals income, expenses, balance and categories", () => {
    const s = summarize(st(entries), "2026-10", today);
    expect([s.income, s.expenses, s.balance]).toEqual([600, 450, 150]);
    expect(s.byCategory.map((c) => [c.category, c.amount])).toEqual([
      ["loyer", 400],
      ["courses", 50],
    ]);
  });

  it("avoids floating point drift", () => {
    const s = summarize(st([e({ amount: 0.1 }), e({ amount: 0.2 }), e({ kind: "income", amount: 0.3 })]), "2026-10", today);
    expect(s.expenses).toBe(0.3);
    expect(s.balance).toBe(0);
  });

  it("spreads the spendable money over the remaining days, today included", () => {
    const s = summarize(st(entries), "2026-10", today);
    expect(s.daysLeft).toBe(10);
    expect(s.perDayLeft).toBe(15);
  });

  it("puts the savings goal aside before the per-day figure", () => {
    const s = summarize(st(entries, { goal: 50 }), "2026-10", today);
    expect(s.spendable).toBe(100);
    expect(s.perDayLeft).toBe(10);
    expect(s.goalReached).toBe(true);
    expect(summarize(st(entries, { goal: 200 }), "2026-10", today).goalReached).toBe(false);
  });

  it("flags categories over their cap and lists capped ones with no spending", () => {
    const s = summarize(st(entries, { limits: { courses: 40, sorties: 30 } }), "2026-10", today);
    expect(s.byCategory.find((c) => c.category === "courses")).toMatchObject({ limit: 40, over: true });
    expect(s.byCategory.find((c) => c.category === "sorties")).toMatchObject({ amount: 0, over: false });
  });

  it("has no per-day figure for past months, a full month for future ones, never negative", () => {
    expect(summarize(st(entries), "2026-09", today).perDayLeft).toBeNull();
    expect(summarize(st(entries), "2026-11", today).daysLeft).toBe(30);
    expect(summarize(st([e({ amount: 999 })]), "2026-10", today).perDayLeft).toBe(0);
  });
});

describe("history", () => {
  it("returns six months oldest first, ending with the given month", () => {
    const h = history([e({ kind: "income", amount: 100, recurring: true, month: "2026-08" })], "2026-10");
    expect(h.map((p) => p.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(h.map((p) => p.income)).toEqual([0, 0, 0, 100, 100, 100]);
  });
});

describe("parseAmount", () => {
  it.each([
    ["8,50", 8.5],
    ["8.50", 8.5],
    ["1 200", 1200],
    ["1 200,50 €", 1200.5],
    ["1.200,50", 1200.5],
    ["0,01", 0.01],
  ])("%s -> %s", (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(["", "abc", "0", "-5", "1,234", "1e3", "Infinity", "NaN", "2000000", "12,", ",5"])("rejects %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("parseState (untrusted input)", () => {
  it("returns an empty budget for garbage", () => {
    for (const raw of [null, 42, "x", [], { entries: "nope" }]) expect(parseState(raw)).toEqual(EMPTY_STATE);
  });

  it("migrates v1 data", () => {
    const v1 = { version: 1, entries: [{ id: "a", kind: "expense", label: "Loyer", amount: 400, category: "loyer", month: "2026-09", recurring: true }] };
    const s = parseState(v1);
    expect(s.version).toBe(2);
    expect(s.entries).toHaveLength(1);
    expect(s.goal).toBeNull();
    expect(s.limits).toEqual({});
  });

  it("drops invalid entries and caps values", () => {
    const s = parseState({
      entries: [
        e({}),
        { id: 1 },
        e({ amount: -5 }),
        e({ amount: Number.POSITIVE_INFINITY }),
        e({ amount: 5_000_000 }),
        e({ month: "2026-13" }),
        e({ kind: "gift" as never }),
        e({ label: "   " }),
      ],
    });
    expect(s.entries).toHaveLength(1);
  });

  it("sanitises labels, categories, ids and end months", () => {
    const [x] = parseState({
      entries: [{ id: "<script>", kind: "income", label: "a\u0000b\n  c".padEnd(200, "z"), amount: 1.005, category: "hack", month: "2026-01", recurring: true, endMonth: "2025-01" }],
    }).entries;
    expect(x!.label).toMatch(/^ab c/);
    expect(x!.label.length).toBe(60);
    expect(x!.category).toBe("autre");
    expect(x!.id).not.toBe("<script>");
    expect(x!.endMonth).toBeUndefined();
  });

  it("never lets prototype keys through", () => {
    const raw = JSON.parse('{"entries":[],"limits":{"__proto__":{"polluted":1},"courses":50,"constructor":3},"goal":20,"__proto__":{"x":1}}');
    const s = parseState(raw);
    expect(s.limits).toEqual({ courses: 50 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(s)).toEqual(["version", "entries", "goal", "limits"]);
  });

  it("deduplicates ids and caps the number of entries", () => {
    const many = Array.from({ length: 6000 }, () => e({ id: "same" }));
    const s = parseState({ entries: many });
    expect(s.entries).toHaveLength(5000);
    expect(new Set(s.entries.map((x) => x.id)).size).toBe(5000);
  });
});
