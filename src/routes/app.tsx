import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ChevronRight, MoveRight } from "lucide-react";
import { Brand } from "@/components/icoach/brand";
import { LanguageSwitch } from "@/components/icoach/language-switch";
import { Button } from "@/components/ui/button";
import { dashboardPath } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { pageMeta, useI18n } from "@/lib/i18n";
import hero from "@/assets/icoach-hero.jpg";

// The front door of the iOS/Android app (capacitor.config.ts opens the app here) and of the
// home-screen web app. A signed-in account goes straight to its dashboard; everyone else picks
// athlete or coach. The public landing page stays the website's front door.
export const Route = createFileRoute("/app")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.app"),
  component: AppHome,
});

function AppHome() {
  const { user, profile, profileError, loading, mustChangePassword } = useAuth();
  if (loading) return <LaunchScreen />;
  if (user && mustChangePassword) return <Navigate to="/reset-password" replace />;
  if (user && profile) return <Navigate to={dashboardPath(profile.role)} replace />;
  // Signed in without a readable profile: the sign-in page explains and offers to sign out.
  if (user && profileError) return <Navigate to="/sign-in" replace />;
  return <Welcome />;
}

/** Same mark, same ground as the native splash, so the hand-off from it is seamless. */
function LaunchScreen() {
  const { t } = useI18n();
  return (
    <main className="app-launch" role="status" aria-label={t("shell.loading")}>
      <span className="app-launch-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
        </svg>
      </span>
    </main>
  );
}

function Welcome() {
  const { t } = useI18n();
  return (
    <main className="app-welcome">
      <img
        src={hero}
        width={1920}
        height={1280}
        alt={t("landing.heroAlt")}
        className="app-welcome-photo"
      />
      <div className="app-welcome-shade" aria-hidden="true" />
      <header className="app-welcome-bar">
        <Brand />
        <LanguageSwitch />
      </header>
      <section className="app-welcome-copy">
        <h1>
          <span>{t("landing.headline1")}</span>
          <em>{t("landing.headline2")}</em>
        </h1>
        <p>{t("landing.description")}</p>
        <div className="app-welcome-actions">
          <Button asChild size="lg" className="cta-primary">
            <Link to="/sign-in" search={{ as: "athlete" }} replace>
              {t("landing.athlete")} <MoveRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/sign-in" search={{ as: "coach" }} replace>
              {t("landing.coach")} <ChevronRight />
            </Link>
          </Button>
        </div>
        <p className="app-welcome-foot">
          {t("app.newCoach")}{" "}
          <Link to="/sign-up" replace>
            {t("landing.coaches.cta")}
          </Link>
        </p>
      </section>
    </main>
  );
}
