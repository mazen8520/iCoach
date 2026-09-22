import { Link, useNavigate } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Dumbbell,
  Filter,
  Flame,
  MessageSquare,
  MoreHorizontal,
  MoveRight,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import battle from "@/assets/workout-battle-rope.jpg";
import runner from "@/assets/workout-runner.jpg";
import { AppShell } from "./app-shell";
import {
  ChangePasswordCard,
  Metric,
  PageHead,
  ProgressBar,
  ProgressRing,
  SectionTitle,
  TaskRow,
} from "./primitives";
import { useAuth } from "@/lib/auth";
import { useCoachRoster, useCreateAthlete } from "@/hooks/use-clients";
import { useClientDetail } from "@/hooks/use-client-detail";
import { useCoachDashboard } from "@/hooks/use-dashboard";
import {
  useConversations,
  useEnsureConversation,
  useMessages,
  useSendMessage,
} from "@/hooks/use-messages";
import { useMeetings, useScheduleMeeting } from "@/hooks/use-meetings";
import { useCoachCheckIns, useReviewCheckIn } from "@/hooks/use-check-ins";
import {
  useUpdateDailyReportSettings,
  useUpdateNotificationPrefs,
  useUpdateProfile,
} from "@/hooks/use-settings";
import {
  useAddExerciseToWorkout,
  useAssignWorkout,
  useCoachWorkouts,
  useCreateExercise,
  useCreateWorkout,
  useExerciseLibrary,
  useRemoveWorkoutExercise,
  useUpdateWorkout,
  useUploadExerciseVideo,
  useVideoLibrary,
} from "@/hooks/use-workouts";
import { useAddMeal, useCreateNutritionPlan, useNutritionPlan } from "@/hooks/use-nutrition";
import type { MealRow } from "@/lib/database.types";
import { useCoachWeekSchedule } from "@/hooks/use-schedule";
import {
  formatClock,
  formatDay,
  initialsFromName,
  isoDate,
  timeAgo,
  weekDates,
} from "@/lib/format";
import { toast } from "sonner";

