import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  MessageSquare,
  Plus,
  Salad,
  SlidersHorizontal,
  Trophy,
  Video,
  Weight,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ProgressBar, SectionTitle } from "./primitives";
import { MeetingDetailsDialog } from "./shared";
import {
  AssignWorkoutDialog,
  CheckInCard,
  ScheduleMeetingDialog,
  assignmentState,
  useDisplayName,
} from "./coach-shared";
import { EventDialog } from "./coach-schedule";
import { PlanDialog } from "./coach-nutrition";
import { useClientProfile, useCoachRoster } from "@/hooks/use-clients";
import {
  useClientAssignmentsForCoach,
  useClientMealLogs,
  useClientMeetings,
  type ClientAssignment,
} from "@/hooks/use-client-detail";
import { useClientCheckIns } from "@/hooks/use-check-ins";
import { usePersonalRecords, useProgressEntries } from "@/hooks/use-progress";
import { useCoachNutritionPlans } from "@/hooks/use-nutrition";
import { useClientEvents } from "@/hooks/use-schedule";
import { useEnsureConversation } from "@/hooks/use-messages";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import {
  addDays,
  daysSince,
  initialsFromName,
  isoDate,
  parseIsoDate,
  weekDates,
} from "@/lib/format";
import type { MeetingRow, SleepQuality } from "@/lib/database.types";

export const PROFILE_TABS = [
  "overview",
  "progress",
  "analysis",
  "workouts",
  "nutrition",
  "schedule",
  "check-ins",
  "activity",
] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

const TAB_LABELS: Record<ProfileTab, TranslationKey> = {
  overview: "coach.profile.tab.overview",
  progress: "coach.profile.tab.progress",
  analysis: "coach.profile.tab.analysis",
  workouts: "coach.profile.tab.workouts",
  nutrition: "coach.profile.tab.nutrition",
  schedule: "coach.profile.tab.schedule",
  "check-ins": "coach.profile.tab.checkIns",
  activity: "coach.profile.tab.activity",
};

