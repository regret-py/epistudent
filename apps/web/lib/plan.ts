export type Category = { key: string; label: string; share: number; hint: string };

/** Default split of what's left once rent and savings are set aside (sums to 100). */
export const CATEGORIES: readonly Category[] = [
  { key: "bouffe", label: "bouffe", share: 40, hint: "courses, cantine, un resto de temps en temps" },
  { key: "transport", label: "transport", share: 12, hint: "pass navigo, essence, vélo" },
  { key: "sorties", label: "sorties", share: 15, hint: "bars, ciné, soirées" },
  { key: "abonnements", label: "abonnements", share: 8, hint: "forfait, streaming, salle de sport" },
  { key: "hygiene", label: "hygiène & santé", share: 8, hint: "pharmacie, produits du quotidien" },
  { key: "shopping", label: "shopping", share: 9, hint: "fringues, matos, cadeaux" },
  { key: "imprevus", label: "imprévus", share: 8, hint: "le truc qui casse au pire moment" },
];

export const MAX_EUROS = 1_000_000;
export const MAX_SHARE = 100;

export type PlanInput = { budget: number; savings: number; rent: number };
export type PlanLine = Category & { percent: number; month: number; week: number; day: number };
export type Plan =
  | { ok: true; spendable: number; lines: PlanLine[]; savingsRate: number }
  | { ok: false; reason: "empty" | "too-much" | "nothing-left" | "no-share"; missing: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
export const WEEKS_PER_MONTH = 52 / 12;
export const DAYS_PER_MONTH = 365 / 12;

/**
 * Splits (budget − savings − rent) across categories proportionally to their shares.
 * Works in cents and hands rounding leftovers to the largest share so the lines add up exactly.
 */
export function buildPlan({ budget, savings, rent }: PlanInput, categories: readonly Category[] = CATEGORIES): Plan {
  if (!(budget > 0)) return { ok: false, reason: "empty", missing: 0 };
  const cents = Math.round(budget * 100) - Math.round(savings * 100) - Math.round(rent * 100);
  if (cents < 0) return { ok: false, reason: "too-much", missing: -cents / 100 };
  if (cents === 0) return { ok: false, reason: "nothing-left", missing: 0 };

  const total = categories.reduce((s, c) => s + Math.max(0, c.share), 0);
  if (total <= 0) return { ok: false, reason: "no-share", missing: 0 };

  const raw = categories.map((c) => Math.floor((cents * Math.max(0, c.share)) / total));
  const biggest = categories.reduce((best, c, i) => (c.share > categories[best]!.share ? i : best), 0);
  raw[biggest] = raw[biggest]! + (cents - raw.reduce((s, v) => s + v, 0));

  const lines = categories.map((c, i) => {
    const month = raw[i]! / 100;
    return {
      ...c,
      percent: r2((Math.max(0, c.share) / total) * 100),
      month,
      week: r2(month / WEEKS_PER_MONTH),
      day: r2(month / DAYS_PER_MONTH),
    };
  });
  return { ok: true, spendable: cents / 100, lines, savingsRate: r2((savings / budget) * 100) };
}

const THOUSANDS_DOTS = /^\d{1,3}(\.\d{3})+(,\d{0,2})?$/;
const PLAIN = /^(\d{1,7}(\.\d{0,2})?|\.\d{1,2})$/;

export type AmountError = "invalid" | "max";

/**
 * French-friendly amount parsing: "1 200,50 €", "1.200", "800", "12.5", "900," (while typing), ",5".
 * Empty → 0. Anything ambiguous or malformed ("1,234", "1,5.2") → null.
 */
export function parseEuros(input: string): number | null {
  return checkAmount(input).value;
}

export function checkAmount(input: string): { value: number | null; error: AmountError | null } {
  let s = input.replace(/[\s\u00a0\u202f€]/g, "");
  if (!s) return { value: 0, error: null };
  if (THOUSANDS_DOTS.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",") && s.includes(".")) return { value: null, error: "invalid" };
  else s = s.replace(",", ".");
  if (/^\d{8,}/.test(s)) return { value: null, error: "max" };
  if (!PLAIN.test(s)) return { value: null, error: "invalid" };
  const n = Number(s);
  if (n > MAX_EUROS) return { value: null, error: "max" };
  return { value: n, error: null };
}

/** Shares come from storage/user input: clamp to whole numbers in [0, 100]. */
export function cleanShares(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const c of CATEGORIES) {
    const v = Object.prototype.hasOwnProperty.call(src, c.key) ? src[c.key] : undefined;
    if (typeof v === "number" && Number.isFinite(v)) out[c.key] = clampShare(v);
  }
  // a split where every category is 0 can't be used: fall back to the default one
  if (CATEGORIES.every((c) => (out[c.key] ?? c.share) === 0)) return {};
  return out;
}

export function clampShare(v: number): number {
  return Math.min(MAX_SHARE, Math.max(0, Math.round(v)));
}

export function withShares(shares: Record<string, number>): Category[] {
  return CATEGORIES.map((c) => ({ ...c, share: shares[c.key] ?? c.share }));
}

const fmt0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Whole euros without decimals, otherwise always two: "400 €", "1 000,50 €" (never "1 000,5 €" or "-0 €"). */
export const euro = (n: number) => {
  const v = Object.is(n, -0) ? 0 : n;
  return (Number.isInteger(v) ? fmt0 : fmt2).format(v);
};

/** Plain-text summary for the "copier" button. */
export function planToText(input: PlanInput, plan: Extract<Plan, { ok: true }>): string {
  const lines = [
    `Mon budget du mois — epistudent.fr`,
    `Budget : ${euro(input.budget)} · Épargne : ${euro(input.savings)}${input.rent ? ` · Loyer & fixes : ${euro(input.rent)}` : ""}`,
    `À dépenser : ${euro(plan.spendable)}`,
    "",
    ...plan.lines.map((l) => `${l.label} : ${euro(l.month)}/mois · ${euro(l.week)}/semaine · ${euro(l.day)}/jour`),
  ];
  return lines.join("\n");
}
