import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { MeetingRow, MeetingStatus } from "@/lib/database.types";
import {
  cancelZoomMeeting,
  getZoomStartUrl,
  scheduleZoomMeeting,
  updateZoomMeeting,
} from "@/lib/zoom.functions";

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

export type MeetingFormInput = {
  title: string;
  /** ISO timestamp. */
  scheduledAt: string;
  durationMinutes: number;
  notes: string | null;
};

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function useAccessToken() {
  const { session } = useAuth();
  return () => {
    if (!session) throw new Error("SESSION_EXPIRED");
    return session.access_token;
  };
}

/** Creates the session and its Zoom meeting (server-side, with the coach's Zoom account). */
export function useScheduleMeeting() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingFormInput & { clientId: string }) => {
      const timezone = browserTimeZone();
      return scheduleZoomMeeting({
        data: { accessToken: token(), ...input, ...(timezone ? { timezone } : {}) },
      });
    },
    onSuccess: () => invalidateMeetingQueries(queryClient),
  });
}

/** Reschedules/renames the session and its Zoom meeting. */
export function useEditMeeting() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingFormInput & { meetingId: string }) => {
      const timezone = browserTimeZone();
      return updateZoomMeeting({
        data: { accessToken: token(), ...input, ...(timezone ? { timezone } : {}) },
      });
    },
    onSuccess: () => invalidateMeetingQueries(queryClient),
  });
}

/** Cancels the session and deletes its Zoom meeting. */
export function useCancelMeeting() {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) =>
      cancelZoomMeeting({ data: { accessToken: token(), meetingId } }),
    onSuccess: () => invalidateMeetingQueries(queryClient),
  });
}

/**
 * Opens the host start link. The tab is opened synchronously on click (so popup blockers allow
 * it) and pointed at the link once the server has fetched a fresh one from Zoom.
 */
export function useStartMeeting() {
  const token = useAccessToken();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const tab = window.open("", "_blank");
      try {
        const { url } = await getZoomStartUrl({ data: { accessToken: token(), meetingId } });
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else {
          window.location.assign(url);
        }
      } catch (err) {
        tab?.close();
        throw err;
      }
    },
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