const statusText = { "on-track": "On track", attention: "Needs attention", new: "New client" };
export function CoachPage({ page, clientId }: { page: string; clientId?: string }) {
  return (
    <AppShell role="coach">
      <CoachContent page={page} {...(clientId ? { clientId } : {})} />
    </AppShell>
  );
}
function CoachContent({ page, clientId }: { page: string; clientId?: string }) {
  switch (page) {
    case "dashboard":
      return <CoachDashboard />;
    case "clients":
      return clientId ? <ClientProfile id={clientId} /> : <Clients />;
    case "schedule":
      return <Schedule />;
    case "workouts":
      return <Workouts />;
    case "videos":
      return <Videos />;
    case "nutrition":
      return <Nutrition />;
    case "messages":
      return <Messages />;
    case "meetings":
      return <Meetings />;
    case "progress":
      return <Progress />;
    case "check-ins":
      return <CheckIns />;
    case "settings":
      return <Settings />;
    default:
      return null;
  }
}
function CoachDashboard() {
  const { profile } = useAuth();
  const d = useCoachDashboard();
  const firstName = profile?.full_name?.split(" ")[0] || "Coach";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const liveNow = d.activeClients > 0 ? Math.round((d.avgCompletion / 100) * d.activeClients) : 0;

  return (
    <>
      <PageHead
        eyebrow={today}
        title={`Good to see you, ${firstName}.`}
        subtitle={
          d.attentionQueue.length > 0
            ? `Your athletes are moving. ${d.attentionQueue.length} moment${d.attentionQueue.length === 1 ? "" : "s"} need your attention today.`
            : "Your athletes are moving. Everything is on track today."
        }
        action={
          <Link to="/coach/clients">
            <Button>
              <Plus />
              Add client
            </Button>
          </Link>
        }
      />
      <section className="dashboard-lead">
        <div className="lead-copy">
          <span className="live-chip">
            <span />
            TODAY LIVE
          </span>
          <h2>
            {d.activeClients} athlete{d.activeClients === 1 ? "" : "s"}
            <br />
            <em>in motion.</em>
          </h2>
          <p>
            {liveNow} of {d.activeClients} scheduled sessions are underway or complete this week.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/coach/clients">
              <Button size="lg">
                Open live activity <MoveRight />
              </Button>
            </Link>
            <Link to="/coach/schedule">
              <Button variant="outline" size="lg">
                View schedule
              </Button>
            </Link>
          </div>
        </div>
        <div className="lead-stats">
          <ProgressRing value={d.avgCompletion} size={154} label="COMPLETION" />
          <div>
            <p className="eyebrow">Team pulse</p>
            <strong className="font-display text-5xl">{d.activeClients}</strong>
            <span className="ml-2 text-sm text-muted-foreground">athletes</span>
          </div>
        </div>
      </section>
      <div className="metric-grid mt-4">
        <Metric label="Active clients" value={String(d.activeClients).padStart(2, "0")} />
        <Metric label="Weekly completion" value={`${d.avgCompletion}%`} />
        <Metric
          label="Check-ins due"
          value={String(d.checkInsDue).padStart(2, "0")}
          accent={d.checkInsDue > 0}
        />
        <Metric label="Needs attention" value={String(d.attentionQueue.length).padStart(2, "0")} />
      </div>
      <div className="content-grid mt-8">
        <section>
          <SectionTitle
            overline="Requires action"
            title="Attention queue"
            action={
              <Link to="/coach/clients">
                <Button variant="ghost" size="sm">
                  View all <ChevronRight />
                </Button>
              </Link>
            }
          />
          <div className="panel divide-y divide-border">
            {d.attentionQueue.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                No athletes need attention right now.
              </p>
            )}
            {d.attentionQueue.map((c) => (
              <Link
                key={c.id}
                to="/coach/clients/$id"
                params={{ id: c.id }}
                className="attention-row"
              >
                <span className="avatar-md">{c.initials}</span>
                <span className="min-w-0 flex-1">
                  <b>{c.name}</b>
                  <small>Check-in or workout overdue</small>
                </span>
                <span className="status attention">
                  <CircleAlert size={13} /> Review
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle overline="Next up" title="Meetings" />
          <div className="panel p-2">
            {d.upcomingMeetings.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">No meetings scheduled.</p>
            )}
            {d.upcomingMeetings.map((m) => {
              const other = m.profiles as unknown as { full_name: string } | null;
              return (
                <div className="meeting-row" key={m.id}>
                  <div className="date-block">
                    <b>{formatClock(m.scheduled_at)}</b>
                    <small>TODAY</small>
                  </div>
                  <div className="flex-1">
                    <b className="text-sm">
                      {other?.full_name ?? "Client"} · {m.title}
                    </b>
                    <p className="text-xs text-muted-foreground">
                      Video call · {m.duration_minutes} min
                    </p>
                  </div>
                  <button className="icon-button">
                    <Video size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="mt-8">
        <SectionTitle overline="Last 7 days" title="Team performance" />
        <div className="chart-panel">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.trend}>
                <defs>
                  <linearGradient id="redArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  fill="url(#redArea)"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </>
  );
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const createAthlete = useCreateAthlete();

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setAge("");
    setSex("");
    setHeight("");
    setWeight("");
  };

  const onSubmit = async () => {
    if (!fullName.trim()) {
      toast.error("Enter the athlete's full name.");
      return;
    }
    if (!emailPattern.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (age && (Number(age) < 1 || Number(age) > 119)) {
      toast.error("Enter a valid age.");
      return;
    }
    if (height && (Number(height) <= 0 || Number(height) > 299)) {
      toast.error("Enter a valid height in cm.");
      return;
    }
    if (weight && (Number(weight) <= 0 || Number(weight) > 500)) {
      toast.error("Enter a valid weight in kg.");
      return;
    }

    try {
      await createAthlete.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        ...(age ? { age: Number(age) } : {}),
        ...(sex ? { sex: sex as "male" | "female" | "other" } : {}),
        ...(height ? { heightCm: Number(height) } : {}),
        ...(weight ? { weightKg: Number(weight) } : {}),
      });
      toast.success(`${fullName.trim()} can now sign in with the credentials you set.`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that athlete's account.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an athlete</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Athletes don't sign up themselves — create their account here and share the email and
            password with them so they can sign in right away.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="athlete-name">Full name</Label>
            <Input
              id="athlete-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Maya Chen"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="athlete-email">Email</Label>
            <Input
              id="athlete-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="athlete@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="athlete-password">Password</Label>
            <Input
              id="athlete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="athlete-age">Age</Label>
              <Input
                id="athlete-age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="28"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="athlete-sex">Sex</Label>
              <select
                id="athlete-sex"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="athlete-height">Height (cm)</Label>
              <Input
                id="athlete-height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="170"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="athlete-weight">Weight (kg)</Label>
              <Input
                id="athlete-weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="65"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createAthlete.isPending}>
            {createAthlete.isPending ? "Creating account..." : "Create athlete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Clients() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useCoachRoster();
  const roster = data ?? [];
  const shown = roster.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead
        eyebrow="Roster"
        title="Your athletes"
        subtitle="Know who is thriving, who needs attention, and what comes next."
        action={<AddClientDialog />}
      />
      <div className="toolbar">
        <div className="search-wrap">
          <Search />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search athletes..."
          />
        </div>
        <Button variant="outline">
          <Filter />
          Filters
        </Button>
        <span className="ml-auto text-xs font-bold text-muted-foreground">
          {shown.length} ACTIVE
        </span>
      </div>
      {isLoading && <p className="p-6 text-sm text-muted-foreground">Loading roster...</p>}
      {!isLoading && roster.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No athletes yet. Add your first client to get started.
          </p>
        </div>
      )}
      <div className="client-list">
        {shown.map((c, i) => (
          <Link
            to="/coach/clients/$id"
            params={{ id: c.id }}
            className="client-row animate-enter"
            style={{ animationDelay: `${i * 60}ms` }}
            key={c.id}
          >
            <span className="avatar-lg">{c.initials}</span>
            <div className="client-main">
              <div>
                <h3>{c.name}</h3>
                <p>
                  {c.goal} · {c.programName}
                </p>
              </div>
              <span className={`status ${c.status}`}>{statusText[c.status]}</span>
            </div>
            <div className="client-progress">
              <div className="flex justify-between text-xs">
                <span>Weekly completion</span>
                <b>{c.weeklyCompletion}%</b>
              </div>
              <ProgressBar value={c.weeklyCompletion} />
            </div>
            <div className="client-streak">
              <Flame size={17} />
              <b>{c.streakDays}</b>
              <span>day streak</span>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <b className="block text-foreground">
                {c.lastActiveAt ? timeAgo(c.lastActiveAt) : "—"}
              </b>
              last active
            </div>
            <ChevronRight className="text-muted-foreground" />
          </Link>
        ))}
      </div>
    </>
  );
}
function ClientProfile({ id }: { id: string }) {
  const { data: roster, isLoading: rosterLoading } = useCoachRoster();
  const { checkIn, week, trend, isLoading } = useClientDetail(id);
  const c = roster?.find((x) => x.id === id);
  const ensureConversation = useEnsureConversation();
  const navigate = useNavigate();

  if (rosterLoading) return <p className="p-6 text-sm text-muted-foreground">Loading athlete...</p>;
  if (!c) return <Clients />;

  const openMessages = async () => {
    await ensureConversation.mutateAsync(id);
    navigate({ to: "/coach/messages" });
  };

  return (
    <>
      <div className="profile-head">
        <div className="flex items-center gap-5">
          <span className="avatar-xl">{c.initials}</span>
          <div>
            <p className="eyebrow">Athlete profile</p>
            <h1 className="page-title">{c.name}</h1>
            <p className="text-sm text-muted-foreground">
              {c.goal} · Active since{" "}
              {c.joinedAt
                ? new Date(c.joinedAt).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })
                : "recently"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openMessages}>
            <MessageSquare />
            Message
          </Button>
          <Link to="/coach/workouts">
            <Button>
              <SlidersHorizontal />
              Adjust plan
            </Button>
          </Link>
        </div>
      </div>
      <div className="profile-kpis">
        <div>
          <p className="eyebrow">Current program</p>
          <b>{c.programName}</b>
        </div>
        <div>
          <p className="eyebrow">Consistency</p>
          <b className="text-primary">{c.weeklyCompletion}%</b>
        </div>
        <div>
          <p className="eyebrow">Current weight</p>
          <b>{c.currentWeightKg ? `${c.currentWeightKg} kg` : "Not logged"}</b>
        </div>
        <div>
          <p className="eyebrow">Streak</p>
          <b>{c.streakDays} days</b>
        </div>
      </div>
      <div className="content-grid mt-8">
        <section>
          <SectionTitle overline="Performance" title="Momentum" />
          <div className="chart-panel">
            <div className="h-64">
              {trend.length < 2 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Not enough weigh-ins yet to chart a trend.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="day" hide />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      fill="var(--primary-fade)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
        <section>
          <SectionTitle overline="Latest" title="Check-in signal" />
          <div className="panel p-6">
            {!checkIn ? (
              <p className="text-sm text-muted-foreground">No check-ins submitted yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    ["ENERGY", checkIn.energy != null ? String(checkIn.energy) : "—"],
                    ["SLEEP", checkIn.sleep_hours != null ? `${checkIn.sleep_hours}h` : "—"],
                    ["MOOD", checkIn.mood ?? "—"],
                  ].map((x) => (
                    <div key={x[0]}>
                      <p className="eyebrow">{x[0]}</p>
                      <b className="mt-2 block text-xl">{x[1]}</b>
                    </div>
                  ))}
                </div>
                {checkIn.training_feedback && (
                  <blockquote>&ldquo;{checkIn.training_feedback}&rdquo;</blockquote>
                )}
                <Link to="/coach/check-ins">
                  <Button variant="outline" className="mt-4 w-full">
                    Review full check-in
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
      <section className="mt-8">
        <SectionTitle overline="This week" title="Scheduled work" />
        <div className="week-strip">
          {isLoading && <p className="text-sm text-muted-foreground">Loading schedule...</p>}
          {!isLoading &&
            week.map((d, i) => (
              <div className={`week-day ${d.score === 100 ? "complete" : ""}`} key={i}>
                <small>{d.day}</small>
                <b>{d.date}</b>
                <span>{d.label}</span>
                <ProgressBar value={d.score} thin />
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
const CAL_START_HOUR = 7;
const CAL_END_HOUR = 19;
function Schedule() {
  const [mode, setMode] = useState("Week");
  const { data } = useCoachWeekSchedule();
  const events = data ?? [];
  const dates = weekDates();
  const today = isoDate();
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      <PageHead
        eyebrow={monthLabel}
        title="Schedule"
        subtitle="Orchestrate every workout, check-in, reminder and call."
        action={
          <Link to="/coach/workouts">
            <Button>
              <Plus />
              New event
            </Button>
          </Link>
        }
      />
      <div className="toolbar">
        <div className="segmented">
          {["Day", "Week", "Month"].map((x) => (
            <button onClick={() => setMode(x)} className={mode === x ? "selected" : ""} key={x}>
              {x}
            </button>
          ))}
        </div>
        <Button variant="outline">
          <CalendarDays />
          Today
        </Button>
      </div>
      <div className="calendar-grid">
        <div className="calendar-times">
          {["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {dates.slice(0, 5).map((date) => {
          const key = date.toISOString().slice(0, 10);
          const dayEvents = events.filter((e) => e.date === key);
          return (
            <div className="calendar-day" key={key}>
              <div className="calendar-head">
                <small>{formatDay(date.toISOString())}</small>
                <b className={key === today ? "today" : ""}>{date.getDate()}</b>
              </div>
              {dayEvents.map((e) => (
                <Event key={e.id} time={e.time} title={e.title} type={e.type} />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
function Event({ time, title, type }: { time: string; title: string; type: string }) {
  const [h, m] = time.split(":").map(Number);
  const minutesFromStart = ((h ?? CAL_START_HOUR) - CAL_START_HOUR) * 60 + (m ?? 0);
  const totalMinutes = (CAL_END_HOUR - CAL_START_HOUR) * 60;
  const top = Math.min(94, Math.max(0, (minutesFromStart / totalMinutes) * 100));
  return (
    <button className={`cal-event ${type.toLowerCase()}`} style={{ top: `${top}%`, height: "16%" }}>
      <small>{type}</small>
      <b>{title}</b>
    </button>
  );
}
function AssignWorkoutDialog({ workoutId }: { workoutId: string }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(isoDate());
  const { data: roster } = useCoachRoster();
  const assign = useAssignWorkout();

  const onSubmit = async () => {
    if (!clientId) return;
    try {
      await assign.mutateAsync({
        workout_id: workoutId,
        client_id: clientId,
        scheduled_date: date,
      });
      toast.success("Workout assigned.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't assign that workout.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="mt-3 w-full">
          <Check />
          Save & assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign this workout</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {(roster ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-date">Date</Label>
            <Input
              id="assign-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={assign.isPending}>
            {assign.isPending ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function NewExerciseDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const createExercise = useCreateExercise();

  const onSubmit = async () => {
    if (!name.trim()) return;
    try {
      const created = await createExercise.mutateAsync({
        name: name.trim(),
        category: category || null,
      });
      toast.success("Exercise added to your library.");
      setOpen(false);
      setName("");
      onCreated(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that exercise.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="exercise-option">
          <span>
            <Plus size={16} />
          </span>
          <b>New exercise</b>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New exercise</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ex-name">Name</Label>
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Back squat"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-category">Category</Label>
            <Input
              id="ex-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Strength"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createExercise.isPending}>
            {createExercise.isPending ? "Adding..." : "Add to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Workouts() {
  const { data: workouts, isLoading } = useCoachWorkouts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data: library } = useExerciseLibrary(search);
  const createWorkout = useCreateWorkout();
  const updateWorkout = useUpdateWorkout();
  const addExercise = useAddExerciseToWorkout();
  const removeExercise = useRemoveWorkoutExercise();

  const selected = workouts?.find((w) => w.id === selectedId) ?? workouts?.[0] ?? null;
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setTitle(selected?.title ?? "");
    setDuration(selected?.duration_minutes ? String(selected.duration_minutes) : "");
    setNotes(selected?.notes ?? "");
    // Only reset the form when switching which workout is selected, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const workoutExercises = [...(selected?.workout_exercises ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  const onNewWorkout = async () => {
    const created = await createWorkout.mutateAsync({ title: "New workout" });
    setSelectedId(created.id);
  };

  const onAddExercise = async (exerciseId: string) => {
    if (!selected) {
      toast.error("Create a workout first.");
      return;
    }
    await addExercise.mutateAsync({
      workout_id: selected.id,
      exercise_id: exerciseId,
      order_index: workoutExercises.length,
      sets: 3,
      reps: "8-10",
      rest_seconds: 60,
    });
  };

  const onSaveSettings = async () => {
    if (!selected) return;
    await updateWorkout.mutateAsync({
      id: selected.id,
      title,
      duration_minutes: duration ? Number(duration) : undefined,
      notes,
    });
    toast.success("Workout saved.");
  };

  return (
    <>
      <PageHead
        eyebrow="Programming"
        title="Workout studio"
        subtitle="Build precise sessions with the rhythm of a professional training floor."
        action={
          <Button onClick={onNewWorkout} disabled={createWorkout.isPending}>
            <Plus />
            New workout
          </Button>
        }
      />
      {!isLoading && (workouts ?? []).length > 1 && (
        <div className="toolbar">
          <div className="segmented">
            {(workouts ?? []).slice(0, 6).map((w) => (
              <button
                key={w.id}
                className={selected?.id === w.id ? "selected" : ""}
                onClick={() => setSelectedId(w.id)}
              >
                {w.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="builder">
        <aside className="builder-library">
          <div className="search-wrap">
            <Search />
            <Input
              placeholder="Search exercises"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="eyebrow mt-5">Exercise library</p>
          {(library ?? []).map((ex) => (
            <button onClick={() => onAddExercise(ex.id)} className="exercise-option" key={ex.id}>
              <span>
                <Dumbbell size={16} />
              </span>
              <b>{ex.name}</b>
              <Plus size={15} />
            </button>
          ))}
          <NewExerciseDialog onCreated={onAddExercise} />
        </aside>
        <section className="builder-canvas">
          {!selected ? (
            <div className="grid h-full place-items-center p-10 text-center text-sm text-muted-foreground">
              Create a workout to start building your training sequence.
            </div>
          ) : (
            <>
              <div className="workout-cover">
                <img
                  src={battle}
                  width={1600}
                  height={912}
                  loading="lazy"
                  alt="Athlete training with battle ropes"
                />
                <div>
                  <p className="eyebrow">
                    {selected.duration_minutes ? `${selected.duration_minutes} min` : "Untimed"}
                  </p>
                  <h2>{selected.title}</h2>
                  {selected.description && <p>{selected.description}</p>}
                </div>
                <button className="play-button">
                  <Play fill="currentColor" />
                </button>
              </div>
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Training sequence</h3>
                  <span className="text-xs font-bold text-muted-foreground">
                    {workoutExercises.length} EXERCISE{workoutExercises.length === 1 ? "" : "S"}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {workoutExercises.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Add exercises from the library on the left.
                    </p>
                  )}
                  {workoutExercises.map((e, i) => {
                    const exercise = e.exercises as unknown as { name: string } | null;
                    return (
                      <div className="builder-row" key={e.id}>
                        <span className="drag-handle">⠿</span>
                        <b className="index">{String(i + 1).padStart(2, "0")}</b>
                        <div className="flex-1">
                          <b>{exercise?.name ?? "Exercise"}</b>
                          <small>
                            {e.sets} × {e.reps} {e.load ? `· ${e.load}` : ""}
                          </small>
                        </div>
                        <div>
                          <small>REST</small>
                          <b>{e.rest_seconds ? `${e.rest_seconds}s` : "—"}</b>
                        </div>
                        <button className="icon-button" onClick={() => removeExercise.mutate(e.id)}>
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
        <aside className="builder-settings">
          <p className="eyebrow">Workout settings</p>
          <label>
            <span>Workout title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!selected} />
          </label>
          <label>
            <span>Duration (minutes)</span>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={!selected}
            />
          </label>
          <label>
            <span>Coach notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!selected}
            />
          </label>
          <Button
            className="mt-3 w-full"
            variant="outline"
            onClick={onSaveSettings}
            disabled={!selected}
          >
            Save changes
          </Button>
          {selected && <AssignWorkoutDialog workoutId={selected.id} />}
        </aside>
      </div>
    </>
  );
}
function UploadVideoDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Strength");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadExerciseVideo();

  const onSubmit = async () => {
    if (!file || !name.trim()) return;
    try {
      await upload.mutateAsync({ file, newExercise: { name: name.trim(), category } });
      toast.success("Video uploaded.");
      setOpen(false);
      setName("");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload that video.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload />
          Upload video
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a training video</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="video-name">Exercise name</Label>
            <Input
              id="video-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint mechanics"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-category">Category</Label>
            <select
              id="video-category"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Strength</option>
              <option>Mobility</option>
              <option>Conditioning</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-file">Video file</Label>
            <input
              id="video-file"
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={upload.isPending || !file}>
            {upload.isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Videos() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { data } = useVideoLibrary(search, category);
  const videos = data ?? [];
  const [featured, ...rest] = videos;

  return (
    <>
      <PageHead
        eyebrow="Media"
        title="Training library"
        subtitle="Movement instruction built to be watched, understood, and performed."
        action={<UploadVideoDialog />}
      />
      <div className="toolbar">
        <div className="search-wrap">
          <Search />
          <Input
            placeholder="Search movement library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="segmented">
          {["All", "Strength", "Mobility", "Conditioning"].map((x) => (
            <button
              key={x}
              className={category === x ? "selected" : ""}
              onClick={() => setCategory(x)}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      {videos.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No training videos yet. Upload your first demonstration video to build the library.
          </p>
        </div>
      )}
      {featured && (
        <div className="video-feature">
          <img
            src={featured.thumbnail_url || runner}
            width={1600}
            height={912}
            loading="lazy"
            alt={featured.name}
          />
          <div className="video-overlay">
            <span className="live-chip">FEATURED</span>
            <h2>{featured.name}</h2>
            <p>
              {featured.category ?? "Movement"}
              {featured.duration_seconds
                ? ` · ${Math.floor(featured.duration_seconds / 60)}:${String(featured.duration_seconds % 60).padStart(2, "0")}`
                : ""}
            </p>
          </div>
          <a href={featured.video_url!} target="_blank" rel="noreferrer" className="play-button">
            <Play fill="currentColor" />
          </a>
        </div>
      )}
      <div className="video-grid">
        {rest.map((ex, i) => {
          const assignedCount =
            (ex.workout_exercises as unknown as { count: number }[])?.[0]?.count ?? 0;
          return (
            <article className="video-card" key={ex.id}>
              <div className="video-thumb">
                <img
                  src={ex.thumbnail_url || (i % 2 ? runner : battle)}
                  loading="lazy"
                  width={1600}
                  height={912}
                  alt={ex.name}
                />
                {ex.duration_seconds && (
                  <span>
                    {Math.floor(ex.duration_seconds / 60)}:
                    {String(ex.duration_seconds % 60).padStart(2, "0")}
                  </span>
                )}
                <a href={ex.video_url!} target="_blank" rel="noreferrer">
                  <Play fill="currentColor" />
                </a>
              </div>
              <p className="eyebrow mt-4">{(ex.category ?? "movement").toUpperCase()}</p>
              <h3>{ex.name}</h3>
              <p className="text-xs text-muted-foreground">
                {assignedCount === 0
                  ? "Not yet assigned"
                  : `Assigned to ${assignedCount} workout${assignedCount === 1 ? "" : "s"}`}
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}
function CreatePlanDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Performance build");
  const [calories, setCalories] = useState("2100");
  const [protein, setProtein] = useState("160");
  const [carbs, setCarbs] = useState("240");
  const [fat, setFat] = useState("65");
  const createPlan = useCreateNutritionPlan();

  const onSubmit = async () => {
    try {
      await createPlan.mutateAsync({
        client_id: clientId,
        name,
        target_calories: Number(calories),
        target_protein_g: Number(protein),
        target_carbs_g: Number(carbs),
        target_fat_g: Number(fat),
      });
      toast.success("Nutrition plan created.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that plan.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Create plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New nutrition plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-cal">Calories</Label>
              <Input
                id="plan-cal"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-protein">Protein (g)</Label>
              <Input
                id="plan-protein"
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-carbs">Carbs (g)</Label>
              <Input
                id="plan-carbs"
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-fat">Fat (g)</Label>
              <Input
                id="plan-fat"
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createPlan.isPending}>
            {createPlan.isPending ? "Creating..." : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Nutrition() {
  const { data: roster } = useCoachRoster();
  const [clientId, setClientId] = useState<string | null>(null);
  const activeClientId = clientId ?? roster?.[0]?.id ?? null;
  const { data: plan, isLoading } = useNutritionPlan(activeClientId ?? undefined);
  const addMeal = useAddMeal();
  const [mealName, setMealName] = useState("");
  const [mealKcal, setMealKcal] = useState("");
  const [addingMeal, setAddingMeal] = useState(false);

  const onAddMeal = async () => {
    if (!plan || !mealName.trim()) return;
    await addMeal.mutateAsync({
      nutrition_plan_id: plan.id,
      name: mealName.trim(),
      order_index: plan.meals?.length ?? 0,
      calories: Number(mealKcal) || 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
    setMealName("");
    setMealKcal("");
    setAddingMeal(false);
  };

  return (
    <>
      <PageHead
        eyebrow="Fuel strategy"
        title="Nutrition plans"
        subtitle="Design the fuel behind the performance."
        action={activeClientId ? <CreatePlanDialog clientId={activeClientId} /> : undefined}
      />
      <div className="toolbar">
        <select
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
          value={activeClientId ?? ""}
          onChange={(e) => setClientId(e.target.value)}
        >
          {(roster ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {!activeClientId && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Add a client first to build their nutrition plan.
          </p>
        </div>
      )}
      {activeClientId && !isLoading && !plan && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No active plan for this athlete yet. Create one to get started.
          </p>
        </div>
      )}
      {plan && (
        <>
          <div className="nutrition-head">
            <div>
              <p className="eyebrow">Selected plan</p>
              <h2>{plan.name}</h2>
              <p>
                {plan.day_type} day · {plan.target_calories} kcal
              </p>
            </div>
            <div className="macro-strip">
              {[
                ["P", `${plan.target_protein_g}g`, "Protein"],
                ["C", `${plan.target_carbs_g}g`, "Carbs"],
                ["F", `${plan.target_fat_g}g`, "Fat"],
              ].map((x) => (
                <div key={x[0]}>
                  <span>{x[0]}</span>
                  <b>{x[1]}</b>
                  <small>{x[2]}</small>
                </div>
              ))}
            </div>
          </div>
          <section className="mt-8">
            <SectionTitle overline="Daily sequence" title="Meal structure" />
            <div className="meal-list">
              {(plan.meals ?? []).map((m: MealRow, i: number) => (
                <article className="meal-row" key={m.id}>
                  <time>{m.meal_time ?? "—"}</time>
                  <span className="meal-number">0{i + 1}</span>
                  <div className="flex-1">
                    <h3>{m.name}</h3>
                    <p>{m.foods_summary ?? "No foods listed yet"}</p>
                  </div>
                  <div className="meal-macros">
                    <b>{m.calories}</b>
                    <small>KCAL</small>
                  </div>
                </article>
              ))}
              {addingMeal ? (
                <article className="meal-row">
                  <span className="meal-number">+</span>
                  <div className="flex flex-1 gap-2">
                    <Input
                      placeholder="Meal name"
                      value={mealName}
                      onChange={(e) => setMealName(e.target.value)}
                    />
                    <Input
                      placeholder="Kcal"
                      type="number"
                      className="w-24"
                      value={mealKcal}
                      onChange={(e) => setMealKcal(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={onAddMeal} disabled={addMeal.isPending}>
                    Save
                  </Button>
                </article>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setAddingMeal(true)}>
                  <Plus />
                  Add meal
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
function Messages() {
  const [text, setText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: conversations, isLoading } = useConversations();
  const list = conversations ?? [];
  const active = list.find((c) => c.id === activeId) ?? list[0] ?? null;
  const { data: messages } = useMessages(active?.id);
  const sendMessage = useSendMessage();
  const { user } = useAuth();

  const other = active?.other as unknown as { full_name: string; id: string } | null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    sendMessage.mutate({ conversationId: active.id, body: text.trim() });
    setText("");
  };

  return (
    <>
      <PageHead
        eyebrow="Communication"
        title="Messages"
        subtitle="Stay close to the work without breaking its focus."
      />
      <div className="messages-layout">
        <aside className="conversation-list">
          <div className="search-wrap">
            <Search />
            <Input placeholder="Search conversations" />
          </div>
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && list.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No conversations yet. Message a client from their profile.
            </p>
          )}
          {list.map((c) => {
            const person = c.other as unknown as { full_name: string; id: string };
            return (
              <button
                className={`conversation ${active?.id === c.id ? "active" : ""}`}
                key={c.id}
                onClick={() => setActiveId(c.id)}
              >
                <span className="avatar-md">{initialsFromName(person?.full_name)}</span>
                <span className="min-w-0 flex-1">
                  <b>{person?.full_name ?? "Client"}</b>
                </span>
                <time>{timeAgo(c.last_message_at)}</time>
              </button>
            );
          })}
        </aside>
        <section className="chat">
          {!active ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Select a conversation to start messaging.
            </div>
          ) : (
            <>
              <header>
                <span className="avatar-md">{initialsFromName(other?.full_name)}</span>
                <div>
                  <b>{other?.full_name ?? "Client"}</b>
                </div>
                <button className="icon-button ml-auto">
                  <Video />
                </button>
              </header>
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
                <button type="button" className="icon-button">
                  <Plus />
                </button>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Message ${other?.full_name?.split(" ")[0] ?? ""}...`}
                />
                <Button type="submit">Send</Button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
function ScheduleMeetingDialog() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState("");
  const { data: roster } = useCoachRoster();
  const schedule = useScheduleMeeting();

  const onSubmit = async () => {
    if (!clientId || !title || !datetime) return;
    try {
      await schedule.mutateAsync({
        client_id: clientId,
        title,
        scheduled_at: new Date(datetime).toISOString(),
      });
      toast.success("Meeting scheduled.");
      setOpen(false);
      setTitle("");
      setDatetime("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't schedule that meeting.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Schedule meeting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {(roster ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Progress review"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meeting-time">Date & time</Label>
            <Input
              id="meeting-time"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={schedule.isPending}>
            {schedule.isPending ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Meetings() {
  const { data } = useMeetings();
  const meetings = data ?? [];
  const now = Date.now();
  const next = meetings.find((m) => new Date(m.scheduled_at).getTime() >= now);
  const upcoming = meetings.filter((m) => m.id !== next?.id).slice(0, 6);
  const nextOther = next?.other as unknown as { full_name: string } | null;
  const minutesUntil = next ? Math.round((new Date(next.scheduled_at).getTime() - now) / 60000) : 0;

  return (
    <>
      <PageHead
        eyebrow="1-to-1 coaching"
        title="Meetings"
        subtitle="Create space for the conversations that move performance forward."
        action={<ScheduleMeetingDialog />}
      />
      {next ? (
        <div className="meeting-feature">
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
              <span />
              {minutesUntil <= 0 ? "IN PROGRESS" : `STARTS IN ${minutesUntil} MIN`}
            </span>
            <h2>
              {next.title} with {nextOther?.full_name ?? "your client"}
            </h2>
            {next.notes && <p>{next.notes}</p>}
            <div className="mt-5 flex gap-3">
              <Button>
                <Video />
                Join room
              </Button>
              <Button variant="outline">View notes</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">No meetings scheduled yet.</p>
        </div>
      )}
      <section className="mt-8">
        <SectionTitle overline="Upcoming" title="Next conversations" />
        <div className="panel divide-y divide-border">
          {upcoming.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nothing else on the calendar.</p>
          )}
          {upcoming.map((m) => {
            const person = m.other as unknown as { full_name: string; id: string };
            const d = new Date(m.scheduled_at);
            return (
              <div className="appointment" key={m.id}>
                <time>
                  <b>{d.getDate()}</b>
                  <span>{d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</span>
                </time>
                <span className="avatar-md">{initialsFromName(person?.full_name)}</span>
                <div className="flex-1">
                  <b>
                    {m.title} · {person?.full_name ?? "Client"}
                  </b>
                  <p>
                    {formatClock(m.scheduled_at)} · Video call · {m.duration_minutes} min
                  </p>
                </div>
                <Button variant="ghost" size="icon">
                  <ChevronRight />
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
function Progress() {
  const { data: roster } = useCoachRoster();
  const d = useCoachDashboard();
  const clients = roster ?? [];
  const avgStreak = clients.length
    ? Math.round(clients.reduce((s, c) => s + c.streakDays, 0) / clients.length)
    : 0;
  const atRisk = clients.filter((c) => c.status === "attention").length;
  const leaderboard = [...clients]
    .sort((a, b) => b.weeklyCompletion - a.weeklyCompletion)
    .slice(0, 5);

  return (
    <>
      <PageHead
        eyebrow="Analytics"
        title="Performance intelligence"
        subtitle="Patterns across your roster, translated into coaching action."
      />
      <div className="metric-grid">
        <Metric label="Avg completion" value={`${d.avgCompletion}%`} />
        <Metric label="Active clients" value={String(clients.length).padStart(2, "0")} />
        <Metric label="Avg streak" value={`${avgStreak}d`} />
        <Metric label="At risk" value={String(atRisk).padStart(2, "0")} accent={atRisk > 0} />
      </div>
      <div className="content-grid mt-8">
        <div className="chart-panel">
          <SectionTitle overline="Completion" title="Weekly output" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.trend}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[2, 2, 0, 0]}
                  animationDuration={900}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-6">
          <SectionTitle overline="Leaderboard" title="Momentum" />
          {leaderboard.length === 0 && (
            <p className="text-sm text-muted-foreground">No athlete activity yet.</p>
          )}
          {leaderboard.map((c, i) => (
            <div className="rank-row" key={c.id}>
              <b className="rank">0{i + 1}</b>
              <span className="avatar-sm">{c.initials}</span>
              <div className="flex-1">
                <b>{c.name}</b>
                <ProgressBar value={c.weeklyCompletion} thin />
              </div>
              <strong>{c.weeklyCompletion}%</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function CheckIns() {
  const { data } = useCoachCheckIns();
  const reviewCheckIn = useReviewCheckIn();
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const checkIns = data ?? [];

  const submitFeedback = async (id: string) => {
    try {
      await reviewCheckIn.mutateAsync({ id, feedback: feedback[id] ?? "" });
      toast.success("Feedback sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save feedback.");
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Athlete signals"
        title="Check-ins"
        subtitle="Read the human data behind every training week."
      />
      {checkIns.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">No check-ins submitted yet.</p>
        </div>
      )}
      <div className="checkin-grid">
        {checkIns.map((c) => {
          const person = c.profiles as unknown as { full_name: string; id: string };
          return (
            <article className="checkin-card" key={c.id}>
              <header>
                <span className="avatar-md">{initialsFromName(person?.full_name)}</span>
                <div>
                  <b>{person?.full_name ?? "Client"}</b>
                  <p>{timeAgo(c.submitted_at)}</p>
                </div>
                <span className={c.status === "pending" ? "status attention" : "status on-track"}>
                  {c.status === "pending" ? "Review" : "Reviewed"}
                </span>
              </header>
              <div className="signal-grid">
                <div>
                  <small>ENERGY</small>
                  <b>{c.energy ?? "—"}</b>
                </div>
                <div>
                  <small>SLEEP</small>
                  <b>{c.sleep_hours != null ? `${c.sleep_hours}h` : "—"}</b>
                </div>
                <div>
                  <small>MOOD</small>
                  <b>{c.mood ?? "—"}</b>
                </div>
              </div>
              {c.training_feedback && (
                <p className="checkin-note">&ldquo;{c.training_feedback}&rdquo;</p>
              )}
              {c.status === "pending" ? (
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder="Write feedback..."
                    value={feedback[c.id] ?? ""}
                    onChange={(e) => setFeedback((f) => ({ ...f, [c.id]: e.target.value }))}
                  />
                  <Button variant="outline" className="w-full" onClick={() => submitFeedback(c.id)}>
                    Send feedback & mark reviewed
                  </Button>
                </div>
              ) : (
                c.coach_feedback && (
                  <p className="text-sm text-muted-foreground">Your reply: {c.coach_feedback}</p>
                )
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
const coachSettingsTabs = ["Profile", "Notifications", "Daily reports"] as const;
function Settings() {
  const [tab, setTab] = useState<(typeof coachSettingsTabs)[number]>("Profile");
  return (
    <>
      <PageHead
        eyebrow="Workspace"
        title="Settings"
        subtitle="Control how iCoach fits your coaching rhythm."
      />
      <div className="settings-layout">
        <nav>
          {coachSettingsTabs.map((x) => (
            <button className={tab === x ? "active" : ""} key={x} onClick={() => setTab(x)}>
              {x}
              <ChevronRight />
            </button>
          ))}
        </nav>
        {tab === "Profile" && <ProfileSettingsPanel />}
        {tab === "Notifications" && <NotificationSettingsPanel />}
        {tab === "Daily reports" && <DailyReportsPanel />}
      </div>
    </>
  );
}
function ProfileSettingsPanel() {
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");

  const save = async () => {
    try {
      await updateProfile.mutateAsync({ full_name: fullName, phone, bio });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your profile.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="settings-panel">
        <p className="eyebrow">Your details</p>
        <h2>Coach profile</h2>
        <p className="text-sm text-muted-foreground">
          This is how your name and bio appear to your athletes.
        </p>
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
            <b>Phone</b>
            <Input className="mt-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="setting-row">
          <div className="w-full">
            <b>Bio</b>
            <textarea
              className="mt-2 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
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
function NotificationSettingsPanel() {
  const { profile } = useAuth();
  const updatePrefs = useUpdateNotificationPrefs();
  const prefs = profile?.notification_prefs ?? {};
  const rows: [string, string, string][] = [
    ["newMessage", "New messages", "Alert me when a client sends a message"],
    ["checkIn", "Check-in submitted", "Alert me when a client submits a check-in"],
    ["workoutCompleted", "Workout completed", "Alert me when a client finishes a session"],
    ["meetingReminder", "Meeting reminders", "Remind me before scheduled meetings"],
  ];
  const toggle = (key: string, value: boolean) => {
    updatePrefs.mutate({ ...prefs, [key]: value });
  };
  return (
    <section className="settings-panel">
      <p className="eyebrow">Stay informed</p>
      <h2>Notifications</h2>
      <p className="text-sm text-muted-foreground">Choose what iCoach should notify you about.</p>
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
function DailyReportsPanel() {
  const { profile } = useAuth();
  const updateSettings = useUpdateDailyReportSettings();
  const settings = profile?.daily_report_settings ?? {};
  const [enabled, setEnabled] = useState(settings.enabled ?? false);
  const [time, setTime] = useState(settings.time ?? "20:00");
  const [push, setPush] = useState(settings.push ?? true);

  const save = async () => {
    try {
      await updateSettings.mutateAsync({ enabled, time, push });
      toast.success("Report preferences saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save preferences.");
    }
  };

  return (
    <section className="settings-panel">
      <p className="eyebrow">Automation setup</p>
      <h2>Daily client reports</h2>
      <p className="text-sm text-muted-foreground">
        Choose when and how your athlete summaries appear.
      </p>
      <div className="setting-row">
        <div>
          <b>Enable daily reports</b>
          <p>Prepare one consolidated report for your active clients.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div className="setting-row">
        <div>
          <b>Report time</b>
          <p>Your preferred daily review window.</p>
        </div>
        <select value={time} onChange={(e) => setTime(e.target.value)}>
          <option>18:00</option>
          <option>20:00</option>
          <option>21:00</option>
        </select>
      </div>
      <div className="setting-row">
        <div>
          <b>Push notification</b>
          <p>Show an alert when the report is ready.</p>
        </div>
        <Switch checked={push} onCheckedChange={setPush} />
      </div>
      <div className="report-preview">
        <p className="eyebrow">Report includes</p>
        <div className="tag-cloud">
          {[
            "Completed tasks",
            "Missed tasks",
            "Workout completion",
            "Nutrition completion",
            "Completion %",
            "Check-in status",
          ].map((x) => (
            <span key={x}>
              <Check /> {x}
            </span>
          ))}
        </div>
      </div>
      <Button className="mt-6" onClick={save} disabled={updateSettings.isPending}>
        {updateSettings.isPending ? "Saving..." : "Save preferences"}
      </Button>
    </section>
  );
}
