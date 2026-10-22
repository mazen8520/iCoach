// Signs a website visitor out after a stretch without using iCoach, so a laptop left open (or
// reopened days later) asks for the password again instead of walking straight into the account.
// The last-activity time lives in localStorage, so every open tab shares it: working in one tab
// keeps the others signed in, and a sign-out in one reaches all of them. The iOS/Android apps
// are exempt — like any phone app they stay signed in, behind the phone's own lock screen.

export const IDLE_LIMIT_MS = 30 * 60 * 1000;

const LAST_ACTIVE_KEY = "icoach:last-active";
const IDLE_NOTICE_KEY = "icoach:idle-signed-out";
// Activity is written at most this often; reads compare against IDLE_LIMIT_MS, so the slack
// only ever errs towards keeping someone signed in a few seconds longer.
const WRITE_EVERY_MS = 15 * 1000;

/** True when the session has been idle for too long. A missing timestamp counts as idle: it
 *  means the session predates this check or was left behind by a browser that cleared it. */
export function isIdleExpired(lastActive: number | null, now: number, limit = IDLE_LIMIT_MS) {
  if (lastActive === null || !Number.isFinite(lastActive)) return true;
  return now - lastActive >= limit;
}

export function readLastActive(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

let lastWrite = 0;

export function markActive(now = Date.now(), force = false) {
  if (!force && now - lastWrite < WRITE_EVERY_MS) return;
  lastWrite = now;
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {
    // Storage blocked (private mode, site data disabled): the session then ends with the tab.
  }
}

export function clearLastActive() {
  lastWrite = 0;
  try {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    // Nothing stored.
  }
}

export function sessionIdleExpired() {
  return isIdleExpired(readLastActive(), Date.now());
}

/** A link from a confirmation / password-reset email signs the visitor in on arrival: that is
 *  fresh activity, not a stale session. */
export function arrivedFromEmailLink(location: Pick<Location, "hash" | "search">) {
  return /(?:^|[#&?])(access_token|code|token_hash)=/.test(`${location.search}${location.hash}`);
}

/** Remembered for the sign-in page, which explains why the visitor was signed out. */
export function flagIdleSignOut() {
  try {
    sessionStorage.setItem(IDLE_NOTICE_KEY, "1");
  } catch {
    // The notice is a nicety; the sign-out itself already happened.
  }
}

export function takeIdleSignOutFlag() {
  try {
    const flagged = sessionStorage.getItem(IDLE_NOTICE_KEY) === "1";
    sessionStorage.removeItem(IDLE_NOTICE_KEY);
    return flagged;
  } catch {
    return false;
  }
}

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/** Records activity and calls onExpire once the visitor has been away too long — checked every
 *  minute and whenever the tab becomes visible again (timers sleep with the laptop). */
export function watchIdle(onExpire: () => void) {
  const onActivity = () => markActive();
  const check = () => {
    if (document.visibilityState === "hidden") return;
    if (sessionIdleExpired()) onExpire();
  };
  for (const name of ACTIVITY_EVENTS) {
    window.addEventListener(name, onActivity, { passive: true, capture: true });
  }
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  const timer = window.setInterval(check, 60 * 1000);
  return () => {
    for (const name of ACTIVITY_EVENTS) {
      window.removeEventListener(name, onActivity, { capture: true });
    }
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("focus", check);
    window.clearInterval(timer);
  };
}
