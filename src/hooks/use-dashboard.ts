import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { computeStreak, useCoachRoster } from "./use-clients";
import { useTodayAssignment } from "./use-workouts";
import { planForDay, useMealLogs, useMyNutritionPlans } from "./use-nutrition";
import { addDays, isoDate, startOfWeek } from "@/lib/format";

/** Coach dashboard: composes the roster (already fetched) with meetings + a 7-day team trend. */
export function useCoachDashboard() {
  const { user } = useAuth();
  const roster = useCoachRoster();

  const trend = useQuery({
    queryKey: ["team-trend", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = isoDate(addDays(new Date(), -6));
      const { data, error } = await supabase
        .from("workout_assignments")
        .select("scheduled_date, status")
        .eq("coach_id", user!.id)
        .gte("scheduled_date", since);
      if (error) throw error;
      const byDate = new Map<string, { total: number; done: number }>();
      for (const row of data ?? []) {
        const entry = byDate.get(row.scheduled_date) ?? { total: 0, done: 0 };
        entry.total += 1;
        if (row.status === "completed") entry.done += 1;
        byDate.set(row.scheduled_date, entry);
      }
      // Raw local dates; the chart formats the weekday label in the viewer's language.
      return Array.from({ length: 7 }, (_, i) => {
        const date = isoDate(addDays(new Date(), i - 6));
        const entry = byDate.get(date);
        const value = entry && entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
        return { date, value, target: 75 };
      });
    },
  });

  const upcomingMeetings = useQuery({
    queryKey: ["upcoming-meetings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, profiles:client_id(id, full_name, avatar_url)")
        .eq("coach_id", user!.id)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(Date.now() - 60 * 60_000).toISOString())
        .order("scheduled_at")
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingCheckIns = useQuery({
    queryKey: ["pending-check-ins-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("check_ins")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const clients = roster.data ?? [];
  const activeClients = clients.length;
  const avgCompletion = activeClients
    ? Math.round(clients.reduce((sum, c) => sum + c.weeklyCompletion, 0) / activeClients)
    : 0;
  const attentionQueue = clients.filter((c) => c.status === "attention");

  return {
    isLoading: roster.isLoading || trend.isLoading,
    activeClients,
    avgCompletion,
    checkInsDue: pendingCheckIns.data ?? 0,
    attentionQueue,
    upcomingMeetings: upcomingMeetings.data ?? [],
    trend: trend.data ?? [],
  };
}

/** Client "Today" — a unified task list built from real assignments, meals and habits. */
export function useClientToday() {
  const { user } = useAuth();
  const today = isoDate();
  const assignment = useTodayAssignment();
  const plans = useMyNutritionPlans();
  const mealLogs = useMealLogs(user?.id, today);
  const habitTargets = useQuery({
    queryKey: ["habit-targets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_targets")
        .select("*")
        .eq("client_id", user!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
  const habitLogs = useQuery({
    queryKey: ["habit-logs", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("*").eq("log_date", today);
      if (error) throw error;
      return data ?? [];
    },
  });
  const checkInThisWeek = useQuery({
    queryKey: ["check-in-this-week", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("id")
        .eq("client_id", user!.id)
        .eq("week_start_date", isoDate(startOfWeek()))
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const isLoading =
    assignment.isLoading ||
    plans.isLoading ||
    mealLogs.isLoading ||
    habitTargets.isLoading ||
    habitLogs.isLoading;

  return {
    isLoading,
    assignment: assignment.data,
    plan: planForDay(plans.data ?? [], !!assignment.data),
    mealLogs: mealLogs.data ?? [],
    habitTargets: habitTargets.data ?? [],
    habitLogs: habitLogs.data ?? [],
    checkInDone: checkInThisWeek.data ?? false,
  };
}

/** Self-facing streak + weekly completion, computed the same way as the coach roster. */
export function useClientStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = isoDate(addDays(new Date(), -60));
      const { data, error } = await supabase
        .from("workout_assignments")
        .select("scheduled_date, status")
        .eq("client_id", user!.id)
        .gte("scheduled_date", since);
      if (error) throw error;
      const rows = data ?? [];
      const weekAgo = isoDate(addDays(new Date(), -6));
      const thisWeek = rows.filter((r) => r.scheduled_date >= weekAgo);
      const weeklyCompletion = thisWeek.length
        ? Math.round(
            (thisWeek.filter((r) => r.status === "completed").length / thisWeek.length) * 100,
          )
        : 0;
      return { streakDays: computeStreak(rows), weeklyCompletion };
    },
  });
}

export function useToggleHabitLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = isoDate();
  return useMutation({
    mutationFn: async ({
      habitTargetId,
      completed,
      targetValue,
    }: {
      habitTargetId: string;
      completed: boolean;
      targetValue: number;
    }) => {
      const { error } = await supabase.from("habit_logs").upsert(
        {
          habit_target_id: habitTargetId,
          log_date: today,
          completed,
          value_logged: completed ? targetValue : 0,
        },
        { onConflict: "habit_target_id,log_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habit-logs", user?.id, today] }),
  });
}
