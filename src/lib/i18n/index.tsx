import { useRouter } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type TranslationKey } from "./en";
import { ar } from "./ar";
import { hasLangCookie, persistLang, readStoredLang, type Lang } from "./lang-cookie";

export type { Lang } from "./lang-cookie";
export type { TranslationKey } from "./en";

type Params = Record<string, string | number | null | undefined>;
/** Keys that have plural variants ("x_one", "x_other", and for Arabic also zero/two/few/many). */
export type PluralKey = {
  [K in TranslationKey]: K extends `${infer Base}_other` ? Base : never;
}[TranslationKey];

const dictionaries: Record<Lang, Record<string, string>> = { en, ar };

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

/** Intl locale for dates. Arabic keeps Latin digits so dates match every other number on screen;
 *  English keeps the browser's own English locale, as before. */
export function localeFor(lang: Lang): string | undefined {
  return lang === "ar" ? "ar-u-nu-latn" : undefined;
}

function interpolate(template: string, params?: Params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export function translate(lang: Lang, key: TranslationKey, params?: Params): string {
  const template = dictionaries[lang][key] ?? en[key] ?? key;
  return interpolate(template, params);
}

export function translatePlural(lang: Lang, key: PluralKey, count: number, params?: Params) {
  const dict = dictionaries[lang];
  const rule = new Intl.PluralRules(lang).select(count);
  const template =
    dict[`${key}_${rule}`] ?? dict[`${key}_other`] ?? en[`${key}_other` as TranslationKey];
  return interpolate(template ?? key, { count, ...params });
}

function createFormatters(lang: Lang, t: (key: TranslationKey, params?: Params) => string) {
  const locale = localeFor(lang);
  const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));
  return {
    locale,
    date: (value: string | Date, options: Intl.DateTimeFormatOptions) =>
      toDate(value).toLocaleDateString(locale, options),
    /** "09:30" in the viewer's clock style. */
    clock: (value: string | Date | null | undefined) =>
      value ? toDate(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "",
    /** Short weekday label, e.g. "MON" / "الاثنين". */
    weekday: (value: string | Date | null | undefined) => {
      if (!value) return "";
      const label = toDate(value).toLocaleDateString(locale, { weekday: "short" });
      return lang === "en" ? label.toUpperCase() : label;
    },
    /** Short month label, e.g. "SEP" / "سبتمبر". */
    month: (value: string | Date) => {
      const label = toDate(value).toLocaleDateString(locale, { month: "short" });
      return lang === "en" ? label.toUpperCase() : label;
    },
    timeAgo: (value: string | null | undefined) => {
      if (!value) return "";
      const diffMs = Date.now() - new Date(value).getTime();
      const minutes = Math.round(diffMs / 60000);
      if (minutes < 1) return t("time.justNow");
      if (minutes < 60) return translatePlural(lang, "time.minutesAgo", minutes);
      const hours = Math.round(minutes / 60);
      if (hours < 24) return translatePlural(lang, "time.hoursAgo", hours);
      const days = Math.round(hours / 24);
      if (days === 1) return t("time.yesterday");
      if (days < 7) return translatePlural(lang, "time.daysAgo", days);
      return new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric" });
    },
  };
}

export type I18n = {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (key: TranslationKey, params?: Params) => string;
  tp: (key: PluralKey, count: number, params?: Params) => string;
  fmt: ReturnType<typeof createFormatters>;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18n | null>(null);

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => setLangState(initialLang), [initialLang]);

  const setLang = useCallback(
    (next: Lang) => {
      persistLang(next);
      setLangState(next);
      document.documentElement.lang = next;
      document.documentElement.dir = dirFor(next);
      // Re-run the root route's beforeLoad so page titles and <html lang/dir> follow the choice.
      void router.invalidate();
    },
    [router],
  );

  // A browser that lost the cookie but still remembers the choice in localStorage.
  useEffect(() => {
    if (hasLangCookie()) return;
    const stored = readStoredLang();
    if (stored && stored !== lang) setLang(stored);
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  const value = useMemo<I18n>(() => {
    const t = (key: TranslationKey, params?: Params) => translate(lang, key, params);
    return {
      lang,
      dir: dirFor(lang),
      t,
      tp: (key, count, params) => translatePlural(lang, key, count, params),
      fmt: createFormatters(lang, t),
      setLang,
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}

/** Title/description meta tags for a route's head(), in the language the page renders in. */
export function pageMeta(
  lang: Lang | undefined,
  titleKey: TranslationKey,
  descKey?: TranslationKey,
) {
  const l = lang ?? "en";
  const title = translate(l, titleKey);
  const description = translate(l, descKey ?? "meta.defaultDescription");
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
