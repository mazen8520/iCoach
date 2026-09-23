import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import type { Profile, UserRole } from "./database.types";
import { mustChangePassword as needsPasswordChange } from "./account";
import { completeRequiredPasswordChange } from "./password.functions";

type SignInResult = {
  error: string | null;
  role: UserRole | null;
  mustChangePassword: boolean;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  /** The CURRENT user's profile row — never a previous account's, even mid-switch. */
  profile: Profile | null;
  /** True until both the session and the current user's profile are known. */
  loading: boolean;
  /** The signed-in user has no readable profile row (e.g. it was deleted). */
  profileError: boolean;
  /** Coach-created athlete still on the temporary password. */
  mustChangePassword: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  /** Public sign-up always creates a coach account — athletes are created by their coach
   *  (see src/lib/create-athlete.functions.ts) and never self-register. */
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
};

type ProfileState = { userId: string; profile: Profile | null; error: boolean };

const AuthContext = createContext<AuthState | null>(null);

/** Forget the persisted Supabase session on this device (used when the sign-out request itself
 *  can't reach Supabase, so the next visit can't silently restore the old account). */
function clearStoredSession() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (/^sb-.+-auth-token(-code-verifier)?$/.test(key)) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable — nothing persisted to clear.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState | null>(null);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitialized(true);
    });

    // Only record the new session here: supabase-js can deadlock if other Supabase calls are
    // awaited inside this callback. The profile is loaded by the effect below instead.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setInitialized(true);
    });

    // A page restored from the back/forward cache must re-check who (if anyone) is signed in,
    // rather than showing whatever account's screen was frozen in the cache.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      supabase.auth.getSession().then(({ data }) => active && setSession(data.session));
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const fetchProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    // A different account signed in (or everyone signed out) while this was in flight.
    if (userIdRef.current !== id) return;
    setProfileState({
      userId: id,
      profile: (data as Profile | null) ?? null,
      error: !!error || !data,
    });
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
    if (!initialized) return;

    // The account on this device changed (sign-out, or a different user signed in): drop every
    // cached query so nothing from the previous account can render for the next one.
    const previous = previousUserIdRef.current;
    if (previous !== null && previous !== userId) queryClient.clear();
    previousUserIdRef.current = userId;

    if (!userId) {
      setProfileState(null);
      return;
    }
    void fetchProfile(userId);
  }, [userId, initialized, fetchProfile, queryClient]);

  const current = profileState && userId && profileState.userId === userId ? profileState : null;
  const profile = current?.profile ?? null;
  const loading = !initialized || (!!userId && !current);

  const value: AuthState = {
    user,
    session,
    profile,
    loading,
    profileError: current?.error ?? false,
    mustChangePassword: needsPasswordChange(user),
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return { error: error?.message ?? "Sign in failed", role: null, mustChangePassword: false };
      }
      // Always resolve the role from the database for the account that JUST signed in.
      const { data: fresh, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError || !fresh) {
        await supabase.auth.signOut({ scope: "local" });
        return {
          error: profileError?.message ?? "PROFILE_MISSING",
          role: null,
          mustChangePassword: false,
        };
      }
      return {
        error: null,
        role: fresh.role as UserRole,
        mustChangePassword: needsPasswordChange(data.user),
      };
    },
    signUp: async (email, password, fullName) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      // With "Confirm email" enabled in Supabase Auth there's no session until the link is clicked.
      return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) clearStoredSession();
      userIdRef.current = null;
      setSession(null);
      setProfileState(null);
      queryClient.clear();
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error?.message ?? null };
    },
    updatePassword: async (password) => {
      if (needsPasswordChange(user)) {
        // Forced first-login change: the flag can only be cleared server-side.
        if (!session) return { error: "SESSION_EXPIRED" };
        try {
          await completeRequiredPasswordChange({
            data: { accessToken: session.access_token, password },
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : "PASSWORD_UPDATE_FAILED" };
        }
        // Changing the password revokes the old refresh token, so start a fresh session with
        // the new password — it also carries the cleared must_change_password flag.
        const { error } = await supabase.auth.signInWithPassword({
          email: user?.email ?? "",
          password,
        });
        return { error: error?.message ?? null };
      }
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error?.message ?? null };
    },
    refreshProfile: async () => {
      if (userId) await fetchProfile(userId);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