export function ClientProfile({ id }: { id: string }) {
  const i18n = useI18n();
  const { t, tp, fmt } = i18n;
  const displayName = useDisplayName();
  const search = useSearch({ strict: false }) as { tab?: ProfileTab };
  const tab: ProfileTab = PROFILE_TABS.includes(search.tab as ProfileTab)
    ? (search.tab as ProfileTab)
    : "overview";
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading, isError } = useClientProfile(id);
  const { data: roster } = useCoachRoster();
  const ensureConversation = useEnsureConversation();
  const stats = roster?.find((x) => x.id === id);

  if (profileLoading) {
    return <p className="p-6 text-sm text-muted-foreground">{t("coach.profile.loading")}</p>;
  }
  if (isError || !profile) {
    return (
      <EmptyState
        action={
          <Link to="/coach/clients">
            <Button variant="outline">{t("coach.profile.backToRoster")}</Button>
          </Link>
        }
      >
        {isError ? t("errors.generic") : t("coach.profile.notFound")}
      </EmptyState>
    );
  }

  const name = displayName(profile.full_name);
  const initials = initialsFromName(profile.full_name);

  const openMessages = async () => {
    try {
      const conversationId = await ensureConversation.mutateAsync(id);
      navigate({ to: "/coach/messages", search: { c: conversationId } });
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.profile.openChatFailed"));
    }
  };

  return (
    <>
      <div className="profile-head">
        <div className="flex min-w-0 items-center gap-5">
          <span className="avatar-xl">{initials}</span>
          <div className="min-w-0">
            <p className="eyebrow">{t("coach.profile.eyebrow")}</p>
            <h1 className="page-title">{name}</h1>
            <p className="text-sm text-muted-foreground">
              {profile.goal || t("common.noGoalSet")} ·{" "}
              {t("coach.profile.activeSince", {
                date: profile.joined_at
                  ? fmt.date(profile.joined_at, { month: "short", year: "numeric" })
                  : t("coach.profile.recently"),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openMessages} disabled={ensureConversation.isPending}>
            <MessageSquare />
            {t("common.message")}
          </Button>
          <Link to="/coach/workouts">
            <Button>
              <SlidersHorizontal />
              {t("coach.profile.adjustPlan")}
            </Button>
          </Link>
        </div>
      </div>
      <div className="profile-kpis">
        <div>
          <p className="eyebrow">{t("coach.profile.currentProgram")}</p>
          <b>{stats?.programName || t("common.noActiveProgram")}</b>
        </div>
        <div>
          <p className="eyebrow">{t("coach.profile.consistency")}</p>
          <b className="text-primary">{stats?.weeklyCompletion ?? 0}%</b>
        </div>
        <div>
          <p className="eyebrow">{t("coach.profile.currentWeight")}</p>
          <b>
            {stats?.currentWeightKg != null
              ? t("common.kgValue", { value: stats.currentWeightKg })
              : t("common.notLogged")}
          </b>
        </div>
        <div>
          <p className="eyebrow">{t("coach.profile.streak")}</p>
          <b>{tp("common.days", stats?.streakDays ?? 0)}</b>
        </div>
      </div>
      <div className="toolbar mt-6">
        <div className="segmented scroll" role="tablist">
          {PROFILE_TABS.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "selected" : ""}
              onClick={() =>
                navigate({
                  to: "/coach/clients/$id",
                  params: { id },
                  search: key === "overview" ? {} : { tab: key },
                  replace: true,
                })
              }
            >
              {t(TAB_LABELS[key])}
            </button>
          ))}
        </div>
      </div>
      <div key={tab} className="animate-enter">
        {tab === "overview" && <OverviewTab id={id} profile={profile} />}
        {tab === "progress" && <ProgressTab id={id} />}
        {tab === "analysis" && <AnalysisTab id={id} />}
        {tab === "workouts" && <WorkoutsTab id={id} />}
        {tab === "nutrition" && <NutritionTab id={id} />}
        {tab === "schedule" && <ScheduleTab id={id} name={name} />}
        {tab === "check-ins" && <CheckInsTab id={id} name={name} />}
        {tab === "activity" && <ActivityTab id={id} />}
      </div>
    </>
  );
}

