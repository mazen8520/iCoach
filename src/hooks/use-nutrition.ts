import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isoDate } from "@/lib/format";
import type { MealRow } from "@/lib/database.types";

async function fetchActivePlan(clientId: string) {
  const { data, error } = await supabase
    .from("nutrition_plans")
    .select("*, meals(*)")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.meals) data.meals.sort((a: MealRow, b: MealRow) => a.order_index - b.order_index);
  return data;
}
export type ActivePlan = Awaited<ReturnType<typeof fetchActivePlan>>;

/** The client's own active nutrition plan, or a specific client's plan (coach view). */
export function useNutritionPlan(clientId?: string) {
  const { user } = useAuth();
  const id = clientId ?? user?.id;
  return useQuery({
    queryKey: ["nutrition-plan", id],
    enabled: !!id,
    queryFn: () => fetchActivePlan(id!),
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

export function useCreateNutritionPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      name: string;
      day_type?: string;
      target_calories: number;
      target_protein_g: number;
      target_carbs_g: number;
      target_fat_g: number;
    }) => {
      await supabase
        .from("nutrition_plans")
        .update({ is_active: false })
        .eq("client_id", input.client_id)
        .eq("is_active", true);
      const { data, error } = await supabase
        .from("nutrition_plans")
        .insert({ ...input, coach_id: user!.id, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition-plan"] }),
  });
}

export function useAddMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nutrition_plan_id: string;
      name: string;
      meal_time?: string;
      order_index: number;
      foods_summary?: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }) => {
      const { error } = await supabase.from("meals").insert(input);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition-plan"] }),
  });
}
