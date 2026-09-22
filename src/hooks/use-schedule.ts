import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { weekDates } from "@/lib/format";

export type ScheduleEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: "TRAINING" | "MEETING";
};

/** Coach's week: workout assignments + meetings, positioned by time-of-day. */
export function useCoachWeekSchedule() {
  const { user } = useAuth();
  const dates = weekDates();
  const from = dates[0]!.toISOString().slice(0, 10);
  const to = dates[6]!.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["coach-schedule", user?.id, from, to],
    enabled: !!user,
    queryFn: async (): Promise<ScheduleEvent[]> => {
      const [{ data: assignments, error: assignError }, { data: meetings, error: meetingError }] =
        await Promise.all([
          supabase
            .from("workout_assignments")
            .select(
              "id, scheduled_date, scheduled_time, workouts(title), profiles:client_id(full_name)",
            )
            .eq("coach_id", user!.id)
            .gte("scheduled_date", from)
            .lte("scheduled_date", to),
          supabase
            .from("meetings")
            .select("id, scheduled_at, title, profiles:client_id(full_name)")
            .eq("coach_id", user!.id)
            .gte("scheduled_at", `${from}T00:00:00`)
            .lte("scheduled_at", `${to}T23:59:59`),
        ]);
      if (assignError) throw assignError;
      if (meetingError) throw meetingError;

      const events: ScheduleEvent[] = [];
      for (const a of assignments ?? []) {
        const client = a.profiles as unknown as { full_name: string } | null;
        const workout = a.workouts as unknown as { title: string } | null;
        events.push({
          id: a.id,
          date: a.scheduled_date,
          time: a.scheduled_time ?? "09:00",
          title: `${client?.full_name ?? "Client"} · ${workout?.title ?? "Workout"}`,
          type: "TRAINING",
        });
      }
      for (const m of meetings ?? []) {
        const client = m.profiles as unknown as { full_name: string } | null;
        const d = new Date(m.scheduled_at);
        events.push({
          id: m.id,
          date: d.toISOString().slice(0, 10),
          time: d.toTimeString().slice(0, 5),
          title: `${client?.full_name ?? "Client"} · ${m.title}`,
          type: "MEETING",
        });
      }
      return events;
    },
  });
}
