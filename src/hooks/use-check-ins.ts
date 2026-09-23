import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isoDate, startOfWeek } from "@/lib/format";
import type { PhotoAngle, SleepQuality } from "@/lib/database.types";

export function useCoachCheckIns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["check-ins-coach", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("*, profiles:client_id(id, full_name, avatar_url)")
        .eq("coach_id", user!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useClientCheckIns(clientId?: string) {
  const { user } = useAuth();
  const id = clientId ?? user?.id;
  return useQuery({
    queryKey: ["check-ins-client", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .eq("client_id", id!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitCheckIn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      coach_id: string;
      weight_kg?: number | undefined;
      energy?: number | undefined;
      sleep_hours?: number | undefined;
      sleep_quality?: SleepQuality | undefined;
      mood?: string | undefined;
      training_feedback?: string | undefined;
    }) => {
      const { data, error } = await supabase
        .from("check_ins")
        .insert({
          ...input,
          client_id: user!.id,
          week_start_date: isoDate(startOfWeek()),
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-ins-client"] });
      queryClient.invalidateQueries({ queryKey: ["check-in-this-week"] });
    },
  });
}

export function useUploadCheckInPhotos() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      checkInId,
      files,
    }: {
      checkInId: string;
      files: { file: File; angle: PhotoAngle }[];
    }) => {
      for (const { file, angle } of files) {
        const path = `${user!.id}/${checkInId}-${angle}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("check-in-photos")
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { error } = await supabase.from("check_in_photos").insert({
          check_in_id: checkInId,
          angle,
          storage_path: path,
        });
        if (error) throw error;
      }
    },
  });
}

export function useReviewCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      const { error } = await supabase
        .from("check_ins")
        .update({
          status: "reviewed",
          coach_feedback: feedback,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-ins-coach"] });
      queryClient.invalidateQueries({ queryKey: ["check-ins-client"] });
      queryClient.invalidateQueries({ queryKey: ["pending-check-ins-count"] });
    },
  });
}
