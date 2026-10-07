/** Profile badges: computed from the budget itself, kept once earned (with the date). */

export type BadgeContext = {
  budget: number;
  savings: number;
  savingsRate: number;
  goalTarget: number;
  customized: boolean;
  spent: Record<string, number>;
  /** monthly amount per category, when there is a plan */
  lines: { key: string; month: number }[];
  spendable: number;
  visits: number;
  signedIn: boolean;
  /** one-off events (share link sent, …) */
  events: ReadonlySet<string>;
  hour: number;
};

export type Badge = { key: string; label: string; hint: string; earned: (c: BadgeContext) => boolean };

const spentTotal = (c: BadgeContext) => Object.values(c.spent).reduce((a, b) => a + b, 0);

export const BADGES: readonly Badge[] = [
  { key: "premier-budget", label: "premier budget", hint: "entrer ton budget du mois", earned: (c) => c.budget > 0 },
  { key: "epargnant", label: "épargnant", hint: "mettre de l'argent de côté", earned: (c) => c.budget > 0 && c.savings > 0 },
  { key: "dix-pourcent", label: "10 %", hint: "épargner au moins 10 % de ton budget", earned: (c) => c.budget > 0 && c.savingsRate >= 10 },
  { key: "objectif", label: "objectif", hint: "te fixer un objectif d'épargne", earned: (c) => c.goalTarget > 0 },
  { key: "sur-mesure", label: "sur mesure", hint: "choisir ta situation ou ta répartition", earned: (c) => c.customized },
  { key: "a-la-trace", label: "à la trace", hint: "noter une première dépense", earned: (c) => spentTotal(c) > 0 },
  {
    key: "dans-les-clous",
    label: "dans les clous",
    hint: "dépenser la moitié de ton budget sans dépasser aucun poste",
    earned: (c) =>
      c.lines.length > 0 &&
      c.spendable > 0 &&
      spentTotal(c) >= c.spendable / 2 &&
      c.lines.every((l) => (c.spent[l.key] ?? 0) <= l.month),
  },
  { key: "partageur", label: "partageur", hint: "partager ton budget avec un lien", earned: (c) => c.events.has("share") },
  { key: "connecte", label: "connecté", hint: "créer ton compte", earned: (c) => c.signedIn },
  { key: "habitue", label: "habitué", hint: "revenir 3 jours différents", earned: (c) => c.visits >= 3 },
  { key: "fidele", label: "fidèle", hint: "revenir 7 jours différents", earned: (c) => c.visits >= 7 },
  { key: "oiseau-de-nuit", label: "oiseau de nuit", hint: "faire tes comptes entre minuit et 5 h", earned: (c) => c.budget > 0 && c.hour < 5 },
];

/** Badges newly earned in this context, not already in `owned`. */
export function newlyEarned(context: BadgeContext, owned: Record<string, string>): Badge[] {
  return BADGES.filter((b) => !owned[b.key] && b.earned(context));
}

/** Validates stored badges: known keys with an ISO date only. */
export function cleanBadges(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const b of BADGES) {
    const v = Object.prototype.hasOwnProperty.call(src, b.key) ? src[b.key] : undefined;
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[b.key] = v;
  }
  return out;
}

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Distinct visit days, newest last, at most 60. */
export function cleanVisits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const days = raw.filter((v): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
  return [...new Set(days)].sort().slice(-60);
}

export function addVisit(visits: string[], today: string = dayKey()): string[] {
  return visits.includes(today) ? visits : cleanVisits([...visits, today]);
}

export function formatBadgeDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}
