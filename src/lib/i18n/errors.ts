import type { I18n, TranslationKey } from "./index";

/** Stable error codes thrown by this app's server functions. */
const CODE_KEYS: Record<string, TranslationKey> = {
  SESSION_EXPIRED: "errors.sessionExpired",
  NOT_COACH: "errors.notCoach",
  EMAIL_EXISTS: "errors.emailExists",
  WEAK_PASSWORD: "errors.weakPassword",
  SERVER_CONFIG: "errors.serverConfig",
  INVALID_INPUT: "errors.invalidInput",
  PASSWORD_SAME_AS_TEMPORARY: "errors.passwordSameAsTemporary",
  PASSWORD_CHANGE_NOT_REQUIRED: "errors.passwordChangeNotRequired",
  PROFILE_MISSING: "errors.profileMissing",
  NOT_YOUR_CLIENT: "errors.permissionDenied",
  MEETING_NOT_FOUND: "errors.meetingNotFound",
  MEETING_NOT_EDITABLE: "errors.meetingNotEditable",
  MEETING_NOT_ON_ZOOM: "errors.meetingNotOnZoom",
  ZOOM_NOT_CONFIGURED: "errors.zoomNotConfigured",
  ZOOM_NOT_CONNECTED: "errors.zoomNotConnected",
  ZOOM_REVOKED: "errors.zoomRevoked",
  ZOOM_RATE_LIMITED: "errors.zoomRateLimited",
  ZOOM_NOT_FOUND: "errors.zoomNotFound",
  ZOOM_REQUEST_FAILED: "errors.zoomRequestFailed",
};

/** Messages Supabase Auth / PostgREST / the browser commonly return. */
const MESSAGE_PATTERNS: [RegExp, TranslationKey][] = [
  [/invalid login credentials/i, "errors.invalidCredentials"],
  [/email not confirmed/i, "errors.emailNotConfirmed"],
  [/rate limit|too many requests|over_request_rate_limit/i, "errors.rateLimited"],
  [/failed to fetch|networkerror|network request failed|load failed/i, "errors.network"],
  [/already registered|already been registered|email_exists/i, "errors.emailExists"],
  [/password should|weak password|weak_password/i, "errors.weakPassword"],
  [/should be different from the old password|same_password/i, "errors.samePassword"],
  [/auth session missing|jwt expired|invalid jwt|refresh token/i, "errors.sessionExpired"],
  [
    /row-level security|permission denied|cannot change your account role/i,
    "errors.permissionDenied",
  ],
  [/athletes can only update workout progress/i, "errors.permissionDenied"],
  [/check_ins_client_id_week_start_date_key/i, "errors.checkInExists"],
  [/duplicate key|already exists/i, "errors.duplicate"],
  [/meetings_video_url_http/i, "errors.invalidUrl"],
  [/schedule_events_time_order/i, "errors.endBeforeStart"],
];

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return typeof err === "string" ? err : "";
}

/** A user-facing, translated message for any thrown error. Unrecognised messages are shown as-is
 *  in English (they're usually specific and useful) and replaced by the fallback in Arabic. */
export function errorText(
  err: unknown,
  i18n: Pick<I18n, "t" | "lang">,
  fallbackKey: TranslationKey,
): string {
  const message = messageOf(err).trim();
  const codeKey = CODE_KEYS[message];
  if (codeKey) return i18n.t(codeKey);
  for (const [pattern, key] of MESSAGE_PATTERNS) {
    if (pattern.test(message)) return i18n.t(key);
  }
  if (message && i18n.lang === "en" && !/^[A-Z_]+$/.test(message)) return message;
  return i18n.t(fallbackKey);
}
