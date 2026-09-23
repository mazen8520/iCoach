import type { User } from "@supabase/supabase-js";
import type { UserRole } from "./database.types";

/** Temporary password every coach-created athlete account starts with. It is not a secret —
 *  the coach relays it to the athlete — and it is never stored anywhere except as Supabase
 *  Auth's password hash. The athlete is forced to replace it on first sign-in. */
export const DEFAULT_ATHLETE_PASSWORD = "icoach123";

export const MIN_PASSWORD_LENGTH = 8;

/** True while the account still has to replace its temporary password. The authoritative flag
 *  lives in app_metadata (only the service role can write it); user_metadata is honoured too so
 *  accounts flagged before app_metadata was used keep being forced through the change. */
export function mustChangePassword(user: Pick<User, "app_metadata" | "user_metadata"> | null) {
  if (!user) return false;
  return (
    user.app_metadata?.["must_change_password"] === true ||
    user.user_metadata?.["must_change_password"] === true
  );
}

export function dashboardPath(role: UserRole) {
  return role === "coach" ? "/coach/dashboard" : "/client/dashboard";
}
