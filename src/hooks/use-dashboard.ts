import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { computeStreak, useCoachRoster } from "./use-clients";
import { useTodayAssignment } from "./use-workouts";
import { useMealLogs, useNutritionPlan } from "./use-nutrition";
import { formatDay, isoDate, startOfWeek } from "@/lib/format";

/** Coach dashboard: composes the roster (already fetched) with meetings + a 7-day team trend. */
export function useCoachDashboard() {
  const { user } = useAuth();
  const roster = useCoachRoster();

  const trend = useQuery({
    queryKey: ["team-trend", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
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
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        const entry = byDate.get(key);
        const value = entry && entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
        return { day: formatDay(d.toISOString()), value, target: 75 };
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
        .gte("scheduled_at", new Date().toISOString())
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
  const plan = useNutritionPlan();
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
        .eq("week_start_date", startOfWeek().toISOString().slice(0, 10))
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const isLoading =
    assignment.isLoading ||
    plan.isLoading ||
    mealLogs.isLoading ||
    habitTargets.isLoading ||
    habitLogs.isLoading;

  return {
    isLoading,
    assignment: assignment.data,
    plan: plan.data,
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
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("workout_assignments")
        .select("scheduled_date, status")
        .eq("client_id", user!.id)
        .gte("scheduled_date", since);
      if (error) throw error;
      const rows = data ?? [];
      const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
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
