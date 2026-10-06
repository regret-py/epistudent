import { describe, expect, it } from "vitest";
import { daysInMonth, entriesForMonth, parseState, shiftMonth, summarize, type Entry } from "./budget";

const e = (o: Partial<Entry>): Entry => ({
  id: Math.random().toString(),
  kind: "expense",
  label: "x",
  amount: 10,
  category: "autre",
  month: "2026-10",
  recurring: false,
  ...o,
});

describe("months", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("counts days", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("entriesForMonth", () => {
  it("applies recurring entries from their start month onwards only", () => {
    const rent = e({ recurring: true, month: "2026-09" });
    const once = e({ month: "2026-09" });
    expect(entriesForMonth([rent, once], "2026-08")).toEqual([]);
    expect(entriesForMonth([rent, once], "2026-09")).toHaveLength(2);
    expect(entriesForMonth([rent, once], "2026-11")).toEqual([rent]);
  });
});

describe("summarize", () => {
  const entries = [
    e({ kind: "income", amount: 600, category: "bourse", recurring: true, month: "2026-09" }),
    e({ amount: 400, category: "loyer", recurring: true, month: "2026-09" }),
    e({ amount: 45.5, category: "courses" }),
    e({ amount: 4.5, category: "courses" }),
  ];

  it("totals income, expenses and balance", () => {
    const s = summarize(entries, "2026-10", new Date(2026, 9, 22));
    expect(s.income).toBe(600);
    expect(s.expenses).toBe(450);
    expect(s.balance).toBe(150);
    expect(s.byCategory[0]).toMatchObject({ category: "loyer", amount: 400 });
    expect(s.byCategory[1]).toMatchObject({ category: "courses", amount: 50 });
  });

  it("spreads what is left over the remaining days (today included)", () => {
    const s = summarize(entries, "2026-10", new Date(2026, 9, 22));
    expect(s.daysLeft).toBe(10);
    expect(s.perDayLeft).toBe(15);
  });

  it("has no per-day figure for past months and never goes negative", () => {
    expect(summarize(entries, "2026-09", new Date(2026, 9, 22)).perDayLeft).toBeNull();
    const broke = [e({ amount: 999 })];
    expect(summarize(broke, "2026-10", new Date(2026, 9, 1)).perDayLeft).toBe(0);
  });
});

describe("parseState", () => {
  it("drops malformed entries and garbage", () => {
    expect(parseState(null).entries).toEqual([]);
    expect(parseState({ entries: [e({}), { id: 1 }, e({ amount: -5 }), e({ month: "oct" })] }).entries).toHaveLength(1);
  });
});
