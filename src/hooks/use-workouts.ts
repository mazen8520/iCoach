import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isoDate } from "@/lib/format";
import type { ExerciseRow, WorkoutAssignmentRow } from "@/lib/database.types";

export type AssignmentExerciseDetail = {
  id: string;
  order_index: number;
  sets: number;
  reps: string;
  load: string | null;
  rest_seconds: number | null;
  exercises: Pick<
    ExerciseRow,
    "id" | "name" | "video_url" | "thumbnail_url" | "instructions"
  > | null;
};
export type AssignmentDetail = WorkoutAssignmentRow & {
  workouts: {
    id: string;
    title: string;
    duration_minutes: number | null;
    cover_image_url: string | null;
    workout_exercises: AssignmentExerciseDetail[];
  } | null;
};

// ============================================================
// Exercise library (also doubles as the training video library —
// an exercise with a video_url shows up there).
// ============================================================
export function useExerciseLibrary(search = "") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["exercises", user?.id, search],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("exercises").select("*").eq("coach_id", user!.id).order("name");
      if (search) query = query.ilike("name", `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ExerciseRow[];
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
      newExercise?: { name: string; category?: string };
    }) => {
      const path = `${user!.id}/${Date.now()}-${file.name}`;
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
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-library"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

export function useCreateExercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ExerciseRow> & { name: string }) => {
      const { data, error } = await supabase
        .from("exercises")
        .insert({ ...input, coach_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as ExerciseRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

// ============================================================
// Workout templates (coach builder)
// ============================================================
async function fetchCoachWorkouts(coachId: string) {
  const { data, error } = await supabase
    .from("workouts")
    .select(
      "*, workout_exercises(id, order_index, sets, reps, load, rest_seconds, notes, exercises(id, name, video_url, thumbnail_url))",
    )
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export type CoachWorkout = Awaited<ReturnType<typeof fetchCoachWorkouts>>[number];

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
    }) => {
      const { data, error } = await supabase
        .from("workouts")
        .insert({ ...input, coach_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
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
      duration_minutes?: number | undefined;
      notes?: string | undefined;
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
      sets?: number;
      reps?: string;
      load?: string;
      rest_seconds?: number;
    }) => {
      const { error } = await supabase.from("workout_exercises").insert(input);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
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
          "*, workouts(id, title, duration_minutes, cover_image_url, workout_exercises(id, order_index, sets, reps, load, rest_seconds, exercises(id, name, video_url, thumbnail_url, instructions)))",
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