function WeightChart({ data }: { data: { label: string; value: number }[] }) {
  const { t } = useI18n();
  return (
    <div className="h-64">
      {data.length < 2 ? (
        <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
          {t("coach.profile.notEnoughWeighIns")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
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
              name={t("coach.profile.bodyWeight")}
              stroke="var(--primary)"
              fill="var(--primary-fade)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ============================================================
// Overview
// ============================================================

function OverviewTab({
  id,
  profile,
}: {
  id: string;
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
}) {
  const { t, fmt } = useI18n();
  const { data: entries } = useProgressEntries(id, 30);
  const { data: checkIns } = useClientCheckIns(id);
  const { data: assignments, isLoading } = useClientAssignmentsForCoach(id);
  const latest = checkIns?.[0];
  const trend = (entries ?? [])
    .filter((e) => e.weight_kg != null)
    .slice(-7)
    .map((e) => ({ label: fmt.weekday(parseIsoDate(e.entry_date)), value: Number(e.weight_kg) }));

  const week = weekDates().map((date) => {
    const key = isoDate(date);
    const rows = (assignments ?? []).filter((a) => a.scheduled_date === key);
    const done = rows.filter((r) => r.status === "completed").length;
    return {
      key,
      day: fmt.weekday(date),
      date: date.getDate(),
      score: rows.length > 0 ? Math.round((done / rows.length) * 100) : 0,
      label: rows[0]?.workouts?.title ?? t("common.rest"),
    };
  });

  const details: [string, string][] = [
    [t("coach.profile.email"), profile.email],
    [
      t("coach.profile.age"),
      profile.age != null
        ? t("coach.profile.years", { value: profile.age })
        : t("common.notProvided"),
    ],
    [t("coach.profile.sex"), profile.sex ? t(`sex.${profile.sex}`) : t("common.notProvided")],
    [
      t("coach.profile.height"),
      profile.height_cm != null
        ? t("common.cmValue", { value: profile.height_cm })
        : t("common.notProvided"),
    ],
    [t("coach.profile.phone"), profile.phone || t("common.notProvided")],
    [t("coach.profile.goal"), profile.goal || t("common.noGoalSet")],
    [
      t("coach.profile.memberSince"),
      fmt.date(profile.joined_at ?? profile.created_at, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    ],
  ];

  return (
    <>
      <div className="content-grid mt-2">
        <section>
          <SectionTitle
            overline={t("coach.profile.performance")}
            title={t("coach.profile.momentum")}
          />
          <div className="chart-panel">
            <WeightChart data={trend} />
          </div>
        </section>
        <section>
          <SectionTitle
            overline={t("coach.profile.latest")}
            title={t("coach.profile.checkInSignal")}
          />
          <div className="panel p-6">
            {!latest ? (
              <p className="text-sm text-muted-foreground">{t("coach.profile.noCheckIns")}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {(
                    [
                      ["signal.energy", latest.energy != null ? String(latest.energy) : "—"],
                      [
                        "signal.sleep",
                        latest.sleep_hours != null
                          ? t("signal.sleepHours", { value: latest.sleep_hours })
                          : latest.sleep_quality
                            ? t(`sleep.${latest.sleep_quality as SleepQuality}`)
                            : "—",
                      ],
                      [
                        latest.weight_kg != null ? "signal.weight" : "signal.mood",
                        latest.weight_kg != null
                          ? t("common.kgValue", { value: latest.weight_kg })
                          : (latest.mood ?? "—"),
                      ],
                    ] as const
                  ).map(([labelKey, value]) => (
                    <div key={labelKey}>
                      <p className="eyebrow">{t(labelKey)}</p>
                      <b className="mt-2 block text-xl">{value}</b>
                    </div>
                  ))}
                </div>
                {latest.training_feedback && (
                  <blockquote>&ldquo;{latest.training_feedback}&rdquo;</blockquote>
                )}
                <Link to="/coach/clients/$id" params={{ id }} search={{ tab: "check-ins" }}>
                  <Button variant="outline" className="mt-4 w-full">
                    {t("coach.profile.reviewCheckIn")}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
      <section className="mt-8">
        <SectionTitle
          overline={t("coach.profile.thisWeek")}
          title={t("coach.profile.scheduledWork")}
        />
        <div className="week-strip">
          {isLoading && (
            <p className="p-4 text-sm text-muted-foreground">
              {t("coach.profile.loadingSchedule")}
            </p>
          )}
          {!isLoading &&
            week.map((d) => (
              <div className={`week-day ${d.score === 100 ? "complete" : ""}`} key={d.key}>
                <small>{d.day}</small>
                <b>{d.date}</b>
                <span>{d.label}</span>
                <ProgressBar value={d.score} thin />
              </div>
            ))}
        </div>
      </section>
      <section className="mt-8">
        <SectionTitle title={t("coach.profile.athleteDetails")} />
        <dl className="detail-list panel p-5">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd dir="auto">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

// ============================================================
// Progress
// ============================================================

function ProgressTab({ id }: { id: string }) {
  const { t, fmt } = useI18n();
  const { data: entries } = useProgressEntries(id, 120);
  const { data: records } = usePersonalRecords(id);
  const weighIns = (entries ?? []).filter((e) => e.weight_kg != null || e.body_fat_pct != null);
  const trend = weighIns
    .filter((e) => e.weight_kg != null)
    .map((e) => ({
      label: fmt.date(parseIsoDate(e.entry_date), { month: "short", day: "numeric" }),
      value: Number(e.weight_kg),
    }));

  return (
    <div className="content-grid mt-2">
      <section>
        <SectionTitle
          overline={t("coach.profile.bodyWeight")}
          title={t("coach.profile.weightTrend")}
        />
        <div className="chart-panel">
          <WeightChart data={trend} />
        </div>
        <SectionTitle title={t("coach.profile.weighIns")} />
        <div className="panel divide-y divide-border">
          {weighIns.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">{t("coach.profile.noWeighIns")}</p>
          )}
          {[...weighIns].reverse().map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="text-muted-foreground">
                {fmt.date(parseIsoDate(e.entry_date), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-4">
                {e.body_fat_pct != null && (
                  <span className="text-muted-foreground">
                    {t("coach.profile.bodyFat")} {e.body_fat_pct}%
                  </span>
                )}
                {e.weight_kg != null && <b>{t("common.kgValue", { value: e.weight_kg })}</b>}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel p-6">
        <SectionTitle
          overline={t("coach.profile.personalRecords")}
          title={t("coach.profile.strengthGains")}
        />
        {(records ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">{t("coach.profile.noRecords")}</p>
        )}
        {(records ?? []).map((r) => (
          <div className="pr-row" key={r.id}>
            <div>
              <b>{r.exercise_name}</b>
              <small>{t("coach.profile.personalBest")}</small>
            </div>
            <strong>{r.value}</strong>
            {r.previous_value && <span>{t("coach.profile.was", { value: r.previous_value })}</span>}
          </div>
        ))}
      </section>
    </div>
  );
}

// ============================================================
// Analysis (last 30 days)
// ============================================================

function AnalysisTab({ id }: { id: string }) {
  const { t, tp } = useI18n();
  const { data: assignments } = useClientAssignmentsForCoach(id);
  const { data: checkIns } = useClientCheckIns(id);
  const { data: entries } = useProgressEntries(id, 120);
  const { data: mealLogs } = useClientMealLogs(id, 30);
  const { data: plans } = useCoachNutritionPlans(id);

  const today = isoDate();
  const since = isoDate(addDays(new Date(), -30));
  const recent = (assignments ?? []).filter(
    (a) => a.scheduled_date >= since && a.scheduled_date <= today,
  );
  const due = recent.filter((a) => a.scheduled_date < today || a.status !== "scheduled");
  const completed = due.filter((a) => a.status === "completed").length;
  const missed = due.filter(
    (a) => assignmentState(a.status, a.scheduled_date) !== "completed",
  ).length;
  const completionPct = due.length ? Math.round((completed / due.length) * 100) : null;

  // Planned meals: the richest active plan's meals per day, since that plan (or 30 days) began.
  const activePlans = (plans ?? []).filter((p) => p.is_active);
  const mealsPerDay = Math.max(0, ...activePlans.map((p) => p.meals.length));
  const planStart = activePlans.length
    ? Math.min(...activePlans.map((p) => new Date(p.created_at).getTime()))
    : null;
  const planDays = planStart ? Math.min(30, daysSince(new Date(planStart).toISOString()) + 1) : 0;
  const plannedMeals = mealsPerDay * planDays;
  const loggedMeals = (mealLogs ?? []).filter((l) => l.completed).length;
  const mealPct =
    plannedMeals > 0 ? Math.min(100, Math.round((loggedMeals / plannedMeals) * 100)) : null;

  const recentCheckIns = (checkIns ?? []).filter((c) => c.submitted_at.slice(0, 10) >= since);
  const energies = recentCheckIns.map((c) => c.energy).filter((e): e is number => e != null);
  const avgEnergy = energies.length
    ? Math.round((energies.reduce((s, e) => s + e, 0) / energies.length) * 10) / 10
    : null;
  const sleeps = recentCheckIns.map((c) => c.sleep_quality).filter(Boolean) as string[];
  const topSleep = sleeps.length
    ? Object.entries(
        sleeps.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {}),
      ).sort((a, b) => b[1] - a[1])[0]![0]
    : null;

  const weights = (entries ?? []).filter((e) => e.entry_date >= since && e.weight_kg != null);
  const first = weights[0]?.weight_kg;
  const last = weights.at(-1)?.weight_kg;
  const weightDelta =
    first != null && last != null && weights.length > 1
      ? Math.round((Number(last) - Number(first)) * 10) / 10
      : null;

  const insights: string[] = [];
  if (completionPct != null && completionPct < 60)
    insights.push(t("coach.profile.insight.lowCompletion"));
  if (completionPct != null && completionPct >= 90 && due.length >= 3) {
    insights.push(t("coach.profile.insight.highCompletion"));
  }
  if (missed > 0) insights.push(tp("coach.profile.insight.missed", missed));
  if (avgEnergy != null && avgEnergy < 5) insights.push(t("coach.profile.insight.lowEnergy"));
  if (daysSince(checkIns?.[0]?.submitted_at) > 10)
    insights.push(t("coach.profile.insight.noCheckIn"));
  if (mealPct != null && mealPct < 50) insights.push(t("coach.profile.insight.lowMeals"));
  if (insights.length === 0) insights.push(t("coach.profile.insight.allGood"));

  const cards: { label: string; value: string; sub: string; pct?: number | null }[] = [
    {
      label: t("coach.profile.workoutCompletion"),
      value: completionPct != null ? `${completionPct}%` : "—",
      sub: due.length
        ? t("coach.profile.completedOf", { done: completed, total: due.length })
        : t("coach.profile.noData"),
      pct: completionPct,
    },
    {
      label: t("coach.profile.missedWorkouts"),
      value: String(missed),
      sub: t("coach.profile.last30"),
    },
    {
      label: t("coach.profile.mealAdherence"),
      value: mealPct != null ? `${mealPct}%` : "—",
      sub: plannedMeals
        ? t("coach.profile.mealsLogged", { done: loggedMeals, total: plannedMeals })
        : t("coach.profile.noData"),
      pct: mealPct,
    },
    {
      label: t("coach.profile.avgEnergy"),
      value: avgEnergy != null ? `${avgEnergy}/10` : "—",
      sub: energies.length
        ? tp("coach.profile.fromCheckIns", energies.length)
        : t("coach.profile.noData"),
    },
    {
      label: t("coach.profile.avgSleep"),
      value: topSleep ? t(`sleep.${topSleep}` as TranslationKey) : "—",
      sub: sleeps.length
        ? tp("coach.profile.fromCheckIns", sleeps.length)
        : t("coach.profile.noData"),
    },
    {
      label: t("coach.profile.weightChange"),
      value: weightDelta != null ? `${weightDelta > 0 ? "+" : ""}${weightDelta} kg` : "—",
      sub:
        weightDelta != null
          ? t("coach.profile.weightRange", { from: first!, to: last! })
          : t("coach.profile.noData"),
    },
  ];

  return (
    <>
      <SectionTitle overline={t("coach.profile.last30")} title={t("coach.profile.analysisTitle")} />
      <div className="analysis-grid">
        {cards.map((card) => (
          <div className="metric" key={card.label}>
            <p className="eyebrow">{card.label}</p>
            <strong className="mt-3 block font-display text-3xl">{card.value}</strong>
            <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
            {card.pct != null && (
              <div className="mt-3">
                <ProgressBar value={card.pct} thin />
              </div>
            )}
          </div>
        ))}
      </div>
      <section className="mt-8">
        <SectionTitle title={t("coach.profile.insights")} />
        <ul className="panel divide-y divide-border">
          {insights.map((insight) => (
            <li key={insight} className="p-4 text-sm">
              {insight}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// ============================================================
// Workouts
// ============================================================

function AssignmentRow({ a }: { a: ClientAssignment }) {
  const { t, tp, fmt } = useI18n();
  const state = assignmentState(a.status, a.scheduled_date);
  const tone = state === "completed" ? "on-track" : state === "scheduled" ? "new" : "attention";
  const date = parseIsoDate(a.scheduled_date);
  return (
    <div className="appointment">
      <time>
        <b>{date.getDate()}</b>
        <span>{fmt.month(date)}</span>
      </time>
      <span className="activity-icon">
        <Dumbbell size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <b className="block truncate">{a.workouts?.title ?? t("common.workout")}</b>
        <p>
          {fmt.weekday(date)}
          {a.scheduled_time ? ` · ${a.scheduled_time.slice(0, 5)}` : ""}
          {a.workouts?.duration_minutes
            ? ` · ${tp("common.minutes", a.workouts.duration_minutes)}`
            : ""}
        </p>
      </div>
      <span className={`status ${tone}`}>{t(`assignment.${state}`)}</span>
    </div>
  );
}

function WorkoutsTab({ id }: { id: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useClientAssignmentsForCoach(id);
  const today = isoDate();
  const all = data ?? [];
  const upcoming = all
    .filter((a) => a.scheduled_date >= today && a.status === "scheduled")
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const history = all.filter((a) => !upcoming.includes(a));

  return (
    <>
      <div className="mb-5 flex justify-end">
        <AssignWorkoutDialog
          clientId={id}
          trigger={
            <Button>
              <Plus />
              {t("coach.profile.assignWorkout")}
            </Button>
          }
        />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      <div className="content-grid">
        <section>
          <SectionTitle title={t("coach.profile.upcoming")} />
          <div className="panel divide-y divide-border">
            {!isLoading && upcoming.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">{t("coach.profile.noUpcoming")}</p>
            )}
            {upcoming.map((a) => (
              <AssignmentRow a={a} key={a.id} />
            ))}
          </div>
        </section>
        <section>
          <SectionTitle title={t("coach.profile.history")} />
          <div className="panel divide-y divide-border">
            {!isLoading && history.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">{t("coach.profile.noHistory")}</p>
            )}
            {history.map((a) => (
              <AssignmentRow a={a} key={a.id} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

// ============================================================
// Nutrition
// ============================================================

function NutritionTab({ id }: { id: string }) {
  const { t, tp } = useI18n();
  const { data: plans, isLoading } = useCoachNutritionPlans(id);
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{t("coach.profile.nutritionPlans")}</h2>
        <PlanDialog clientId={id} />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {!isLoading && (plans ?? []).length === 0 && (
        <EmptyState>{t("coach.profile.noPlans")}</EmptyState>
      )}
      <div className="plan-grid">
        {(plans ?? []).map((p) => (
          <div key={p.id} className="plan-card static">
            <span className="activity-icon">
              <Salad size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate">{p.name}</b>
              <small className="block">
                {t("coach.nutrition.dayLine", {
                  dayType: ["training", "rest", "any"].includes(p.day_type)
                    ? t(`dayType.${p.day_type as "training" | "rest" | "any"}`)
                    : p.day_type,
                  kcal: p.target_calories,
                })}
              </small>
              <small className="block">
                P {p.target_protein_g}g · C {p.target_carbs_g}g · F {p.target_fat_g}g ·{" "}
                {tp("coach.profile.meals", p.meals.length)}
              </small>
            </span>
            <span className="flex flex-col items-end gap-2">
              <span className={`status ${p.is_active ? "on-track" : "new"}`}>
                {p.is_active ? t("coach.nutrition.active") : t("coach.nutrition.inactive")}
              </span>
              <Link to="/coach/nutrition" search={{ client: id, plan: p.id }}>
                <Button variant="ghost" size="sm">
                  {t("coach.profile.openPlan")}
                </Button>
              </Link>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
// Schedule (next 30 days)
// ============================================================

type UpcomingItem = {
  key: string;
  at: number;
  icon: ReactNode;
  title: string;
  meta: string;
  meeting?: MeetingRow;
};

function ScheduleTab({ id, name }: { id: string; name: string }) {
  const { t, tp, fmt } = useI18n();
  const { data: assignments } = useClientAssignmentsForCoach(id);
  const { data: meetings } = useClientMeetings(id);
  const { data: events } = useClientEvents(id);
  const [openMeeting, setOpenMeeting] = useState<MeetingRow | null>(null);
  const now = Date.now();
  const horizon = addDays(new Date(), 30).getTime();

  const items: UpcomingItem[] = [];
  for (const a of assignments ?? []) {
    const date = parseIsoDate(a.scheduled_date);
    const [h, m] = (a.scheduled_time ?? "00:00").split(":").map(Number);
    date.setHours(h ?? 0, m ?? 0);
    const endOfDay = addDays(parseIsoDate(a.scheduled_date), 1).getTime();
    if (a.status !== "scheduled" || endOfDay < now || date.getTime() > horizon) continue;
    items.push({
      key: `a-${a.id}`,
      at: date.getTime(),
      icon: <Dumbbell size={15} />,
      title: a.workouts?.title ?? t("common.workout"),
      meta: `${t("scheduleKind.training")} · ${fmt.date(date, { weekday: "short", day: "numeric", month: "short" })}${a.scheduled_time ? ` · ${a.scheduled_time.slice(0, 5)}` : ""}`,
    });
  }
  for (const m of meetings ?? []) {
    const at = new Date(m.scheduled_at).getTime();
    if (m.status !== "scheduled" || at + m.duration_minutes * 60_000 < now || at > horizon)
      continue;
    items.push({
      key: `m-${m.id}`,
      at,
      icon: <Video size={15} />,
      title: m.title,
      meta: `${t("scheduleKind.meeting")} · ${fmt.date(m.scheduled_at, { weekday: "short", day: "numeric", month: "short" })} · ${fmt.clock(m.scheduled_at)} · ${tp("common.minutes", m.duration_minutes)}`,
      meeting: m,
    });
  }
  for (const e of events ?? []) {
    const at = new Date(e.starts_at).getTime();
    if (new Date(e.ends_at).getTime() < now || at > horizon) continue;
    items.push({
      key: `e-${e.id}`,
      at,
      icon: <CalendarDays size={15} />,
      title: e.title,
      meta: `${t(`eventType.${e.event_type}`)} · ${fmt.date(e.starts_at, { weekday: "short", day: "numeric", month: "short" })} · ${t("common.timeRange", { start: fmt.clock(e.starts_at), end: fmt.clock(e.ends_at) })}`,
    });
  }
  items.sort((a, b) => a.at - b.at);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{t("coach.profile.next30")}</p>
          <h2 className="font-display text-xl font-bold">{t("coach.profile.comingUp")}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScheduleMeetingDialog
            clientId={id}
            trigger={
              <Button variant="outline">
                <Video />
                {t("coach.meetings.schedule")}
              </Button>
            }
          />
          <EventDialog clientId={id} />
        </div>
      </div>
      <div className="panel divide-y divide-border">
        {items.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("coach.profile.nothingScheduled")}</p>
        )}
        {items.map((item) => (
          <button
            key={item.key}
            className="appointment w-full text-start"
            onClick={() => item.meeting && setOpenMeeting(item.meeting)}
            disabled={!item.meeting}
          >
            <span className="activity-icon">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <b className="block truncate">{item.title}</b>
              <p>{item.meta}</p>
            </div>
          </button>
        ))}
      </div>
      <MeetingDetailsDialog
        meeting={openMeeting}
        otherName={name}
        canEdit
        onClose={() => setOpenMeeting(null)}
      />
    </>
  );
}

// ============================================================
// Check-ins
// ============================================================

function CheckInsTab({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useClientCheckIns(id);
  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if ((data ?? []).length === 0) return <EmptyState>{t("coach.profile.noCheckIns")}</EmptyState>;
  return (
    <div className="checkin-grid">
      {(data ?? []).map((c) => (
        <CheckInCard key={c.id} checkIn={c} athleteName={name} showAthlete={false} />
      ))}
    </div>
  );
}

// ============================================================
// Activity timeline
// ============================================================

function ActivityTab({ id }: { id: string }) {
  const { t, tp, fmt } = useI18n();
  const { data: assignments } = useClientAssignmentsForCoach(id);
  const { data: checkIns } = useClientCheckIns(id);
  const { data: entries } = useProgressEntries(id, 120);
  const { data: records } = usePersonalRecords(id);
  const { data: meetings } = useClientMeetings(id);
  const { data: mealLogs } = useClientMealLogs(id, 30);
  const now = Date.now();

  const feed: { key: string; at: string; icon: ReactNode; text: string }[] = [];
  for (const a of assignments ?? []) {
    const workout = a.workouts?.title ?? t("common.workout");
    if (a.status === "completed" && a.completed_at) {
      feed.push({
        key: `done-${a.id}`,
        at: a.completed_at,
        icon: <Dumbbell size={15} />,
        text: t("coach.profile.activity.workoutCompleted", { workout }),
      });
    } else if (a.status === "skipped") {
      feed.push({
        key: `skip-${a.id}`,
        at: `${a.scheduled_date}T12:00:00`,
        icon: <Dumbbell size={15} />,
        text: t("coach.profile.activity.workoutSkipped", { workout }),
      });
    }
  }
  for (const c of checkIns ?? []) {
    feed.push({
      key: `ci-${c.id}`,
      at: c.submitted_at,
      icon: <ClipboardCheck size={15} />,
      text: t("coach.profile.activity.checkInSubmitted"),
    });
    if (c.reviewed_at) {
      feed.push({
        key: `cr-${c.id}`,
        at: c.reviewed_at,
        icon: <ClipboardCheck size={15} />,
        text: t("coach.profile.activity.checkInReviewed"),
      });
    }
  }
  for (const e of entries ?? []) {
    if (e.weight_kg == null) continue;
    feed.push({
      key: `w-${e.id}`,
      at: e.created_at,
      icon: <Weight size={15} />,
      text: t("coach.profile.activity.weightLogged", { value: e.weight_kg }),
    });
  }
  for (const r of records ?? []) {
    feed.push({
      key: `pr-${r.id}`,
      at: r.created_at,
      icon: <Trophy size={15} />,
      text: t("coach.profile.activity.prSet", { exercise: r.exercise_name, value: r.value }),
    });
  }
  for (const m of meetings ?? []) {
    if (m.status === "cancelled" || new Date(m.scheduled_at).getTime() > now) continue;
    feed.push({
      key: `m-${m.id}`,
      at: m.scheduled_at,
      icon: <Video size={15} />,
      text: t("coach.profile.activity.meeting", { title: m.title }),
    });
  }
  const mealsByDay = new Map<string, number>();
  for (const log of mealLogs ?? []) {
    if (log.completed) mealsByDay.set(log.log_date, (mealsByDay.get(log.log_date) ?? 0) + 1);
  }
  for (const [day, count] of mealsByDay) {
    feed.push({
      key: `meals-${day}`,
      at: `${day}T20:00:00`,
      icon: <Salad size={15} />,
      text: tp("coach.profile.activity.mealsLogged", count),
    });
  }
  feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <>
      <SectionTitle title={t("coach.profile.recentActivity")} />
      <div className="panel divide-y divide-border">
        {feed.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("coach.profile.noActivity")}</p>
        )}
        {feed.slice(0, 50).map((item) => (
          <div key={item.key} className="flex items-center gap-3 p-4">
            <span className="activity-icon">{item.icon}</span>
            <p className="min-w-0 flex-1 text-sm">{item.text}</p>
            <time className="text-xs text-muted-foreground">{fmt.timeAgo(item.at)}</time>
          </div>
        ))}
      </div>
    </>
  );
}
