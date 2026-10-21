import type { SupportedStorage } from "@supabase/supabase-js";

// Where the iOS/Android app keeps the Supabase session. A web view's localStorage can be cleared
// by the OS (iOS reclaims it under storage pressure), which would sign athletes out at random.
// Capacitor Preferences (UserDefaults / SharedPreferences) is never evicted, so the session
// lives there, mirrored to localStorage so the web view always has a readable copy too.

const SESSION_KEY = /^sb-.+-auth-token(-code-verifier)?$/;

async function preferences() {
  try {
    return (await import("@capacitor/preferences")).Preferences;
  } catch {
    return null;
  }
}

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable: the native copy still holds the session.
  }
}

export const nativeAuthStorage: SupportedStorage = {
  async getItem(key) {
    try {
      const prefs = await preferences();
      const stored = prefs ? (await prefs.get({ key })).value : null;
      if (stored !== null) return stored;
    } catch {
      // Preferences unavailable: fall back to the web view copy.
    }
    return localGet(key);
  },
  async setItem(key, value) {
    localSet(key, value);
    try {
      await (await preferences())?.set({ key, value });
    } catch {
      // The localStorage copy above still holds the session.
    }
  },
  async removeItem(key) {
    localSet(key, null);
    try {
      await (await preferences())?.remove({ key });
    } catch {
      // Nothing stored natively.
    }
  },
};

/** Forgets every stored Supabase session on this device (see clearStoredSession in auth.tsx). */
export async function clearNativeAuthStorage(): Promise<void> {
  const prefs = await preferences();
  if (!prefs) return;
  try {
    const { keys } = await prefs.keys();
    await Promise.all(keys.filter((k) => SESSION_KEY.test(k)).map((key) => prefs.remove({ key })));
  } catch {
    // Nothing stored natively.
  }
}
