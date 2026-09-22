import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export function useMeetings() {
  const { user, profile } = useAuth();
  return useQuery({
    queryKey: ["meetings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const column = profile?.role === "coach" ? "coach_id" : "client_id";
      const other = profile?.role === "coach" ? "client_id" : "coach_id";
      const { data, error } = await supabase
        .from("meetings")
        .select(`*, other:${other}(id, full_name, avatar_url)`)
        .eq(column, user!.id)
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });
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
      notes?: string;
      video_url?: string;
    }) => {
      const { error } = await supabase.from("meetings").insert({ ...input, coach_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useUpdateMeetingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "scheduled" | "completed" | "cancelled";
    }) => {
      const { error } = await supabase.from("meetings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  });
}
