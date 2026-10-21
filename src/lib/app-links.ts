// Store listings for the iCoach mobile apps, used by the download buttons on the home page.
//
// Until an app is published its button says "Coming soon" and explains how to use iCoach in the
// browser meanwhile. Once a listing is live, set its URL in the Vercel project
// (Settings → Environment Variables) and redeploy:
//   VITE_APP_STORE_URL   e.g. https://apps.apple.com/app/icoach/id0000000000
//   VITE_PLAY_STORE_URL  e.g. https://play.google.com/store/apps/details?id=com.icoach.performance
// Or replace the empty fallbacks below with the URLs.

function listing(value: string | undefined, fallback: string): string | null {
  const url = (value ?? "").trim() || fallback;
  return /^https:\/\//.test(url) ? url : null;
}

export const APP_STORE_URL = listing(import.meta.env["VITE_APP_STORE_URL"], "");
export const PLAY_STORE_URL = listing(import.meta.env["VITE_PLAY_STORE_URL"], "");
