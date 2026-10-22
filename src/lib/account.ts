import type { User } from "@supabase/supabase-js";
import type { UserRole } from "./database.types";

// No lookalike characters (0/O, 1/l/I) so the coach can read the password out loud or retype it.
const TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A fresh random temporary password for one coach-created athlete, e.g. "k7Qm-x2Rt-9bHw"
 *  (~68 bits). Each account gets its own, so knowing one athlete's password never opens another
 *  account. The athlete is forced to replace it on first sign-in. */
export function generateTemporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  // 256 is not a multiple of the alphabet size; rejecting the top bytes keeps every character
  // equally likely.
  const limit = 256 - (256 % TEMP_PASSWORD_ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < 12) {
    for (const byte of bytes) {
      if (chars.length === 12) break;
      if (byte < limit) chars.push(TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]!);
    }
    crypto.getRandomValues(bytes);
  }
  return [0, 4, 8].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

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
