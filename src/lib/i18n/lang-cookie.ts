import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

export type Lang = "en" | "ar";

export const LANG_COOKIE = "icoach-lang";
export const LANG_STORAGE_KEY = "icoach-lang";
export const DEFAULT_LANG: Lang = "en";

export function parseLang(value: string | null | undefined): Lang | null {
  return value === "ar" || value === "en" ? value : null;
}

function readDocumentCookie(): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/** The persisted language, read from the same cookie on the server (SSR) and in the browser so
 *  the first client render always matches the server-rendered HTML. */
export const getPersistedLang = createIsomorphicFn()
  .server((): Lang => parseLang(getCookie(LANG_COOKIE)) ?? DEFAULT_LANG)
  .client((): Lang => parseLang(readDocumentCookie()) ?? DEFAULT_LANG);

export function hasLangCookie(): boolean {
  return typeof document !== "undefined" && readDocumentCookie() !== undefined;
}

export function persistLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Storage can be unavailable (private mode); the cookie alone is enough.
  }
}

export function readStoredLang(): Lang | null {
  try {
    return parseLang(localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return null;
  }
}
