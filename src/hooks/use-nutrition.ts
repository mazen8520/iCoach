import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isoDate } from "@/lib/format";
import type {
  DayMarker,
  FoodAlternative,
  FoodUnit,
  MealItemRow,
  MealMacrosRow,
  MealRow,
  NutritionPlanRow,
  NutritionPlanTargetsRow,
} from "@/lib/database.types";

// A coach can run several nutrition plans per athlete (e.g. a training-day and a rest-day plan).
// Each plan is a Saturday -> Friday week: every meal belongs to one weekday
// (meals.day_of_week, 0 = Sunday ... 6 = Saturday). Templates are plans with no athlete.
//
// Calories and macros live only in nutrition_plan_targets / meal_macros, which RLS limits to the
// owning coach. Athlete queries below never ask for them, and the database would return nothing
// if they did.

export type DayType = "training" | "rest" | "any";
export const DAY_TYPES: DayType[] = ["training", "rest", "any"];

export type MealWithItems = MealRow & { meal_items: MealItemRow[] };
export type PlanWithMeals = NutritionPlanRow & { meals: MealWithItems[] };

export type CoachMeal = MealWithItems & { meal_macros: MealMacrosRow | null };
export type CoachPlan = NutritionPlanRow & {
  meals: CoachMeal[];
  targets: NutritionPlanTargetsRow | null;
  client: { id: string; full_name: string } | null;
};

type Embedded<T> = T | T[] | null | undefined;
function one<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function sortMeals<T extends { meals: MealWithItems[] | null }>(plans: T[]): T[] {
  for (const plan of plans) {
    plan.meals = [...(plan.meals ?? [])]
      .map((m) => ({
        ...m,
        meal_items: [...(m.meal_items ?? [])].sort((a, b) => a.order_index - b.order_index),
      }))
      .sort((a, b) => a.day_of_week - b.day_of_week || a.order_index - b.order_index);
  }
  return plans;
}

/** A plan's meals for one weekday, in order. */
export function mealsForDay<T extends MealRow>(plan: { meals: T[] } | null, weekday: number): T[] {
  return (plan?.meals ?? []).filter((m) => m.day_of_week === weekday);
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
        .select(
          "id, coach_id, client_id, name, day_type, is_active, is_template, day_types, notes, created_at, meals(id, nutrition_plan_id, name, meal_time, order_index, foods_summary, day_of_week, meal_items(*))",
        )
        .eq("client_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return sortMeals((data ?? []) as PlanWithMeals[]);
    },
  });
}

/** The plan that applies to a day: one whose weekday marker or day type matches (training when a
 *  workout is scheduled, rest otherwise), then an every-day plan, then the most recent plan. */
export function planForDay<T extends NutritionPlanRow>(
  plans: T[],
  hasWorkout: boolean,
  weekday: number = new Date().getDay(),
): T | null {
  const wanted: DayType = hasWorkout ? "training" : "rest";
  return (
    plans.find((p) => p.day_types?.[String(weekday)] === wanted) ??
    plans.find((p) => p.day_type === wanted) ??
    plans.find((p) => p.day_type === "any") ??
    plans[0] ??
    null
  );
}

const COACH_PLAN_SELECT =
  "*, meals(*, meal_items(*), meal_macros(*)), targets:nutrition_plan_targets(*), client:client_id(id, full_name)";

function normalizeCoachPlans(rows: unknown[]): CoachPlan[] {
  const plans = (rows as (CoachPlan & { targets: Embedded<NutritionPlanTargetsRow> })[]).map(
    (p) => ({
      ...p,
      targets: one(p.targets),
      meals: (p.meals ?? []).map((m) => ({
        ...m,
        meal_macros: one(m.meal_macros as Embedded<MealMacrosRow>),
      })),
    }),
  );
  return sortMeals(plans) as CoachPlan[];
}

/** Coach: every athlete plan they've created (or only one athlete's), newest first. */
export function useCoachNutritionPlans(clientId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["nutrition-plans", "coach", user?.id, clientId ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<CoachPlan[]> => {
      let query = supabase
        .from("nutrition_plans")
        .select(COACH_PLAN_SELECT)
        .eq("coach_id", user!.id)
        .eq("is_template", false)
        .order("created_at", { ascending: false });
      if (clientId) query = query.eq("client_id", clientId);
      const { data, error } = await query;
      if (error) throw error;
      return normalizeCoachPlans(data ?? []);
    },
  });
}

/** Coach: saved plan templates. */
export function useNutritionTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["nutrition-plans", "templates", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CoachPlan[]> => {
      const { data, error } = await supabase
        .from("nutrition_plans")
        .select(COACH_PLAN_SELECT)
        .eq("coach_id", user!.id)
        .eq("is_template", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return normalizeCoachPlans(data ?? []);
    },
  });
}

export type Targets = Pick<
  NutritionPlanTargetsRow,
  "target_calories" | "target_protein_g" | "target_carbs_g" | "target_fat_g"
>;

export type PlanInput = {
  client_id: string | null;
  is_template?: boolean;
  name: string;
  day_type: DayType;
  notes: string | null;
  is_active: boolean;
};

