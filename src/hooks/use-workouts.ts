import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isoDate } from "@/lib/format";
import { legacyColumns, type PlannedSet } from "@/lib/workout-sets";
import type {
  ExerciseRow,
  WorkoutAssignmentRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from "@/lib/database.types";

/** Exercise fields the athlete's session screen shows. */
export type SessionExercise = Pick<
  ExerciseRow,
  | "id"
  | "name"
  | "video_url"
  | "thumbnail_url"
  | "image_url"
  | "instructions"
  | "description"
  | "cues"
  | "common_mistakes"
>;

export type AssignmentExerciseDetail = Pick<
  WorkoutExerciseRow,
  | "id"
  | "order_index"
  | "sets"
  | "reps"
  | "load"
  | "rest_seconds"
  | "rest_after_seconds"
  | "superset_with_next"
  | "set_plan"
  | "notes"
> & { exercises: SessionExercise | null };

export type AssignmentDetail = WorkoutAssignmentRow & {
  workouts: {
    id: string;
    title: string;
    duration_minutes: number | null;
    cover_image_url: string | null;
    workout_exercises: AssignmentExerciseDetail[];
  } | null;
};

const SESSION_EXERCISE_FIELDS =
  "id, order_index, sets, reps, load, rest_seconds, rest_after_seconds, superset_with_next, set_plan, notes, exercises(id, name, video_url, thumbnail_url, image_url, instructions, description, cues, common_mistakes)";

function invalidateExerciseQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["exercises"] });
  queryClient.invalidateQueries({ queryKey: ["video-library"] });
  queryClient.invalidateQueries({ queryKey: ["workouts"] });
  queryClient.invalidateQueries({ queryKey: ["assignment-detail"] });
}

// ============================================================
// Exercise library (also doubles as the training video library —
// an exercise with a video_url shows up there).
// ============================================================
export type LibraryFilters = {
  search?: string;
  muscle?: string;
  equipment?: string;
  type?: string;
  difficulty?: string;
  archived?: boolean;
};

export function useExerciseLibrary(filters: LibraryFilters = {}) {
  const { user } = useAuth();
  const { search = "", muscle = "", equipment = "", type = "", difficulty = "" } = filters;
  const archived = filters.archived ?? false;
  return useQuery({
    queryKey: ["exercises", user?.id, search, muscle, equipment, type, difficulty, archived],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("exercises").select("*").eq("is_library", true).order("name");
      // The coach's own exercises plus the shared library (archive only applies to their own).
      query = archived
        ? query.eq("coach_id", user!.id).not("archived_at", "is", null)
        : query.or(`coach_id.eq.${user!.id},is_global.eq.true`).is("archived_at", null);
      if (search) query = query.ilike("name", `%${search}%`);
      if (muscle) {
        query = query.or(`primary_muscles.cs.{${muscle}},secondary_muscles.cs.{${muscle}}`);
      }
      if (equipment) query = query.contains("equipment_list", [equipment]);
      if (type) query = query.eq("exercise_type", type);
      if (difficulty) query = query.eq("difficulty", difficulty);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ExerciseRow[];
    },
  });
}

/** Library exercises by id — used to show an exercise's substitutes by name. */
export function useExercisesByIds(ids: string[]) {
  const { user } = useAuth();
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["exercises", "by-ids", user?.id, key],
    enabled: !!user && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, archived_at, is_global")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as Pick<ExerciseRow, "id" | "name" | "archived_at" | "is_global">[];
    },
  });
}

/** How many workouts use an exercise (to warn before a library edit or delete). */
export function useExerciseUsage(exerciseId: string | null | undefined) {
  return useQuery({
    queryKey: ["exercises", "usage", exerciseId],
    enabled: !!exerciseId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("workout_exercises")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", exerciseId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Exercises that have a demonstration video attached — the "training video library". */
export function useVideoLibrary(search = "", category = "All") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["video-library", user?.id, search, category],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("exercises")
        .select("*, workout_exercises(count)")
        .eq("coach_id", user!.id)
        .eq("is_library", true)
        .is("archived_at", null)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });
      if (search) query = query.ilike("name", `%${search}%`);
      if (category !== "All") query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function storageKey(userId: string, file: File, fallback: string) {
  // Keep the storage key URL-safe regardless of what the original file was called.
  const extension = file.name.includes(".") ? file.name.split(".").pop() : fallback;
  const safeBase = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 60);
  return `${userId}/${Date.now()}-${safeBase || "file"}.${extension}`;
}

