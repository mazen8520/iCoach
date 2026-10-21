import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  Play,
  Plus,
  Send,
  Timer,
  Utensils,
  Video,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import workoutImage from "@/assets/workout-battle-rope.jpg";
import runner from "@/assets/workout-runner.jpg";
import { AppShell } from "./app-shell";
import {
  ChangePasswordCard,
  EmptyState,
  PageHead,
  ProgressBar,
  ProgressRing,
  SectionTitle,
  TaskRow,
} from "./primitives";
import { MeetingDetailsDialog, VideoPlayerDialog, type PlayableVideo } from "./shared";
import { isMeetingLive } from "@/lib/meeting-draft";
import { useAuth } from "@/lib/auth";
import { useMyCoach } from "@/hooks/use-clients";
import { useClientStats, useClientToday, useToggleHabitLog } from "@/hooks/use-dashboard";
import {
  useAssignmentDetail,
  useClientAssignments,
  useCompleteAssignment,
  useLogSet,
  useStartAssignment,
  useTodayAssignment,
} from "@/hooks/use-workouts";
import {
  mealsForDay,
  planForDay,
  useMealLogs,
  useMyNutritionPlans,
  useToggleMealLog,
  type DayType,
  type MealWithItems,
} from "@/hooks/use-nutrition";
import { useMyGoals } from "@/hooks/use-goals";
import { Celebration, DumbbellLoader, HeaderPulse } from "./gym-visuals";
import { MyGoalCard } from "./goals";
import { reachedWeightTarget } from "@/lib/goals";
import { useFoodLine, useWeekdayName } from "./nutrition-text";
import {
  formatClock,
  formatRest,
  nextExerciseIndex,
  plannedSets,
  restAfterSet,
  supersetChains,
  type PlannedSet,
} from "@/lib/workout-sets";
import { exerciseDisplayName } from "@/lib/exercise-names-ar";
import { WEEK_ORDER, isoForWeekday, sampleDateForWeekday } from "@/lib/week";
import {
  useCompletionStats,
  useLogProgressEntry,
  usePersonalRecords,
  useProgressEntries,
} from "@/hooks/use-progress";
import { useSubmitCheckIn, useUploadCheckInPhotos } from "@/hooks/use-check-ins";
import { useEnsureConversation, useMessages, useSendMessage } from "@/hooks/use-messages";
import { useMeetings, type MeetingWithOther } from "@/hooks/use-meetings";
import { useMyScheduleEvents } from "@/hooks/use-schedule";
import { useUpdateNotificationPrefs, useUpdateProfile } from "@/hooks/use-settings";
import {
  endOfMonth,
  initialsFromName,
  isHttpUrl,
  isoDate,
  parseIsoDate,
  startOfMonth,
  weekDates,
} from "@/lib/format";
import type { MealRow, SleepQuality } from "@/lib/database.types";
import { playRestChime, unlockChimeAudio } from "@/lib/chime";
import { useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";

export function ClientPage({ page }: { page: string }) {
  return (
    <AppShell role="client">
      <ClientContent page={page} />
    </AppShell>
  );
}
function ClientContent({ page }: { page: string }) {
  switch (page) {
    case "dashboard":
      return <Dashboard />;
    case "today":
      return <Today />;
    case "week":
      return <Week />;
    case "workouts":
      return <Workout />;
    case "nutrition":
      return <Nutrition />;
    case "progress":
      return <Progress />;
    case "calendar":
      return <Calendar />;
    case "messages":
      return <Messages />;
    case "meetings":
      return <Meetings />;
    case "check-ins":
      return <CheckIns />;
    case "settings":
      return <Settings />;
    default:
      return null;
  }
}
/** A meal's foods in one line ("Oats, Greek yogurt +2 more") — never calories. */
function mealSummary(
  meal: Pick<MealWithItems, "meal_items" | "foods_summary">,
  t: ReturnType<typeof useI18n>["t"],
) {
  const names = (meal.meal_items ?? []).map((i) => i.name);
  if (names.length === 0) return meal.foods_summary ?? "";
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2
    ? `${shown} ${t("client.nutrition.moreFoods", { n: names.length - 2 })}`
    : shown;
}

/** Opens the celebration when a percentage reaches 100 because of something the athlete did
 *  (not when the page loads already complete). */
function useCompletionCelebration(pct: number, ready: boolean) {
  const [open, setOpen] = useState(false);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (previous.current !== null && previous.current < 100 && pct >= 100) setOpen(true);
    previous.current = pct;
  }, [pct, ready]);
  return [open, () => setOpen(false)] as const;
}

type TodayTask = {
  id: string;
  title: string;
  meta: string;
  time: string;
  type: "workout" | "meal" | "habit";
  done: boolean;
  toggle: () => void;
};

