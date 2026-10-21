// Public home page. Motion is CSS + inline SVG (transform/opacity only), switched off under
// prefers-reduced-motion. Content is fully visible without JavaScript: scroll reveals only arm
// once the page has hydrated and IntersectionObserver exists.
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarCheck2,
  ChevronRight,
  Dumbbell,
  MessagesSquare,
  MoveRight,
  Salad,
  Target,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { Button } from "@/components/ui/button";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { usePlatformStats } from "@/hooks/use-platform-stats";
import { PLACEHOLDER_STATS } from "@/lib/landing-stats";
import hero from "@/assets/icoach-hero-man.jpg";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Arms scroll reveals for everything marked data-reveal under the root. */
function useScrollReveal() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    el.classList.add("reveal-armed");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset["reveal"] = "in";
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
  return root;
}

/** Counts from 0 to `value` (ease-out) the first time it scrolls into view. */
function CountUp({ value, locale }: { value: number; locale: string | undefined }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(value);
      return;
    }
    setShown(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1600;
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(2, -10 * p);
          setShown(Math.round(value * (p >= 1 ? 1 : eased)));
          if (p < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <span ref={ref} className="count-up">
      <span aria-hidden="true">{shown.toLocaleString(locale)}</span>
      <span className="sr-only">{value.toLocaleString(locale)}</span>
    </span>
  );
}

/** Animated training floor: a barbell being lifted, a turning dumbbell, a swinging kettlebell
 *  and a heartbeat line, around a red glow. Decorative only. */
function GymStage() {
  return (
    <svg className="gym-stage" viewBox="0 0 520 520" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="stage-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="var(--primary)" stopOpacity="0.1" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stage-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.86 0.005 260)" />
          <stop offset="1" stopColor="oklch(0.58 0.008 260)" />
        </linearGradient>
        <linearGradient id="stage-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.36 0.008 260)" />
          <stop offset="1" stopColor="oklch(0.2 0.006 260)" />
        </linearGradient>
      </defs>

      <circle className="stage-glow" cx="260" cy="250" r="230" fill="url(#stage-glow)" />
      <g className="stage-rings">
        <circle cx="260" cy="250" r="205" />
        <circle cx="260" cy="250" r="160" strokeDasharray="4 12" />
        <circle cx="260" cy="250" r="118" />
      </g>

      {/* Kettlebell swinging from the rack (raised so its arc clears the lifted bar) */}
      <g transform="translate(24 -46)">
        <g className="stage-kettlebell">
          <line x1="416" y1="0" x2="416" y2="62" className="stage-chain" />
          <path className="stage-handle" d="M396 84 C396 60, 436 60, 436 84" />
          <path
            fill="url(#stage-plate)"
            d="M416 76 C442 76, 456 94, 456 116 C456 136, 442 148, 416 148 C390 148, 376 136, 376 116 C376 94, 390 76, 416 76 Z"
          />
          <rect x="404" y="108" width="24" height="6" rx="3" className="stage-accent" />
        </g>
      </g>

      {/* Barbell being lifted */}
      <ellipse className="stage-shadow" cx="260" cy="382" rx="170" ry="10" />
      <g className="stage-barbell">
        <rect x="60" y="244" width="400" height="10" rx="5" fill="url(#stage-steel)" />
        <rect
          x="104"
          y="184"
          width="20"
          height="130"
          rx="4"
          fill="url(#stage-plate)"
          className="stage-plate-edge"
        />
        <rect
          x="124"
          y="200"
          width="16"
          height="98"
          rx="3"
          fill="url(#stage-plate)"
          className="stage-plate-edge"
        />
        <rect x="140" y="236" width="9" height="26" rx="2" className="stage-accent" />
        <rect
          x="396"
          y="184"
          width="20"
          height="130"
          rx="4"
          fill="url(#stage-plate)"
          className="stage-plate-edge"
        />
        <rect
          x="380"
          y="200"
          width="16"
          height="98"
          rx="3"
          fill="url(#stage-plate)"
          className="stage-plate-edge"
        />
        <rect x="371" y="236" width="9" height="26" rx="2" className="stage-accent" />
        <g className="stage-knurl">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={214 + i * 11} y1="246" x2={214 + i * 11} y2="252" />
          ))}
        </g>
      </g>

      {/* Dumbbell turning over */}
      <g className="stage-dumbbell">
        <rect x="92" y="416" width="76" height="8" rx="4" fill="url(#stage-steel)" />
        <rect
          x="74"
          y="396"
          width="20"
          height="48"
          rx="4"
          fill="url(#stage-plate)"
          className="stage-plate-edge"
        />
        <rect
          x="166"
          y="396"
          width="20"
          height="48"
          rx="4"
          fill="url(#stage-plate)"
          className="stage-plate-edge"
        />
        <rect x="94" y="408" width="6" height="24" rx="2" className="stage-accent" />
        <rect x="160" y="408" width="6" height="24" rx="2" className="stage-accent" />
      </g>

      {/* Heartbeat */}
      <path
        className="stage-pulse-track"
        d="M0 478 H150 L166 478 L178 448 L194 500 L206 462 L216 478 H330 L342 478 L350 462 L358 492 L366 478 H520"
      />
      <path
        className="stage-pulse"
        d="M0 478 H150 L166 478 L178 448 L194 500 L206 462 L216 478 H330 L342 478 L350 462 L358 492 L366 478 H520"
      />
    </svg>
  );
}

