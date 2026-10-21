// First-run tour of the mobile app. It walks the real screens: each step opens that tab behind a
// spotlight in the brand's skewed frame, which glides from control to control. Next moves on one
// step at a time, Back returns, Skip all ends it from anywhere. It starts once per account in the
// iOS/Android app (and the home-screen web app) and can be replayed from More on any phone.
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Languages,
  LayoutDashboard,
  MoreHorizontal,
  MoveRight,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { haptic, isAppContext, onNativeBack, START_TOUR_EVENT } from "@/lib/native";
import runner from "@/assets/workout-runner.jpg";

type Role = "coach" | "client";

type TabRoute =
  | "/coach/dashboard"
  | "/coach/clients"
  | "/coach/schedule"
  | "/coach/workouts"
  | "/client/dashboard"
  | "/client/today"
  | "/client/week"
  | "/client/workouts";

type SpotStep = {
  kind: "spot";
  target: string;
  title: TranslationKey;
  body: TranslationKey;
  icon: ReactNode;
  /** Tab steps open their screen behind the spotlight. */
  route?: TabRoute;
};
type Step = { kind: "welcome" } | { kind: "finish" } | SpotStep;

const tab = (route: TabRoute, title: TranslationKey, body: TranslationKey, icon: ReactNode) =>
  ({ kind: "spot", target: `[data-tour-nav="${route}"]`, title, body, icon, route }) as const;

function stepsFor(role: Role): Step[] {
  const shared: SpotStep[] = [
    {
      kind: "spot",
      target: '[data-tour="more"]',
      title: "shell.more",
      body: role === "coach" ? "tour.coach.more" : "tour.client.more",
      icon: <MoreHorizontal />,
    },
    {
      kind: "spot",
      target: '[data-tour="notifications"]',
      title: "shell.notifications",
      body: role === "coach" ? "tour.notifications.coach" : "tour.notifications.client",
      icon: <Bell />,
    },
    {
      kind: "spot",
      target: '[data-tour="language"]',
      title: "tour.language.title",
      body: "tour.language.body",
      icon: <Languages />,
    },
  ];
  const tabs: SpotStep[] =
    role === "coach"
      ? [
          tab("/coach/dashboard", "nav.overview", "tour.coach.overview", <LayoutDashboard />),
          tab("/coach/clients", "nav.clients", "tour.coach.clients", <UsersRound />),
          tab("/coach/schedule", "nav.schedule", "tour.coach.schedule", <CalendarDays />),
          tab("/coach/workouts", "nav.workouts", "tour.coach.workouts", <Dumbbell />),
        ]
      : [
          tab("/client/dashboard", "nav.home", "tour.client.home", <LayoutDashboard />),
          tab("/client/today", "nav.today", "tour.client.today", <CheckCircle2 />),
          tab("/client/week", "nav.week", "tour.client.week", <CalendarDays />),
          tab("/client/workouts", "nav.train", "tour.client.train", <Dumbbell />),
        ];
  return [{ kind: "welcome" }, ...tabs, ...shared, { kind: "finish" }];
}

const storageKey = (userId: string) => `icoach:tour:v1:${userId}`;

function hasSeenTour(userId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) !== null;
  } catch {
    return false;
  }
}

function markTourSeen(userId: string) {
  try {
    window.localStorage.setItem(storageKey(userId), new Date().toISOString());
  } catch {
    // Storage unavailable: the tour may simply offer itself again next time.
  }
}

/** Phones and small tablets: the layout with the bottom tab bar the tour points at. */
const isTabBarLayout = () => window.innerWidth < 1024;

type Box = { top: number; left: number; width: number; height: number };

