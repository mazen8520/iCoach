import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isoDate } from "@/lib/format";
import type { MealRow, NutritionPlanRow } from "@/lib/database.types";

// A coach can run several nutrition plans per athlete (e.g. a training-day and a rest-day plan)
// and different plans for different athletes. Every plan is tied to exactly one athlete
// (nutrition_plans.client_id) from the moment it's created.

export type DayType = "training" | "rest" | "any";
export const DAY_TYPES: DayType[] = ["training", "rest", "any"];

export type PlanWithMeals = NutritionPlanRow & { meals: MealRow[] };
export type CoachPlan = PlanWithMeals & { client: { id: string; full_name: string } | null };

function sortMeals<T extends { meals: MealRow[] | null }>(plans: T[]): T[] {
  for (const plan of plans) {
    plan.meals = [...(plan.meals ?? [])].sort((a, b) => a.order_index - b.order_index);
  }
  return plans;
}

/** Athlete: every active plan their coach has assigned to them, newest first. */
export function useMyNutritionPlans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["nutrition-plans", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PlanWithMeals[]> => {
      const { data, error } = await supabase
        .from("nutrition_plans")
        .select("*, meals(*)")
        .eq("client_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return sortMeals((data ?? []) as PlanWithMeals[]);
    },
  });
}

/** The plan that applies to a day: one whose day type matches (training when a workout is
 *  scheduled, rest otherwise), then an every-day plan, then the most recent active plan. */
export function planForDay<T extends NutritionPlanRow>(plans: T[], hasWorkout: boolean): T | null {
  const wanted: DayType = hasWorkout ? "training" : "rest";
  return (
    plans.find((p) => p.day_type === wanted) ??
    plans.find((p) => p.day_type === "any") ??
    plans[0] ??
    null
  );
}

/** Coach: every plan they've created (or only one athlete's), newest first. */
export function useCoachNutritionPlans(clientId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["nutrition-plans", "coach", user?.id, clientId ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<CoachPlan[]> => {
      let query = supabase
        .from("nutrition_plans")
        .select("*, meals(*), client:client_id(id, full_name)")
        .eq("coach_id", user!.id)
        .order("created_at", { ascending: false });
      if (clientId) query = query.eq("client_id", clientId);
      const { data, error } = await query;
      if (error) throw error;
      return sortMeals((data ?? []) as CoachPlan[]);
    },
  });
}

export type PlanInput = {
  client_id: string;
  name: string;
  day_type: DayType;
  notes: string | null;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  is_active: boolean;
};

export function useCreateNutritionPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanInput) => {
      const { data, error } = await supabase
        .from("nutrition_plans")
        .insert({ ...input, coach_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as NutritionPlanRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition-plans"] }),
  });
}

export function useUpdateNutritionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PlanInput> & { id: string }) => {
      const { error } = await supabase.from("nutrition_plans").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition-plans"] }),
  });
}

export function useDeleteNutritionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nutrition_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<{ id: string }[]>({ queryKey: ["nutrition-plans"] }, (old) =>
        old?.filter((p) => p.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ["nutrition-plans"] });
    },
  });
}

export function useMealLogs(clientId: string | undefined, date: string = isoDate()) {
  return useQuery({
    queryKey: ["meal-logs", clientId, date],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("client_id", clientId!)
        .eq("log_date", date);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleMealLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      mealId,
      date,
      completed,
    }: {
      mealId: string;
      date: string;
      completed: boolean;
    }) => {
      const { error } = await supabase.from("meal_logs").upsert(
        {
          meal_id: mealId,
          client_id: user!.id,
          log_date: date,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: "meal_id,log_date" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: ["meal-logs", user?.id, vars.date] }),
  });
}

export type MealInput = {
  nutrition_plan_id: string;
  name: string;
  meal_time: string | null;
  order_index: number;
  foods_summary: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function useAddMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MealInput) => {
      const { error } = await supabase.from("meals").insert(input);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition-plans"] }),
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition-plans"] }),
  });
}
