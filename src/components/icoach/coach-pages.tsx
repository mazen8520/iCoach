import { Link, useNavigate, useSearch } from "@tanstack/react-router";
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
  Check,
  ChevronRight,
  CircleAlert,
  Dumbbell,
  Filter,
  Flame,
  MoveRight,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  EmptyState,
  Metric,
  PageHead,
  ProgressBar,
  ProgressRing,
  SectionTitle,
} from "./primitives";
import {
  ConfirmDialog,
  Field,
  FieldSelect,
  MeetingDetailsDialog,
  StartMeetingButton,
  VideoPlayerDialog,
  type PlayableVideo,
} from "./shared";
import { isMeetingLive } from "@/lib/meeting-draft";
import {
  AssignWorkoutDialog,
  CheckInCard,
  ScheduleMeetingDialog,
  useDisplayName,
} from "./coach-shared";
import { ClientProfile } from "./coach-client-profile";
import { Schedule } from "./coach-schedule";
import { Nutrition } from "./coach-nutrition";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useConnectZoom, useDisconnectZoom, useZoomStatus } from "@/hooks/use-zoom";
import { DEFAULT_ATHLETE_PASSWORD } from "@/lib/account";
import { useCoachRoster, useCreateAthlete, type ClientStatus } from "@/hooks/use-clients";
import { useCoachDashboard } from "@/hooks/use-dashboard";
import { useConversations, useMessages, useSendMessage } from "@/hooks/use-messages";
import { useMeetings, type MeetingWithOther } from "@/hooks/use-meetings";
import { useCoachCheckIns } from "@/hooks/use-check-ins";
import {
  useUpdateDailyReportSettings,
  useUpdateNotificationPrefs,
  useUpdateProfile,
} from "@/hooks/use-settings";
import {
  useAddExerciseToWorkout,
  useCoachWorkouts,
  useCreateExercise,
  useCreateWorkout,
  useDeleteWorkout,
  useExerciseLibrary,
  useRemoveWorkoutExercise,
  useUpdateWorkout,
  useUploadExerciseVideo,
  useVideoLibrary,
} from "@/hooks/use-workouts";
import { initialsFromName, isHttpUrl, isoDate, parseIsoDate } from "@/lib/format";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";

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

const chartTooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 4,
};

