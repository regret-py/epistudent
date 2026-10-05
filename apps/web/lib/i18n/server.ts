import "server-only";
import { cookies, headers } from "next/headers";
import en from "./dictionaries/en";
import fr from "./dictionaries/fr";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Dictionary, type Locale } from "./types";

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function getLocale(): Locale {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = headers().get("accept-language") ?? "";
  const preferred = accept
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2).toLowerCase())
    .find(isLocale);
  return preferred ?? DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale = getLocale()): Dictionary {
  return dictionaries[locale];
}
