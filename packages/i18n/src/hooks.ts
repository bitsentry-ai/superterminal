import { useCallback } from "react";
import { useTranslation as useTranslationBase } from "react-i18next";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  mapLocaleToBackendCode,
  resolveSupportedLocale,
  type SupportedLocale,
} from "./config";
import { ensureLocaleResources } from "./instance";

export { useTranslationBase as useTranslation };

export interface UseLocaleResult {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => Promise<void>;
  supportedLocales: readonly SupportedLocale[];
  backendCode: string;
}

export function useLocale(): UseLocaleResult {
  const { i18n } = useTranslationBase();
  const current =
    resolveSupportedLocale(i18n.language) ??
    resolveSupportedLocale(i18n.resolvedLanguage) ??
    DEFAULT_LOCALE;

  const setLocale = useCallback(
    async (next: SupportedLocale) => {
      await ensureLocaleResources(next, i18n);
      await i18n.changeLanguage(next);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
        } catch {
          /* ignore storage errors */
        }
      }
      if (typeof document !== "undefined") {
        document.documentElement.lang = next;
      }
    },
    [i18n],
  );

  return {
    locale: current,
    setLocale,
    supportedLocales: SUPPORTED_LOCALES,
    backendCode: mapLocaleToBackendCode(current),
  };
}

export function getCurrentLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = resolveSupportedLocale(
      window.localStorage.getItem(LOCALE_STORAGE_KEY),
    );
    if (stored !== null) return stored;
  } catch {
    /* ignore storage errors */
  }
  if (typeof navigator !== "undefined") {
    const detected = resolveSupportedLocale(navigator.language);
    if (detected !== null) return detected;
  }
  return DEFAULT_LOCALE;
}
