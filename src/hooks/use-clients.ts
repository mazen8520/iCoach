import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { daysSince, isoDate } from "@/lib/format";
import type { Profile } from "@/lib/database.types";
import { createAthleteAccount } from "@/lib/create-athlete.functions";

export type ClientStatus = "on-track" | "attention" | "new";

export type RosterClient = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  goal: string;
  programName: string;
  weeklyCompletion: number;
  streakDays: number;
  status: ClientStatus;
  lastActiveAt: string | null;
  currentWeightKg: number | null;
  joinedAt: string | null;
};

const WEEK_MS = 7 * 86_400_000;

/** Coach's full roster with weekly completion, streak and status computed from real activity. */
export function useCoachRoster() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["coach-roster", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<RosterClient[]> => {
      const { data: links, error: linksError } = await supabase
        .from("coach_clients")
        .select("client_id, joined_at, profiles:client_id(id, full_name, avatar_url, goal)")
        .eq("coach_id", user!.id)
        .not("client_id", "is", null);
      if (linksError) throw linksError;
      const clientIds = (links ?? []).map((l) => l.client_id as string);
      if (clientIds.length === 0) return [];

      const since = new Date(Date.now() - WEEK_MS).toISOString().slice(0, 10);
      const [{ data: assignments }, { data: programs }, { data: checkIns }, { data: weights }] =
        await Promise.all([
          supabase
            .from("workout_assignments")
            .select("client_id, scheduled_date, status, completed_at")
            .eq("coach_id", user!.id)
            .gte("scheduled_date", since),
          supabase
            .from("programs")
            .select("client_id, name, start_date")
            .eq("coach_id", user!.id)
            .eq("status", "active"),
          supabase
            .from("check_ins")
            .select("client_id, submitted_at")
            .eq("coach_id", user!.id)
            .order("submitted_at", { ascending: false }),
          supabase
            .from("progress_entries")
            .select("client_id, weight_kg, entry_date")
            .in("client_id", clientIds)
            .order("entry_date", { ascending: false }),
        ]);

      return (links ?? []).map((link) => {
        const clientId = link.client_id as string;
        const profile = link.profiles as unknown as Pick<
          Profile,
          "id" | "full_name" | "avatar_url" | "goal"
        > | null;
        const myAssignments = (assignments ?? []).filter((a) => a.client_id === clientId);
        const total = myAssignments.length;
        const completed = myAssignments.filter((a) => a.status === "completed").length;
        const weeklyCompletion = total > 0 ? Math.round((completed / total) * 100) : 0;
        const streakDays = computeStreak(myAssignments);
        const program = (programs ?? []).find((p) => p.client_id === clientId);
        const lastCheckIn = (checkIns ?? []).find((c) => c.client_id === clientId);
        const lastCompletedAssignment = myAssignments
          .filter((a) => a.completed_at)
          .sort((a, b) => (a.completed_at! > b.completed_at! ? -1 : 1))[0];
        const lastActiveAt = [lastCheckIn?.submitted_at, lastCompletedAssignment?.completed_at]
          .filter(Boolean)
          .sort()
          .pop() as string | undefined;
        const weight = (weights ?? []).find((w) => w.client_id === clientId);

        const overdueWorkout = myAssignments.some(
          (a) => a.status === "scheduled" && a.scheduled_date < isoDate(),
        );
        const checkInOverdue = daysSince(lastCheckIn?.submitted_at) > 9;
        const isNew = daysSince(link.joined_at) <= 13;
        const status: ClientStatus = isNew
          ? "new"
          : overdueWorkout || checkInOverdue
            ? "attention"
            : "on-track";

        return {
          id: clientId,
          name: profile?.full_name || "Unnamed athlete",
          initials: initials(profile?.full_name),
          avatarUrl: profile?.avatar_url ?? null,
          goal: profile?.goal || "No goal set",
          programName: program?.name || "No active program",
          weeklyCompletion,
          streakDays,
          status,
          lastActiveAt: lastActiveAt ?? null,
          currentWeightKg: weight?.weight_kg ?? null,
          joinedAt: link.joined_at,
        };
      });
    },
  });
}

function initials(name?: string | null) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

/** Consecutive days up to today where every assigned workout was completed. Days with no
 *  assignment don't break the streak. */
export function computeStreak(assignments: { scheduled_date: string; status: string }[]): number {
  const byDate = new Map<string, { total: number; completed: number }>();
  for (const a of assignments) {
    const entry = byDate.get(a.scheduled_date) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (a.status === "completed") entry.completed += 1;
    byDate.set(a.scheduled_date, entry);
  }
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 60; i++) {
    const key = cursor.toISOString().slice(0, 10);
    const day = byDate.get(key);
    if (day && day.completed < day.total) break;
    if (day) streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type NewAthleteInput = {
  fullName: string;
  email: string;
  password: string;
  age?: number;
  sex?: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
};

/** Coach-only: creates a real auth account + profile for an athlete and links them to the
 *  coach, via a server function so the service-role key never reaches the browser. */
export function useCreateAthlete() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewAthleteInput) => {
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      return createAthleteAccount({
        data: {
          accessToken: session.access_token,
          fullName: input.fullName,
          email: input.email,
          password: input.password,
          ...(input.age !== undefined ? { age: input.age } : {}),
          ...(input.sex !== undefined ? { sex: input.sex } : {}),
          ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
          ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
        },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-roster"] }),
  });
}

export function useRemoveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.from("coach_clients").delete().eq("client_id", clientId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-roster"] }),
  });
}

/** The current client's coach, for client-facing pages (messages, meetings, coach notes). */
export function useMyCoach() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-coach", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_clients")
        .select("coach_id, profiles:coach_id(id, full_name, avatar_url)")
        .eq("client_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data
        ? (data.profiles as unknown as Pick<Profile, "id" | "full_name" | "avatar_url">)
        : null;
    },
  });
}
