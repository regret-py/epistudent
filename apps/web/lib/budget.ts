export type Kind = "income" | "expense";

export const EXPENSE_CATEGORIES = ["loyer", "courses", "transport", "abonnements", "sorties", "santé", "matériel", "autre"] as const;
export const INCOME_CATEGORIES = ["bourse", "apl", "job", "parents", "autre"] as const;

export type Entry = {
  id: string;
  kind: Kind;
  label: string;
  amount: number; // euros, always positive
  category: string;
  /** "YYYY-MM" the entry belongs to */
  month: string;
  /** repeats every month from `month` onwards */
  recurring: boolean;
};

export type BudgetState = { version: 1; entries: Entry[] };

export const EMPTY_STATE: BudgetState = { version: 1, entries: [] };

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

/** Entries that apply to a month: its own one-offs + recurring ones started on or before it. */
export function entriesForMonth(entries: readonly Entry[], month: string): Entry[] {
  return entries.filter((e) => (e.recurring ? e.month <= month : e.month === month));
}

export type Summary = {
  income: number;
  expenses: number;
  balance: number;
  byCategory: { category: string; amount: number; share: number }[];
  /** what can still be spent per day for the rest of the month (null if month is over or in the future) */
  perDayLeft: number | null;
  daysLeft: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function summarize(entries: readonly Entry[], month: string, today: Date = new Date()): Summary {
  const list = entriesForMonth(entries, month);
  const income = round(list.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0));
  const expenses = round(list.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0));
  const totals = new Map<string, number>();
  for (const e of list) if (e.kind === "expense") totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  const byCategory = [...totals]
    .map(([category, amount]) => ({ category, amount: round(amount), share: expenses ? amount / expenses : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const balance = round(income - expenses);
  const current = monthKey(today);
  let daysLeft = 0;
  if (month === current) daysLeft = daysInMonth(month) - today.getDate() + 1;
  else if (month > current) daysLeft = daysInMonth(month);
  const perDayLeft = daysLeft > 0 ? round(Math.max(0, balance) / daysLeft) : null;

  return { income, expenses, balance, byCategory, perDayLeft, daysLeft };
}

/** Validates data coming from localStorage or an imported file. */
export function parseState(raw: unknown): BudgetState {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as BudgetState).entries)) return EMPTY_STATE;
  const entries = (raw as BudgetState).entries.filter(
    (e): e is Entry =>
      !!e &&
      typeof e.id === "string" &&
      (e.kind === "income" || e.kind === "expense") &&
      typeof e.label === "string" &&
      typeof e.amount === "number" &&
      Number.isFinite(e.amount) &&
      e.amount >= 0 &&
      typeof e.category === "string" &&
      typeof e.month === "string" &&
      /^\d{4}-\d{2}$/.test(e.month) &&
      typeof e.recurring === "boolean",
  );
  return { version: 1, entries };
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
