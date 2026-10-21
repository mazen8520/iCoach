// The iOS and Android apps are Capacitor shells that load this same site (capacitor.config.ts),
// so every screen, server function and the Supabase database are shared with the web. This
// module is the one place the web code asks "am I inside the app?" and reaches native features.
// Everything here is safe to import during SSR: nothing touches `window` until it is called.
// Capacitor plugins are loaded lazily, so browsers never download them.

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** Running inside the iCoach iOS/Android app. The native shell injects `window.Capacitor`
 *  before any page script runs, so this is already correct on the first render. */
export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

export function nativePlatform(): "ios" | "android" | "web" {
  const platform = isNativeApp() ? capacitor()?.getPlatform?.() : "web";
  return platform === "ios" || platform === "android" ? platform : "web";
}

/** Installed from the browser to the home screen (iOS "Add to Home Screen", Android install). */
export function isStandaloneWebApp(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/** Any installed-app context: the native shells or a home-screen web app. */
export function isAppContext(): boolean {
  return isNativeApp() || isStandaloneWebApp();
}

/** Custom URL scheme registered by both native shells (Info.plist / AndroidManifest.xml). */
export const APP_URL_SCHEME = "icoach";

function isZoomHost(host: string): boolean {
  return /(^|\.)zoom\.(us|com)$/i.test(host);
}

/**
 * Opens a link that leaves iCoach.
 * - App: Zoom links and mailto/tel go to the system, so the Zoom app (or Mail, Phone) opens
 *   them; other web pages open in the in-app browser and the athlete stays in iCoach.
 * - Web: a new tab, as before.
 */
export async function openExternal(href: string): Promise<void> {
  if (!isNativeApp()) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return;
  }
  const web = url.protocol === "https:" || url.protocol === "http:";
  if (web && !isZoomHost(url.hostname)) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: url.href, presentationStyle: "popover", toolbarColor: "#1b1b1e" });
      return;
    } catch {
      // Fall through to the system handler.
    }
  }
  try {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    const { completed } = await AppLauncher.openUrl({ url: url.href });
    if (completed) return;
  } catch {
    // Fall through.
  }
  // Last resort: a top-level navigation to another site, which the shell hands to the system.
  window.location.assign(url.href);
}

/** Opens a page in the in-app browser (Safari View Controller / Chrome Custom Tab). Used for
 *  sign-in flows such as Zoom's, which must not run inside the app's own web view. */
export async function openInAppBrowser(href: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: href, presentationStyle: "fullscreen", toolbarColor: "#1b1b1e" });
}

export async function closeInAppBrowser(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // Nothing open.
  }
}

/** Copies text to the clipboard. The app uses the native clipboard: the web Clipboard API is
 *  unreliable inside Android's web view. */
export async function copyText(text: string): Promise<void> {
  if (isNativeApp()) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: text });
    return;
  }
  await navigator.clipboard.writeText(text);
}

type HapticKind = "selection" | "light" | "medium" | "success" | "warning";

/** A short vibration in the app; does nothing on the web. Never throws. */
export function haptic(kind: HapticKind = "light"): void {
  if (!isNativeApp()) return;
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle, NotificationType }) => {
      switch (kind) {
        case "selection":
          return Haptics.selectionChanged();
        case "medium":
          return Haptics.impact({ style: ImpactStyle.Medium });
        case "success":
          return Haptics.notification({ type: NotificationType.Success });
        case "warning":
          return Haptics.notification({ type: NotificationType.Warning });
        default:
          return Haptics.impact({ style: ImpactStyle.Light });
      }
    })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------
// Android back button. Screens that own a temporary state (the app tour, an open sheet) register
// a handler; the newest one gets the first chance to consume the press. See native-bridge.tsx.
// ---------------------------------------------------------------------------------------------

type BackHandler = () => boolean;
const backHandlers: BackHandler[] = [];

/** Registers a back-button handler. Return true from it to consume the press. Returns the
 *  unregister function. */
export function onNativeBack(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
  };
}

/** Offers a back press to the registered handlers, newest first. */
export function runNativeBackHandlers(): boolean {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    if (backHandlers[i]?.()) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// App tour (src/components/icoach/app-tour.tsx)
// ---------------------------------------------------------------------------------------------

export const START_TOUR_EVENT = "icoach:start-tour";

/** Replays the app tour on the current screen. */
export function startAppTour(): void {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}