function boxOf(el: Element | null): Box | null {
  const r = el?.getBoundingClientRect();
  if (!r || r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** The brand mark's lean (skew(-8deg)), applied to the spotlight around a box. */
const LEAN = Math.tan((8 * Math.PI) / 180);
function holePath(b: Box): string {
  const k = (b.height / 2) * LEAN;
  const r = (n: number) => Math.round(n * 10) / 10;
  const x0 = b.left;
  const x1 = b.left + b.width;
  const y0 = b.top;
  const y1 = b.top + b.height;
  return `M${r(x0 + k)} ${r(y0)}H${r(x1 + k)}L${r(x1 - k)} ${r(y1)}H${r(x0 - k)}Z`;
}

const sameBox = (a: Box | null, b: Box | null) =>
  !!a &&
  !!b &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

export function AppTour() {
  const { user, profile, mustChangePassword } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const role: Role | null =
    profile?.role === "coach" ? "coach" : profile?.role === "client" ? "client" : null;
  const inShell = !!role && !mustChangePassword && path.startsWith(`/${role}/`);
  const userId = user?.id ?? null;
  const router = useRouter();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const startPath = useRef<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const begin = useCallback(() => {
    startPath.current = pathRef.current;
    setIndex(0);
    setOpen(true);
  }, []);

  // First run in the app: once per account, after the screen has settled.
  useEffect(() => {
    if (!inShell || !userId || open) return;
    if (!isAppContext() || !isTabBarLayout() || hasSeenTour(userId)) return;
    const id = window.setTimeout(begin, 900);
    return () => window.clearTimeout(id);
  }, [inShell, userId, open, begin]);

  // Replay from the More sheet.
  useEffect(() => {
    if (!inShell) return;
    window.addEventListener(START_TOUR_EVENT, begin);
    return () => window.removeEventListener(START_TOUR_EVENT, begin);
  }, [inShell, begin]);

  // Signed out, or left the coach/athlete area mid-tour.
  useEffect(() => {
    if (open && !inShell) setOpen(false);
  }, [open, inShell]);

  if (!open || !role || !userId || typeof document === "undefined") return null;
  return createPortal(
    <TourOverlay
      role={role}
      firstName={profile?.full_name?.trim().split(/\s+/)[0] ?? ""}
      index={index}
      setIndex={setIndex}
      onClose={(nextRoute) => {
        markTourSeen(userId);
        setOpen(false);
        // Tour stops replace the current history entry, so putting the starting screen back
        // leaves history exactly as it was before the tour.
        const back = startPath.current;
        if (back && back !== pathRef.current) router.history.replace(back);
        if (nextRoute && nextRoute !== back) void navigate({ to: nextRoute });
      }}
    />,
    document.body,
  );
}

export function TourOverlay({
  role,
  firstName,
  index,
  setIndex,
  onClose,
  onRoute,
}: {
  role: Role;
  firstName: string;
  index: number;
  setIndex: (index: number) => void;
  /** Closes the tour and returns to the screen it started on, then opens `nextRoute` if given. */
  onClose: (nextRoute?: "/coach/clients" | "/client/today") => void;
  /** Opens a tab step's screen. Defaults to navigating there. */
  onRoute?: (route: TabRoute) => void;
}) {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const steps = useMemo(() => stepsFor(role), [role]);
  const step = steps[index] ?? steps[0]!;
  const spots = steps.length - 2;
  const last = steps.length - 1;
  const primary = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const boxStep = useRef(-1);
  const veil = useRef<SVGPathElement>(null);
  const frame = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  /** The spotlight as drawn this frame; it eases towards the target control. */
  const hole = useRef<Box | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(last, next));
      if (clamped === index) return;
      haptic("selection");
      setIndex(clamped);
    },
    [index, last, setIndex],
  );
  const skipAll = useCallback(() => onClose(), [onClose]);

  // Tab steps open their screen behind the spotlight (replacing the history entry, so Back after
  // the tour never walks through its stops).
  const routeRef = useRef(onRoute);
  routeRef.current = onRoute;
  useEffect(() => {
    if (step.kind !== "spot" || !step.route) return;
    if (routeRef.current) routeRef.current(step.route);
    else void navigate({ to: step.route, replace: true });
  }, [step, navigate]);

  // Every frame: find the highlighted control (screens change underneath while the tour runs)
  // and ease the spotlight towards it. It irises open on the first control, then glides from one
  // to the next. Drawn as one SVG path, so the dimmed screen costs no more than a repaint.
  useLayoutEffect(() => {
    if (step.kind !== "spot") {
      setBox(null);
      boxStep.current = index;
      hole.current = null;
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pad = 6;
    let target: Box | null = null;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const found = boxOf(document.querySelector(step.target));
      if (found) {
        boxStep.current = index;
        target = found;
        setBox((prev) => (sameBox(prev, found) ? prev : found));
      } else if (boxStep.current !== index) {
        target = null;
        setBox(null);
      }
      if (target) {
        const goal = {
          left: target.left - pad,
          top: target.top - pad,
          width: target.width + pad * 2,
          height: target.height + pad * 2,
        };
        const from = hole.current ?? {
          left: goal.left + goal.width / 2,
          top: goal.top + goal.height / 2,
          width: 0,
          height: 0,
        };
        const ease = reduceMotion ? 1 : 1 - Math.exp(-Math.min(64, now - last) / 80);
        const next = {
          left: from.left + (goal.left - from.left) * ease,
          top: from.top + (goal.top - from.top) * ease,
          width: from.width + (goal.width - from.width) * ease,
          height: from.height + (goal.height - from.height) * ease,
        };
        hole.current = sameBox(next, goal) ? goal : next;
        const d = holePath(hole.current);
        const w = window.innerWidth;
        const h = window.innerHeight;
        veil.current?.setAttribute("d", `M0 0H${w}V${h}H0Z${d}`);
        frame.current?.setAttribute("d", d);
        glow.current?.setAttribute("d", d);
      }
      last = now;
      raf = window.requestAnimationFrame(tick);
    };
    tick(last);
    return () => window.cancelAnimationFrame(raf);
  }, [step, index]);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  // Keyboard and the Android back button.
  useEffect(() => {
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipAll();
      } else if (e.key === forward && index < last) go(index + 1);
      else if (e.key === backward) go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    const offBack = onNativeBack(() => {
      if (index > 0) go(index - 1);
      else skipAll();
      return true;
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      offBack();
    };
  }, [dir, index, last, go, skipAll]);

  // The page behind stays put while the tour is open.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [index]);

  // Swipe the card: towards the reading direction for Next, against it for Back.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const p = e.touches[0];
    touch.current = p ? { x: p.clientX, y: p.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const p = e.changedTouches[0];
    touch.current = null;
    if (!start || !p) return;
    const dx = p.clientX - start.x;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(p.clientY - start.y) * 1.4) return;
    const towardsNext = dir === "rtl" ? dx > 0 : dx < 0;
    if (towardsNext) {
      if (index < last) go(index + 1);
    } else go(index - 1);
  };

  const finish = () => {
    haptic("success");
    onClose(role === "coach" ? "/coach/clients" : "/client/today");
  };

  const titleId = "app-tour-title";
  const bodyId = "app-tour-body";

  // ---- Spotlight and card geometry ------------------------------------------------------------
  const pad = 6;
  const spot = step.kind === "spot" && box ? box : null;
  const cardWidth = Math.min(420, viewport.width - 32);
  let cardStyle: CSSProperties | undefined;
  let caret: { left: number; side: "top" | "bottom" } | null = null;
  if (spot) {
    const centerX = spot.left + spot.width / 2;
    const left = Math.max(16, Math.min(viewport.width - 16 - cardWidth, centerX - cardWidth / 2));
    const inTopHalf = spot.top + spot.height / 2 < viewport.height / 2;
    cardStyle = inTopHalf
      ? { top: spot.top + spot.height + pad + 14, left, width: cardWidth }
      : { bottom: viewport.height - spot.top + pad + 14, left, width: cardWidth };
    caret = {
      left: Math.max(22, Math.min(cardWidth - 22, centerX - left)),
      side: inTopHalf ? "top" : "bottom",
    };
  }

  return (
    <div
      className={`app-tour ${spot ? "has-spot" : "is-centered"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      {step.kind === "spot" ? (
        <svg className="app-tour-veil" aria-hidden="true">
          <path ref={veil} className="app-tour-veil-dim" fillRule="evenodd" />
          <path ref={glow} className="app-tour-veil-glow" />
          <path ref={frame} className="app-tour-veil-frame" />
        </svg>
      ) : (
        <div className={`app-tour-scrim ${index === 0 ? "fade-in" : ""}`} aria-hidden="true" />
      )}

      {step.kind === "welcome" && (
        <section
          className="app-tour-card app-tour-hero"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="app-tour-hero-image">
            <img src={runner} width={1600} height={912} alt="" />
          </div>
          <div className="app-tour-hero-body">
            <h2 id={titleId} className="app-tour-title">
              {firstName
                ? t("tour.welcome.title", { name: firstName })
                : t("tour.welcome.titleAnon")}
            </h2>
            <p id={bodyId} className="app-tour-text">
              {t(role === "coach" ? "tour.welcome.coach" : "tour.welcome.client")}
            </p>
            <ol className="app-tour-route" aria-label={t("tour.route")}>
              {steps.map((s, i) =>
                s.kind === "spot" && s.route ? (
                  <li key={s.route} style={{ "--i": i } as CSSProperties}>
                    {s.icon}
                    <span>{t(s.title)}</span>
                  </li>
                ) : null,
              )}
              <li style={{ "--i": spots } as CSSProperties}>
                <MoreHorizontal />
                <span>{t("shell.more")}</span>
              </li>
            </ol>
            <p className="app-tour-meta">
              <Clock3 aria-hidden="true" />
              <span>{t("tour.duration")}</span>
            </p>
            <p className="app-tour-hint">{t("tour.hint")}</p>
            <div className="app-tour-actions stacked">
              <Button ref={primary} size="lg" className="cta-primary" onClick={() => go(1)}>
                {t("tour.start")} <MoveRight />
              </Button>
              <button type="button" className="app-tour-skip" onClick={skipAll}>
                {t("tour.skipAll")}
              </button>
            </div>
          </div>
        </section>
      )}

      {step.kind === "spot" && (
        <section
          key={index}
          className={`app-tour-card app-tour-step ${caret ? `caret-${caret.side}` : "floating"}`}
          style={cardStyle}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {caret && (
            <span
              className="app-tour-caret"
              style={{ left: caret.left } as CSSProperties}
              aria-hidden="true"
            />
          )}
          <div className="app-tour-progress">
            <div className="app-tour-segments" aria-hidden="true">
              {Array.from({ length: spots }, (_, i) => (
                <span key={i} className={i + 1 < index ? "done" : i + 1 === index ? "now" : ""} />
              ))}
            </div>
            <button type="button" className="app-tour-skip" onClick={skipAll}>
              {t("tour.skipAll")}
            </button>
          </div>
          <div className="app-tour-heading">
            <span className="app-tour-icon" aria-hidden="true">
              {step.icon}
            </span>
            <h2 id={titleId} className="app-tour-title">
              {t(step.title)}
            </h2>
          </div>
          <p id={bodyId} className="app-tour-text">
            {t(step.body)}
          </p>
          <div className="app-tour-actions">
            <span
              className="app-tour-count"
              aria-label={t("tour.progress", { current: index, total: spots })}
            >
              <b>{index}</b>/{spots}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="app-tour-back"
              onClick={() => go(index - 1)}
              aria-label={t("tour.back")}
            >
              <MoveRight className="app-tour-prev-icon" />
            </Button>
            <Button ref={primary} onClick={() => go(index + 1)}>
              {t("tour.next")} <MoveRight />
            </Button>
          </div>
        </section>
      )}

      {step.kind === "finish" && (
        <section
          className="app-tour-card app-tour-finish"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <svg className="app-tour-pulse" viewBox="0 0 240 64" aria-hidden="true">
            <path d="M0 34 H78 L92 34 L104 10 L122 56 L134 22 L144 34 H240" />
          </svg>
          <h2 id={titleId} className="app-tour-title">
            {t("tour.finish.title")}
          </h2>
          <p id={bodyId} className="app-tour-text">
            {t(role === "coach" ? "tour.finish.coach" : "tour.finish.client")}
          </p>
          <div className="app-tour-actions">
            <Button
              variant="outline"
              size="icon"
              className="app-tour-back"
              onClick={() => go(index - 1)}
              aria-label={t("tour.back")}
            >
              <MoveRight className="app-tour-prev-icon" />
            </Button>
            <Button ref={primary} size="lg" className="cta-primary flex-1" onClick={finish}>
              {t(role === "coach" ? "tour.finish.ctaCoach" : "tour.finish.ctaClient")} <MoveRight />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
