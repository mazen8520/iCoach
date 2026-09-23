import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { MeetingRow, MeetingStatus } from "@/lib/database.types";

export type MeetingWithOther = MeetingRow & {
  other: { id: string; full_name: string; avatar_url: string | null } | null;
};

export function useMeetings() {
  const { user, profile } = useAuth();
  return useQuery({
    queryKey: ["meetings", user?.id, profile?.role],
    enabled: !!user && !!profile,
    queryFn: async (): Promise<MeetingWithOther[]> => {
      const column = profile?.role === "coach" ? "coach_id" : "client_id";
      const other = profile?.role === "coach" ? "client_id" : "coach_id";
      const { data, error } = await supabase
        .from("meetings")
        .select(`*, other:${other}(id, full_name, avatar_url)`)
        .eq(column, user!.id)
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as MeetingWithOther[];
    },
  });
}

function invalidateMeetingQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["meetings"] });
  queryClient.invalidateQueries({ queryKey: ["upcoming-meetings"] });
  queryClient.invalidateQueries({ queryKey: ["client-meetings"] });
  queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
}

export function useScheduleMeeting() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      title: string;
      scheduled_at: string;
      duration_minutes?: number;
      notes?: string | null;
      /** The Zoom meeting link. */
      video_url?: string | null;
    }) => {
      const { error } = await supabase.from("meetings").insert({ ...input, coach_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => invalidateMeetingQueries(queryClient),
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      status?: MeetingStatus;
      video_url?: string | null;
      notes?: string | null;
    }) => {
      const { error } = await supabase.from("meetings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMeetingQueries(queryClient),
  });
}