const FEATURES: { icon: ReactNode; title: TranslationKey; body: TranslationKey }[] = [
  {
    icon: <Dumbbell />,
    title: "landing.feature.program.title",
    body: "landing.feature.program.body",
  },
  { icon: <Timer />, title: "landing.feature.rest.title", body: "landing.feature.rest.body" },
  { icon: <Salad />, title: "landing.feature.meals.title", body: "landing.feature.meals.body" },
  { icon: <Target />, title: "landing.feature.goals.title", body: "landing.feature.goals.body" },
  {
    icon: <MessagesSquare />,
    title: "landing.feature.connect.title",
    body: "landing.feature.connect.body",
  },
];

export function Landing() {
  const { t, fmt } = useI18n();
  const root = useScrollReveal();
  const { data: live, isError } = usePlatformStats();
  // Placeholders only ever stand in when the live figures failed to load, and are labelled.
  const stats = live ?? (isError ? PLACEHOLDER_STATS : null);
  const sample = !live && isError;
  const year = new Date().getFullYear();

  return (
    <main className="landing-v2" ref={root}>
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

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <h1>
            <span className="hero-line">{t("landing.headline1")}</span>
            <em className="hero-line">{t("landing.headline2")}</em>
          </h1>
          <p className="landing-description">{t("landing.description")}</p>
          <div className="landing-actions">
            <Link to="/sign-in" search={{ as: "athlete" }}>
              <Button size="lg" className="cta-primary">
                {t("landing.athlete")} <MoveRight />
              </Button>
            </Link>
            <Link to="/sign-in" search={{ as: "coach" }}>
              <Button variant="outline" size="lg">
                {t("landing.coach")} <ChevronRight />
              </Button>
            </Link>
          </div>
        </div>
        <div className="landing-hero-stage">
          <GymStage />
        </div>
      </section>

      <section className="landing-stats" aria-label={t("landing.stats.label")}>
        {(
          [
            ["athletes_coached", "landing.stats.athletes", <Dumbbell key="a" />],
            ["workouts_completed", "landing.stats.workouts", <CalendarCheck2 key="w" />],
            ["programs_created", "landing.stats.programs", <Timer key="p" />],
          ] as const
        ).map(([key, label, icon], i) => (
          <div
            key={key}
            className="landing-stat"
            data-reveal
            style={{ transitionDelay: `${i * 90}ms` }}
          >
            <span className="landing-stat-icon" aria-hidden="true">
              {icon}
            </span>
            <strong>
              {stats ? (
                <CountUp value={stats[key]} locale={fmt.locale} />
              ) : (
                <span className="count-up pending" aria-hidden="true">
                  —
                </span>
              )}
            </strong>
            <span>{t(label)}</span>
          </div>
        ))}
        {sample && <p className="landing-stats-note">{t("landing.stats.sample")}</p>}
      </section>

      <section className="landing-features">
        <div className="landing-features-head" data-reveal>
          <h2>{t("landing.features.title")}</h2>
          <p>{t("landing.features.body")}</p>
        </div>
        <ul>
          {FEATURES.map((f, i) => (
            <li key={f.title} data-reveal style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <span className="feature-icon" aria-hidden="true">
                {f.icon}
              </span>
              <div>
                <h3>{t(f.title)}</h3>
                <p>{t(f.body)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-split">
        <div className="landing-split-image" data-reveal>
          <img src={hero} width={1920} height={1280} loading="lazy" alt={t("landing.heroAlt")} />
        </div>
        <div className="landing-split-copy">
          <article data-reveal>
            <h2>{t("landing.coaches.title")}</h2>
            <p>{t("landing.coaches.body")}</p>
            <Link to="/sign-up">
              <Button>
                {t("landing.coaches.cta")} <MoveRight />
              </Button>
            </Link>
          </article>
          <article data-reveal>
            <h2>{t("landing.athletes.title")}</h2>
            <p>{t("landing.athletes.body")}</p>
            <Link to="/sign-in" search={{ as: "athlete" }}>
              <Button variant="outline">
                {t("landing.athletes.cta")} <ChevronRight />
              </Button>
            </Link>
          </article>
        </div>
      </section>

      <section className="landing-final" data-reveal>
        <h2>{t("landing.final.title")}</h2>
        <div className="landing-actions">
          <Link to="/sign-in" search={{ as: "athlete" }}>
            <Button size="lg" className="cta-primary">
              {t("landing.athlete")} <MoveRight />
            </Button>
          </Link>
          <Link to="/sign-in" search={{ as: "coach" }}>
            <Button variant="outline" size="lg">
              {t("landing.coach")} <ChevronRight />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <Brand />
        <small>{t("landing.footer", { year })}</small>
      </footer>
    </main>
  );
}
