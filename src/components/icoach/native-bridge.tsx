// Native behaviour for the iOS/Android app shells (capacitor.config.ts). Renders nothing and does
// nothing on the web. Inside the app it:
// - marks <html> so styles can target the app, and hides the native splash once React is up;
// - gives Android's back button app behaviour (close the open sheet, then go back, then leave);
// - sends links that leave iCoach to the right place (Zoom app, in-app browser, Mail, Phone);
// - finishes deep links (icoach://zoom after connecting Zoom in the in-app browser);
// - refreshes data when the app returns to the foreground;
// - hides the bottom tab bar while the keyboard is open.
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { dashboardPath } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import {
  APP_URL_SCHEME,
  closeInAppBrowser,
  isNativeApp,
  nativePlatform,
  openExternal,
  runNativeBackHandlers,
} from "@/lib/native";

/** Screens where Back leaves the app instead of going back. */
const HOME_PATHS = new Set(["/app", "/coach/dashboard", "/client/dashboard"]);
const AUTH_PATHS = new Set(["/sign-in", "/sign-up", "/forgot-password"]);
const ZOOM_RESULTS = ["connected", "denied", "expired", "error", "install"] as const;
type ZoomResult = (typeof ZOOM_RESULTS)[number];

/** Anything Escape would close: Radix dialogs, sheets, menus, selects and popovers, the shell's
 *  own sheets (data-back-dismiss) and the celebration overlay. */
const OPEN_OVERLAY = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  "[data-radix-popper-content-wrapper]",
  "[data-back-dismiss]",
  ".celebrate",
].join(",");

const VIEWPORT =
  "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no";

export function NativeBridge() {
  if (!isNativeApp()) return null;
  return <NativeBridgeEffects />;
}

function NativeBridgeEffects() {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;

  // <html> classes, app viewport (no input zoom, no pinch), and the splash screen.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("native-app", `platform-${nativePlatform()}`);
    const onScreen = () => {
      document.querySelector('meta[name="viewport"]')?.setAttribute("content", VIEWPORT);
      // A full page load of "/" (e.g. "Go home" on an error page) renders the website's landing
      // page on the server; the app's home is /app.
      if (router.state.location.pathname === "/") void navigate({ to: "/app", replace: true });
    };
    onScreen();
    const unsubscribe = router.subscribe("onResolved", onScreen);
    void import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 250 }))
      .catch(() => undefined);
    return unsubscribe;
  }, [router, navigate]);

  // Links that leave iCoach, and window.open (a new tab means nothing inside the app).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return;
      const raw = anchor.getAttribute("href") ?? "";
      if (!raw || raw.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.protocol === "blob:" || url.protocol === "data:" || url.protocol === "javascript:")
        return;
      const sameOrigin = url.origin === window.location.origin;
      if (sameOrigin && anchor.target !== "_blank") return; // Ordinary in-app navigation.
      e.preventDefault();
      if (sameOrigin) router.history.push(url.pathname + url.search + url.hash);
      else void openExternal(url.href);
    };
    // Bubble phase on window: React's own handlers (and their preventDefault) run first.
    window.addEventListener("click", onClick);

    const originalOpen = window.open;
    window.open = ((target?: string | URL) => {
      const href = target ? String(target) : "";
      if (href && href !== "about:blank") void openExternal(href);
      return null;
    }) as typeof window.open;

    return () => {
      window.removeEventListener("click", onClick);
      window.open = originalOpen;
    };
  }, [router]);

  // Android back button, app lifecycle, deep links and the keyboard.
  useEffect(() => {
    let disposed = false;
    const removers: Array<() => void> = [];
    const keep = (handle: { remove: () => Promise<void> }) => {
      if (disposed) void handle.remove();
      else removers.push(() => void handle.remove());
    };

    let lastDismissed: Element | null = null;
    const dismissTopOverlay = (): boolean => {
      const overlay = document.querySelector(OPEN_OVERLAY);
      // An overlay that ignored Escape last time must not trap Back forever.
      if (!overlay || overlay === lastDismissed) {
        lastDismissed = null;
        return false;
      }
      lastDismissed = overlay;
      const target =
        document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          bubbles: true,
          cancelable: true,
        }),
      );
      window.setTimeout(() => {
        if (lastDismissed && !lastDismissed.isConnected) lastDismissed = null;
      }, 400);
      return true;
    };

    const zoomReturn = (url: URL) => {
      void closeInAppBrowser();
      void queryClient.invalidateQueries({ queryKey: ["zoom-status"] });
      const result = url.searchParams.get("result");
      const zoom = ZOOM_RESULTS.includes(result as ZoomResult) ? (result as ZoomResult) : undefined;
      void navigate({
        to: "/coach/settings",
        search: zoom ? { tab: "integrations", zoom } : { tab: "integrations" },
      });
    };

    const openAppUrl = (raw: string) => {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return;
      }
      if (url.protocol === `${APP_URL_SCHEME}:`) {
        const action = url.hostname || url.pathname.replace(/^\/+/, "");
        if (action === "zoom") zoomReturn(url);
        return;
      }
      if (url.origin === window.location.origin) {
        router.history.push(url.pathname + url.search + url.hash);
      }
    };

    void (async () => {
      const [{ App }, { Keyboard }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/keyboard"),
        import("@capacitor/browser"),
      ]);
      if (disposed) return;

      keep(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (runNativeBackHandlers() || dismissTopOverlay()) return;
          const path = router.state.location.pathname;
          const { user, profile, mustChangePassword } = authRef.current;
          if (HOME_PATHS.has(path) || (path === "/reset-password" && mustChangePassword)) {
            void App.minimizeApp();
          } else if (canGoBack) {
            window.history.back();
          } else if (AUTH_PATHS.has(path) || !user || !profile) {
            void navigate({ to: "/app", replace: true });
          } else {
            void navigate({ to: dashboardPath(profile.role), replace: true });
          }
        }),
      );

      // Coming back to the app after a while: show fresh data.
      let pausedAt = 0;
      keep(await App.addListener("pause", () => void (pausedAt = Date.now())));
      keep(
        await App.addListener("resume", () => {
          if (pausedAt && Date.now() - pausedAt > 20_000) void queryClient.invalidateQueries();
        }),
      );

      keep(await App.addListener("appUrlOpen", ({ url }) => openAppUrl(url)));
      // Cold start from a deep link (the OS may close the app while the in-app browser is open).
      const launch = await App.getLaunchUrl().catch(() => undefined);
      if (launch?.url && !disposed) {
        const seenKey = `icoach:launch-url:${launch.url}`;
        let seen = false;
        try {
          seen = sessionStorage.getItem(seenKey) !== null;
          sessionStorage.setItem(seenKey, "1");
        } catch {
          // Without sessionStorage a reload may replay the link once; harmless.
        }
        if (!seen) openAppUrl(launch.url);
      }

      // Closed the in-app browser by hand (e.g. mid Zoom sign-in): re-check the connection.
      keep(
        await Browser.addListener("browserFinished", () => {
          void queryClient.invalidateQueries({ queryKey: ["zoom-status"] });
        }),
      );

      const root = document.documentElement;
      keep(
        await Keyboard.addListener("keyboardWillShow", () => root.classList.add("keyboard-open")),
      );
      keep(
        await Keyboard.addListener("keyboardWillHide", () =>
          root.classList.remove("keyboard-open"),
        ),
      );
    })().catch(() => undefined);

    return () => {
      disposed = true;
      removers.forEach((remove) => remove());
    };
  }, [router, navigate, queryClient]);

  return null;
}
