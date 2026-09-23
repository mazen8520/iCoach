import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { addDays, isoDate, localTime, parseIsoDate } from "@/lib/format";
import type {
  MeetingStatus,
  ScheduleEventRow,
  ScheduleEventType,
  WorkoutStatus,
} from "@/lib/database.types";

export type ScheduleItemKind = "training" | "meeting" | "event";

/** One entry on the coach calendar, normalised from workout assignments, meetings and custom
 *  schedule events. Dates/times are LOCAL. Titles/names are raw data (null when missing) — the UI
 *  supplies translated fallbacks. */
export type ScheduleItem = {
  key: string;
  id: string;
  kind: ScheduleItemKind;
  date: string;
  start: string;
  end: string;
  startsAt: number;
  durationMinutes: number;
  title: string | null;
  clientId: string | null;
  clientName: string | null;
  description: string | null;
  eventType: ScheduleEventType | null;
  status: WorkoutStatus | MeetingStatus | null;
  videoUrl: string | null;
};

const DEFAULT_TRAINING_TIME = "09:00";
const DEFAULT_TRAINING_MINUTES = 60;

function minutesToClock(total: number) {
  const clamped = Math.min(total, 24 * 60 - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function clockToMinutes(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Start of `from` and end of `to` (local YYYY-MM-DD) as ISO timestamps for timestamptz filters. */
function localRange(from: string, to: string) {
  const start = parseIsoDate(from);
  const end = addDays(parseIsoDate(to), 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Everything on the coach's calendar between two local dates (inclusive). */
export function useCoachSchedule(from: string, to: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["coach-schedule", user?.id, from, to],
    enabled: !!user,
    queryFn: async (): Promise<ScheduleItem[]> => {
      const { startIso, endIso } = localRange(from, to);
      const [assignments, meetings, events] = await Promise.all([
        supabase
          .from("workout_assignments")
          .select(
            "id, client_id, scheduled_date, scheduled_time, status, workouts(title, duration_minutes), profiles:client_id(full_name)",
          )
          .eq("coach_id", user!.id)
          .gte("scheduled_date", from)
          .lte("scheduled_date", to),
        supabase
          .from("meetings")
          .select(
            "id, client_id, scheduled_at, duration_minutes, title, notes, status, video_url, profiles:client_id(full_name)",
          )
          .eq("coach_id", user!.id)
          .gte("scheduled_at", startIso)
          .lt("scheduled_at", endIso),
        supabase
          .from("schedule_events")
          .select("*, profiles:client_id(full_name)")
          .eq("coach_id", user!.id)
          .lt("starts_at", endIso)
          .gt("ends_at", startIso),
      ]);
      if (assignments.error) throw assignments.error;
      if (meetings.error) throw meetings.error;
      if (events.error) throw events.error;

      const items: ScheduleItem[] = [];
      for (const a of assignments.data ?? []) {
        const client = a.profiles as unknown as { full_name: string } | null;
        const workout = a.workouts as unknown as {
          title: string;
          duration_minutes: number | null;
        } | null;
        const start = a.scheduled_time?.slice(0, 5) ?? DEFAULT_TRAINING_TIME;
        const duration = workout?.duration_minutes || DEFAULT_TRAINING_MINUTES;
        const startMinutes = clockToMinutes(start);
        const day = parseIsoDate(a.scheduled_date);
        day.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        const startsAt = day.getTime();
        items.push({
          key: `training:${a.id}`,
          id: a.id,
          kind: "training",
          date: a.scheduled_date,
          start,
          end: minutesToClock(clockToMinutes(start) + duration),
          startsAt,
          durationMinutes: duration,
          title: workout?.title ?? null,
          clientId: a.client_id,
          clientName: client?.full_name || null,
          description: null,
          eventType: null,
          status: a.status,
          videoUrl: null,
        });
      }
      for (const meeting of meetings.data ?? []) {
        const client = meeting.profiles as unknown as { full_name: string } | null;
        const startDate = new Date(meeting.scheduled_at);
        const start = localTime(startDate);
        items.push({
          key: `meeting:${meeting.id}`,
          id: meeting.id,
          kind: "meeting",
          date: isoDate(startDate),
          start,
          end: minutesToClock(clockToMinutes(start) + meeting.duration_minutes),
          startsAt: startDate.getTime(),
          durationMinutes: meeting.duration_minutes,
          title: meeting.title,
          clientId: meeting.client_id,
          clientName: client?.full_name || null,
          description: meeting.notes,
          eventType: null,
          status: meeting.status,
          videoUrl: meeting.video_url,
        });
      }
      for (const event of (events.data ?? []) as (ScheduleEventRow & {
        profiles: { full_name: string } | null;
      })[]) {
        const startDate = new Date(event.starts_at);
        const endDate = new Date(event.ends_at);
        const sameDay = isoDate(startDate) === isoDate(endDate);
        items.push({
          key: `event:${event.id}`,
          id: event.id,
          kind: "event",
          date: isoDate(startDate),
          start: localTime(startDate),
          end: sameDay ? localTime(endDate) : "23:59",
          startsAt: startDate.getTime(),
          durationMinutes: Math.max(
            15,
            Math.round((endDate.getTime() - startDate.getTime()) / 60000),
          ),
          title: event.title,
          clientId: event.client_id,
          clientName: event.profiles?.full_name || null,
          description: event.description,
          eventType: event.event_type,
          status: null,
          videoUrl: null,
        });
      }
      return items.sort((a, b) => a.startsAt - b.startsAt);
    },
  });
}

export type NewScheduleEvent = {
  title: string;
  starts_at: string;
  ends_at: string;
  event_type: ScheduleEventType;
  client_id: string | null;
  description: string | null;
};

export function useCreateScheduleEvent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewScheduleEvent) => {
      const { data, error } = await supabase
        .from("schedule_events")
        .insert({ ...input, coach_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleEventRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["client-events"] });
    },
  });
}

export function useDeleteScheduleEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<{ id: string; kind: string }[]>(
        { queryKey: ["coach-schedule"] },
        (old) => old?.filter((item) => !(item.kind === "event" && item.id === id)),
      );
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["client-events"] });
    },
  });
}

/** Coach view: custom events tied to one athlete, oldest first. */
export function useClientEvents(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-events", user?.id, clientId],
    enabled: !!user && !!clientId,
    queryFn: async (): Promise<ScheduleEventRow[]> => {
      const { data, error } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("coach_id", user!.id)
        .eq("client_id", clientId)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as ScheduleEventRow[];
    },
  });
}

/** Athlete view: events their coach scheduled for them between two local dates. */
export function useMyScheduleEvents(from: string, to: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-events", user?.id, from, to],
    enabled: !!user,
    queryFn: async (): Promise<ScheduleEventRow[]> => {
      const { startIso, endIso } = localRange(from, to);
      const { data, error } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("client_id", user!.id)
        .lt("starts_at", endIso)
        .gt("ends_at", startIso)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as ScheduleEventRow[];
    },
  });
}
