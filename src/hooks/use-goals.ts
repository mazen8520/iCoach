import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { goalLabel } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import type { ClientGoalHistoryRow, ClientGoalsRow } from "@/lib/database.types";

// One client_goals row per athlete. RLS lets the coach read/write it and the athlete read it
// (and write it while client_can_edit is on). The history table is filled by a database trigger.

export type GoalsInput = Omit<
  ClientGoalsRow,
  "client_id" | "coach_id" | "updated_by" | "created_at" | "updated_at"
>;

export const EMPTY_GOALS: GoalsInput = {
  primary_goal: null,
  primary_goal_custom: null,
  secondary_goals: [],
  target_weight_kg: null,
  target_body_fat_pct: null,
  target_measurements: {},
  target_date: null,
  strength_targets: [],
  weekly_training_days: null,
  notes: null,
  experience_level: null,
  training_location: null,
  client_can_edit: false,
};

export function useClientGoals(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-goals", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_goals")
        .select("*")
        .eq("client_id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ClientGoalsRow | null) ?? null;
    },
  });
}

/** Athlete: their own goals. */
export function useMyGoals() {
  const { user } = useAuth();
  return useClientGoals(user?.id);
}

export type GoalHistoryEntry = ClientGoalHistoryRow & {
  changer: { id: string; full_name: string; role: "coach" | "client" } | null;
};

export function useGoalHistory(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-goal-history", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_goal_history")
        .select("*, changer:changed_by(id, full_name, role)")
        .eq("client_id", clientId!)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as GoalHistoryEntry[];
    },
  });
}

/** Coach: create or update an athlete's goals. */
export function useSaveClientGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      goals,
      exists,
    }: {
      clientId: string;
      goals: Partial<GoalsInput>;
      exists: boolean;
    }) => {
      const { error } = exists
        ? await supabase.from("client_goals").update(goals).eq("client_id", clientId)
        : await supabase
            .from("client_goals")
            .insert({ ...EMPTY_GOALS, ...goals, client_id: clientId, coach_id: user!.id });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["client-goals", vars.clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-goal-history", vars.clientId] });
    },
  });
}

/** Athlete: update their own goal details (only works while the coach allows it). */
export function useUpdateMyGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goals: Partial<Omit<GoalsInput, "client_can_edit">>) => {
      const { data, error } = await supabase
        .from("client_goals")
        .update(goals)
        .eq("client_id", user!.id)
        .select("client_id");
      if (error) throw error;
      // RLS silently matches zero rows when editing isn't allowed.
      if (!data || data.length === 0) throw new Error("goals_locked");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-goals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["client-goal-history", user?.id] });
    },
  });
}

/** Coach: one-line primary goal (structured goal first, then the athlete's free-text goal). */
export function usePrimaryGoalText(clientId: string, fallback: string | null | undefined) {
  const { t } = useI18n();
  const { data } = useClientGoals(clientId);
  return goalLabel(t, data ?? null) ?? (fallback?.trim() || null);
}