export function useUploadExerciseVideo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      exerciseId,
      file,
      newExercise,
    }: {
      exerciseId?: string;
      file: File;
      newExercise?: { name: string; category?: string; durationSeconds?: number | null };
    }) => {
      const path = storageKey(user!.id, file, "mp4");
      const { error: uploadError } = await supabase.storage.from("media").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("media").getPublicUrl(path);

      if (exerciseId) {
        const { error } = await supabase
          .from("exercises")
          .update({ video_url: publicUrl.publicUrl })
          .eq("id", exerciseId);
        if (error) throw error;
      } else if (newExercise) {
        const { error } = await supabase.from("exercises").insert({
          coach_id: user!.id,
          name: newExercise.name,
          category: newExercise.category || null,
          video_url: publicUrl.publicUrl,
          duration_seconds: newExercise.durationSeconds ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateExerciseQueries(queryClient),
  });
}

/** Uploads an exercise image to the coach's media folder and returns its public URL. */
export function useUploadExerciseImage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      const path = storageKey(user!.id, file, "jpg");
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) throw error;
      return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    },
  });
}

/** Everything the exercise editor can change. */
export type ExerciseInput = Pick<
  ExerciseRow,
  | "name"
  | "description"
  | "instructions"
  | "cues"
  | "common_mistakes"
  | "primary_muscles"
  | "secondary_muscles"
  | "equipment_list"
  | "difficulty"
  | "exercise_type"
  | "body_region"
  | "video_url"
  | "image_url"
  | "alternative_ids"
>;

export function useCreateExercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<ExerciseInput> & { name: string; category?: string | null },
    ) => {
      const { data, error } = await supabase
        .from("exercises")
        .insert({ ...input, coach_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as ExerciseRow;
    },
    onSuccess: () => invalidateExerciseQueries(queryClient),
  });
}

/** Updates the library exercise itself — every workout using it sees the change. */
export function useUpdateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ExerciseInput> }) => {
      const { error } = await supabase.from("exercises").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateExerciseQueries(queryClient),
  });
}

/**
 * "Apply to this workout only": saves the edits as a private copy of the exercise (hidden from
 * the library) and points just this workout exercise at it. The library exercise and every other
 * workout keep the original.
 */
export function useSaveExerciseForWorkoutOnly() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workoutExerciseId,
      source,
      patch,
    }: {
      workoutExerciseId: string;
      source: ExerciseRow;
      patch: Partial<ExerciseInput>;
    }) => {
      // A private copy is already specific to this workout, so edit it in place.
      if (!source.is_library) {
        const { error } = await supabase.from("exercises").update(patch).eq("id", source.id);
        if (error) throw error;
        return;
      }
      const {
        id: _id,
        created_at: _created,
        updated_at: _updated,
        archived_at: _archived,
        ...rest
      } = source;
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          ...rest,
          ...patch,
          coach_id: user!.id,
          is_global: false,
          is_library: false,
          source_exercise_id: source.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: linkError } = await supabase
        .from("workout_exercises")
        .update({ exercise_id: (data as { id: string }).id })
        .eq("id", workoutExerciseId);
      if (linkError) throw linkError;
    },
    onSuccess: () => invalidateExerciseQueries(queryClient),
  });
}

export function useArchiveExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("exercises")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateExerciseQueries(queryClient),
  });
}

/** Permanently deletes an exercise. Workouts that use it lose it too (FK cascade), so the UI
 *  only offers this for exercises no workout uses, and suggests archiving otherwise. */
export function useDeleteExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateExerciseQueries(queryClient),
  });
}

// ============================================================
// Workout templates (coach builder)
// ============================================================
export type BuilderWorkoutExercise = Pick<
  WorkoutExerciseRow,
  | "id"
  | "exercise_id"
  | "order_index"
  | "sets"
  | "reps"
  | "load"
  | "rest_seconds"
  | "rest_after_seconds"
  | "superset_with_next"
  | "set_plan"
  | "notes"
> & { exercises: ExerciseRow | null };

export type CoachWorkout = WorkoutRow & {
  workout_exercises: BuilderWorkoutExercise[];
  workout_assignments: { count: number }[];
};

async function fetchCoachWorkouts(coachId: string): Promise<CoachWorkout[]> {
  const { data, error } = await supabase
    .from("workouts")
    .select(
      "*, workout_exercises(id, exercise_id, order_index, sets, reps, load, rest_seconds, rest_after_seconds, superset_with_next, set_plan, notes, exercises(*)), workout_assignments(count)",
    )
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CoachWorkout[];
}

export function useCoachWorkouts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workouts", user?.id],
    enabled: !!user,
    queryFn: () => fetchCoachWorkouts(user!.id),
  });
}

