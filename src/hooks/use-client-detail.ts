import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { addDays, isoDate } from "@/lib/format";
import type { MeetingRow, WorkoutAssignmentRow } from "@/lib/database.types";

// Coach-side views of ONE athlete. Every query filters on that athlete's id (and on the coach's
// own id where the table has one) and is keyed by it, so data from different athletes can never
// share a cache entry; RLS additionally limits coaches to their own linked athletes.

export type ClientAssignment = Pick<
  WorkoutAssignmentRow,
  | "id"
  | "workout_id"
  | "scheduled_date"
  | "scheduled_time"
  | "status"
  | "started_at"
  | "completed_at"
> & { workouts: { id: string; title: string; duration_minutes: number | null } | null };

/** The athlete's workout assignments from 90 days back to 60 days ahead, newest first. */
export function useClientAssignmentsForCoach(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-assignments", user?.id, clientId],
    enabled: !!user && !!clientId,
    queryFn: async (): Promise<ClientAssignment[]> => {
      const { data, error } = await supabase
        .from("workout_assignments")
        .select(
          "id, workout_id, scheduled_date, scheduled_time, status, started_at, completed_at, workouts(id, title, duration_minutes)",
        )
        .eq("coach_id", user!.id)
        .eq("client_id", clientId)
        .gte("scheduled_date", isoDate(addDays(new Date(), -90)))
        .lte("scheduled_date", isoDate(addDays(new Date(), 60)))
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientAssignment[];
    },
  });
}

/** Meetings between this coach and the athlete, oldest first. */
export function useClientMeetings(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-meetings", user?.id, clientId],
    enabled: !!user && !!clientId,
    queryFn: async (): Promise<MeetingRow[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("coach_id", user!.id)
        .eq("client_id", clientId)
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The athlete's meal check-offs over the last `days` days (for adherence analysis). */
export function useClientMealLogs(clientId: string, days = 30) {
  return useQuery({
    queryKey: ["client-meal-logs", clientId, days],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_logs")
        .select("id, meal_id, log_date, completed, completed_at")
        .eq("client_id", clientId)
        .gte("log_date", isoDate(addDays(new Date(), -days)))
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
