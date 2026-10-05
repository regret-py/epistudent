"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./dictionaries/en";
import fr from "./dictionaries/fr";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Dictionary, type Locale } from "./types";

const dictionaries: Record<Locale, Dictionary> = { fr, en };

type I18nContextValue = { locale: Locale; dict: Dictionary; setLocale: (l: Locale) => void };

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // storage blocked
  }
  const nav = navigator.languages?.[0] ?? navigator.language ?? "";
  return nav.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Static HTML is rendered in French; the real preference is applied after hydration.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // storage blocked: preference lasts for this visit
    }
  }, []);

  const value = useMemo(() => ({ locale, dict: dictionaries[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
