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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      ...pageMeta(match.context.lang, "meta.appTitle").meta,
      { name: "author", content: "iCoach" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
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
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
