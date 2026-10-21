import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "../lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { AppTour } from "@/components/icoach/app-tour";
import { NativeBridge } from "@/components/icoach/native-bridge";
import { LanguageProvider, dirFor, pageMeta, translate, useI18n } from "@/lib/i18n";
import { getPersistedLang, type Lang } from "@/lib/i18n/lang-cookie";

/** The page language from the root route context. Usable outside LanguageProvider (the 404 and
 *  error screens can render without it). */
function useRootLang(): Lang {
  return useRouterState({
    select: (s) => (s.matches[0]?.context as { lang?: Lang } | undefined)?.lang ?? "en",
  });
}

function NotFoundComponent() {
  const lang = useRootLang();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {translate(lang, "notFound.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{translate(lang, "notFound.body")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {translate(lang, "common.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const lang = useRootLang();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {translate(lang, "errorPage.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{translate(lang, "errorPage.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {translate(lang, "common.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {translate(lang, "common.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Read on the server (cookie header) and in the browser (document.cookie) so the first render
  // is already in the chosen language and direction.
  beforeLoad: () => ({ lang: getPersistedLang() }),
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      // viewport-fit=cover lets the app shells and home-screen installs draw under the status
      // bar and home indicator; every edge that matters pads itself with env(safe-area-inset-*).
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      ...pageMeta(match.context.lang, "meta.appTitle").meta,
      { name: "author", content: "iCoach" },
      { name: "theme-color", content: "#1b1b1e" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "iCoach" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      // The faces styles.css names (--font-sans / --font-display); without these the app fell
      // back to system fonts.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const lang = useRootLang();
  return (
    <html lang={lang} dir={dirFor(lang)}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function LocalizedToaster() {
  const { dir, t } = useI18n();
  return (
    <Toaster
      dir={dir}
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      containerAriaLabel={t("shell.notifications")}
      // On phones, clear the bottom tab bar and the home indicator.
      mobileOffset={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
    />
  );
}

function RootComponent() {
  const { queryClient, lang } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLang={lang}>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <LocalizedToaster />
          {/* Mobile app: first-run tour (outlives route changes) and native behaviour. */}
          <AppTour />
          <NativeBridge />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
