export type Kind = "income" | "expense";

export const EXPENSE_CATEGORIES = [
  "loyer",
  "courses",
  "transport",
  "abonnements",
  "sorties",
  "santé",
  "matériel",
  "autre",
] as const;
export const INCOME_CATEGORIES = ["bourse", "apl", "job", "parents", "autre"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Entry = {
  id: string;
  kind: Kind;
  label: string;
  /** euros, > 0 */
  amount: number;
  category: string;
  /** "YYYY-MM" the entry starts in */
  month: string;
  /** repeats every month from `month` onwards (until `endMonth`, inclusive, if set) */
  recurring: boolean;
  endMonth?: string;
};

export type BudgetState = {
  version: 2;
  entries: Entry[];
  /** money to put aside each month */
  goal: number | null;
  /** monthly cap per expense category */
  limits: Partial<Record<ExpenseCategory, number>>;
};

export const EMPTY_STATE: BudgetState = { version: 2, entries: [], goal: null, limits: {} };

/** Hard caps for anything typed in or imported. */
export const LIMITS = {
  label: 60,
  amount: 1_000_000,
  entries: 5_000,
  importBytes: 2_000_000,
} as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m, 0).getDate();
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("fr-FR", style === "long" ? { month: "long", year: "numeric" } : { month: "short" }).format(
    new Date(y, m - 1, 1),
  );
}

/** Does this entry count in `month`? */
export function appliesTo(entry: Entry, month: string): boolean {
  if (!entry.recurring) return entry.month === month;
  return entry.month <= month && (!entry.endMonth || month <= entry.endMonth);
}

export function entriesForMonth(entries: readonly Entry[], month: string): Entry[] {
  return entries.filter((e) => appliesTo(e, month));
}

export type CategoryLine = { category: string; amount: number; share: number; limit: number | null; over: boolean };

export type Summary = {
  income: number;
  expenses: number;
  balance: number;
  /** what is left once the savings goal is put aside */
  spendable: number;
  goal: number | null;
  goalReached: boolean;
  byCategory: CategoryLine[];
  /** spendable money per remaining day (null for past months) */
  perDayLeft: number | null;
  daysLeft: number;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarize(
  state: { entries: readonly Entry[]; goal: number | null; limits: BudgetState["limits"] },
  month: string,
  today: Date = new Date(),
): Summary {
  const list = entriesForMonth(state.entries, month);
  let income = 0;
  let expenses = 0;
  const totals = new Map<string, number>();
  for (const e of list) {
    if (e.kind === "income") income += e.amount;
    else {
      expenses += e.amount;
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
    }
  }
  income = round2(income);
  expenses = round2(expenses);

  // categories with a limit are always listed, even before the first expense
  for (const cat of Object.keys(state.limits)) if (!totals.has(cat)) totals.set(cat, 0);

  const byCategory = [...totals]
    .map(([category, amount]) => {
      const limit = state.limits[category as ExpenseCategory] ?? null;
      return { category, amount: round2(amount), share: expenses ? amount / expenses : 0, limit, over: limit !== null && amount > limit };
    })
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  const balance = round2(income - expenses);
  const goal = state.goal && state.goal > 0 ? state.goal : null;
  const spendable = round2(balance - (goal ?? 0));

  const current = monthKey(today);
  let daysLeft = 0;
  if (month === current) daysLeft = daysInMonth(month) - today.getDate() + 1;
  else if (month > current) daysLeft = daysInMonth(month);
  const perDayLeft = daysLeft > 0 ? round2(Math.max(0, spendable) / daysLeft) : null;

  return { income, expenses, balance, spendable, goal, goalReached: goal !== null && balance >= goal, byCategory, perDayLeft, daysLeft };
}

export type HistoryPoint = { month: string; income: number; expenses: number; balance: number };

/** `count` months ending with `month` (oldest first). */
export function history(entries: readonly Entry[], month: string, count = 6): HistoryPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const m = shiftMonth(month, i - count + 1);
    const s = summarize({ entries, goal: null, limits: {} }, m);
    return { month: m, income: s.income, expenses: s.expenses, balance: s.balance };
  });
}

/** Parses an amount typed by a French user: "8,50", "1 200", "1.200,50", "12.5". */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[\s  €]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > LIMITS.amount) return null;
  return round2(n);
}

const KINDS: readonly string[] = ["income", "expense"];

function categoryFor(kind: Kind, value: unknown): string {
  const allowed: readonly string[] = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return typeof value === "string" && allowed.includes(value) ? value : "autre";
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // drop control characters, collapse whitespace
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, LIMITS.label);
  return s || null;
}

function cleanEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== "string" || !KINDS.includes(r.kind)) return null;
  const kind = r.kind as Kind;
  const label = cleanLabel(r.label);
  const amount = typeof r.amount === "number" ? round2(r.amount) : NaN;
  if (!label || !Number.isFinite(amount) || amount <= 0 || amount > LIMITS.amount) return null;
  if (!isMonth(r.month)) return null;
  const recurring = r.recurring === true;
  const endMonth = recurring && isMonth(r.endMonth) && r.endMonth >= r.month ? r.endMonth : undefined;
  const id = typeof r.id === "string" && /^[\w-]{1,64}$/.test(r.id) ? r.id : newId();
  // build a fresh object: never spread untrusted input
  const entry: Entry = { id, kind, label, amount, category: categoryFor(kind, r.category), month: r.month, recurring };
  if (endMonth) entry.endMonth = endMonth;
  return entry;
}

/**
 * Validates anything coming from storage or an imported file and migrates v1 data.
 * Unknown fields are dropped, bad entries skipped, everything capped.
 */
export function parseState(raw: unknown): BudgetState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_STATE;
  const r = raw as Record<string, unknown>;
  const entries: Entry[] = [];
  const seen = new Set<string>();
  if (Array.isArray(r.entries)) {
    for (const item of r.entries.slice(0, LIMITS.entries)) {
      const e = cleanEntry(item);
      if (!e) continue;
      if (seen.has(e.id)) e.id = newId();
      seen.add(e.id);
      entries.push(e);
    }
  }
  const goal = typeof r.goal === "number" && Number.isFinite(r.goal) && r.goal > 0 && r.goal <= LIMITS.amount ? round2(r.goal) : null;
  const limits: BudgetState["limits"] = {};
  if (r.limits && typeof r.limits === "object" && !Array.isArray(r.limits)) {
    const src = r.limits as Record<string, unknown>;
    for (const cat of EXPENSE_CATEGORIES) {
      const v = Object.prototype.hasOwnProperty.call(src, cat) ? src[cat] : undefined;
      if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= LIMITS.amount) limits[cat] = round2(v);
    }
  }
  return { version: 2, entries, goal, limits };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export function formatEuro(n: number): string {
  return euro.format(n);
}
