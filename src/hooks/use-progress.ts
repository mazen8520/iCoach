import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isoDate } from "@/lib/format";

export function useProgressEntries(clientId?: string, limit = 30) {
  const { user } = useAuth();
  const id = clientId ?? user?.id;
  return useQuery({
    queryKey: ["progress-entries", id, limit],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_entries")
        .select("*")
        .eq("client_id", id!)
        .order("entry_date", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLogProgressEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      weight_kg?: number;
      body_fat_pct?: number;
      notes?: string;
      entry_date?: string;
    }) => {
      const { error } = await supabase
        .from("progress_entries")
        .upsert(
          { client_id: user!.id, entry_date: input.entry_date ?? isoDate(), ...input },
          { onConflict: "client_id,entry_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress-entries"] });
      queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
    },
  });
}

export function usePersonalRecords(clientId?: string) {
  const { user } = useAuth();
  const id = clientId ?? user?.id;
  return useQuery({
    queryKey: ["personal-records", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("*")
        .eq("client_id", id!)
        .order("achieved_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddPersonalRecord() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      exercise_name: string;
      value: string;
      previous_value?: string;
    }) => {
      const { error } = await supabase
        .from("personal_records")
        .insert({ ...input, client_id: user!.id, achieved_at: isoDate() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal-records"] }),
  });
}

/** Aggregate completion stats across all task types for the last N days — used by client Progress page. */
export function useCompletionStats(days = 30) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["completion-stats", user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      const [{ data: workouts }, { data: meals }] = await Promise.all([
        supabase
          .from("workout_assignments")
          .select("status")
          .eq("client_id", user!.id)
          .gte("scheduled_date", since),
        supabase
          .from("meal_logs")
          .select("completed")
          .eq("client_id", user!.id)
          .gte("log_date", since),
      ]);
      const total = (workouts?.length ?? 0) + (meals?.length ?? 0);
      const done =
        (workouts?.filter((w) => w.status === "completed").length ?? 0) +
        (meals?.filter((m) => m.completed).length ?? 0);
      return {
        total,
        done,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    },
  });
}
