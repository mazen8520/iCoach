// Public home page. Motion is CSS + inline SVG (transform/opacity only), switched off under
// prefers-reduced-motion. Content is fully visible without JavaScript: scroll reveals only arm
// once the page has hydrated and IntersectionObserver exists.
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  MoreHorizontal,
  MoveRight,
  Timer,
  Trophy,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { StoreButtons } from "./store-buttons";
import { Button } from "@/components/ui/button";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { usePlatformStats } from "@/hooks/use-platform-stats";
import { PLACEHOLDER_STATS } from "@/lib/landing-stats";
import coachPhoto from "@/assets/workout-battle-rope.jpg";
import athletePhoto from "@/assets/workout-runner.jpg";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Arms scroll reveals for everything marked data-reveal under the root. An IntersectionObserver
 *  does the work; a light scroll check backs it up so no section can stay hidden if the
 *  observer is slow to report (e.g. right after a tab regains focus). */
function useScrollReveal() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    const pending = new Set(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    el.classList.add("reveal-armed");
    const reveal = (target: HTMLElement) => {
      target.dataset["reveal"] = "in";
      pending.delete(target);
      observer.unobserve(target);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    pending.forEach((t) => observer.observe(t));
    const check = () => {
      const fold = window.innerHeight * 0.92;
      for (const target of pending) {
        const r = target.getBoundingClientRect();
        if (r.top < fold && r.bottom > 0) reveal(target);
      }
      if (pending.size === 0) window.removeEventListener("scroll", check);
    };
    window.addEventListener("scroll", check, { passive: true });
    const settle = window.setTimeout(check, 1200);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", check);
      window.clearTimeout(settle);
    };
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

type Pillar = {
  id: "train" | "fuel" | "track" | "connect";
  word: TranslationKey;
  title: TranslationKey;
  body: TranslationKey;
  points: TranslationKey[];
  scene: () => ReactNode;
};

const PILLARS: Pillar[] = [
  {
    id: "train",
    word: "home.pillar.train",
    title: "home.train.title",
    body: "home.train.body",
    points: ["home.train.1", "home.train.2", "home.train.3"],
    scene: () => <TrainScene />,
  },
  {
    id: "fuel",
    word: "home.pillar.fuel",
    title: "home.fuel.title",
    body: "home.fuel.body",
    points: ["home.fuel.1", "home.fuel.2", "home.fuel.3"],
    scene: () => <FuelScene />,
  },
  {
    id: "track",
    word: "home.pillar.track",
    title: "home.track.title",
    body: "home.track.body",
    points: ["home.track.1", "home.track.2", "home.track.3"],
    scene: () => <TrackScene />,
  },
  {
    id: "connect",
    word: "home.pillar.connect",
    title: "home.connect.title",
    body: "home.connect.body",
    points: ["home.connect.1", "home.connect.2", "home.connect.3"],
    scene: () => <ConnectScene />,
  },
];

const COACH_BENEFITS: TranslationKey[] = [
  "home.benefits.coach.1",
  "home.benefits.coach.2",
  "home.benefits.coach.3",
  "home.benefits.coach.4",
  "home.benefits.coach.5",
];
const ATHLETE_BENEFITS: TranslationKey[] = [
  "home.benefits.athlete.1",
  "home.benefits.athlete.2",
  "home.benefits.athlete.3",
  "home.benefits.athlete.4",
  "home.benefits.athlete.5",
];
const STEPS = [
  ["home.how.1.title", "home.how.1.body"],
  ["home.how.2.title", "home.how.2.body"],
  ["home.how.3.title", "home.how.3.body"],
] as const satisfies readonly (readonly [TranslationKey, TranslationKey])[];

/** Delay for a staggered reveal, in steps of 80ms. */
const stagger = (step: number) => ({ "--d": `${step * 80}ms` }) as CSSProperties;

// ---------------------------------------------------------------------------------------------
// Product scenes: small, labelled examples of the real screens, animated when they scroll in.
// ---------------------------------------------------------------------------------------------

function TrainScene() {
  const { t } = useI18n();
  const sets = ["done", "done", "now", "next"] as const;
  return (
    <div className="scene-card">
      <div className="scene-head">
        <b>{t("home.scene.squat")}</b>
        <span className="scene-pill">4 × 8</span>
      </div>
      <ol className="scene-sets">
        {sets.map((state, i) => (
          <li key={i} className={state} style={stagger(i)}>
            <span className="scene-set-no">{i + 1}</span>
            <span>{t("home.scene.setRow", { n: i + 1 })}</span>
            <span className="scene-load">80 kg × 8</span>
            <span className="scene-check" aria-hidden="true">
              <Check />
            </span>
          </li>
        ))}
      </ol>
      <div className="scene-rest">
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle className="scene-rest-track" cx="22" cy="22" r="18" />
          <circle className="scene-rest-ring" cx="22" cy="22" r="18" pathLength={100} />
        </svg>
        <span>
          <small>{t("home.scene.restTimer")}</small>
          <b>01:30</b>
        </span>
      </div>
    </div>
  );
}

function FuelScene() {
  const { t } = useI18n();
  const meals: TranslationKey[] = [
    "home.scene.breakfast",
    "home.scene.lunch",
    "home.scene.dinner",
    "home.scene.water",
  ];
  return (
    <div className="scene-card">
      <div className="scene-head">
        <b>{t("home.scene.trainingDay")}</b>
        <span className="scene-pill">2,450 kcal</span>
      </div>
      <ul className="scene-meals">
        {meals.map((key, i) => (
          <li key={key} className={i < 3 ? "done" : ""} style={stagger(i)}>
            <span className="scene-tick" aria-hidden="true">
              <Check />
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
      <div className="scene-macros" aria-hidden="true">
        <span style={{ "--w": "34%" } as CSSProperties} />
        <span style={{ "--w": "46%" } as CSSProperties} />
        <span style={{ "--w": "20%" } as CSSProperties} />
      </div>
    </div>
  );
}

function TrackScene() {
  const { t } = useI18n();
  return (
    <div className="scene-card">
      <div className="scene-head">
        <b>{t("home.scene.weight")}</b>
        <span className="scene-pill accent">{t("home.scene.weightDelta")}</span>
      </div>
      <svg className="scene-chart" viewBox="0 0 300 120" aria-hidden="true">
        <path className="scene-chart-grid" d="M0 30 H300 M0 60 H300 M0 90 H300" />
        <path
          className="scene-chart-area"
          d="M0 26 L40 34 L80 31 L120 48 L160 52 L200 70 L240 74 L300 92 L300 120 L0 120 Z"
        />
        <path
          className="scene-chart-line"
          pathLength={100}
          d="M0 26 L40 34 L80 31 L120 48 L160 52 L200 70 L240 74 L300 92"
        />
        <circle className="scene-chart-dot" cx="300" cy="92" r="5" />
      </svg>
      <div className="scene-pr">
        <Trophy aria-hidden="true" />
        <span>{t("home.scene.pr")}</span>
      </div>
    </div>
  );
}

function ConnectScene() {
  const { t } = useI18n();
  return (
    <div className="scene-card">
      <div className="scene-chat">
        <p className="from-coach" style={stagger(0)}>
          {t("home.scene.coachMsg")}
        </p>
        <p className="from-athlete" style={stagger(2)}>
          {t("home.scene.athleteMsg")}
        </p>
      </div>
      <div className="scene-meeting" style={stagger(4)}>
        <span className="scene-meeting-icon" aria-hidden="true">
          <Video />
        </span>
        <span className="min-w-0 flex-1">
          <b>{t("home.scene.meeting")}</b>
          <small>{t("home.scene.meetingTime")}</small>
        </span>
        <span className="scene-join" aria-hidden="true">
          {t("home.scene.join")}
        </span>
      </div>
    </div>
  );
}

/** The athlete's Today screen in a phone frame. */
function PhoneScene() {
  const { t } = useI18n();
  const rows: [TranslationKey, boolean][] = [
    ["home.scene.bench", true],
    ["home.scene.pullups", true],
    ["home.scene.lunch", false],
  ];
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-screen">
        <div className="phone-notch" />
        <div className="phone-top">
          <Brand compact />
          <span>{t("nav.today")}</span>
        </div>
        <div className="phone-hero">
          <svg viewBox="0 0 64 64">
            <circle className="phone-ring-track" cx="32" cy="32" r="26" />
            <circle className="phone-ring" cx="32" cy="32" r="26" pathLength={100} />
          </svg>
          <span>
            <small>{t("home.scene.upper")}</small>
            <b>67%</b>
          </span>
        </div>
        <ul className="phone-rows">
          {rows.map(([key, done], i) => (
            <li key={key} className={done ? "done" : ""} style={stagger(i + 2)}>
              <span className="scene-tick">
                <Check />
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <div className="phone-tabs">
          <LayoutDashboard />
          <CheckCircle2 className="active" />
          <CalendarDays />
          <Dumbbell />
          <MoreHorizontal />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

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
      <div className="landing-progress" aria-hidden="true" />
      <header className="landing-nav">
        <Link to="/" aria-label="iCoach">
          <Brand />
        </Link>
        <nav className="landing-links" aria-label={t("home.nav.label")}>
          <a href="#services">{t("home.nav.services")}</a>
          <a href="#benefits">{t("home.nav.benefits")}</a>
          <a href="#how">{t("home.nav.how")}</a>
          <a href="#app">{t("home.nav.app")}</a>
        </nav>
        <div className="landing-nav-actions">
          <LanguageSwitch />
          {/* Signing in (or being signed in already) decides which dashboard opens. */}
          <Button asChild variant="outline" size="sm">
            <Link to="/sign-in">{t("auth.signIn")}</Link>
          </Button>
          <Button asChild size="sm" className="landing-nav-start">
            <Link to="/sign-up">
              {t("home.nav.start")} <ArrowUpRight />
            </Link>
          </Button>
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
            <Button asChild size="lg" className="cta-primary">
              <Link to="/sign-in" search={{ as: "athlete" }}>
                {t("landing.athlete")} <MoveRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/sign-in" search={{ as: "coach" }}>
                {t("landing.coach")} <ChevronRight />
              </Link>
            </Button>
          </div>
          <div className="landing-hero-apps">
            <StoreButtons compact />
            <p>{t("home.hero.platforms")}</p>
          </div>
        </div>
        <div className="landing-hero-stage">
          <GymStage />
          <div className="hero-chip chip-set" aria-hidden="true">
            <span className="hero-chip-check">
              <Check />
            </span>
            {t("home.chip.set")}
          </div>
          <div className="hero-chip chip-rest" aria-hidden="true">
            <Timer />
            {t("home.chip.rest")} <b>01:30</b>
          </div>
          <div className="hero-chip chip-checkin" aria-hidden="true">
            <Camera />
            {t("home.chip.checkin")}
          </div>
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
          <div key={key} className="landing-stat" data-reveal style={stagger(i)}>
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

      <section id="services" className="landing-services">
        <div className="landing-section-head" data-reveal>
          <h2>{t("landing.features.title")}</h2>
          <p>{t("landing.features.body")}</p>
        </div>
        {PILLARS.map((pillar, i) => (
          <article key={pillar.id} className={`pillar ${i % 2 ? "flip" : ""}`}>
            <div className="pillar-copy" data-reveal data-from={i % 2 ? "end" : "start"}>
              <h3>{t(pillar.title)}</h3>
              <p>{t(pillar.body)}</p>
              <ul>
                {pillar.points.map((key, n) => (
                  <li key={key} style={stagger(n + 2)}>
                    <Check aria-hidden="true" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pillar-scene" data-reveal data-from="rise">
              <span className="pillar-word" aria-hidden="true">
                {t(pillar.word)}
              </span>
              <span className="scene-tag">{t("home.example")}</span>
              {pillar.scene()}
            </div>
          </article>
        ))}
      </section>

      <section id="benefits" className="landing-benefits">
        <div className="landing-section-head centered" data-reveal>
          <h2>{t("home.benefits.title")}</h2>
        </div>
        <div className="benefit-columns">
          <article className="benefit coach" data-reveal data-from="start">
            <img src={coachPhoto} width={1600} height={912} loading="lazy" alt="" />
            <div className="benefit-body">
              <h3>{t("landing.coaches.title")}</h3>
              <p>{t("landing.coaches.body")}</p>
              <ul>
                {COACH_BENEFITS.map((key, n) => (
                  <li key={key} style={stagger(n + 1)}>
                    <Check aria-hidden="true" />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <Button asChild className="cta-primary">
                <Link to="/sign-up">
                  {t("landing.coaches.cta")} <MoveRight />
                </Link>
              </Button>
            </div>
          </article>
          <article className="benefit athlete" data-reveal data-from="end">
            <img src={athletePhoto} width={1600} height={912} loading="lazy" alt="" />
            <div className="benefit-body">
              <h3>{t("landing.athletes.title")}</h3>
              <p>{t("landing.athletes.body")}</p>
              <ul>
                {ATHLETE_BENEFITS.map((key, n) => (
                  <li key={key} style={stagger(n + 1)}>
                    <Check aria-hidden="true" />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline">
                <Link to="/sign-in" search={{ as: "athlete" }}>
                  {t("landing.athletes.cta")} <ChevronRight />
                </Link>
              </Button>
            </div>
          </article>
        </div>
      </section>

      <section id="how" className="landing-how">
        <div className="landing-section-head centered" data-reveal>
          <h2>{t("home.how.title")}</h2>
        </div>
        <div className="how-track" data-reveal>
          <svg
            className="how-line"
            viewBox="0 0 1000 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="how-line-path"
              pathLength={100}
              d="M0 30 H300 L318 30 L332 6 L350 54 L364 18 L374 30 H640 L658 30 L672 6 L690 54 L704 18 L714 30 H1000"
            />
          </svg>
          <ol className="how-steps">
            {STEPS.map(([title, body], i) => (
              <li key={title} style={stagger(i * 2 + 1)}>
                <span className="how-num">{i + 1}</span>
                <h3>{t(title)}</h3>
                <p>{t(body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="app" className="landing-app">
        <div className="landing-app-copy" data-reveal data-from="start">
          <h2>{t("home.app.title")}</h2>
          <p>{t("home.app.body")}</p>
          <ul>
            {(["home.app.1", "home.app.2", "home.app.3"] as const).map((key, n) => (
              <li key={key} style={stagger(n + 2)}>
                <Check aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
          <StoreButtons />
        </div>
        <div className="landing-app-device" data-reveal data-from="rise">
          <PhoneScene />
        </div>
      </section>

      <section className="landing-final" data-reveal>
        <h2>{t("landing.final.title")}</h2>
        <div className="landing-actions">
          <Button asChild size="lg" className="cta-primary">
            <Link to="/sign-in" search={{ as: "athlete" }}>
              {t("landing.athlete")} <MoveRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/sign-in" search={{ as: "coach" }}>
              {t("landing.coach")} <ChevronRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <Brand />
          <small>{t("landing.footer", { year })}</small>
        </div>
        <nav className="landing-footer-links" aria-label={t("home.nav.label")}>
          <a href="#services">{t("home.nav.services")}</a>
          <a href="#benefits">{t("home.nav.benefits")}</a>
          <a href="#how">{t("home.nav.how")}</a>
          <Link to="/sign-in">{t("auth.signIn")}</Link>
          <Link to="/sign-up">{t("landing.coaches.cta")}</Link>
        </nav>
        <StoreButtons compact />
      </footer>
    </main>
  );
}
