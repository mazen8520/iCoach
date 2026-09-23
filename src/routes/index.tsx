import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, Dumbbell, MoveRight, Play, Zap } from "lucide-react";
import { Brand } from "@/components/icoach/brand";
import { LanguageSwitch } from "@/components/icoach/language-switch";
import { Button } from "@/components/ui/button";
import { pageMeta, useI18n } from "@/lib/i18n";
import hero from "@/assets/icoach-hero-man.jpg";

export const Route = createFileRoute("/")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.home", "meta.homeDescription"),
  component: Landing,
});
function Landing() {
  const { t } = useI18n();
  return (
    <main className="landing">
      <img
        src={hero}
        width={1920}
        height={1280}
        alt={t("landing.heroAlt")}
        className="landing-image"
      />
      <div className="landing-shade" />
      <header className="landing-nav">
        <Brand />
        <span className="hidden text-xs font-bold uppercase tracking-[.18em] text-muted-foreground md:block">
          {t("landing.builtFor")}
        </span>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          {/* Signing in (or being signed in already) decides which dashboard opens. */}
          <Link to="/sign-in">
            <Button variant="outline" size="sm">
              {t("landing.enter")} <ArrowUpRight />
            </Button>
          </Link>
        </div>
      </header>
      <section className="landing-copy">
        <p className="eyebrow animate-enter">{t("landing.eyebrow")}</p>
        <h1>
          {t("landing.headline1")}
          <br />
          <em>{t("landing.headline2")}</em>
        </h1>
        <p className="landing-description">{t("landing.description")}</p>
        <div className="landing-actions">
          <Link to="/sign-in" search={{ as: "athlete" }}>
            <Button size="lg">
              {t("landing.athlete")} <MoveRight />
            </Button>
          </Link>
          <Link to="/sign-in" search={{ as: "coach" }}>
            <Button variant="outline" size="lg">
              {t("landing.coach")} <ChevronRight />
            </Button>
          </Link>
        </div>
        <div className="landing-proof">
          <div>
            <Zap />
            <b>87%</b>
            <span>{t("landing.proof.completion")}</span>
          </div>
          <div>
            <Dumbbell />
            <b>24</b>
            <span>{t("landing.proof.athletes")}</span>
          </div>
          <div>
            <Play />
            <b>164</b>
            <span>{t("landing.proof.sessions")}</span>
          </div>
        </div>
      </section>
      <div className="landing-scroll">
        <span />
        {t("landing.scroll")}
      </div>
    </main>
  );
}
