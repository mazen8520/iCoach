import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatDay, weekDates } from "@/lib/format";

/** Coach view of a single client: latest check-in signal + this week's scheduled work. */
export function useClientDetail(clientId: string) {
  const { user } = useAuth();

  const checkIn = useQuery({
    queryKey: ["client-latest-check-in", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .eq("client_id", clientId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const week = useQuery({
    queryKey: ["client-week", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const dates = weekDates();
      const from = dates[0]!.toISOString().slice(0, 10);
      const to = dates[6]!.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("workout_assignments")
        .select("scheduled_date, status, workouts(title)")
        .eq("client_id", clientId)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to);
      if (error) throw error;
      return dates.map((date) => {
        const key = date.toISOString().slice(0, 10);
        const rows = (data ?? []).filter((r) => r.scheduled_date === key);
        const total = rows.length;
        const done = rows.filter((r) => r.status === "completed").length;
        const workout = rows[0]?.workouts as unknown as { title: string } | null;
        return {
          day: formatDay(date.toISOString()),
          date: String(date.getDate()),
          score: total > 0 ? Math.round((done / total) * 100) : 0,
          label: workout?.title ?? "Rest",
        };
      });
    },
  });

  const trend = useQuery({
    queryKey: ["client-trend", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_entries")
        .select("entry_date, weight_kg")
        .eq("client_id", clientId)
        .order("entry_date", { ascending: true })
        .limit(7);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        day: formatDay(row.entry_date),
        value: row.weight_kg ?? 0,
      }));
    },
  });

  return {
    isLoading: checkIn.isLoading || week.isLoading || trend.isLoading,
    checkIn: checkIn.data,
    week: week.data ?? [],
    trend: trend.data ?? [],
  };
}