function CoachDashboard() {
  const { t, tp, fmt } = useI18n();
  const { profile } = useAuth();
  const displayName = useDisplayName();
  const d = useCoachDashboard();
  const firstName = profile?.full_name?.split(" ")[0] || t("coach.dashboard.fallbackName");
  const today = fmt.date(new Date(), { weekday: "long", month: "short", day: "numeric" });
  const liveNow = d.activeClients > 0 ? Math.round((d.avgCompletion / 100) * d.activeClients) : 0;
  const trend = d.trend.map((p) => ({ ...p, day: fmt.weekday(parseIsoDate(p.date)) }));

  return (
    <>
      <PageHead
        eyebrow={today}
        title={t("coach.dashboard.greeting", { name: firstName })}
        subtitle={
          d.attentionQueue.length > 0
            ? tp("coach.dashboard.subtitleAttention", d.attentionQueue.length)
            : t("coach.dashboard.subtitleClear")
        }
        action={
          <Link to="/coach/clients">
            <Button>
              <Plus />
              {t("coach.addClient")}
            </Button>
          </Link>
        }
      />
      <section className="dashboard-lead">
        <div className="lead-copy">
          <span className="live-chip">
            <span />
            {t("coach.dashboard.todayLive")}
          </span>
          <h2>
            {tp("coach.dashboard.athletes", d.activeClients)}
            <br />
            <em>{t("coach.dashboard.inMotion")}</em>
          </h2>
          <p>{t("coach.dashboard.sessionsUnderway", { done: liveNow, total: d.activeClients })}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/coach/clients">
              <Button size="lg">
                {t("coach.dashboard.openLive")} <MoveRight />
              </Button>
            </Link>
            <Link to="/coach/schedule">
              <Button variant="outline" size="lg">
                {t("coach.dashboard.viewSchedule")}
              </Button>
            </Link>
          </div>
        </div>
        <div className="lead-stats">
          <ProgressRing
            value={d.avgCompletion}
            size={154}
            label={t("coach.dashboard.completionRing")}
          />
          <div>
            <p className="eyebrow">{t("coach.dashboard.teamPulse")}</p>
            <strong className="font-display text-5xl">{d.activeClients}</strong>
            <span className="ms-2 text-sm text-muted-foreground">
              {t("coach.dashboard.athletesLabel")}
            </span>
          </div>
        </div>
      </section>
      <div className="metric-grid mt-4">
        <Metric
          label={t("metric.activeClients")}
          value={String(d.activeClients).padStart(2, "0")}
        />
        <Metric label={t("metric.weeklyCompletion")} value={`${d.avgCompletion}%`} />
        <Metric
          label={t("metric.checkInsDue")}
          value={String(d.checkInsDue).padStart(2, "0")}
          accent={d.checkInsDue > 0}
        />
        <Metric
          label={t("metric.needsAttention")}
          value={String(d.attentionQueue.length).padStart(2, "0")}
        />
      </div>
      <div className="content-grid mt-8">
        <section>
          <SectionTitle
            overline={t("coach.dashboard.requiresAction")}
            title={t("coach.dashboard.attentionQueue")}
            action={
              <Link to="/coach/clients">
                <Button variant="ghost" size="sm">
                  {t("common.viewAll")} <ChevronRight />
                </Button>
              </Link>
            }
          />
          <div className="panel divide-y divide-border">
            {d.attentionQueue.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                {t("coach.dashboard.noAttention")}
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
                  <b>{displayName(c.name)}</b>
                  <small>{t("coach.dashboard.overdue")}</small>
                </span>
                <span className="status attention">
                  <CircleAlert size={13} /> {t("coach.dashboard.review")}
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle
            overline={t("coach.dashboard.nextUp")}
            title={t("coach.dashboard.meetings")}
          />
          <div className="panel p-2">
            {d.upcomingMeetings.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">{t("coach.dashboard.noMeetings")}</p>
            )}
            {d.upcomingMeetings.map((m) => {
              const other = m.profiles as unknown as { full_name: string } | null;
              const isToday = isoDate(new Date(m.scheduled_at)) === isoDate();
              return (
                <div className="meeting-row" key={m.id}>
                  <div className="date-block">
                    <b>{fmt.clock(m.scheduled_at)}</b>
                    <small>
                      {isToday
                        ? t("common.today")
                        : fmt.date(m.scheduled_at, { month: "short", day: "numeric" })}
                    </small>
                  </div>
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">
                      {displayName(other?.full_name)} · {m.title}
                    </b>
                    <p className="text-xs text-muted-foreground">
                      {t("coach.dashboard.videoCall", { minutes: m.duration_minutes })}
                    </p>
                  </div>
                  {m.zoom_meeting_id ? (
                    <StartMeetingButton meetingId={m.id} iconOnly />
                  ) : isHttpUrl(m.video_url) ? (
                    <a
                      href={m.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="icon-button"
                      aria-label={t("coach.dashboard.joinMeeting")}
                    >
                      <Video size={16} />
                    </a>
                  ) : (
                    <Link
                      to="/coach/meetings"
                      className="icon-button"
                      aria-label={t("coach.dashboard.meetings")}
                    >
                      <Video size={16} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="mt-8">
        <SectionTitle
          overline={t("coach.dashboard.last7")}
          title={t("coach.dashboard.teamPerformance")}
        />
        <div className="chart-panel">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
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
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={t("metric.weeklyCompletion")}
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

// ============================================================
// Clients
// ============================================================

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function AddClientDialog() {
  const i18n = useI18n();
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const createAthlete = useCreateAthlete();

  const reset = () => {
    setFullName("");
    setEmail("");
    setAge("");
    setSex("");
    setHeight("");
    setWeight("");
    setCreated(null);
  };

  const onSubmit = async () => {
    if (!fullName.trim()) {
      toast.error(t("validation.fullName"));
      return;
    }
    if (!emailPattern.test(email.trim())) {
      toast.error(t("validation.email"));
      return;
    }
    if (age && !(Number.isInteger(Number(age)) && Number(age) >= 1 && Number(age) <= 119)) {
      toast.error(t("validation.age"));
      return;
    }
    if (height && !(Number(height) > 0 && Number(height) <= 299)) {
      toast.error(t("validation.height"));
      return;
    }
    if (weight && !(Number(weight) > 0 && Number(weight) <= 500)) {
      toast.error(t("validation.weight"));
      return;
    }

    try {
      const result = await createAthlete.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        ...(age ? { age: Number(age) } : {}),
        ...(sex ? { sex: sex as "male" | "female" | "other" } : {}),
        ...(height ? { heightCm: Number(height) } : {}),
        ...(weight ? { weightKg: Number(weight) } : {}),
      });
      setCreated({ email: result.email, temporaryPassword: result.temporaryPassword });
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.addClient.failed"));
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(
        t("coach.addClient.credentialsText", {
          email: created.email,
          password: created.temporaryPassword,
        }),
      );
      toast.success(t("coach.addClient.copied"));
    } catch {
      toast.error(t("coach.addClient.copyFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("coach.addClient")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("coach.addClient.createdTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("coach.addClient.createdBody")}</p>
              <Field label={t("coach.addClient.email")}>
                <Input readOnly dir="ltr" value={created.email} />
              </Field>
              <Field label={t("coach.addClient.temporaryPassword")}>
                <Input readOnly dir="ltr" value={created.temporaryPassword} />
              </Field>
              <Button type="button" variant="outline" className="w-full" onClick={copyCredentials}>
                {t("coach.addClient.copy")}
              </Button>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                {t("common.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("coach.addClient.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("coach.addClient.intro", { password: DEFAULT_ATHLETE_PASSWORD })}
              </p>
              <Field label={t("coach.addClient.fullName")} htmlFor="athlete-name">
                <Input
                  id="athlete-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("coach.addClient.namePlaceholder")}
                />
              </Field>
              <Field label={t("coach.addClient.email")} htmlFor="athlete-email">
                <Input
                  id="athlete-email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("coach.addClient.emailPlaceholder")}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("coach.addClient.age")} htmlFor="athlete-age">
                  <Input
                    id="athlete-age"
                    type="number"
                    min={1}
                    max={119}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="28"
                  />
                </Field>
                <Field label={t("coach.addClient.sex")} htmlFor="athlete-sex">
                  <FieldSelect
                    id="athlete-sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                  >
                    <option value="">{t("sex.unspecified")}</option>
                    <option value="female">{t("sex.female")}</option>
                    <option value="male">{t("sex.male")}</option>
                    <option value="other">{t("sex.other")}</option>
                  </FieldSelect>
                </Field>
                <Field label={t("coach.addClient.height")} htmlFor="athlete-height">
                  <Input
                    id="athlete-height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="170"
                  />
                </Field>
                <Field label={t("coach.addClient.weight")} htmlFor="athlete-weight">
                  <Input
                    id="athlete-weight"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="65"
                  />
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onSubmit} disabled={createAthlete.isPending}>
                {createAthlete.isPending
                  ? t("coach.addClient.submitting")
                  : t("coach.addClient.submit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type StatusFilter = "all" | ClientStatus;
type SortKey = "name" | "completion" | "streak" | "recent" | "newest";
const STATUS_FILTERS: StatusFilter[] = ["all", "on-track", "attention", "new"];
const SORT_KEYS: SortKey[] = ["name", "completion", "streak", "recent", "newest"];

function Clients() {
  const { t, fmt } = useI18n();
  const displayName = useDisplayName();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [showFilters, setShowFilters] = useState(false);
  const { data, isLoading, isError } = useCoachRoster();
  const roster = data ?? [];

  const needle = q.trim().toLowerCase();
  const matchesSearch = (c: (typeof roster)[number]) =>
    !needle ||
    [c.name, c.goal ?? "", c.programName ?? ""].some((v) => v.toLowerCase().includes(needle));
  const counts = Object.fromEntries(
    STATUS_FILTERS.map((s) => [
      s,
      roster.filter((c) => matchesSearch(c) && (s === "all" || c.status === s)).length,
    ]),
  ) as Record<StatusFilter, number>;

  const shown = roster
    .filter((c) => matchesSearch(c) && (status === "all" || c.status === status))
    .sort((a, b) => {
      switch (sort) {
        case "completion":
          return b.weeklyCompletion - a.weeklyCompletion;
        case "streak":
          return b.streakDays - a.streakDays;
        case "recent":
          return (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "");
        case "newest":
          return (b.joinedAt ?? "").localeCompare(a.joinedAt ?? "");
        default:
          return displayName(a.name).localeCompare(displayName(b.name));
      }
    });
  const activeFilters = (status !== "all" ? 1 : 0) + (sort !== "name" ? 1 : 0);
  const filtering = needle !== "" || status !== "all";
  const clearFilters = () => {
    setQ("");
    setStatus("all");
    setSort("name");
  };

  return (
    <>
      <PageHead
        eyebrow={t("coach.clients.eyebrow")}
        title={t("coach.clients.title")}
        subtitle={t("coach.clients.subtitle")}
        action={<AddClientDialog />}
      />
      <div className="toolbar">
        <div className="search-wrap">
          <Search />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("coach.clients.search")}
            aria-label={t("coach.clients.search")}
          />
        </div>
        <Button
          variant={showFilters || activeFilters > 0 ? "default" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <Filter />
          {t("coach.clients.filters")}
          {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
        </Button>
        <span className="ms-auto text-xs font-bold text-muted-foreground">
          {filtering
            ? t("coach.clients.countFiltered", { shown: shown.length, total: roster.length })
            : t("coach.clients.countActive", { count: roster.length })}
        </span>
      </div>
      {showFilters && (
        <div className="filter-bar animate-enter">
          <div>
            <p className="eyebrow mb-2">{t("coach.clients.filterStatus")}</p>
            <div className="segmented scroll">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  className={status === s ? "selected" : ""}
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                >
                  {s === "all" ? t("common.all") : t(`status.${s}`)} · {counts[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="client-sort" className="eyebrow mb-2 block">
              {t("coach.clients.sortBy")}
            </Label>
            <FieldSelect
              id="client-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`coach.clients.sort.${key}`)}
                </option>
              ))}
            </FieldSelect>
          </div>
          {(activeFilters > 0 || needle) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X />
              {t("common.clearFilters")}
            </Button>
          )}
        </div>
      )}
      {isLoading && (
        <p className="p-6 text-sm text-muted-foreground">{t("coach.clients.loading")}</p>
      )}
      {isError && <EmptyState>{t("coach.clients.loadFailed")}</EmptyState>}
      {!isLoading && !isError && roster.length === 0 && (
        <EmptyState>{t("coach.clients.empty")}</EmptyState>
      )}
      {!isLoading && roster.length > 0 && shown.length === 0 && (
        <EmptyState
          action={
            <Button variant="outline" onClick={clearFilters}>
              {t("common.clearFilters")}
            </Button>
          }
        >
          {t("coach.clients.noMatches")}
        </EmptyState>
      )}
      <div className="client-list">
        {shown.map((c, i) => (
          <Link
            to="/coach/clients/$id"
            params={{ id: c.id }}
            className="client-row animate-enter"
            style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}
            key={c.id}
          >
            <span className="avatar-lg">{c.initials}</span>
            <div className="client-main">
              <div className="min-w-0">
                <h3>{displayName(c.name)}</h3>
                <p>
                  {c.goal || t("common.noGoalSet")} · {c.programName || t("common.noActiveProgram")}
                </p>
              </div>
              <span className={`status ${c.status}`}>{t(`status.${c.status}`)}</span>
            </div>
            <div className="client-progress">
              <div className="flex justify-between text-xs">
                <span>{t("coach.clients.weeklyCompletion")}</span>
                <b>{c.weeklyCompletion}%</b>
              </div>
              <ProgressBar value={c.weeklyCompletion} />
            </div>
            <div className="client-streak">
              <Flame size={17} />
              <b>{c.streakDays}</b>
              <span>{t("coach.clients.dayStreak")}</span>
            </div>
            <div className="client-last-active text-end text-xs text-muted-foreground">
              <b className="block text-foreground">
                {c.lastActiveAt ? fmt.timeAgo(c.lastActiveAt) : "—"}
              </b>
              {t("coach.clients.lastActive")}
            </div>
            <ChevronRight className="text-muted-foreground" />
          </Link>
        ))}
      </div>
    </>
  );
}

// ============================================================
// Workouts
// ============================================================

function NewExerciseDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const createExercise = useCreateExercise();

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("validation.exerciseNameRequired"));
      return;
    }
    try {
      const created = await createExercise.mutateAsync({
        name: name.trim(),
        category: category.trim() || null,
      });
      toast.success(t("coach.workouts.exerciseAdded"));
      setOpen(false);
      setName("");
      setCategory("");
      onCreated(created.id);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.exerciseFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="exercise-option">
          <span>
            <Plus size={16} />
          </span>
          <b>{t("coach.workouts.newExercise")}</b>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("coach.workouts.newExercise")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("coach.workouts.exerciseName")} htmlFor="ex-name">
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("coach.workouts.exerciseNamePlaceholder")}
            />
          </Field>
          <Field label={t("coach.workouts.category")} htmlFor="ex-category">
            <Input
              id="ex-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("coach.workouts.categoryPlaceholder")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createExercise.isPending}>
            {createExercise.isPending
              ? t("coach.workouts.adding")
              : t("coach.workouts.addToLibrary")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "New workout": the coach names the workout (and optionally sets its duration/description)
 *  before it's created. */
function NewWorkoutDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const createWorkout = useCreateWorkout();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setTitle("");
    setDuration("");
    setDescription("");
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) {
      toast.error(t("validation.workoutNameRequired"));
      return;
    }
    if (duration && !(Number(duration) > 0 && Number(duration) <= 600)) {
      toast.error(t("validation.number"));
      return;
    }
    try {
      const created = await createWorkout.mutateAsync({
        title: title.trim(),
        ...(duration ? { duration_minutes: Math.round(Number(duration)) } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.success(t("coach.workouts.created"));
      onCreated(created.id);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.createFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("coach.workouts.newWorkout")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("coach.workouts.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t("coach.workouts.name")} htmlFor="workout-name">
              <Input
                id="workout-name"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("coach.workouts.namePlaceholder")}
              />
            </Field>
            <Field label={t("coach.workouts.duration")} htmlFor="workout-duration">
              <Input
                id="workout-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="45"
              />
            </Field>
            <Field label={t("coach.workouts.description")} htmlFor="workout-description">
              <Textarea
                id="workout-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("coach.workouts.descriptionPlaceholder")}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createWorkout.isPending}>
              {createWorkout.isPending ? t("coach.workouts.creating") : t("coach.workouts.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Workouts() {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const { data: workouts, isLoading } = useCoachWorkouts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: library } = useExerciseLibrary(search);
  const updateWorkout = useUpdateWorkout();
  const deleteWorkout = useDeleteWorkout();
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
  const assignmentCount =
    (selected?.workout_assignments as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;

  const onAddExercise = async (exerciseId: string) => {
    if (!selected) {
      toast.error(t("coach.workouts.createFirst"));
      return;
    }
    try {
      await addExercise.mutateAsync({
        workout_id: selected.id,
        exercise_id: exerciseId,
        order_index: workoutExercises.length,
        sets: 3,
        reps: "8-10",
        rest_seconds: 60,
      });
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.addExerciseFailed"));
    }
  };

  const onSaveSettings = async () => {
    if (!selected) return;
    if (!title.trim()) {
      toast.error(t("validation.workoutNameRequired"));
      return;
    }
    try {
      await updateWorkout.mutateAsync({
        id: selected.id,
        title: title.trim(),
        duration_minutes: duration ? Math.round(Number(duration)) : null,
        notes,
      });
      toast.success(t("coach.workouts.saved"));
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.saveFailed"));
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    try {
      await deleteWorkout.mutateAsync(selected.id);
      toast.success(t("coach.workouts.deleted"));
      setConfirmDelete(false);
      setSelectedId(null);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.deleteFailed"));
    }
  };

  return (
    <>
      <PageHead
        eyebrow={t("coach.workouts.eyebrow")}
        title={t("coach.workouts.title")}
        subtitle={t("coach.workouts.subtitle")}
        action={<NewWorkoutDialog onCreated={setSelectedId} />}
      />
      {!isLoading && (workouts ?? []).length > 1 && (
        <div className="toolbar">
          <div className="segmented scroll">
            {(workouts ?? []).map((w) => (
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
              placeholder={t("coach.workouts.searchExercises")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="eyebrow mt-5">{t("coach.workouts.exerciseLibrary")}</p>
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
              {isLoading ? t("common.loading") : t("coach.workouts.emptyCanvas")}
            </div>
          ) : (
            <>
              <div className="workout-cover">
                <img
                  src={battle}
                  width={1600}
                  height={912}
                  loading="lazy"
                  alt={t("coach.workouts.coverAlt")}
                />
                <div>
                  <p className="eyebrow">
                    {selected.duration_minutes
                      ? tp("common.minutes", selected.duration_minutes)
                      : t("coach.workouts.untimed")}
                  </p>
                  <h2>{selected.title}</h2>
                  {selected.description && <p>{selected.description}</p>}
                </div>
                <span className="play-button" aria-hidden="true">
                  <Play fill="currentColor" />
                </span>
              </div>
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{t("coach.workouts.trainingSequence")}</h3>
                  <span className="text-xs font-bold text-muted-foreground">
                    {tp("coach.workouts.exerciseCount", workoutExercises.length)}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {workoutExercises.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("coach.workouts.addFromLibrary")}
                    </p>
                  )}
                  {workoutExercises.map((e, i) => {
                    const exercise = e.exercises as unknown as { name: string } | null;
                    return (
                      <div className="builder-row" key={e.id}>
                        <span className="drag-handle">⠿</span>
                        <b className="index">{String(i + 1).padStart(2, "0")}</b>
                        <div className="min-w-0 flex-1">
                          <b>{exercise?.name ?? t("common.exercise")}</b>
                          <small>
                            {e.sets} × {e.reps} {e.load ? `· ${e.load}` : ""}
                          </small>
                        </div>
                        <div>
                          <small>{t("coach.workouts.rest")}</small>
                          <b>{e.rest_seconds ? `${e.rest_seconds}s` : "—"}</b>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={t("coach.workouts.removeExercise")}
                          onClick={() =>
                            removeExercise.mutate(e.id, {
                              onError: (err) =>
                                toast.error(errorText(err, i18n, "coach.workouts.saveFailed")),
                            })
                          }
                        >
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
          <p className="eyebrow">{t("coach.workouts.settings")}</p>
          <label>
            <span>{t("coach.workouts.workoutTitle")}</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!selected} />
          </label>
          <label>
            <span>{t("coach.workouts.duration")}</span>
            <Input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={!selected}
            />
          </label>
          <label>
            <span>{t("coach.workouts.coachNotes")}</span>
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
            disabled={!selected || updateWorkout.isPending}
          >
            {updateWorkout.isPending ? t("common.saving") : t("coach.workouts.saveChanges")}
          </Button>
          {selected && <AssignWorkoutDialog workoutId={selected.id} />}
          {selected && (
            <Button
              className="mt-3 w-full text-destructive hover:text-destructive"
              variant="outline"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              {t("coach.workouts.deleteWorkout")}
            </Button>
          )}
        </aside>
      </div>
      {selected && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("coach.workouts.deleteConfirmTitle", { title: selected.title })}
          description={
            <>
              <span className="block">{t("coach.workouts.deleteConfirmBody")}</span>
              {assignmentCount > 0 && (
                <span className="block">
                  {tp("coach.workouts.deleteConfirmAssignments", assignmentCount)}
                </span>
              )}
            </>
          }
          confirmLabel={t("coach.workouts.deleteWorkout")}
          pending={deleteWorkout.isPending}
          onConfirm={onDelete}
        />
      )}
    </>
  );
}

// ============================================================
// Videos
// ============================================================

const VIDEO_CATEGORIES = ["Strength", "Mobility", "Conditioning"] as const;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

function categoryLabel(t: (key: TranslationKey) => string, category: string | null) {
  if (!category) return t("category.movement");
  return (VIDEO_CATEGORIES as readonly string[]).includes(category)
    ? t(`category.${category as (typeof VIDEO_CATEGORIES)[number]}`)
    : category;
}

function UploadVideoDialog() {
  const i18n = useI18n();
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Strength");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadExerciseVideo();

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("validation.exerciseNameRequired"));
      return;
    }
    if (!file) {
      toast.error(t("validation.videoFile"));
      return;
    }
    if (!file.type.startsWith("video/")) {
      toast.error(t("validation.videoType"));
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(t("validation.videoSize"));
      return;
    }
    try {
      const durationSeconds = await readVideoDuration(file);
      await upload.mutateAsync({
        file,
        newExercise: { name: name.trim(), category, durationSeconds },
      });
      toast.success(t("coach.videos.uploaded"));
      setOpen(false);
      setName("");
      setFile(null);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.videos.uploadFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload />
          {t("coach.videos.upload")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("coach.videos.uploadTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("coach.videos.exerciseName")} htmlFor="video-name">
            <Input
              id="video-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("coach.videos.namePlaceholder")}
            />
          </Field>
          <Field label={t("coach.videos.category")} htmlFor="video-category">
            <FieldSelect
              id="video-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {VIDEO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </FieldSelect>
          </Field>
          <Field label={t("coach.videos.file")} htmlFor="video-file">
            <input
              id="video-file"
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={upload.isPending || !file}>
            {upload.isPending ? t("coach.videos.uploading") : t("coach.videos.uploadSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Videos() {
  const { t, tp } = useI18n();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [playing, setPlaying] = useState<PlayableVideo | null>(null);
  const { data, isLoading } = useVideoLibrary(search.trim(), category);
  const videos = data ?? [];
  const [featured, ...rest] = videos;
  const filtering = search.trim() !== "" || category !== "All";

  const play = (ex: { name: string; video_url: string | null; category: string | null }) => {
    if (!ex.video_url) return;
    setPlaying({ title: ex.name, url: ex.video_url, subtitle: categoryLabel(t, ex.category) });
  };

  return (
    <>
      <PageHead
        eyebrow={t("coach.videos.eyebrow")}
        title={t("coach.videos.title")}
        subtitle={t("coach.videos.subtitle")}
        action={<UploadVideoDialog />}
      />
      <div className="toolbar">
        <div className="search-wrap">
          <Search />
          <Input
            placeholder={t("coach.videos.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="segmented scroll">
          {(["All", ...VIDEO_CATEGORIES] as const).map((x) => (
            <button
              key={x}
              className={category === x ? "selected" : ""}
              onClick={() => setCategory(x)}
            >
              {t(`category.${x}`)}
            </button>
          ))}
        </div>
      </div>
      {isLoading && (
        <p className="p-6 text-sm text-muted-foreground">{t("coach.videos.loading")}</p>
      )}
      {!isLoading && videos.length === 0 && (
        <EmptyState>{filtering ? t("coach.videos.noMatches") : t("coach.videos.empty")}</EmptyState>
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
            <span className="live-chip">{t("coach.videos.featured")}</span>
            <h2>{featured.name}</h2>
            <p>
              {categoryLabel(t, featured.category)}
              {featured.duration_seconds ? ` · ${formatDuration(featured.duration_seconds)}` : ""}
            </p>
          </div>
          <button
            className="play-button"
            onClick={() => play(featured)}
            aria-label={t("coach.videos.play", { name: featured.name })}
          >
            <Play fill="currentColor" />
          </button>
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
                {ex.duration_seconds ? <span>{formatDuration(ex.duration_seconds)}</span> : null}
                <button
                  onClick={() => play(ex)}
                  aria-label={t("coach.videos.play", { name: ex.name })}
                >
                  <Play fill="currentColor" />
                </button>
              </div>
              <p className="eyebrow mt-4">{categoryLabel(t, ex.category)}</p>
              <h3>{ex.name}</h3>
              <p className="text-xs text-muted-foreground">
                {assignedCount === 0
                  ? t("coach.videos.notAssigned")
                  : tp("coach.videos.assigned", assignedCount)}
              </p>
            </article>
          );
        })}
      </div>
      <VideoPlayerDialog video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

// ============================================================
// Messages
// ============================================================

function Messages() {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const displayName = useDisplayName();
  const search = useSearch({ strict: false }) as { c?: string };
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("");
  const [activeId, setActiveId] = useState<string | null>(search.c ?? null);
  const { data: conversations, isLoading } = useConversations();
  const list = conversations ?? [];
  const needle = filter.trim().toLowerCase();
  const shownList = list.filter((c) => {
    const person = c.other as unknown as { full_name: string } | null;
    return !needle || (person?.full_name ?? "").toLowerCase().includes(needle);
  });
  const active = list.find((c) => c.id === activeId) ?? list[0] ?? null;
  const { data: messages } = useMessages(active?.id);
  const sendMessage = useSendMessage();
  const { user } = useAuth();

  useEffect(() => {
    if (search.c) setActiveId(search.c);
  }, [search.c]);

  const other = active?.other as unknown as { full_name: string; id: string } | null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    sendMessage.mutate(
      { conversationId: active.id, body: text.trim() },
      { onError: (err) => toast.error(errorText(err, i18n, "messages.sendFailed")) },
    );
    setText("");
  };

  return (
    <>
      <PageHead
        eyebrow={t("coach.messages.eyebrow")}
        title={t("coach.messages.title")}
        subtitle={t("coach.messages.subtitle")}
      />
      <div className="messages-layout">
        <aside className="conversation-list">
          <div className="search-wrap">
            <Search />
            <Input
              placeholder={t("coach.messages.search")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {isLoading && <p className="p-4 text-sm text-muted-foreground">{t("common.loading")}</p>}
          {!isLoading && list.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{t("coach.messages.empty")}</p>
          )}
          {!isLoading && list.length > 0 && shownList.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{t("coach.messages.noMatches")}</p>
          )}
          {shownList.map((c) => {
            const person = c.other as unknown as { full_name: string; id: string };
            return (
              <button
                className={`conversation ${active?.id === c.id ? "active" : ""}`}
                key={c.id}
                onClick={() => setActiveId(c.id)}
              >
                <span className="avatar-md">{initialsFromName(person?.full_name)}</span>
                <span className="min-w-0 flex-1">
                  <b>{displayName(person?.full_name)}</b>
                </span>
                <time>{fmt.timeAgo(c.last_message_at)}</time>
              </button>
            );
          })}
        </aside>
        <section className="chat">
          {!active ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              {t("coach.messages.select")}
            </div>
          ) : (
            <>
              <header>
                <span className="avatar-md">{initialsFromName(other?.full_name)}</span>
                <div>
                  <b>{displayName(other?.full_name)}</b>
                </div>
                <Link
                  to="/coach/meetings"
                  className="icon-button ms-auto"
                  aria-label={t("coach.messages.scheduleCall")}
                  title={t("coach.messages.scheduleCall")}
                >
                  <Video />
                </Link>
              </header>
              <div className="chat-body">
                {(messages ?? []).length === 0 && (
                  <p className="day-label">{t("messages.sayHello")}</p>
                )}
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
                <button type="button" className="icon-button">
                  <Plus />
                </button>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("messages.placeholder", {
                    name: other?.full_name?.split(" ")[0] ?? "",
                  })}
                />
                <Button type="submit">{t("common.send")}</Button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}

// ============================================================
// Meetings
// ============================================================

function Meetings() {
  const { t, fmt } = useI18n();
  const displayName = useDisplayName();
  const { data } = useMeetings();
  const [openMeeting, setOpenMeeting] = useState<MeetingWithOther | null>(null);
  const meetings = (data ?? []).filter((m) => m.status === "scheduled");
  const now = Date.now();
  // Still joinable until it ends.
  const upcomingAll = meetings.filter(
    (m) => new Date(m.scheduled_at).getTime() + m.duration_minutes * 60_000 >= now,
  );
  const next = upcomingAll[0];
  const upcoming = upcomingAll.slice(1, 7);
  const minutesUntil = next ? Math.round((new Date(next.scheduled_at).getTime() - now) / 60000) : 0;
  const nextLink = next && isHttpUrl(next.video_url) ? next.video_url : null;
  // Keep the open dialog in sync with refetched data (e.g. after editing its link).
  const liveOpenMeeting = openMeeting
    ? ((data ?? []).find((m) => m.id === openMeeting.id) ?? openMeeting)
    : null;

  return (
    <>
      <PageHead
        eyebrow={t("coach.meetings.eyebrow")}
        title={t("coach.meetings.title")}
        subtitle={t("coach.meetings.subtitle")}
        action={<ScheduleMeetingDialog />}
      />
      {next ? (
        <div className="meeting-feature">
          <div className="date-big">
            <b>{new Date(next.scheduled_at).getDate()}</b>
            <span>{fmt.month(next.scheduled_at)}</span>
          </div>
          <div>
            <span className="live-chip">
              <span />
              {isMeetingLive(next)
                ? t("meeting.live")
                : minutesUntil <= 0
                  ? t("meeting.inProgress")
                  : minutesUntil < 60
                    ? t("meeting.startsIn", { count: minutesUntil })
                    : t("meeting.onDate", {
                        date: fmt.date(next.scheduled_at, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        }),
                        time: fmt.clock(next.scheduled_at),
                      })}
            </span>
            <h2>
              {t("coach.meetings.withClient", {
                title: next.title,
                name: next.other?.full_name || t("coach.meetings.yourClient"),
              })}
            </h2>
            {next.notes && <p>{next.notes}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              {next.zoom_meeting_id ? (
                <StartMeetingButton meetingId={next.id} />
              ) : nextLink ? (
                <a href={nextLink} target="_blank" rel="noreferrer">
                  <Button>
                    <Video />
                    {t("coach.meetings.joinRoom")}
                  </Button>
                </a>
              ) : (
                <Button disabled title={t("meeting.noZoomLink")}>
                  <Video />
                  {t("coach.meetings.joinRoom")}
                </Button>
              )}
              <Button variant="outline" onClick={() => setOpenMeeting(next)}>
                {t("coach.meetings.viewNotes")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState>{t("coach.meetings.empty")}</EmptyState>
      )}
      <section className="mt-8">
        <SectionTitle
          overline={t("coach.meetings.upcoming")}
          title={t("coach.meetings.nextConversations")}
        />
        <div className="panel divide-y divide-border">
          {upcoming.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">{t("coach.meetings.nothingElse")}</p>
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
                <span className="avatar-md">{initialsFromName(m.other?.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <b>
                    {m.title} · {displayName(m.other?.full_name)}
                  </b>
                  <p>
                    {t("coach.meetings.videoCallLine", {
                      time: fmt.clock(m.scheduled_at),
                      minutes: m.duration_minutes,
                    })}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </section>
      <MeetingDetailsDialog
        meeting={liveOpenMeeting}
        otherName={displayName(liveOpenMeeting?.other?.full_name)}
        canEdit
        onClose={() => setOpenMeeting(null)}
      />
    </>
  );
}

// ============================================================
// Progress
// ============================================================

function Progress() {
  const { t, fmt } = useI18n();
  const displayName = useDisplayName();
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
  const trend = d.trend.map((p) => ({ ...p, day: fmt.weekday(parseIsoDate(p.date)) }));

  return (
    <>
      <PageHead
        eyebrow={t("coach.progress.eyebrow")}
        title={t("coach.progress.title")}
        subtitle={t("coach.progress.subtitle")}
      />
      <div className="metric-grid">
        <Metric label={t("metric.avgCompletion")} value={`${d.avgCompletion}%`} />
        <Metric label={t("metric.activeClients")} value={String(clients.length).padStart(2, "0")} />
        <Metric
          label={t("metric.avgStreak")}
          value={t("coach.progress.streakValue", { count: avgStreak })}
        />
        <Metric
          label={t("metric.atRisk")}
          value={String(atRisk).padStart(2, "0")}
          accent={atRisk > 0}
        />
      </div>
      <div className="content-grid mt-8">
        <div className="chart-panel">
          <SectionTitle
            overline={t("coach.progress.completion")}
            title={t("coach.progress.weeklyOutput")}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--accent)" }} />
                <Bar
                  dataKey="value"
                  name={t("metric.weeklyCompletion")}
                  fill="var(--primary)"
                  radius={[2, 2, 0, 0]}
                  animationDuration={900}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-6">
          <SectionTitle
            overline={t("coach.progress.leaderboard")}
            title={t("coach.progress.momentum")}
          />
          {leaderboard.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("coach.progress.noActivity")}</p>
          )}
          {leaderboard.map((c, i) => (
            <Link to="/coach/clients/$id" params={{ id: c.id }} className="rank-row" key={c.id}>
              <b className="rank">0{i + 1}</b>
              <span className="avatar-sm">{c.initials}</span>
              <div className="min-w-0 flex-1">
                <b>{displayName(c.name)}</b>
                <ProgressBar value={c.weeklyCompletion} thin />
              </div>
              <strong>{c.weeklyCompletion}%</strong>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Check-ins
// ============================================================

function CheckIns() {
  const { t } = useI18n();
  const displayName = useDisplayName();
  const { data, isLoading } = useCoachCheckIns();
  const checkIns = data ?? [];

  return (
    <>
      <PageHead
        eyebrow={t("coach.checkins.eyebrow")}
        title={t("coach.checkins.title")}
        subtitle={t("coach.checkins.subtitle")}
      />
      {isLoading && <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>}
      {!isLoading && checkIns.length === 0 && <EmptyState>{t("coach.checkins.empty")}</EmptyState>}
      <div className="checkin-grid">
        {checkIns.map((c) => {
          const person = c.profiles as unknown as { full_name: string; id: string } | null;
          return (
            <CheckInCard key={c.id} checkIn={c} athleteName={displayName(person?.full_name)} />
          );
        })}
      </div>
    </>
  );
}

// ============================================================
// Settings
// ============================================================

const coachSettingsTabs = [
  ["profile", "settings.tab.profile"],
  ["notifications", "settings.tab.notifications"],
  ["reports", "settings.tab.dailyReports"],
  ["integrations", "settings.tab.integrations"],
] as const;
type CoachSettingsTab = (typeof coachSettingsTabs)[number][0];

const ZOOM_RESULT_KEYS = {
  connected: "zoom.result.connected",
  denied: "zoom.result.denied",
  expired: "zoom.result.expired",
  error: "zoom.result.error",
  install: "zoom.result.install",
} as const;

function Settings() {
  const { t } = useI18n();
  const search = useSearch({ from: "/coach/settings" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<CoachSettingsTab>(search.tab ?? "profile");

  // Back from Zoom's consent screen (/api/zoom/callback redirects here with ?zoom=<result>).
  useEffect(() => {
    if (!search.zoom) return;
    const message = t(ZOOM_RESULT_KEYS[search.zoom]);
    if (search.zoom === "connected") toast.success(message);
    else if (search.zoom === "install") toast.info(message);
    else toast.error(message);
    void queryClient.invalidateQueries({ queryKey: ["zoom-status"] });
    setTab("integrations");
    void navigate({ to: "/coach/settings", search: { tab: "integrations" }, replace: true });
  }, [search.zoom, t, queryClient, navigate]);

  return (
    <>
      <PageHead
        eyebrow={t("settings.eyebrowCoach")}
        title={t("settings.title")}
        subtitle={t("settings.subtitleCoach")}
      />
      <div className="settings-layout">
        <nav>
          {coachSettingsTabs.map(([key, labelKey]) => (
            <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>
              {t(labelKey)}
              <ChevronRight />
            </button>
          ))}
        </nav>
        {tab === "profile" && <ProfileSettingsPanel />}
        {tab === "notifications" && <NotificationSettingsPanel />}
        {tab === "reports" && <DailyReportsPanel />}
        {tab === "integrations" && <ZoomSettingsPanel />}
      </div>
    </>
  );
}

function ZoomSettingsPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const { data: zoom, isLoading } = useZoomStatus();
  const connect = useConnectZoom();
  const disconnect = useDisconnectZoom();
  const [confirming, setConfirming] = useState(false);

  const onConnect = () =>
    connect.mutate(undefined, {
      onError: (err) => toast.error(errorText(err, i18n, "zoom.connectFailed")),
    });

  const onDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success(t("zoom.disconnected"));
      setConfirming(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "zoom.disconnectFailed"));
    }
  };

  const status = isLoading
    ? t("common.loading")
    : zoom?.connected
      ? zoom.email
        ? t("zoom.connectedAs", { email: zoom.email })
        : t("zoom.connected")
      : t("zoom.notConnected");

  return (
    <div className="space-y-6">
      <section className="settings-panel">
        <p className="eyebrow">{t("zoom.eyebrow")}</p>
        <h2>{t("zoom.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("zoom.body")}</p>
        <div className="setting-row">
          <div className="min-w-0">
            <b>{t("meeting.status")}</b>
            <p className="break-words" data-testid="zoom-status">
              {status}
            </p>
          </div>
          {zoom?.connected ? (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              {t("zoom.disconnect")}
            </Button>
          ) : (
            <Button
              onClick={onConnect}
              disabled={isLoading || connect.isPending || zoom?.configured === false}
            >
              <Video />
              {connect.isPending ? t("zoom.connecting") : t("zoom.connect")}
            </Button>
          )}
        </div>
        {zoom?.configured === false && (
          <p className="mt-3 text-sm text-destructive">{t("zoom.notConfigured")}</p>
        )}
      </section>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("zoom.disconnectConfirmTitle")}
        description={t("zoom.disconnectConfirmBody")}
        confirmLabel={t("zoom.disconnect")}
        pendingLabel={t("common.saving")}
        pending={disconnect.isPending}
        onConfirm={onDisconnect}
      />
    </div>
  );
}
function ProfileSettingsPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");

  const save = async () => {
    if (!fullName.trim()) {
      toast.error(t("validation.yourName"));
      return;
    }
    try {
      await updateProfile.mutateAsync({ full_name: fullName.trim(), phone, bio });
      toast.success(t("settings.profileUpdated"));
    } catch (err) {
      toast.error(errorText(err, i18n, "settings.profileFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <section className="settings-panel">
        <p className="eyebrow">{t("settings.yourDetails")}</p>
        <h2>{t("settings.coachProfile")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.coachProfileBody")}</p>
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
            <b>{t("settings.phone")}</b>
            <Input
              className="mt-2"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <div className="setting-row">
          <div className="w-full">
            <b>{t("settings.bio")}</b>
            <textarea
              className="mt-2 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
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
function NotificationSettingsPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const { profile } = useAuth();
  const updatePrefs = useUpdateNotificationPrefs();
  const prefs = profile?.notification_prefs ?? {};
  const rows = [
    ["newMessage", "notifPref.newMessage", "notifPref.newMessageDesc"],
    ["checkIn", "notifPref.checkIn", "notifPref.checkInDesc"],
    ["workoutCompleted", "notifPref.workoutCompleted", "notifPref.workoutCompletedDesc"],
    ["meetingReminder", "notifPref.meetingReminder", "notifPref.meetingReminderDesc"],
  ] as const;
  const toggle = (key: string, value: boolean) => {
    updatePrefs.mutate(
      { ...prefs, [key]: value },
      { onError: (err) => toast.error(errorText(err, i18n, "settings.prefsUpdateFailed")) },
    );
  };
  return (
    <section className="settings-panel">
      <p className="eyebrow">{t("settings.stayInformed")}</p>
      <h2>{t("settings.notificationsTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("settings.notificationsCoachBody")}</p>
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
function DailyReportsPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const { profile } = useAuth();
  const updateSettings = useUpdateDailyReportSettings();
  const settings = profile?.daily_report_settings ?? {};
  const [enabled, setEnabled] = useState(settings.enabled ?? false);
  const [time, setTime] = useState(settings.time ?? "20:00");
  const [push, setPush] = useState(settings.push ?? true);

  const save = async () => {
    try {
      await updateSettings.mutateAsync({ enabled, time, push });
      toast.success(t("settings.prefsSaved"));
    } catch (err) {
      toast.error(errorText(err, i18n, "settings.prefsFailed"));
    }
  };

  const includes = [
    "report.completedTasks",
    "report.missedTasks",
    "report.workoutCompletion",
    "report.nutritionCompletion",
    "report.completionPct",
    "report.checkInStatus",
  ] as const;

  return (
    <section className="settings-panel">
      <p className="eyebrow">{t("settings.automation")}</p>
      <h2>{t("settings.dailyReports")}</h2>
      <p className="text-sm text-muted-foreground">{t("settings.dailyReportsBody")}</p>
      <div className="setting-row">
        <div>
          <b>{t("settings.enableReports")}</b>
          <p>{t("settings.enableReportsDesc")}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div className="setting-row">
        <div>
          <b>{t("settings.reportTime")}</b>
          <p>{t("settings.reportTimeDesc")}</p>
        </div>
        <select value={time} onChange={(e) => setTime(e.target.value)} dir="ltr">
          <option>18:00</option>
          <option>20:00</option>
          <option>21:00</option>
        </select>
      </div>
      <div className="setting-row">
        <div>
          <b>{t("settings.push")}</b>
          <p>{t("settings.pushDesc")}</p>
        </div>
        <Switch checked={push} onCheckedChange={setPush} />
      </div>
      <div className="report-preview">
        <p className="eyebrow">{t("settings.reportIncludes")}</p>
        <div className="tag-cloud">
          {includes.map((key) => (
            <span key={key}>
              <Check /> {t(key)}
            </span>
          ))}
        </div>
      </div>
      <Button className="mt-6" onClick={save} disabled={updateSettings.isPending}>
        {updateSettings.isPending ? t("common.saving") : t("settings.savePrefs")}
      </Button>
    </section>
  );
}
