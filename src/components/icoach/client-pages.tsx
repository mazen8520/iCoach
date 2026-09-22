import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis } from "recharts";
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
  MessageSquare,
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
  PageHead,
  ProgressBar,
  ProgressRing,
  SectionTitle,
  TaskRow,
} from "./primitives";
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
import { useMealLogs, useNutritionPlan, useToggleMealLog } from "@/hooks/use-nutrition";
import {
  useCompletionStats,
  useLogProgressEntry,
  usePersonalRecords,
  useProgressEntries,
} from "@/hooks/use-progress";
import { useSubmitCheckIn, useUploadCheckInPhotos } from "@/hooks/use-check-ins";
import { useEnsureConversation, useMessages, useSendMessage } from "@/hooks/use-messages";
import { useMeetings } from "@/hooks/use-meetings";
import { useUpdateNotificationPrefs, useUpdateProfile } from "@/hooks/use-settings";

import {
  formatClock,
  formatDay,
  initialsFromName,
  isoDate,
  timeAgo,
  weekDates,
} from "@/lib/format";
import type { MealRow, SleepQuality } from "@/lib/database.types";

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
  const data = useClientToday();
  const completeAssignment = useCompleteAssignment();
  const toggleMeal = useToggleMealLog();
  const toggleHabit = useToggleHabitLog();
  const submitCheckIn = useSubmitCheckIn();
  const today = isoDate();

  const tasks: TodayTask[] = [];
  if (data.assignment) {
    const workout = data.assignment.workouts as unknown as {
      title: string;
      duration_minutes: number;
    } | null;
    tasks.push({
      id: `workout-${data.assignment.id}`,
      title: workout?.title ?? "Workout",
      meta: workout?.duration_minutes ? `${workout.duration_minutes} min` : "",
      time: data.assignment.scheduled_time?.slice(0, 5) ?? "TODAY",
      type: "workout",
      done: data.assignment.status === "completed",
      toggle: () => completeAssignment.mutate(data.assignment!.id),
    });
  }
  for (const meal of data.plan?.meals ?? []) {
    const log = data.mealLogs.find((l) => l.meal_id === meal.id);
    tasks.push({
      id: `meal-${meal.id}`,
      title: meal.name,
      meta: `${meal.calories} kcal`,
      time: meal.meal_time?.slice(0, 5) ?? "ANYTIME",
      type: "meal",
      done: log?.completed ?? false,
      toggle: () =>
        toggleMeal.mutate({ mealId: meal.id, date: today, completed: !(log?.completed ?? false) }),
    });
  }
  for (const habit of data.habitTargets) {
    const log = data.habitLogs.find((l) => l.habit_target_id === habit.id);
    tasks.push({
      id: `habit-${habit.id}`,
      title: habit.name,
      meta: `${habit.target_value}${habit.unit} goal`,
      time: "ALL DAY",
      type: "habit",
      done: log?.completed ?? false,
      toggle: () =>
        toggleHabit.mutate({
          habitTargetId: habit.id,
          completed: !(log?.completed ?? false),
          targetValue: habit.target_value,
        }),
    });
  }
  tasks.push({
    id: "checkin",
    title: "Weekly check-in",
    meta: "Energy, sleep & feedback",
    time: "BY 21:00",
    type: "habit",
    done: data.checkInDone,
    toggle: () => {
      if (!data.checkInDone) toast.info("Head to Check-ins to submit this week's reflection.");
    },
  });

  const pct = tasks.length
    ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)
    : 0;
  return { tasks, pct, isLoading: data.isLoading, assignment: data.assignment };
}
function Dashboard() {
  const { profile } = useAuth();
  const { tasks, pct, assignment } = useTodayTasks();
  const stats = useClientStats();
  const { data: coach } = useMyCoach();
  const { data: meetings } = useMeetings();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] || "athlete";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const workout = assignment?.workouts as unknown as {
    title: string;
    duration_minutes: number;
  } | null;
  const nextMeeting = (meetings ?? []).find(
    (m) => new Date(m.scheduled_at).getTime() >= Date.now(),
  );

  return (
    <>
      <PageHead
        eyebrow={today}
        title={`Ready to move, ${firstName}?`}
        subtitle="Your next action is clear. Everything else can wait."
      />
      <section className="client-hero">
        <img
          src={workoutImage}
          width={1600}
          height={912}
          loading="eager"
          alt="Athlete performing battle rope training"
        />
        <div className="client-hero-shade" />
        <div className="client-hero-content">
          <span className="live-chip">
            <Dumbbell />
            TODAY'S WORKOUT
          </span>
          <h2>{workout?.title ?? "Rest day"}</h2>
          <p>
            {workout?.duration_minutes
              ? `${workout.duration_minutes} minutes`
              : "No session scheduled today"}
          </p>
          {workout && assignment && (
            <Button size="lg" onClick={() => navigate({ to: "/client/workouts" })}>
              Start workout <Play fill="currentColor" />
            </Button>
          )}
        </div>
        <div className="client-hero-progress">
          <ProgressRing value={pct} size={126} label="DAY DONE" />
        </div>
      </section>
      <div className="client-kpi-strip">
        <div>
          <Flame />
          <span>
            <b>{stats.data?.streakDays ?? 0} days</b>
            <small>Current streak</small>
          </span>
        </div>
        <div>
          <Zap />
          <span>
            <b>{stats.data?.weeklyCompletion ?? 0}%</b>
            <small>Weekly score</small>
          </span>
        </div>
        <div>
          <Clock3 />
          <span>
            <b>{nextMeeting ? formatClock(nextMeeting.scheduled_at) : "—"}</b>
            <small>Coach meeting</small>
          </span>
        </div>
      </div>
      <div className="content-grid mt-8">
        <section>
          <SectionTitle
            overline="Your plan"
            title="Move through today"
            action={<span className="text-sm font-bold text-primary">{pct}% DONE</span>}
          />
          <div className="panel p-2">
            {tasks.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nothing scheduled for today yet.</p>
            )}
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                title={t.title}
                meta={t.meta}
                done={t.done}
                onClick={t.toggle}
                icon={
                  t.type === "workout" ? (
                    <Dumbbell size={15} />
                  ) : t.type === "meal" ? (
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
            overline={`From ${coach?.full_name?.split(" ")[0] ?? "your coach"}`}
            title="Coach signal"
          />
          {coach ? (
            <div className="coach-note">
              <span className="avatar-md">{initialsFromName(coach.full_name)}</span>
              <div>
                <b>{coach.full_name}</b>
                <p>Send a message to get personal feedback on today's session.</p>
                <Link to="/client/messages">
                  <button>
                    Message {coach.full_name.split(" ")[0]} <ChevronRight />
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="panel p-6 text-sm text-muted-foreground">
              You're not linked to a coach yet.
            </div>
          )}
          {nextMeeting && (
            <div className="meeting-mini">
              <Video />
              <div>
                <p className="eyebrow">UPCOMING</p>
                <b>{nextMeeting.title}</b>
                <small>
                  {formatClock(nextMeeting.scheduled_at)} · {nextMeeting.duration_minutes} min
                </small>
              </div>
              <Link to="/client/meetings">
                <Button variant="outline" size="sm">
                  Details
                </Button>
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function Today() {
  const { tasks, pct, isLoading } = useTodayTasks();
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <>
      <div className="today-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Today is the work.</h1>
          <p>
            {tasks.length} action{tasks.length === 1 ? "" : "s"}. One clear target.
          </p>
        </div>
        <ProgressRing value={pct} size={145} />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading today's plan...</p>}
      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing scheduled for today. Enjoy the rest.
        </p>
      )}
      <div className="today-timeline">
        {tasks.map((t) => (
          <div className={`timeline-item ${t.done ? "done" : ""}`} key={t.id}>
            <div className="timeline-time">{t.time}</div>
            <div className="timeline-line">
              <span />
            </div>
            <div
              className="timeline-content"
              role="button"
              tabIndex={0}
              onClick={t.toggle}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  t.toggle();
                }
              }}
            >
              <span className={`task-check ${t.done ? "checked" : ""}`}>
                {t.done ? (
                  <Check />
                ) : t.type === "workout" ? (
                  <Dumbbell />
                ) : t.type === "meal" ? (
                  <Utensils />
                ) : (
                  <HeartPulse />
                )}
              </span>
              <div>
                <p className="eyebrow">{t.type}</p>
                <h3>{t.title}</h3>
                <span>{t.meta}</span>
              </div>
              {t.type === "workout" && !t.done && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate({ to: "/client/workouts" });
                  }}
                >
                  Start <Play fill="currentColor" />
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
  const dates = weekDates();
  const [day, setDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const from = dates[0]!.toISOString().slice(0, 10);
  const to = dates[6]!.toISOString().slice(0, 10);
  const { data: assignments } = useClientAssignments(from, to);
  const { data: plan } = useNutritionPlan();

  const weekSummary = dates.map((date) => {
    const key = date.toISOString().slice(0, 10);
    const rows = (assignments ?? []).filter((a) => a.scheduled_date === key);
    const total = rows.length;
    const done = rows.filter((a) => a.status === "completed").length;
    const workout = rows[0]?.workouts as unknown as {
      title: string;
      duration_minutes: number;
    } | null;
    return {
      day: formatDay(date.toISOString()),
      date: String(date.getDate()),
      score: total > 0 ? Math.round((done / total) * 100) : 0,
      label: workout?.title ?? "Rest",
      duration: workout?.duration_minutes,
    };
  });
  const selectedDay = weekSummary[day]!;

  return (
    <>
      <PageHead
        eyebrow={`${dates[0]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}—${dates[6]!.getDate()}`}
        title="The week ahead"
        subtitle="Rhythm, recovery, and the work between."
      />
      <div className="week-selector">
        {weekSummary.map((d, i) => (
          <button
            onClick={() => setDay(i)}
            className={`${day === i ? "selected" : ""} ${d.score === 100 ? "done" : ""}`}
            key={d.day + d.date}
          >
            <small>{d.day}</small>
            <b>{d.date}</b>
            {d.score === 100 ? <Check /> : <span />}
          </button>
        ))}
      </div>
      <section className="day-focus">
        <div className="day-title">
          <p className="eyebrow">
            {selectedDay.day} · DAY {day + 1}
          </p>
          <h2>{selectedDay.label}</h2>
          <p>
            {selectedDay.label === "Rest"
              ? "Intentional recovery. Walk, mobility and fuel."
              : "Build quality through every rep. Keep two reps in reserve."}
          </p>
        </div>
        <div className="day-score">
          <b>{selectedDay.score}%</b>
          <span>COMPLETE</span>
        </div>
      </section>
      <div className="plan-columns">
        <section>
          <SectionTitle
            overline="Training"
            title={selectedDay.label === "Rest" ? "Recovery flow" : "Primary session"}
          />
          <div className="workout-strip">
            <img src={runner} width={1600} height={912} loading="lazy" alt="Running workout" />
            <div>
              <p className="eyebrow">{selectedDay.label === "Rest" ? "MOBILITY" : "STRENGTH"}</p>
              <h3>{selectedDay.label}</h3>
              <p>
                {selectedDay.duration
                  ? `${selectedDay.duration} min · Guided session`
                  : "Guided session"}
              </p>
            </div>
            <Play />
          </div>
        </section>
        <section>
          <SectionTitle overline="Fuel" title="Meals" />
          <div className="panel p-2">
            {(plan?.meals ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No nutrition plan assigned yet.</p>
            )}
            {(plan?.meals ?? []).slice(0, 3).map((m: MealRow) => (
              <TaskRow
                key={m.id}
                title={m.name}
                meta={`${m.meal_time?.slice(0, 5) ?? ""} · ${m.calories} kcal`}
                done={false}
                icon={<Utensils size={15} />}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function Workout() {
  const navigate = useNavigate();
  const { data: todayAssignment, isLoading: loadingToday } = useTodayAssignment();
  const { data, isLoading } = useAssignmentDetail(todayAssignment?.id);
  const startAssignment = useStartAssignment();
  const completeAssignment = useCompleteAssignment();
  const logSet = useLogSet();
  const [active, setActive] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  const assignment = data?.assignment;
  const logs = data?.logs ?? [];
  const workoutExercises = [...(assignment?.workouts?.workout_exercises ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const activeExercise = workoutExercises[active];
  const setsForActive = logs.filter((l) => l.workout_exercise_id === activeExercise?.id).length;
  const totalSets = workoutExercises.reduce((a, e) => a + e.sets, 0);
  const completedSets = logs.length;
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

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
    if (restSeconds === null) return;
    if (restSeconds <= 0) {
      setRestSeconds(null);
      return;
    }
    const id = setTimeout(() => setRestSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [restSeconds]);

  useEffect(() => {
    if (assignment && totalSets > 0 && completedSets >= totalSets && !finishedRef.current) {
      finishedRef.current = true;
      completeAssignment.mutate(assignment.id);
      toast.success("Workout complete. Great session!");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSets, totalSets]);

  if (loadingToday || isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading your session...</p>;
  }
  if (!todayAssignment || !assignment) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-sm text-muted-foreground">No workout scheduled for today.</p>
        <Link to="/client/dashboard">
          <Button variant="outline" className="mt-4">
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const workoutTitle = assignment.workouts?.title ?? "Workout";
  const next = workoutExercises[active + 1];

  return (
    <>
      <div className="session-top">
        <div>
          <p className="eyebrow">ACTIVE SESSION · {elapsed} MIN ELAPSED</p>
          <h1>{workoutTitle}</h1>
        </div>
        <div className="session-progress">
          <span>
            {completedSets}/{totalSets} SETS
          </span>
          <ProgressBar value={pct} />
        </div>
        <Button variant="outline" onClick={() => navigate({ to: "/client/dashboard" })}>
          Exit
        </Button>
      </div>
      <div className="workout-session">
        <aside className="exercise-rail">
          {workoutExercises.map((e, i) => {
            const done = logs.filter((l) => l.workout_exercise_id === e.id).length;
            return (
              <button
                onClick={() => setActive(i)}
                className={`${active === i ? "active" : ""} ${done === e.sets ? "done" : ""}`}
                key={e.id}
              >
                <span>{done === e.sets ? <Check /> : i + 1}</span>
                <div>
                  <b>{e.exercises?.name ?? "Exercise"}</b>
                  <small>
                    {done} / {e.sets} sets
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
                    activeExercise.exercises?.thumbnail_url || (active % 2 ? runner : workoutImage)
                  }
                  width={1600}
                  height={912}
                  alt="Exercise demonstration"
                />
                {activeExercise.exercises?.video_url ? (
                  <a
                    href={activeExercise.exercises.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="play-button"
                  >
                    <Play fill="currentColor" />
                  </a>
                ) : (
                  <button className="play-button" disabled>
                    <Play fill="currentColor" />
                  </button>
                )}
              </div>
              <div className="exercise-detail">
                <p className="eyebrow">
                  EXERCISE {active + 1} OF {workoutExercises.length}
                </p>
                <h2>{activeExercise.exercises?.name ?? "Exercise"}</h2>
                {activeExercise.exercises?.instructions && (
                  <p>{activeExercise.exercises.instructions}</p>
                )}
                <div className="prescription">
                  <div>
                    <small>SETS × REPS</small>
                    <b>
                      {activeExercise.sets} × {activeExercise.reps}
                    </b>
                  </div>
                  <div>
                    <small>LOAD</small>
                    <b>{activeExercise.load ?? "—"}</b>
                  </div>
                  <div>
                    <small>REST</small>
                    <b>{activeExercise.rest_seconds ? `${activeExercise.rest_seconds}s` : "—"}</b>
                  </div>
                </div>
                <div className="set-dots">
                  {Array.from({ length: activeExercise.sets }).map((_, i) => (
                    <button key={i} className={i < setsForActive ? "done" : ""} disabled>
                      {i < setsForActive ? <Check /> : i + 1}
                    </button>
                  ))}
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={setsForActive >= activeExercise.sets || logSet.isPending}
                  onClick={() => {
                    logSet.mutate({
                      assignment_id: assignment.id,
                      workout_exercise_id: activeExercise.id,
                      set_number: setsForActive + 1,
                    });
                    setRestSeconds(activeExercise.rest_seconds ?? 60);
                  }}
                >
                  Complete set <Check />
                </Button>
              </div>
            </main>
            <aside className="rest-panel">
              <Timer />
              <p className="eyebrow">REST TIMER</p>
              <b>
                {restSeconds != null
                  ? `${String(Math.floor(restSeconds / 60)).padStart(2, "0")}:${String(restSeconds % 60).padStart(2, "0")}`
                  : "00:00"}
              </b>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRestSeconds((s) => Math.max(0, (s ?? 0) - 15))}
                >
                  -15
                </Button>
                <Button size="sm" onClick={() => setRestSeconds(null)}>
                  Skip
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRestSeconds((s) => (s ?? 0) + 15)}
                >
                  +15
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {next ? `Next: ${next.exercises?.name ?? "Exercise"}` : "Last exercise"}
              </p>
            </aside>
          </>
        )}
      </div>
    </>
  );
}
function Nutrition() {
  const { user } = useAuth();
  const { data: plan, isLoading } = useNutritionPlan();
  const today = isoDate();
  const { data: logs } = useMealLogs(user?.id, today);
  const toggleMeal = useToggleMealLog();
  const { data: coach } = useMyCoach();

  const meals = plan?.meals ?? [];
  const doneMealIds = new Set((logs ?? []).filter((l) => l.completed).map((l) => l.meal_id));
  const totals = meals.reduce(
    (acc: { kcal: number; protein: number; carbs: number; fat: number }, m: MealRow) => {
      if (!doneMealIds.has(m.id)) return acc;
      acc.kcal += m.calories;
      acc.protein += m.protein_g;
      acc.carbs += m.carbs_g;
      acc.fat += m.fat_g;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your plan...</p>;
  if (!plan) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Your coach hasn't set up a nutrition plan yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHead
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long" })}
        title="Eat to perform."
        subtitle="Clear timing. No guesswork. Built around today's training."
      />
      <section className="nutrition-daily">
        <div>
          <p className="eyebrow">Daily energy</p>
          <strong>{totals.kcal}</strong>
          <span>/ {plan.target_calories} kcal</span>
          <ProgressBar
            value={plan.target_calories ? (totals.kcal / plan.target_calories) * 100 : 0}
          />
        </div>
        <div className="macro-strip">
          {[
            ["P", totals.protein, plan.target_protein_g],
            ["C", totals.carbs, plan.target_carbs_g],
            ["F", totals.fat, plan.target_fat_g],
          ].map((x) => (
            <div key={x[0] as string}>
              <span>{x[0]}</span>
              <b>{x[1]}g</b>
              <small>of {x[2]}g</small>
            </div>
          ))}
        </div>
      </section>
      <div className="meal-list mt-8">
        {meals.map((m: MealRow, i: number) => {
          const done = doneMealIds.has(m.id);
          return (
            <button
              onClick={() => toggleMeal.mutate({ mealId: m.id, date: today, completed: !done })}
              className={`meal-row client ${done ? "done" : ""}`}
              key={m.id}
            >
              <time>{m.meal_time?.slice(0, 5) ?? "—"}</time>
              <span className={`task-check ${done ? "checked" : ""}`}>
                {done ? <Check /> : <Utensils />}
              </span>
              <div className="flex-1 text-left">
                <p className="eyebrow">MEAL {i + 1}</p>
                <h3>{m.name}</h3>
                <p>{m.foods_summary ?? "No foods listed"}</p>
              </div>
              <div className="meal-macros">
                <b>{m.calories}</b>
                <small>KCAL</small>
              </div>
              <ChevronRight />
            </button>
          );
        })}
      </div>
      {coach && (
        <div className="coach-note mt-6">
          <span className="avatar-md">{initialsFromName(coach.full_name)}</span>
          <div>
            <b>{coach.full_name}</b>
            <p>Have a nutrition question? Send a message and get a personal answer.</p>
            <Link to="/client/messages">
              <button>
                Message {coach.full_name.split(" ")[0]} <ChevronRight />
              </button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
function Progress() {
  const stats = useClientStats();
  const completion = useCompletionStats(30);
  const { data: entries } = useProgressEntries();
  const { data: records } = usePersonalRecords();
  const logProgress = useLogProgressEntry();
  const [weight, setWeight] = useState("");

  const trend = (entries ?? []).slice(-7).map((e) => ({
    day: formatDay(e.entry_date),
    value: e.weight_kg ?? 0,
  }));

  const onLogWeight = async () => {
    if (!weight) return;
    try {
      await logProgress.mutateAsync({ weight_kg: Number(weight) });
      toast.success("Weight logged.");
      setWeight("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log that weight.");
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Your data"
        title="Proof of the work."
        subtitle="You are not chasing perfect days. You are building undeniable consistency."
      />
      <div className="progress-hero">
        <div>
          <p className="eyebrow">CURRENT STREAK</p>
          <strong>{stats.data?.streakDays ?? 0}</strong>
          <span>DAYS</span>
          <Flame />
        </div>
        <div>
          <p className="eyebrow">LAST 30 DAYS</p>
          <h2>{completion.data?.pct ?? 0}% consistent.</h2>
          <p>
            {completion.data?.done ?? 0} of {completion.data?.total ?? 0} planned actions complete.
          </p>
        </div>
      </div>
      <div className="content-grid mt-8">
        <div className="chart-panel">
          <SectionTitle
            overline="Body weight"
            title="Trend"
            action={
              <div className="flex gap-2">
                <Input
                  className="h-8 w-20"
                  placeholder="kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <Button size="sm" onClick={onLogWeight} disabled={logProgress.isPending}>
                  Log
                </Button>
              </div>
            }
          />
          <div className="h-64">
            {trend.length < 2 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Log your weight a few times to see a trend.
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
                  <Area
                    dataKey="value"
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
          <SectionTitle overline="Personal records" title="Strength gains" />
          {(records ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No personal records logged yet.</p>
          )}
          {(records ?? []).map((r) => (
            <div className="pr-row" key={r.id}>
              <div>
                <b>{r.exercise_name}</b>
                <small>PERSONAL BEST</small>
              </div>
              <strong>{r.value}</strong>
              {r.previous_value && <span>was {r.previous_value}</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function Calendar() {
  const now = new Date();
  const [selected, setSelected] = useState(now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const from = monthStart.toISOString().slice(0, 10);
  const to = monthEnd.toISOString().slice(0, 10);
  const { data: assignments } = useClientAssignments(from, to);
  const { data: meetings } = useMeetings();

  const leadingBlanks = (monthStart.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = monthEnd.getDate();
  const eventDays = new Set((assignments ?? []).map((a) => new Date(a.scheduled_date).getDate()));
  const selectedKey = new Date(now.getFullYear(), now.getMonth(), selected)
    .toISOString()
    .slice(0, 10);
  const dayAssignments = (assignments ?? []).filter((a) => a.scheduled_date === selectedKey);
  const dayMeetings = (meetings ?? []).filter(
    (m) => new Date(m.scheduled_at).toISOString().slice(0, 10) === selectedKey,
  );
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedLabel = new Date(now.getFullYear(), now.getMonth(), selected).toLocaleDateString(
    undefined,
    {
      weekday: "long",
    },
  );

  return (
    <>
      <PageHead
        eyebrow={monthLabel}
        title="Your calendar"
        subtitle="Training, fuel, recovery, and coaching — one rhythm."
      />
      <div className="calendar-mobile-head">
        <button className="icon-button" disabled>
          <ChevronLeft />
        </button>
        <b>{monthLabel}</b>
        <button className="icon-button" disabled>
          <ChevronRight />
        </button>
      </div>
      <div className="month-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((x, i) => (
          <span className="month-label" key={i}>
            {x}
          </span>
        ))}
        {Array.from({ length: leadingBlanks + daysInMonth }).map((_, i) => {
          const n = i - leadingBlanks + 1;
          return (
            <button
              disabled={n < 1 || n > daysInMonth}
              onClick={() => setSelected(n)}
              className={`${n === selected ? "selected" : ""} ${eventDays.has(n) ? "has-event" : ""}`}
              key={i}
            >
              {n > 0 && n <= daysInMonth ? n : ""}
            </button>
          );
        })}
      </div>
      <section className="mt-8">
        <SectionTitle
          overline={`${monthLabel.toUpperCase()} ${selected}`}
          title={`${selectedLabel}'s plan`}
        />
        <div className="panel p-2">
          {dayAssignments.length === 0 && dayMeetings.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nothing scheduled this day.</p>
          )}
          {dayAssignments.map((a) => {
            const workout = a.workouts as unknown as {
              title: string;
              duration_minutes: number;
            } | null;
            return (
              <TaskRow
                key={a.id}
                title={workout?.title ?? "Workout"}
                meta={`${a.scheduled_time?.slice(0, 5) ?? "Anytime"} · ${workout?.duration_minutes ?? "—"} minutes`}
                done={a.status === "completed"}
                icon={<Dumbbell />}
              />
            );
          })}
          {dayMeetings.map((m) => (
            <TaskRow
              key={m.id}
              title={m.title}
              meta={`${formatClock(m.scheduled_at)} · Video call`}
              done={false}
              icon={<Video />}
            />
          ))}
        </div>
      </section>
    </>
  );
}
function Messages() {
  const [text, setText] = useState("");
  const { user } = useAuth();
  const { data: coach } = useMyCoach();
  const ensureConversation = useEnsureConversation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { data: messages } = useMessages(conversationId);
  const sendMessage = useSendMessage();

  useEffect(() => {
    if (coach && !conversationId) {
      ensureConversation.mutateAsync(coach.id).then(setConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach?.id]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !conversationId) return;
    sendMessage.mutate({ conversationId, body: text.trim() });
    setText("");
  };

  if (!coach) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-sm text-muted-foreground">You're not linked to a coach yet.</p>
      </div>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Your coach"
        title={coach.full_name}
        subtitle="Performance coach"
        action={
          <Button variant="outline">
            <Video />
            Video call
          </Button>
        }
      />
      <section className="client-chat">
        <div className="chat-body">
          {(messages ?? []).length === 0 && (
            <p className="day-label">Say hello to start the conversation.</p>
          )}
          {(messages ?? []).map((m) => (
            <div className={`bubble ${m.sender_id === user?.id ? "out" : "in"}`} key={m.id}>
              {m.body}
              <time>
                {formatClock(m.created_at)}
                {m.sender_id === user?.id && m.read_at ? " · Read" : ""}
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
            placeholder={`Message ${coach.full_name.split(" ")[0]}...`}
          />
          <Button type="submit" size="icon">
            <Send />
          </Button>
        </form>
      </section>
    </>
  );
}
function Meetings() {
  const { data } = useMeetings();
  const { data: coach } = useMyCoach();
  const meetings = data ?? [];
  const now = Date.now();
  const next = meetings.find((m) => new Date(m.scheduled_at).getTime() >= now);
  const upcoming = meetings.filter((m) => m.id !== next?.id);
  const minutesUntil = next ? Math.round((new Date(next.scheduled_at).getTime() - now) / 60000) : 0;

  return (
    <>
      <PageHead
        eyebrow="Coaching room"
        title="Meetings"
        subtitle="Your next chance to reflect, adjust, and move forward."
      />
      {next ? (
        <section className="meeting-feature client">
          <div className="date-big">
            <b>{new Date(next.scheduled_at).getDate()}</b>
            <span>
              {new Date(next.scheduled_at)
                .toLocaleDateString(undefined, { month: "short" })
                .toUpperCase()}
            </span>
          </div>
          <div>
            <span className="live-chip">
              <Clock3 />
              {minutesUntil <= 0 ? "IN PROGRESS" : `TODAY · ${formatClock(next.scheduled_at)}`}
            </span>
            <h2>{next.title}</h2>
            <p>{next.notes || `With ${coach?.full_name ?? "your coach"}`}</p>
            <div className="mt-5 flex gap-3">
              <Button>
                <Video />
                Join at {formatClock(next.scheduled_at)}
              </Button>
              <Button variant="outline">Meeting notes</Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">No meetings scheduled yet.</p>
        </div>
      )}
      <section className="mt-8">
        <SectionTitle overline="Scheduled" title="Coming up" />
        <div className="panel divide-y divide-border">
          {upcoming.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nothing else on the calendar.</p>
          )}
          {upcoming.map((m) => {
            const d = new Date(m.scheduled_at);
            return (
              <div className="appointment" key={m.id}>
                <time>
                  <b>{d.getDate()}</b>
                  <span>{d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</span>
                </time>
                <div className="flex-1">
                  <b>{m.title}</b>
                  <p>
                    {formatClock(m.scheduled_at)} · With {coach?.full_name ?? "your coach"}
                  </p>
                </div>
                <ChevronRight />
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
function CheckIns() {
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
      toast.error("You're not linked to a coach yet.");
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
      toast.success("Check-in submitted.");
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your check-in.");
    }
  };

  if (submitted) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Check-in submitted. {coach?.full_name ?? "Your coach"} will review it soon.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Weekly reflection"
        title="Check in with yourself."
        subtitle="Honest signals help your coach coach the person, not just the program."
      />
      <div className="checkin-form">
        <section>
          <p className="eyebrow">01 · BODY</p>
          <h2>Where are you today?</h2>
          <label>
            Current weight{" "}
            <div className="unit-input">
              <Input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="62.4"
              />
              <span>KG</span>
            </div>
          </label>
          <label>
            Energy{" "}
            <div className="number-scale">
              {Array.from({ length: 10 }).map((_, i) => (
                <button
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
            Sleep quality{" "}
            <div className="mood-row">
              <button
                type="button"
                className={sleepQuality === "poor" ? "active" : ""}
                onClick={() => setSleepQuality("poor")}
              >
                <Moon size={19} />
                <span>Poor</span>
              </button>
              <button
                type="button"
                className={sleepQuality === "okay" ? "active" : ""}
                onClick={() => setSleepQuality("okay")}
              >
                <Circle size={19} />
                <span>Okay</span>
              </button>
              <button
                type="button"
                className={sleepQuality === "strong" ? "active" : ""}
                onClick={() => setSleepQuality("strong")}
              >
                <Zap size={19} />
                <span>Strong</span>
              </button>
            </div>
          </label>
        </section>
        <section>
          <p className="eyebrow">02 · REFLECT</p>
          <h2>Tell your coach more.</h2>
          <label>
            How did training feel?
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share wins, challenges, or anything your coach should know..."
            />
          </label>
          <label>
            Progress photos
            <label className="photo-upload" htmlFor="checkin-photo">
              <Camera />
              <b>{photo ? photo.name : "Add progress photos"}</b>
              <span>Front, side and back</span>
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
            disabled={submitCheckIn.isPending}
          >
            {submitCheckIn.isPending ? "Submitting..." : "Submit weekly check-in"} <Check />
          </Button>
        </section>
      </div>
    </>
  );
}
const clientSettingsTabs = ["Profile", "Notifications"] as const;
function Settings() {
  const [tab, setTab] = useState<(typeof clientSettingsTabs)[number]>("Profile");
  return (
    <>
      <PageHead
        eyebrow="Your account"
        title="Settings"
        subtitle="Make iCoach work around your training life."
      />
      <div className="settings-layout">
        <nav>
          {clientSettingsTabs.map((x) => (
            <button className={tab === x ? "active" : ""} key={x} onClick={() => setTab(x)}>
              {x}
              <ChevronRight />
            </button>
          ))}
        </nav>
        {tab === "Profile" ? <ClientProfileSettingsPanel /> : <ClientNotificationSettingsPanel />}
      </div>
    </>
  );
}
function ClientProfileSettingsPanel() {
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [goal, setGoal] = useState(profile?.goal ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");

  const save = async () => {
    try {
      await updateProfile.mutateAsync({ full_name: fullName, goal, phone });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your profile.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="settings-panel">
        <p className="eyebrow">Your details</p>
        <h2>Athlete profile</h2>
        <p className="text-sm text-muted-foreground">This is how your coach sees you.</p>
        <div className="setting-row">
          <div className="w-full">
            <b>Full name</b>
            <Input
              className="mt-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>
        <div className="setting-row">
          <div className="w-full">
            <b>Primary goal</b>
            <Input
              className="mt-2"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Build strength"
            />
          </div>
        </div>
        <div className="setting-row">
          <div className="w-full">
            <b>Phone</b>
            <Input className="mt-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <Button className="mt-6" onClick={save} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving..." : "Save profile"}
        </Button>
      </section>
      <ChangePasswordCard />
    </div>
  );
}
function ClientNotificationSettingsPanel() {
  const { profile } = useAuth();
  const updatePrefs = useUpdateNotificationPrefs();
  const prefs = profile?.notification_prefs ?? {};
  const rows: [string, string, string][] = [
    ["push", "Push notifications", "Workout, schedule and coach updates"],
    ["coachMessages", "Coach messages", "Alert me when my coach sends a message"],
    ["workoutReminders", "Workout reminders", "30 minutes before planned sessions"],
    ["meetingReminders", "Meeting reminders", "One hour before coach meetings"],
  ];
  const toggle = (key: string, value: boolean) => updatePrefs.mutate({ ...prefs, [key]: value });

  return (
    <section className="settings-panel">
      <p className="eyebrow">Stay informed</p>
      <h2>Notifications</h2>
      <p className="text-sm text-muted-foreground">
        Choose the moments you want iCoach to bring to your attention.
      </p>
      {rows.map(([key, label, desc]) => (
        <div className="setting-row" key={key}>
          <div>
            <b>{label}</b>
            <p>{desc}</p>
          </div>
          <Switch checked={prefs[key] ?? true} onCheckedChange={(v) => toggle(key, v)} />
        </div>
      ))}
    </section>
  );
}
