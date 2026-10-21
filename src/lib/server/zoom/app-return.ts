// The iOS/Android app runs Zoom's consent screen in the in-app browser (Safari View Controller /
// Chrome Custom Tab) rather than inside its own web view, where Zoom's Google and Apple sign-in
// are refused. The OAuth state of such an attempt carries APP_STATE_SUFFIX, and the callback then
// ends on a small page that hands the result back to the app through the icoach:// scheme,
// instead of redirecting that browser to a settings page it isn't signed in to.

/** base64url state tokens never contain ".", so the suffix can't occur by chance. */
export const APP_STATE_SUFFIX = ".app";

export function stateFor(token: string, returnTo?: "app"): string {
  return returnTo === "app" ? `${token}${APP_STATE_SUFFIX}` : token;
}

export function isAppState(state: string | null | undefined): boolean {
  return !!state && state.endsWith(APP_STATE_SUFFIX);
}

export function appReturnUrl(result: string): string {
  return `icoach://zoom?result=${encodeURIComponent(result)}`;
}

const COPY = {
  connected: { en: "Zoom is connected", ar: "تم ربط Zoom" },
  denied: { en: "Zoom wasn't connected", ar: "لم يتم ربط Zoom" },
  failed: { en: "Couldn't connect Zoom", ar: "تعذّر ربط Zoom" },
} as const;

/** The page the in-app browser lands on. It opens the app straight away; the button is there
 *  for browsers that only follow an app link on a tap. */
export function appReturnPage(result: string): Response {
  const href = appReturnUrl(result);
  const copy =
    result === "connected" ? COPY.connected : result === "denied" ? COPY.denied : COPY.failed;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>iCoach</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px;
    background: #1b1b1e; color: #f4f1ed;
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { width: min(100%, 360px); text-align: center; }
  .mark {
    display: inline-grid; width: 56px; height: 56px; place-items: center; margin-bottom: 20px;
    background: #f40d1f; transform: skew(-8deg); box-shadow: 0 12px 32px rgb(244 13 31 / 0.3);
  }
  .mark svg { width: 28px; height: 28px; fill: none; stroke: #fff; stroke-width: 2.6;
    stroke-linecap: round; stroke-linejoin: round; transform: skew(8deg); }
  h1 { margin: 0; font-size: 1.35rem; letter-spacing: 0.01em; }
  h1 + h1 { margin-top: 2px; font-weight: 600; color: #a9aab2; }
  p { margin: 14px 0 26px; color: #a9aab2; }
  a {
    display: block; padding: 14px 18px; background: #f40d1f; color: #fff; font-weight: 700;
    text-decoration: none; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.8rem;
    border-radius: 10px;
  }
</style>
</head>
<body>
<main>
  <span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg></span>
  <h1>${copy.en}</h1>
  <h1 lang="ar" dir="rtl">${copy.ar}</h1>
  <p>Returning you to iCoach… <span lang="ar" dir="rtl">جارٍ العودة إلى iCoach…</span></p>
  <a href="${href}">Open iCoach · افتح iCoach</a>
</main>
<script>setTimeout(function () { location.replace(${JSON.stringify(href)}); }, 60);</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