/** Builds today's task list from real assignments, meals and habits, with working toggles. */
function useTodayTasks() {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const data = useClientToday();
  const completeAssignment = useCompleteAssignment();
  const toggleMeal = useToggleMealLog();
  const toggleHabit = useToggleHabitLog();
  const today = isoDate();
  const onError = (err: unknown) => toast.error(errorText(err, i18n, "errors.generic"));

  const tasks: TodayTask[] = [];
  if (data.assignment) {
    const workout = data.assignment.workouts as unknown as {
      title: string;
      duration_minutes: number;
    } | null;
    tasks.push({
      id: `workout-${data.assignment.id}`,
      title: workout?.title ?? t("common.workout"),
      meta: workout?.duration_minutes ? tp("common.minutes", workout.duration_minutes) : "",
      time: data.assignment.scheduled_time?.slice(0, 5) ?? t("task.today"),
      type: "workout",
      done: data.assignment.status === "completed",
      toggle: () => completeAssignment.mutate(data.assignment!.id, { onError }),
    });
  }
  for (const meal of data.meals) {
    const log = data.mealLogs.find((l) => l.meal_id === meal.id);
    tasks.push({
      id: `meal-${meal.id}`,
      title: meal.name,
      meta: mealSummary(meal, t),
      time: meal.meal_time?.slice(0, 5) ?? t("task.anytime"),
      type: "meal",
      done: log?.completed ?? false,
      toggle: () =>
        toggleMeal.mutate(
          { mealId: meal.id, date: today, completed: !(log?.completed ?? false) },
          { onError },
        ),
    });
  }
  for (const habit of data.habitTargets) {
    const log = data.habitLogs.find((l) => l.habit_target_id === habit.id);
    tasks.push({
      id: `habit-${habit.id}`,
      title: habit.name,
      meta: t("task.habitGoal", { value: habit.target_value, unit: habit.unit }),
      time: t("task.allDay"),
      type: "habit",
      done: log?.completed ?? false,
      toggle: () =>
        toggleHabit.mutate(
          {
            habitTargetId: habit.id,
            completed: !(log?.completed ?? false),
            targetValue: habit.target_value,
          },
          { onError },
        ),
    });
  }
  tasks.push({
    id: "checkin",
    title: t("task.weeklyCheckIn"),
    meta: t("task.checkInMeta"),
    time: t("task.by"),
    type: "habit",
    done: data.checkInDone,
    toggle: () => {
      if (!data.checkInDone) toast.info(t("task.checkInToast"));
    },
  });

  const pct = tasks.length
    ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)
    : 0;
  return { tasks, pct, isLoading: data.isLoading, assignment: data.assignment };
}
function Dashboard() {
  const { t, tp, fmt } = useI18n();
  const { profile } = useAuth();
  const { tasks, pct, assignment, isLoading } = useTodayTasks();
  const [celebrating, closeCelebration] = useCompletionCelebration(pct, !isLoading);
  const stats = useClientStats();
  const { data: coach } = useMyCoach();
  const { data: meetings } = useMeetings();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] || t("client.dashboard.fallbackName");
  const today = fmt.date(new Date(), { weekday: "long", month: "short", day: "numeric" });
  const workout = assignment?.workouts as unknown as {
    title: string;
    duration_minutes: number;
  } | null;
  const nextMeeting = (meetings ?? []).find(
    (m) => m.status === "scheduled" && new Date(m.scheduled_at).getTime() >= Date.now(),
  );
  const coachFirst = coach?.full_name?.split(" ")[0];

  return (
    <>
      <PageHead
        eyebrow={today}
        title={t("client.dashboard.greeting", { name: firstName })}
        subtitle={t("client.dashboard.subtitle")}
        action={<HeaderPulse />}
      />
      <section className="client-hero">
        <img
          src={workoutImage}
          width={1600}
          height={912}
          loading="eager"
          alt={t("client.dashboard.heroAlt")}
        />
        <div className="client-hero-shade" />
        <div className="client-hero-content">
          <span className="live-chip">
            <Dumbbell />
            {t("client.dashboard.todaysWorkout")}
          </span>
          <h2>{workout?.title ?? t("client.dashboard.restDay")}</h2>
          <p>
            {workout?.duration_minutes
              ? t("client.dashboard.minutes", { count: workout.duration_minutes })
              : t("client.dashboard.noSession")}
          </p>
          {workout && assignment && (
            <Button size="lg" onClick={() => navigate({ to: "/client/workouts" })}>
              {t("client.dashboard.startWorkout")} <Play fill="currentColor" />
            </Button>
          )}
        </div>
        <div className="client-hero-progress">
          <ProgressRing value={pct} size={126} label={t("client.dashboard.dayDone")} />
        </div>
      </section>
      <div className="client-kpi-strip">
        <div>
          <Flame />
          <span>
            <b>{tp("common.days", stats.data?.streakDays ?? 0)}</b>
            <small>{t("client.dashboard.currentStreak")}</small>
          </span>
        </div>
        <div>
          <Zap />
          <span>
            <b>{stats.data?.weeklyCompletion ?? 0}%</b>
            <small>{t("client.dashboard.weeklyScore")}</small>
          </span>
        </div>
        <div>
          <Clock3 />
          <span>
            <b>{nextMeeting ? fmt.clock(nextMeeting.scheduled_at) : "—"}</b>
            <small>{t("client.dashboard.coachMeeting")}</small>
          </span>
        </div>
      </div>
      <div className="content-grid mt-8">
        <section>
          <SectionTitle
            overline={t("client.dashboard.yourPlan")}
            title={t("client.dashboard.moveThroughToday")}
            action={
              <span className="text-sm font-bold text-primary">
                {t("client.dashboard.pctDone", { pct })}
              </span>
            }
          />
          <div className="panel p-2">
            {tasks.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                {t("client.dashboard.nothingToday")}
              </p>
            )}
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                title={task.title}
                meta={task.meta}
                done={task.done}
                onClick={task.toggle}
                icon={
                  task.type === "workout" ? (
                    <Dumbbell size={15} />
                  ) : task.type === "meal" ? (
                    <Utensils size={15} />
                  ) : (
                    <Circle size={13} />
                  )
                }
              />
            ))}
          </div>
        </section>
        <section>
          <SectionTitle
            overline={t("client.dashboard.fromCoach", {
              name: coachFirst ?? t("client.dashboard.yourCoach"),
            })}
            title={t("client.dashboard.coachSignal")}
          />
          {coach ? (
            <div className="coach-note">
              <span className="avatar-md">{initialsFromName(coach.full_name)}</span>
              <div>
                <b>{coach.full_name}</b>
                <p>{t("client.dashboard.coachNoteBody")}</p>
                <Link to="/client/messages">
                  <button>
                    {t("client.dashboard.messageName", { name: coachFirst ?? "" })} <ChevronRight />
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="panel p-6 text-sm text-muted-foreground">{t("client.notLinked")}</div>
          )}
          {nextMeeting && (
            <div className="meeting-mini">
              <Video />
              <div>
                <p className="eyebrow">{t("client.dashboard.upcoming")}</p>
                <b>{nextMeeting.title}</b>
                <small>
                  {fmt.clock(nextMeeting.scheduled_at)} ·{" "}
                  {tp("common.minutes", nextMeeting.duration_minutes)}
                </small>
              </div>
              <Link to="/client/meetings">
                <Button variant="outline" size="sm">
                  {t("common.details")}
                </Button>
              </Link>
            </div>
          )}
        </section>
      </div>
      <div className="mt-8">
        <MyGoalCard />
      </div>
      <Celebration
        open={celebrating}
        onClose={closeCelebration}
        title={t("celebrate.dayTitle")}
        body={t("celebrate.dayBody")}
      />
    </>
  );
}
function Today() {
  const { t, tp, fmt } = useI18n();
  const { tasks, pct, isLoading } = useTodayTasks();
  const [celebrating, closeCelebration] = useCompletionCelebration(pct, !isLoading);
  const navigate = useNavigate();
  const today = fmt.date(new Date(), { weekday: "long", month: "short", day: "numeric" });
  return (
    <>
      <Celebration
        open={celebrating}
        onClose={closeCelebration}
        title={t("celebrate.dayTitle")}
        body={t("celebrate.dayBody")}
      />
      <div className="today-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>{t("client.today.title")}</h1>
          <p>{tp("client.today.actions", tasks.length)}</p>
        </div>
        <ProgressRing value={pct} size={145} />
      </div>
      {isLoading && <DumbbellLoader label={t("client.today.loading")} />}
      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("client.today.empty")}</p>
      )}
      <div className="today-timeline">
        {tasks.map((task) => (
          <div className={`timeline-item ${task.done ? "done" : ""}`} key={task.id}>
            <div className="timeline-time">{task.time}</div>
            <div className="timeline-line">
              <span />
            </div>
            <div
              className="timeline-content"
              role="button"
              tabIndex={0}
              onClick={task.toggle}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  task.toggle();
                }
              }}
            >
              <span className={`task-check ${task.done ? "checked" : ""}`}>
                {task.done ? (
                  <Check />
                ) : task.type === "workout" ? (
                  <Dumbbell />
                ) : task.type === "meal" ? (
                  <Utensils />
                ) : (
                  <HeartPulse />
                )}
              </span>
              <div>
                <p className="eyebrow">{t(`task.type.${task.type}`)}</p>
                <h3>{task.title}</h3>
                <span>{task.meta}</span>
              </div>
              {task.type === "workout" && !task.done && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate({ to: "/client/workouts" });
                  }}
                >
                  {t("client.today.start")} <Play fill="currentColor" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
