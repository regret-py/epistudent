import type { Locale } from "./i18n/types";

const tag = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-GB");

export function formatDateTime(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

export function formatMonth(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric" }).format(value);
}

/** "in 3 days" / "2 h ago" */
export function formatRelative(value: string | Date, locale: Locale, now = Date.now()) {
  const diff = new Date(value).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

/** <input type="datetime-local"> value -> ISO string in the user's timezone */
export function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

export type Urgency = "overdue" | "today" | "soon" | "later" | "none";

export function urgencyOf(deadline: string | null, now = Date.now()): Urgency {
  if (!deadline) return "none";
  const diff = new Date(deadline).getTime() - now;
  if (diff < 0) return "overdue";
  if (diff < 86_400_000) return "today";
  if (diff < 3 * 86_400_000) return "soon";
  return "later";
}