async function saveTargets(planId: string, coachId: string, targets: Targets) {
  const { error } = await supabase
    .from("nutrition_plan_targets")
    .upsert({ plan_id: planId, coach_id: coachId, ...targets }, { onConflict: "plan_id" });
  if (error) throw error;
}

function invalidatePlans(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["nutrition-plans"] });
}

export function useCreateNutritionPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ targets, ...input }: PlanInput & { targets: Targets }) => {
      const { data, error } = await supabase
        .from("nutrition_plans")
        .insert({ ...input, is_template: input.is_template ?? false, coach_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      const plan = data as NutritionPlanRow;
      await saveTargets(plan.id, user!.id, targets);
      return plan;
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

export function useUpdateNutritionPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      targets,
      ...patch
    }: Partial<PlanInput> & {
      id: string;
      targets?: Targets;
      day_types?: NutritionPlanRow["day_types"];
    }) => {
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("nutrition_plans").update(patch).eq("id", id);
        if (error) throw error;
      }
      if (targets) await saveTargets(id, user!.id, targets);
    },
    onSuccess: () => invalidatePlans(queryClient),
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
      invalidatePlans(queryClient);
    },
  });
}

/** Sets or clears one weekday's marker (training / rest / refeed). */
export function useSetDayMarker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      plan,
      weekday,
      marker,
    }: {
      plan: Pick<NutritionPlanRow, "id" | "day_types">;
      weekday: number;
      marker: DayMarker | null;
    }) => {
      const next = { ...(plan.day_types ?? {}) };
      if (marker) next[String(weekday)] = marker;
      else delete next[String(weekday)];
      const { error } = await supabase
        .from("nutrition_plans")
        .update({ day_types: next })
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

// ============================================================
// Meals and food items
// ============================================================
export type FoodItemInput = {
  name: string;
  quantity: number | null;
  unit: FoodUnit | null;
  notes: string | null;
  alternatives: FoodAlternative[];
};

export type Macros = Pick<MealMacrosRow, "calories" | "protein_g" | "carbs_g" | "fat_g">;

export type MealInput = {
  name: string;
  meal_time: string | null;
  items: FoodItemInput[];
  macros: Macros;
};

async function replaceItems(mealId: string, items: FoodItemInput[]) {
  const { error: deleteError } = await supabase.from("meal_items").delete().eq("meal_id", mealId);
  if (deleteError) throw deleteError;
  if (items.length === 0) return;
  const { error } = await supabase
    .from("meal_items")
    .insert(items.map((item, order_index) => ({ ...item, meal_id: mealId, order_index })));
  if (error) throw error;
}

async function saveMacros(mealId: string, coachId: string, macros: Macros) {
  const { error } = await supabase
    .from("meal_macros")
    .upsert({ meal_id: mealId, coach_id: coachId, ...macros }, { onConflict: "meal_id" });
  if (error) throw error;
}

export function useAddMeal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      weekday,
      orderIndex,
      meal,
    }: {
      planId: string;
      weekday: number;
      orderIndex: number;
      meal: MealInput;
    }) => {
      const { data, error } = await supabase
        .from("meals")
        .insert({
          nutrition_plan_id: planId,
          day_of_week: weekday,
          order_index: orderIndex,
          name: meal.name,
          meal_time: meal.meal_time,
        })
        .select("id")
        .single();
      if (error) throw error;
      const mealId = (data as { id: string }).id;
      await replaceItems(mealId, meal.items);
      await saveMacros(mealId, user!.id, meal.macros);
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

export function useUpdateMeal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, meal }: { id: string; meal: MealInput }) => {
      const { error } = await supabase
        .from("meals")
        .update({ name: meal.name, meal_time: meal.meal_time })
        .eq("id", id);
      if (error) throw error;
      await replaceItems(id, meal.items);
      await saveMacros(id, user!.id, meal.macros);
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

export function useReorderMeals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const results = await Promise.all(
        orderedIds.map((id, order_index) =>
          supabase.from("meals").update({ order_index }).eq("id", id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSettled: () => invalidatePlans(queryClient),
  });
}

/** Copies one weekday's meals onto other weekdays (replacing what those days had). */
export function useCopyDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      fromDay,
      toDays,
    }: {
      planId: string;
      fromDay: number;
      toDays: number[];
    }) => {
      const { error } = await supabase.rpc("copy_nutrition_day", {
        p_plan_id: planId,
        p_from_day: fromDay,
        p_to_days: toDays,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

export function useClearDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, weekday }: { planId: string; weekday: number }) => {
      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("nutrition_plan_id", planId)
        .eq("day_of_week", weekday);
      if (error) throw error;
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

/** Duplicates a whole plan — as a template, or as a new plan for an athlete. Returns its id. */
export function useCopyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceId,
      clientId,
      name,
      asTemplate,
    }: {
      sourceId: string;
      clientId: string | null;
      name: string | null;
      asTemplate: boolean;
    }) => {
      const { data, error } = await supabase.rpc("copy_nutrition_plan", {
        p_source_id: sourceId,
        p_client_id: clientId,
        p_name: name,
        p_as_template: asTemplate,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidatePlans(queryClient),
  });
}

// ============================================================
// Meal check-offs
// ============================================================
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
