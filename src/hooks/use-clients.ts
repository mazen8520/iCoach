import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { addDays, daysSince, initialsFromName, isoDate } from "@/lib/format";
import type { Profile } from "@/lib/database.types";
import { createAthleteAccount } from "@/lib/create-athlete.functions";

export type ClientStatus = "on-track" | "attention" | "new";

export type RosterClient = {
  id: string;
  /** Raw values — empty/null when the athlete hasn't filled them in; the UI shows a translated
   *  placeholder. */
  name: string;
  initials: string;
  avatarUrl: string | null;
  goal: string | null;
  programName: string | null;
  weeklyCompletion: number;
  streakDays: number;
  status: ClientStatus;
  lastActiveAt: string | null;
  currentWeightKg: number | null;
  joinedAt: string | null;
};

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

      const since = isoDate(addDays(new Date(), -7));
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

      const today = isoDate();
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
        const weight = (weights ?? []).find((w) => w.client_id === clientId && w.weight_kg != null);

        const overdueWorkout = myAssignments.some(
          (a) => a.status === "scheduled" && a.scheduled_date < today,
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
          name: profile?.full_name?.trim() ?? "",
          initials: initialsFromName(profile?.full_name),
          avatarUrl: profile?.avatar_url ?? null,
          goal: profile?.goal?.trim() || null,
          programName: program?.name ?? null,
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
    const day = byDate.get(isoDate(cursor));
    if (day && day.completed < day.total) break;
    if (day) streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type ClientProfileDetail = Pick<
  Profile,
  | "id"
  | "email"
  | "full_name"
  | "avatar_url"
  | "goal"
  | "phone"
  | "age"
  | "sex"
  | "height_cm"
  | "created_at"
> & { joined_at: string | null };

/** Coach view: one athlete's profile — only resolves if that athlete is linked to THIS coach,
 *  so a guessed or stale client id never shows another coach's athlete. */
export function useClientProfile(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-profile", user?.id, clientId],
    enabled: !!user && !!clientId,
    queryFn: async (): Promise<ClientProfileDetail | null> => {
      const { data, error } = await supabase
        .from("coach_clients")
        .select(
          "joined_at, profiles:client_id(id, email, full_name, avatar_url, goal, phone, age, sex, height_cm, created_at)",
        )
        .eq("coach_id", user!.id)
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.profiles) return null;
      const profile = data.profiles as unknown as Omit<ClientProfileDetail, "joined_at">;
      return { ...profile, joined_at: data.joined_at };
    },
  });
}

export type NewAthleteInput = {
  fullName: string;
  email: string;
  age?: number;
  sex?: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
};

/** Coach-only: creates a real auth account + profile for an athlete (with the default temporary
 *  password — the coach never sets it) and links them to the coach, via a server function so the
 *  service-role key never reaches the browser. */
export function useCreateAthlete() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewAthleteInput) => {
      if (!session) throw new Error("SESSION_EXPIRED");
      return createAthleteAccount({
        data: {
          accessToken: session.access_token,
          fullName: input.fullName,
          email: input.email,
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