export function useCreateWorkout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      duration_minutes?: number;
      notes?: string;
      default_rest_seconds?: number;
    }) => {
      const { data, error } = await supabase
        .from("workouts")
        .insert({ ...input, coach_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as WorkoutRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

/** Permanently deletes a workout template. Its exercise sequence and every assignment of it
 *  (with the athletes' logged sets) are removed by FK cascade. */
export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      // Drop it from the cached list right away so the studio never shows a deleted workout
      // while the refetch is in flight.
      queryClient.setQueriesData<{ id: string }[]>({ queryKey: ["workouts"] }, (old) =>
        old?.filter((w) => w.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["client-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
      queryClient.invalidateQueries({ queryKey: ["team-trend"] });
    },
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      title?: string | undefined;
      duration_minutes?: number | null | undefined;
      notes?: string | undefined;
      default_rest_seconds?: number | undefined;
    }) => {
      const { error } = await supabase.from("workouts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function useAddExerciseToWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workout_id: string;
      exercise_id: string;
      order_index: number;
      set_plan: PlannedSet[];
      rest_seconds: number;
    }) => {
      const { error } = await supabase
        .from("workout_exercises")
        .insert({ ...input, ...legacyColumns(input.set_plan) });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export type WorkoutExercisePatch = {
  set_plan?: PlannedSet[];
  rest_seconds?: number | null;
  rest_after_seconds?: number | null;
  superset_with_next?: boolean;
  notes?: string | null;
};

/** Saves an exercise's prescription; the plain-text summary columns follow the set plan. */
export function useUpdateWorkoutExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: WorkoutExercisePatch }) => {
      const row = patch.set_plan ? { ...patch, ...legacyColumns(patch.set_plan) } : patch;
      const { error } = await supabase.from("workout_exercises").update(row).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["assignment-detail"] });
    },
  });
}

export function useReorderWorkoutExercises() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const results = await Promise.all(
        orderedIds.map((id, order_index) =>
          supabase.from("workout_exercises").update({ order_index }).eq("id", id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function useRemoveWorkoutExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

// ============================================================
// Assigning workouts to clients (scheduling)
// ============================================================
export function useAssignWorkout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workout_id: string;
      client_id: string;
      scheduled_date: string;
      scheduled_time?: string;
    }) => {
      const { error } = await supabase
        .from("workout_assignments")
        .insert({ ...input, coach_id: user!.id, status: "scheduled" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["client-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

// ============================================================
// Client-facing: assignments for a date range (Today / Week / Calendar)
// ============================================================
export function useClientAssignments(fromDate: string, toDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assignments", user?.id, fromDate, toDate],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_assignments")
        .select("*, workouts(id, title, description, duration_minutes, cover_image_url)")
        .eq("client_id", user!.id)
        .gte("scheduled_date", fromDate)
        .lte("scheduled_date", toDate)
        .order("scheduled_date");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTodayAssignment() {
  const today = isoDate();
  const { data, ...rest } = useClientAssignments(today, today);
  return { data: data?.[0] ?? null, ...rest };
}

/** Full workout session detail for the active-workout screen: exercises, prescriptions, set logs. */
export function useAssignmentDetail(assignmentId: string | null | undefined) {
  return useQuery({
    queryKey: ["assignment-detail", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data: assignment, error } = await supabase
        .from("workout_assignments")
        .select(
          `*, workouts(id, title, duration_minutes, cover_image_url, workout_exercises(${SESSION_EXERCISE_FIELDS}))`,
        )
        .eq("id", assignmentId!)
        .single<AssignmentDetail>();
      if (error) throw error;
      const { data: logs, error: logsError } = await supabase
        .from("set_logs")
        .select("*")
        .eq("assignment_id", assignmentId!);
      if (logsError) throw logsError;
      return { assignment, logs: logs ?? [] };
    },
  });
}

export function useStartAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("workout_assignments")
        .update({ status: "scheduled", started_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["assignment-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

export function useCompleteAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("workout_assignments")
        .update({
          status: "completed" as WorkoutAssignmentRow["status"],
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
    },
  });
}

export function useLogSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      assignment_id: string;
      workout_exercise_id: string;
      set_number: number;
      reps_done?: number;
      weight_used?: number;
    }) => {
      const { error } = await supabase
        .from("set_logs")
        .upsert(input, { onConflict: "assignment_id,workout_exercise_id,set_number" });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["assignment-detail", vars.assignment_id] });
    },
  });
}

/** Adds several exercises to a workout in one insert, each with its own starting prescription. */
export function useAddExercisesToWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: {
        workout_id: string;
        exercise_id: string;
        order_index: number;
        set_plan: PlannedSet[];
        rest_seconds: number;
      }[],
    ) => {
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("workout_exercises")
        .insert(rows.map((row) => ({ ...row, ...legacyColumns(row.set_plan) })));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