function Week() {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const dates = weekDates();
  const [day, setDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const from = isoDate(dates[0]!);
  const to = isoDate(dates[6]!);
  const { data: assignments } = useClientAssignments(from, to);
  const { data: plans } = useMyNutritionPlans();

  const weekSummary = dates.map((date) => {
    const key = isoDate(date);
    const rows = (assignments ?? []).filter((a) => a.scheduled_date === key);
    const total = rows.length;
    const done = rows.filter((a) => a.status === "completed").length;
    const workout = rows[0]?.workouts as unknown as {
      title: string;
      duration_minutes: number;
    } | null;
    return {
      key,
      day: fmt.weekday(date),
      date: String(date.getDate()),
      score: total > 0 ? Math.round((done / total) * 100) : 0,
      title: workout?.title ?? null,
      duration: workout?.duration_minutes,
    };
  });
  const selectedDay = weekSummary[day]!;
  const isRest = !selectedDay.title;
  const selectedWeekday = dates[day]!.getDay();
  const dayMeals = mealsForDay(planForDay(plans ?? [], !isRest, selectedWeekday), selectedWeekday);
  const label = selectedDay.title ?? t("common.rest");

  return (
    <>
      <PageHead
        eyebrow={`${fmt.date(dates[0]!, { month: "short", day: "numeric" })} — ${fmt.date(dates[6]!, { month: "short", day: "numeric" })}`}
        title={t("client.week.title")}
        subtitle={t("client.week.subtitle")}
      />
      <div className="week-selector">
        {weekSummary.map((d, i) => (
          <button
            onClick={() => setDay(i)}
            className={`${day === i ? "selected" : ""} ${d.score === 100 ? "done" : ""}`}
            key={d.key}
          >
            <small>{d.day}</small>
            <b>{d.date}</b>
            {d.score === 100 ? <Check /> : <span />}
          </button>
        ))}
      </div>
      <section className="day-focus">
        <div className="day-title">
          <p className="eyebrow">{t("client.week.dayN", { day: selectedDay.day, n: day + 1 })}</p>
          <h2>{label}</h2>
          <p>{isRest ? t("client.week.restCopy") : t("client.week.trainCopy")}</p>
        </div>
        <div className="day-score">
          <b>{selectedDay.score}%</b>
          <span>{t("client.week.complete")}</span>
        </div>
      </section>
      <div className="plan-columns">
        <section>
          <SectionTitle
            overline={t("client.week.training")}
            title={isRest ? t("client.week.recoveryFlow") : t("client.week.primarySession")}
          />
          <div className="workout-strip">
            <img
              src={runner}
              width={1600}
              height={912}
              loading="lazy"
              alt={t("client.week.runningAlt")}
            />
            <div>
              <p className="eyebrow">
                {isRest ? t("client.week.mobility") : t("client.week.strength")}
              </p>
              <h3>{label}</h3>
              <p>
                {selectedDay.duration
                  ? t("client.week.guidedMinutes", { count: selectedDay.duration })
                  : t("client.week.guided")}
              </p>
            </div>
            <Play />
          </div>
        </section>
        <section>
          <SectionTitle overline={t("client.week.fuel")} title={t("client.week.meals")} />
          <div className="panel p-2">
            {dayMeals.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">{t("client.week.noPlan")}</p>
            )}
            {dayMeals.slice(0, 4).map((m) => (
              <TaskRow
                key={m.id}
                title={m.name}
                meta={[m.meal_time?.slice(0, 5), mealSummary(m, t)].filter(Boolean).join(" · ")}
                done={false}
                onClick={() => navigate({ to: "/client/nutrition" })}
                icon={<Utensils size={15} />}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
/** Language-aware text for one planned set ("8–12 reps", "60 kg", "Tempo 3-1-1-0"). */
function useSetText() {
  const { t } = useI18n();
  const reps = (set: PlannedSet) => {
    switch (set.reps.mode) {
      case "fixed":
        return t("session.reps", { reps: set.reps.value });
      case "range":
        return t("session.reps", { reps: `${set.reps.min}–${set.reps.max}` });
      case "amrap":
        return t("repsMode.amrap");
      case "failure":
        return t("repsMode.failure");
      default:
        return "";
    }
  };
  const load = (set: PlannedSet) => {
    switch (set.load.mode) {
      case "kg":
        return `${set.load.value} kg`;
      case "lbs":
        return `${set.load.value} lbs`;
      case "pct_1rm":
        return `${set.load.value}% 1RM`;
      case "bodyweight":
        return set.load.value
          ? `${t("loadMode.bodyweight")} + ${set.load.value} kg`
          : t("loadMode.bodyweight");
      default:
        return "";
    }
  };
  const extras = (set: PlannedSet) =>
    [
      set.tempo ? t("session.tempo", { tempo: set.tempo }) : "",
      set.rpe != null ? `RPE ${set.rpe}` : "",
      set.rir != null ? `RIR ${set.rir}` : "",
      set.duration_seconds ? formatClock(set.duration_seconds) : "",
      set.distance ? `${set.distance.value} ${t(`distanceUnit.${set.distance.unit}`)}` : "",
    ].filter(Boolean);
  return { reps, load, extras };
}

/** Countdown driven by an end timestamp, so it stays accurate when the tab is throttled. */
function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const remaining = endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt != null && now >= endsAt) {
      playRestChime();
      if (typeof navigator !== "undefined" && "vibrate" in navigator)
        navigator.vibrate?.([180, 90, 180]);
      setEndsAt(null);
    }
  }, [now, endsAt]);

  return {
    running: endsAt != null,
    remaining,
    total,
    start: (seconds: number) => {
      setTotal(seconds);
      setNow(Date.now());
      setEndsAt(Date.now() + seconds * 1000);
    },
    adjust: (delta: number) => {
      if (endsAt == null) return;
      const next = Math.max(Date.now(), endsAt + delta * 1000);
      setTotal((v) => Math.max(1, v + delta));
      setEndsAt(next);
    },
    skip: () => setEndsAt(null),
  };
}

function Workout() {
  const i18n = useI18n();
  const { t } = i18n;
  const xn = (name: string | null | undefined) => exerciseDisplayName(name, i18n.lang);
  const navigate = useNavigate();
  const { data: todayAssignment, isLoading: loadingToday } = useTodayAssignment();
  const { data, isLoading } = useAssignmentDetail(todayAssignment?.id);
  const startAssignment = useStartAssignment();
  const completeAssignment = useCompleteAssignment();
  const logSet = useLogSet();
  const setText = useSetText();
  const rest = useRestTimer();
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState<PlayableVideo | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  const assignment = data?.assignment;
  const logs = data?.logs ?? [];
  const workoutExercises = [...(assignment?.workouts?.workout_exercises ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const plans = workoutExercises.map((e) => plannedSets(e));
  const doneCounts = workoutExercises.map((e, i) =>
    Math.min(plans[i]!.length, logs.filter((l) => l.workout_exercise_id === e.id).length),
  );
  const remaining = plans.map((p, i) => Math.max(0, p.length - doneCounts[i]!));
  const totalSets = plans.reduce((a, p) => a + p.length, 0);
  const completedSets = doneCounts.reduce((a, n) => a + n, 0);
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const activeExercise = workoutExercises[active];
  const activeSets = plans[active] ?? [];
  const activeDone = doneCounts[active] ?? 0;
  const chains = supersetChains(workoutExercises);
  const chainOf = (i: number) => chains.find((c) => c.includes(i)) ?? [i];

  useEffect(() => {
    if (assignment && !assignment.started_at && !startedRef.current) {
      startedRef.current = true;
      startAssignment.mutate(assignment.id);
    }
    // startAssignment/completeAssignment are React Query mutation objects that get a new
    // identity every render; only re-run this when the assignment itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id]);

  useEffect(() => {
    if (!assignment?.started_at) return;
    const start = new Date(assignment.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [assignment?.started_at]);

  useEffect(() => {
    if (
      assignment &&
      assignment.status !== "completed" &&
      totalSets > 0 &&
      completedSets >= totalSets &&
      !finishedRef.current
    ) {
      finishedRef.current = true;
      rest.skip();
      completeAssignment.mutate(assignment.id);
      setCelebrating(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSets, totalSets]);

  if (loadingToday || isLoading) return <DumbbellLoader label={t("client.workout.loading")} />;
  if (!todayAssignment || !assignment) {
    return (
      <EmptyState
        icon="kettlebell"
        action={
          <Link to="/client/dashboard">
            <Button variant="outline">{t("client.workout.back")}</Button>
          </Link>
        }
      >
        {t("client.workout.none")}
      </EmptyState>
    );
  }

  const workoutTitle = assignment.workouts?.title ?? t("common.workout");
  const videoUrl = activeExercise?.exercises?.video_url;
  const nextIndex = activeExercise
    ? nextExerciseIndex(workoutExercises, remaining, active)
    : active;
  const upNext = nextIndex !== active ? workoutExercises[nextIndex] : workoutExercises[active + 1];
  const steps = (activeExercise?.exercises?.instructions ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const completeSet = () => {
    if (!activeExercise || activeDone >= activeSets.length) return;
    unlockChimeAudio();
    const set = activeSets[activeDone];
    logSet.mutate(
      {
        assignment_id: assignment.id,
        workout_exercise_id: activeExercise.id,
        set_number: activeDone + 1,
      },
      { onError: (err) => toast.error(errorText(err, i18n, "client.workout.logFailed")) },
    );
    const after = remaining.map((r, i) => (i === active ? r - 1 : r));
    if (after.every((r) => r <= 0)) return;
    const next = nextExerciseIndex(workoutExercises, after, active);
    const seconds = restAfterSet(activeExercise, set, {
      isLastSet: after[active] === 0,
      hasNextExercise: active < workoutExercises.length - 1,
    });
    // Inside a superset the athlete moves straight to the partner exercise.
    if (next !== active) setActive(next);
    if (seconds > 0) rest.start(seconds);
    else rest.skip();
  };

  return (
    <>
      <Celebration
        open={celebrating}
        onClose={() => setCelebrating(false)}
        title={t("celebrate.workoutTitle")}
        body={t("celebrate.workoutBody", { title: workoutTitle })}
      />
      <div className="session-top">
        <div>
          <p className="eyebrow">{t("client.workout.active", { count: elapsed })}</p>
          <h1>{workoutTitle}</h1>
        </div>
        <div className="session-progress">
          <span>{t("client.workout.sets", { done: completedSets, total: totalSets })}</span>
          <ProgressBar value={pct} />
        </div>
        <Button variant="outline" onClick={() => navigate({ to: "/client/dashboard" })}>
          {t("client.workout.exit")}
        </Button>
      </div>
      <div className="workout-session">
        <aside className="exercise-rail">
          {workoutExercises.map((e, i) => {
            const done = doneCounts[i]!;
            const total = plans[i]!.length;
            const chain = chainOf(i);
            return (
              <button
                onClick={() => setActive(i)}
                className={`${active === i ? "active" : ""} ${done === total ? "done" : ""} ${chain.length > 1 ? "in-superset" : ""}`}
                aria-current={active === i ? "step" : undefined}
                key={e.id}
              >
                <span>{done === total ? <Check /> : i + 1}</span>
                <div>
                  <b>{xn(e.exercises?.name) || t("common.exercise")}</b>
                  <small>
                    {t("client.workout.setsOf", { done, total })}
                    {chain.length > 1 && ` · ${t("session.superset")}`}
                  </small>
                </div>
              </button>
            );
          })}
        </aside>
        {activeExercise && (
          <>
            <main className="active-exercise">
              <div className="exercise-video">
                <img
                  src={
                    activeExercise.exercises?.image_url ||
                    activeExercise.exercises?.thumbnail_url ||
                    (active % 2 ? runner : workoutImage)
                  }
                  width={1600}
                  height={912}
                  alt={t("client.workout.demoAlt")}
                />
                <button
                  className="play-button"
                  disabled={!videoUrl}
                  aria-label={t("client.workout.playDemo")}
                  onClick={() =>
                    videoUrl &&
                    setPlaying({
                      title: xn(activeExercise.exercises?.name) || t("common.exercise"),
                      url: videoUrl,
                    })
                  }
                >
                  <Play fill="currentColor" />
                </button>
              </div>
              <div className="exercise-detail">
                <p className="eyebrow">
                  {t("client.workout.exerciseOf", {
                    n: active + 1,
                    total: workoutExercises.length,
                  })}
                  {activeExercise.superset_with_next && workoutExercises[active + 1]
                    ? ` · ${t("session.supersetWith", { name: xn(workoutExercises[active + 1]!.exercises?.name) })}`
                    : ""}
                </p>
                <h2>{xn(activeExercise.exercises?.name) || t("common.exercise")}</h2>
                {activeExercise.exercises?.description && (
                  <p>{activeExercise.exercises.description}</p>
                )}
                <div className="prescription">
                  <div>
                    <small>{t("client.workout.setsReps")}</small>
                    <b>
                      {activeSets.length} × {setText.reps(activeSets[0]!) || "—"}
                    </b>
                  </div>
                  <div>
                    <small>{t("client.workout.load")}</small>
                    <b>{setText.load(activeSets[0]!) || "—"}</b>
                  </div>
                  <div>
                    <small>{t("client.workout.rest")}</small>
                    <b dir="ltr">
                      {activeExercise.superset_with_next && workoutExercises[active + 1]
                        ? t("rest.none")
                        : formatRest(activeExercise.rest_seconds)}
                    </b>
                  </div>
                </div>
                <ol className="session-sets">
                  {activeSets.map((set, i) => {
                    const done = i < activeDone;
                    const current = i === activeDone;
                    const extras = setText.extras(set);
                    const restFor =
                      set.rest_seconds ??
                      (i === activeSets.length - 1 && activeExercise.rest_after_seconds != null
                        ? activeExercise.rest_after_seconds
                        : activeExercise.rest_seconds);
                    return (
                      <li
                        key={set.id}
                        className={`${done ? "done" : ""} ${current ? "current" : ""}`}
                        aria-current={current ? "step" : undefined}
                      >
                        <span className="session-set-no">{done ? <Check /> : i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <b>
                            {[setText.reps(set), setText.load(set)].filter(Boolean).join(" · ") ||
                              t(`setType.${set.type}`)}
                          </b>
                          <small>
                            {set.type !== "normal" && (
                              <span className={`set-type-tag ${set.type}`}>
                                {t(`setType.${set.type}`)}
                              </span>
                            )}
                            {extras.join(" · ")}
                            {set.notes ? ` · ${set.notes}` : ""}
                          </small>
                        </div>
                        <span className="session-set-rest" title={t("session.restAfter")}>
                          <Timer aria-hidden="true" />
                          <span dir="ltr">
                            {activeExercise.superset_with_next && workoutExercises[active + 1]
                              ? "0s"
                              : formatRest(restFor)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={activeDone >= activeSets.length || logSet.isPending}
                  onClick={completeSet}
                >
                  {activeDone >= activeSets.length
                    ? t("session.exerciseDone")
                    : t("session.completeSetN", { n: activeDone + 1 })}{" "}
                  <Check />
                </Button>
                {(steps.length > 0 ||
                  activeExercise.exercises?.cues ||
                  activeExercise.exercises?.common_mistakes ||
                  activeExercise.notes) && (
                  <div className="coaching-notes">
                    {activeExercise.notes && (
                      <p className="coach-says">
                        <b>{t("session.coachNote")}</b> {activeExercise.notes}
                      </p>
                    )}
                    {steps.length > 0 && (
                      <details open={steps.length <= 4}>
                        <summary>{t("session.howTo")}</summary>
                        <ol>
                          {steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </details>
                    )}
                    {activeExercise.exercises?.cues && (
                      <details>
                        <summary>{t("exercise.cues")}</summary>
                        <p className="whitespace-pre-wrap">{activeExercise.exercises.cues}</p>
                      </details>
                    )}
                    {activeExercise.exercises?.common_mistakes && (
                      <details>
                        <summary>{t("exercise.mistakes")}</summary>
                        <p className="whitespace-pre-wrap">
                          {activeExercise.exercises.common_mistakes}
                        </p>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </main>
            <aside className={`rest-panel ${rest.running ? "running" : ""}`} aria-live="polite">
              <Timer />
              <p className="eyebrow">{t("client.workout.restTimer")}</p>
              <b dir="ltr" className="rest-clock">
                {formatClock(rest.running ? rest.remaining : 0)}
              </b>
              <div className="rest-meter" aria-hidden="true">
                <span
                  style={{
                    transform: `scaleX(${rest.running && rest.total > 0 ? rest.remaining / rest.total : 0})`,
                  }}
                />
              </div>
              <div className="flex gap-2" dir="ltr">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!rest.running}
                  aria-label={t("session.minus15")}
                  onClick={() => rest.adjust(-15)}
                >
                  −15s
                </Button>
                <Button size="sm" disabled={!rest.running} onClick={rest.skip}>
                  {t("client.workout.skip")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!rest.running}
                  aria-label={t("session.plus15")}
                  onClick={() => rest.adjust(15)}
                >
                  +15s
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {rest.running
                  ? t("session.restingThen", {
                      name: xn(workoutExercises[active]?.exercises?.name) || t("common.exercise"),
                    })
                  : upNext
                    ? t("client.workout.next", {
                        name: xn(upNext.exercises?.name) || t("common.exercise"),
                      })
                    : t("client.workout.last")}
              </p>
              <p className="rest-hint">{t("session.restHint")}</p>
            </aside>
          </>
        )}
      </div>
      <VideoPlayerDialog video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}
function Nutrition() {
  const { t, fmt } = useI18n();
  const i18n = useI18n();
  const { user } = useAuth();
  const dayName = useWeekdayName();
  const foodLine = useFoodLine();
  const { data: plans, isLoading } = useMyNutritionPlans();
  const { data: todayAssignment } = useTodayAssignment();
  const todayWeekday = new Date().getDay();
  const todayIso = isoDate();
  const [weekday, setWeekday] = useState(todayWeekday);
  const date = isoForWeekday(weekday);
  const isFuture = date > todayIso;
  const { data: logs } = useMealLogs(user?.id, date);
  const toggleMeal = useToggleMealLog();
  const { data: coach } = useMyCoach();
  const [pickedId, setPickedId] = useState<string | null>(null);

  const all = plans ?? [];
  const plan =
    all.find((p) => p.id === pickedId) ?? planForDay(all, !!todayAssignment, todayWeekday);
  const meals = mealsForDay(plan, weekday);
  const doneMealIds = new Set((logs ?? []).filter((l) => l.completed).map((l) => l.meal_id));
  const eaten = meals.filter((m) => doneMealIds.has(m.id)).length;
  const marker = plan?.day_types?.[String(weekday)];
  const [celebrating, closeCelebration] = useCompletionCelebration(
    meals.length ? Math.round((eaten / meals.length) * 100) : 0,
    !!logs && !isFuture,
  );

  if (isLoading) return <DumbbellLoader label={t("client.nutrition.loading")} />;
  if (!plan) return <EmptyState icon="plate">{t("client.nutrition.none")}</EmptyState>;

  const toggle = (mealId: string, done: boolean) =>
    toggleMeal.mutate(
      { mealId, date, completed: !done },
      { onError: (err) => toast.error(errorText(err, i18n, "errors.generic")) },
    );

  return (
    <>
      <Celebration
        open={celebrating}
        onClose={closeCelebration}
        title={t("celebrate.mealsTitle")}
        body={t("celebrate.mealsBody")}
      />
      <PageHead
        eyebrow={fmt.date(new Date(), { weekday: "long", day: "numeric", month: "short" })}
        title={t("client.nutrition.title")}
        subtitle={t("client.nutrition.weekSubtitle")}
      />
      {all.length > 1 && (
        <div className="toolbar">
          <div
            className="segmented scroll"
            role="tablist"
            aria-label={t("client.nutrition.yourPlans")}
          >
            {all.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={plan.id === p.id}
                className={plan.id === p.id ? "selected" : ""}
                onClick={() => setPickedId(p.id)}
              >
                {p.name}
                {["training", "rest", "any"].includes(p.day_type)
                  ? ` · ${t(`dayType.${p.day_type as DayType}`)}`
                  : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="week-tabs client" role="tablist" aria-label={t("client.nutrition.week")}>
        {WEEK_ORDER.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={weekday === d}
            className={`${weekday === d ? "selected" : ""} ${d === todayWeekday ? "today" : ""}`}
            onClick={() => setWeekday(d)}
          >
            <small>{dayName(d, "short")}</small>
            <b>{fmt.date(parseIsoDate(isoForWeekday(d)), { day: "numeric" })}</b>
            <span className={`day-marker ${plan.day_types?.[String(d)] ?? "none"}`}>
              {plan.day_types?.[String(d)] ? t(`dayMarker.${plan.day_types[String(d)]!}`) : "·"}
            </span>
          </button>
        ))}
      </div>
      <section className="nutrition-daily">
        <div>
          <p className="eyebrow">
            {weekday === todayWeekday ? t("client.nutrition.today") : dayName(weekday)}
            {marker ? ` · ${t(`dayMarker.${marker}`)}` : ""}
          </p>
          <strong>
            {eaten}
            <span>/{meals.length}</span>
          </strong>
          <span>{t("client.nutrition.mealsEaten")}</span>
          <ProgressBar value={meals.length ? (eaten / meals.length) * 100 : 0} />
        </div>
        {plan.notes && <p className="nutrition-notes whitespace-pre-wrap">{plan.notes}</p>}
      </section>
      {isFuture && (
        <p className="mt-4 text-sm text-muted-foreground">{t("client.nutrition.futureDay")}</p>
      )}
      <div className="meal-list mt-6">
        {meals.length === 0 && (
          <EmptyState icon="plate">
            {t("client.nutrition.noMealsDay", { day: dayName(weekday) })}
          </EmptyState>
        )}
        {meals.map((m) => {
          const done = doneMealIds.has(m.id);
          return (
            <article className={`meal-row client ${done ? "done" : ""}`} key={m.id}>
              <time>{m.meal_time?.slice(0, 5) ?? "—"}</time>
              <button
                type="button"
                className={`task-check ${done ? "checked" : ""}`}
                aria-pressed={done}
                aria-label={t(
                  done ? "client.nutrition.markNotEaten" : "client.nutrition.markEaten",
                  { meal: m.name },
                )}
                disabled={isFuture || toggleMeal.isPending}
                onClick={() => toggle(m.id, done)}
              >
                {done ? <Check /> : <Utensils />}
              </button>
              <div className="min-w-0 flex-1 text-start">
                <h3>{m.name}</h3>
                {m.meal_items.length > 0 ? (
                  <ul className="food-lines">
                    {m.meal_items.map((item) => (
                      <li key={item.id}>
                        <span>{foodLine(item)}</span>
                        {item.alternatives.length > 0 && (
                          <span className="food-or">
                            {item.alternatives
                              .map((a) => `${t("nutrition.or")} ${foodLine(a)}`)
                              .join(" · ")}
                          </span>
                        )}
                        {item.notes && <small>{item.notes}</small>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{m.foods_summary ?? t("client.nutrition.noFoods")}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {coach && (
        <div className="coach-note mt-6">
          <span className="avatar-md">{initialsFromName(coach.full_name)}</span>
          <div>
            <b>{coach.full_name}</b>
            <p>{t("client.nutrition.coachQuestion")}</p>
            <Link to="/client/messages">
              <button>
                {t("client.dashboard.messageName", { name: coach.full_name.split(" ")[0] ?? "" })}{" "}
                <ChevronRight />
              </button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
function Progress() {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const stats = useClientStats();
  const completion = useCompletionStats(30);
  const { data: entries } = useProgressEntries();
  const { data: records } = usePersonalRecords();
  const logProgress = useLogProgressEntry();
  const { data: goals } = useMyGoals();
  const [weight, setWeight] = useState("");
  const [goalHit, setGoalHit] = useState(false);

  const trend = (entries ?? [])
    .filter((e) => e.weight_kg != null)
    .slice(-7)
    .map((e) => ({
      day: fmt.weekday(parseIsoDate(e.entry_date)),
      value: Number(e.weight_kg),
    }));

  const onLogWeight = async () => {
    const value = Number(weight);
    if (!weight || !(value > 0 && value <= 500)) {
      toast.error(t("validation.weight"));
      return;
    }
    const previous = [...(entries ?? [])].reverse().find((e) => e.weight_kg != null)?.weight_kg;
    try {
      await logProgress.mutateAsync({ weight_kg: value });
      if (
        reachedWeightTarget(
          goals?.target_weight_kg,
          previous != null ? Number(previous) : null,
          value,
        )
      ) {
        setGoalHit(true);
      } else {
        toast.success(t("client.progress.logged"));
      }
      setWeight("");
    } catch (err) {
      toast.error(errorText(err, i18n, "client.progress.logFailed"));
    }
  };

  return (
    <>
      <Celebration
        open={goalHit}
        onClose={() => setGoalHit(false)}
        title={t("celebrate.goalTitle")}
        body={t("celebrate.goalBody", { value: goals?.target_weight_kg ?? "" })}
      />
      <PageHead
        eyebrow={t("client.progress.eyebrow")}
        title={t("client.progress.title")}
        subtitle={t("client.progress.subtitle")}
      />
      <div className="progress-hero">
        <div>
          <p className="eyebrow">{t("client.progress.currentStreak")}</p>
          <strong>{stats.data?.streakDays ?? 0}</strong>
          <span>{t("client.progress.days")}</span>
          <Flame />
        </div>
        <div>
          <p className="eyebrow">{t("client.progress.last30")}</p>
          <h2>{t("client.progress.consistent", { pct: completion.data?.pct ?? 0 })}</h2>
          <p>
            {t("client.progress.actionsComplete", {
              done: completion.data?.done ?? 0,
              total: completion.data?.total ?? 0,
            })}
          </p>
        </div>
      </div>
      <div className="content-grid mt-8">
        <div className="chart-panel">
          <SectionTitle
            overline={t("client.progress.bodyWeight")}
            title={t("client.progress.trend")}
            action={
              <div className="flex gap-2">
                <Input
                  className="h-8 w-20"
                  type="number"
                  inputMode="decimal"
                  placeholder={t("client.progress.kg")}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <Button size="sm" onClick={onLogWeight} disabled={logProgress.isPending}>
                  {t("client.progress.log")}
                </Button>
              </div>
            }
          />
          <div className="h-64">
            {trend.length < 2 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                {t("client.progress.needMore")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="clientArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--primary)" stopOpacity=".4" />
                      <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                    }}
                  />
                  <Area
                    dataKey="value"
                    name={t("client.progress.bodyWeight")}
                    stroke="var(--primary)"
                    fill="url(#clientArea)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="panel p-6">
          <SectionTitle
            overline={t("client.progress.prs")}
            title={t("client.progress.strengthGains")}
          />
          {(records ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("client.progress.noPrs")}</p>
          )}
          {(records ?? []).map((r) => (
            <div className="pr-row" key={r.id}>
              <div>
                <b>{r.exercise_name}</b>
                <small>{t("client.progress.personalBest")}</small>
              </div>
              <strong>{r.value}</strong>
              {r.previous_value && (
                <span>{t("client.progress.was", { value: r.previous_value })}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function Calendar() {
  const { t, fmt } = useI18n();
  const now = new Date();
  const [month, setMonth] = useState(() => startOfMonth(now));
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const [selected, setSelected] = useState(now.getDate());
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const from = isoDate(monthStart);
  const to = isoDate(monthEnd);
  const { data: assignments } = useClientAssignments(from, to);
  const { data: meetings } = useMeetings();
  const { data: events } = useMyScheduleEvents(from, to);
  const [openMeeting, setOpenMeeting] = useState<MeetingWithOther | null>(null);

  const leadingBlanks = (monthStart.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = monthEnd.getDate();
  const monthMeetings = (meetings ?? []).filter(
    (m) =>
      m.status !== "cancelled" &&
      isoDate(new Date(m.scheduled_at)).slice(0, 7) === from.slice(0, 7),
  );
  const eventDays = new Set([
    ...(assignments ?? []).map((a) => parseIsoDate(a.scheduled_date).getDate()),
    ...monthMeetings.map((m) => new Date(m.scheduled_at).getDate()),
    ...(events ?? []).map((e) => new Date(e.starts_at).getDate()),
  ]);
  const selectedDate = new Date(month.getFullYear(), month.getMonth(), selected);
  const selectedKey = isoDate(selectedDate);
  const dayAssignments = (assignments ?? []).filter((a) => a.scheduled_date === selectedKey);
  const dayMeetings = monthMeetings.filter(
    (m) => isoDate(new Date(m.scheduled_at)) === selectedKey,
  );
  const dayEvents = (events ?? []).filter((e) => isoDate(new Date(e.starts_at)) === selectedKey);
  const monthLabel = fmt.date(month, { month: "long", year: "numeric" });
  const selectedLabel = fmt.date(selectedDate, { weekday: "long" });
  // Monday-first single-letter weekday headers in the current language.
  const weekdayLabels = weekDates(new Date(2024, 0, 1)).map((d) =>
    fmt.date(d, { weekday: "narrow" }),
  );

  const shiftMonth = (direction: 1 | -1) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonth(next);
    const sameAsNow =
      next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth();
    setSelected(sameAsNow ? now.getDate() : 1);
  };

  return (
    <>
      <PageHead
        eyebrow={monthLabel}
        title={t("client.calendar.title")}
        subtitle={t("client.calendar.subtitle")}
      />
      <div className="calendar-mobile-head">
        <button
          className="icon-button"
          onClick={() => shiftMonth(-1)}
          aria-label={t("client.calendar.prevMonth")}
        >
          <ChevronLeft />
        </button>
        <b>{monthLabel}</b>
        <button
          className="icon-button"
          onClick={() => shiftMonth(1)}
          aria-label={t("client.calendar.nextMonth")}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="month-grid">
        {weekdayLabels.map((x, i) => (
          <span className="month-label" key={i}>
            {x}
          </span>
        ))}
        {Array.from({ length: leadingBlanks + daysInMonth }).map((_, i) => {
          const n = i - leadingBlanks + 1;
          const isToday = isCurrentMonth && n === now.getDate();
          return (
            <button
              disabled={n < 1 || n > daysInMonth}
              onClick={() => setSelected(n)}
              className={`${n === selected ? "selected" : ""} ${eventDays.has(n) ? "has-event" : ""} ${isToday ? "is-today" : ""}`}
              key={i}
            >
              {n > 0 && n <= daysInMonth ? n : ""}
            </button>
          );
        })}
      </div>
      <section className="mt-8">
        <SectionTitle
          overline={fmt.date(selectedDate, { day: "numeric", month: "long", year: "numeric" })}
          title={t("client.calendar.planFor", { day: selectedLabel })}
        />
        <div className="panel p-2">
          {dayAssignments.length === 0 && dayMeetings.length === 0 && dayEvents.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{t("client.calendar.nothing")}</p>
          )}
          {dayAssignments.map((a) => {
            const workout = a.workouts as unknown as {
              title: string;
              duration_minutes: number;
            } | null;
            return (
              <TaskRow
                key={a.id}
                title={workout?.title ?? t("common.workout")}
                meta={t("client.calendar.minutesLine", {
                  time: a.scheduled_time?.slice(0, 5) ?? t("task.anytime"),
                  minutes: workout?.duration_minutes ?? "—",
                })}
                done={a.status === "completed"}
                icon={<Dumbbell />}
              />
            );
          })}
          {dayMeetings.map((m) => (
            <TaskRow
              key={m.id}
              title={m.title}
              meta={t("client.calendar.videoCall", { time: fmt.clock(m.scheduled_at) })}
              done={m.status === "completed"}
              icon={<Video />}
              onClick={() => setOpenMeeting(m)}
            />
          ))}
          {dayEvents.map((e) => (
            <TaskRow
              key={e.id}
              title={e.title}
              meta={`${t(`eventType.${e.event_type}`)} · ${t("common.timeRange", { start: fmt.clock(e.starts_at), end: fmt.clock(e.ends_at) })}${e.description ? ` · ${e.description}` : ""}`}
              done={false}
              icon={<CalendarDays />}
            />
          ))}
        </div>
      </section>
      <MeetingDetailsDialog
        meeting={openMeeting}
        otherName={openMeeting?.other?.full_name ?? t("client.meetings.yourCoach")}
        canEdit={false}
        onClose={() => setOpenMeeting(null)}
      />
    </>
  );
}
function Messages() {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [text, setText] = useState("");
  const { user } = useAuth();
  const { data: coach, isLoading } = useMyCoach();
  const ensureConversation = useEnsureConversation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { data: messages } = useMessages(conversationId);
  const sendMessage = useSendMessage();

  useEffect(() => {
    if (coach && !conversationId) {
      ensureConversation
        .mutateAsync(coach.id)
        .then(setConversationId)
        .catch((err) => toast.error(errorText(err, i18n, "errors.generic")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach?.id]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !conversationId) return;
    sendMessage.mutate(
      { conversationId, body: text.trim() },
      { onError: (err) => toast.error(errorText(err, i18n, "messages.sendFailed")) },
    );
    setText("");
  };

  if (isLoading) return <DumbbellLoader />;
  if (!coach) return <EmptyState>{t("client.notLinked")}</EmptyState>;

  return (
    <>
      <PageHead
        eyebrow={t("client.messages.yourCoach")}
        title={coach.full_name}
        subtitle={t("client.messages.performanceCoach")}
        action={
          <Link to="/client/meetings">
            <Button variant="outline">
              <Video />
              {t("client.messages.videoCall")}
            </Button>
          </Link>
        }
      />
      <section className="client-chat">
        <div className="chat-body">
          {(messages ?? []).length === 0 && <p className="day-label">{t("messages.sayHello")}</p>}
          {(messages ?? []).map((m) => (
            <div className={`bubble ${m.sender_id === user?.id ? "out" : "in"}`} key={m.id}>
              {m.body}
              <time>
                {fmt.clock(m.created_at)}
                {m.sender_id === user?.id && m.read_at ? ` · ${t("common.read")}` : ""}
              </time>
            </div>
          ))}
        </div>
        <form className="chat-input" onSubmit={onSubmit}>
          <button className="icon-button" type="button">
            <Plus />
          </button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("messages.placeholder", { name: coach.full_name.split(" ")[0] ?? "" })}
          />
          <Button type="submit" size="icon" aria-label={t("common.send")}>
            <Send />
          </Button>
        </form>
      </section>
    </>
  );
}
function Meetings() {
  const { t, fmt } = useI18n();
  const { data } = useMeetings();
  const { data: coach } = useMyCoach();
  const [openMeeting, setOpenMeeting] = useState<MeetingWithOther | null>(null);
  const meetings = (data ?? []).filter((m) => m.status === "scheduled");
  const now = Date.now();
  const upcomingAll = meetings.filter(
    (m) => new Date(m.scheduled_at).getTime() + m.duration_minutes * 60_000 >= now,
  );
  const next = upcomingAll[0];
  const upcoming = upcomingAll.slice(1);
  const minutesUntil = next ? Math.round((new Date(next.scheduled_at).getTime() - now) / 60000) : 0;
  const coachName = coach?.full_name || t("client.meetings.yourCoach");
  const nextLink = next && isHttpUrl(next.video_url) ? next.video_url : null;

  return (
    <>
      <PageHead
        eyebrow={t("client.meetings.eyebrow")}
        title={t("client.meetings.title")}
        subtitle={t("client.meetings.subtitle")}
      />
      {next ? (
        <section className="meeting-feature client">
          <div className="date-big">
            <b>{new Date(next.scheduled_at).getDate()}</b>
            <span>{fmt.month(next.scheduled_at)}</span>
          </div>
          <div>
            <span className="live-chip">
              <Clock3 />
              {isMeetingLive(next)
                ? t("meeting.live")
                : minutesUntil <= 0
                  ? t("meeting.inProgress")
                  : t("meeting.onDate", {
                      date:
                        isoDate(new Date(next.scheduled_at)) === isoDate()
                          ? t("common.today")
                          : fmt.date(next.scheduled_at, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            }),
                      time: fmt.clock(next.scheduled_at),
                    })}
            </span>
            <h2>{next.title}</h2>
            <p>{next.notes || t("client.meetings.withCoach", { name: coachName })}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {nextLink ? (
                <a href={nextLink} target="_blank" rel="noreferrer">
                  <Button>
                    <Video />
                    {t("client.meetings.joinAt", { time: fmt.clock(next.scheduled_at) })}
                  </Button>
                </a>
              ) : (
                <Button disabled>
                  <Video />
                  {t("meeting.linkPending")}
                </Button>
              )}
              <Button variant="outline" onClick={() => setOpenMeeting(next)}>
                {t("client.meetings.notes")}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState>{t("client.meetings.empty")}</EmptyState>
      )}
      <section className="mt-8">
        <SectionTitle
          overline={t("client.meetings.scheduled")}
          title={t("client.meetings.comingUp")}
        />
        <div className="panel divide-y divide-border">
          {upcoming.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">{t("client.meetings.nothingElse")}</p>
          )}
          {upcoming.map((m) => {
            const d = new Date(m.scheduled_at);
            return (
              <button
                className="appointment w-full text-start"
                key={m.id}
                onClick={() => setOpenMeeting(m)}
              >
                <time>
                  <b>{d.getDate()}</b>
                  <span>{fmt.month(d)}</span>
                </time>
                <div className="min-w-0 flex-1">
                  <b>{m.title}</b>
                  <p>
                    {fmt.clock(m.scheduled_at)} ·{" "}
                    {t("client.meetings.withCoach", { name: coachName })}
                  </p>
                </div>
                <ChevronRight />
              </button>
            );
          })}
        </div>
      </section>
      <MeetingDetailsDialog
        meeting={openMeeting}
        otherName={coachName}
        canEdit={false}
        onClose={() => setOpenMeeting(null)}
      />
    </>
  );
}
function CheckIns() {
  const i18n = useI18n();
  const { t } = i18n;
  const { data: coach } = useMyCoach();
  const submitCheckIn = useSubmitCheckIn();
  const uploadPhotos = useUploadCheckInPhotos();
  const [weight, setWeight] = useState("");
  const [energy, setEnergy] = useState(8);
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>("okay");
  const [feedback, setFeedback] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async () => {
    if (!coach) {
      toast.error(t("client.notLinked"));
      return;
    }
    if (weight && !(Number(weight) > 0 && Number(weight) <= 500)) {
      toast.error(t("validation.weight"));
      return;
    }
    try {
      const created = await submitCheckIn.mutateAsync({
        coach_id: coach.id,
        weight_kg: weight ? Number(weight) : undefined,
        energy,
        sleep_quality: sleepQuality,
        training_feedback: feedback || undefined,
      });
      if (photo && created) {
        await uploadPhotos.mutateAsync({
          checkInId: created.id,
          files: [{ file: photo, angle: "front" }],
        });
      }
      toast.success(t("client.checkins.submitted"));
      setSubmitted(true);
    } catch (err) {
      toast.error(errorText(err, i18n, "client.checkins.failed"));
    }
  };

  if (submitted) {
    return (
      <EmptyState>
        {t("client.checkins.submittedBody", {
          name: coach?.full_name ?? t("client.checkins.yourCoach"),
        })}
      </EmptyState>
    );
  }

  const sleepOptions: [SleepQuality, typeof Moon][] = [
    ["poor", Moon],
    ["okay", Circle],
    ["strong", Zap],
  ];

  return (
    <>
      <PageHead
        eyebrow={t("client.checkins.eyebrow")}
        title={t("client.checkins.title")}
        subtitle={t("client.checkins.subtitle")}
      />
      <div className="checkin-form">
        <section>
          <p className="eyebrow">{t("client.checkins.body")}</p>
          <h2>{t("client.checkins.whereToday")}</h2>
          <label>
            {t("client.checkins.currentWeight")}{" "}
            <div className="unit-input">
              <Input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="62.4"
              />
              <span>{t("client.checkins.kg")}</span>
            </div>
          </label>
          <label>
            {t("client.checkins.energy")}{" "}
            <div className="number-scale" dir="ltr">
              {Array.from({ length: 10 }).map((_, i) => (
                <button
                  type="button"
                  onClick={() => setEnergy(i + 1)}
                  className={energy === i + 1 ? "active" : ""}
                  key={i}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </label>
          <label>
            {t("client.checkins.sleepQuality")}{" "}
            <div className="mood-row">
              {sleepOptions.map(([value, Icon]) => (
                <button
                  key={value}
                  type="button"
                  className={sleepQuality === value ? "active" : ""}
                  onClick={() => setSleepQuality(value)}
                >
                  <Icon size={19} />
                  <span>{t(`sleep.${value}`)}</span>
                </button>
              ))}
            </div>
          </label>
        </section>
        <section>
          <p className="eyebrow">{t("client.checkins.reflect")}</p>
          <h2>{t("client.checkins.tellMore")}</h2>
          <label>
            {t("client.checkins.howTraining")}
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t("client.checkins.feedbackPlaceholder")}
            />
          </label>
          <label>
            {t("client.checkins.photos")}
            <label className="photo-upload" htmlFor="checkin-photo">
              <Camera />
              <b>{photo ? photo.name : t("client.checkins.addPhotos")}</b>
              <span>{t("client.checkins.photoAngles")}</span>
              <input
                id="checkin-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </label>
          <Button
            size="lg"
            className="w-full"
            onClick={onSubmit}
            disabled={submitCheckIn.isPending || uploadPhotos.isPending}
          >
            {submitCheckIn.isPending || uploadPhotos.isPending
              ? t("client.checkins.submitting")
              : t("client.checkins.submit")}{" "}
            <Check />
          </Button>
        </section>
      </div>
    </>
  );
}
const clientSettingsTabs = [
  ["profile", "settings.tab.profile"],
  ["notifications", "settings.tab.notifications"],
] as const;
function Settings() {
  const { t } = useI18n();
  const [tab, setTab] = useState<(typeof clientSettingsTabs)[number][0]>("profile");
  return (
    <>
      <PageHead
        eyebrow={t("settings.eyebrowClient")}
        title={t("settings.title")}
        subtitle={t("settings.subtitleClient")}
      />
      <div className="settings-layout">
        <nav>
          {clientSettingsTabs.map(([key, labelKey]) => (
            <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>
              {t(labelKey)}
              <ChevronRight />
            </button>
          ))}
        </nav>
        {tab === "profile" ? <ClientProfileSettingsPanel /> : <ClientNotificationSettingsPanel />}
      </div>
    </>
  );
}
function ClientProfileSettingsPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [goal, setGoal] = useState(profile?.goal ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");

  const save = async () => {
    if (!fullName.trim()) {
      toast.error(t("validation.yourName"));
      return;
    }
    try {
      await updateProfile.mutateAsync({ full_name: fullName.trim(), goal, phone });
      toast.success(t("settings.profileUpdated"));
    } catch (err) {
      toast.error(errorText(err, i18n, "settings.profileFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <section className="settings-panel">
        <p className="eyebrow">{t("settings.yourDetails")}</p>
        <h2>{t("settings.athleteProfile")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.athleteProfileBody")}</p>
        <div className="setting-row">
          <div className="w-full">
            <b>{t("settings.fullName")}</b>
            <Input
              className="mt-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>
        <div className="setting-row">
          <div className="w-full">
            <b>{t("settings.primaryGoal")}</b>
            <Input
              className="mt-2"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("settings.goalPlaceholder")}
            />
          </div>
        </div>
        <div className="setting-row">
          <div className="w-full">
            <b>{t("settings.phone")}</b>
            <Input
              className="mt-2"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-6" onClick={save} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? t("common.saving") : t("settings.saveProfile")}
        </Button>
      </section>
      <ChangePasswordCard />
    </div>
  );
}
function ClientNotificationSettingsPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const { profile } = useAuth();
  const updatePrefs = useUpdateNotificationPrefs();
  const prefs = profile?.notification_prefs ?? {};
  const rows = [
    ["push", "notifPref.push", "notifPref.pushDesc"],
    ["coachMessages", "notifPref.coachMessages", "notifPref.coachMessagesDesc"],
    ["workoutReminders", "notifPref.workoutReminders", "notifPref.workoutRemindersDesc"],
    ["meetingReminders", "notifPref.meetingReminders", "notifPref.meetingRemindersDesc"],
  ] as const;
  const toggle = (key: string, value: boolean) =>
    updatePrefs.mutate(
      { ...prefs, [key]: value },
      { onError: (err) => toast.error(errorText(err, i18n, "settings.prefsUpdateFailed")) },
    );

  return (
    <section className="settings-panel">
      <p className="eyebrow">{t("settings.stayInformed")}</p>
      <h2>{t("settings.notificationsTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("settings.notificationsClientBody")}</p>
      {rows.map(([key, labelKey, descKey]) => (
        <div className="setting-row" key={key}>
          <div>
            <b>{t(labelKey)}</b>
            <p>{t(descKey)}</p>
          </div>
          <Switch checked={prefs[key] ?? true} onCheckedChange={(v) => toggle(key, v)} />
        </div>
      ))}
    </section>
  );
}
