import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";

export function useUpdateProfile() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<Profile, "full_name" | "bio" | "phone" | "goal" | "timezone" | "avatar_url">
      >,
    ) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
    },
  });
}

export function useUpdateNotificationPrefs() {
  const { user, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (prefs: Record<string, boolean>) => {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_prefs: prefs })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => refreshProfile(),
  });
}

export function useUpdateDailyReportSettings() {
  const { user, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (settings: { enabled?: boolean; time?: string; push?: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_report_settings: settings })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => refreshProfile(),
  });
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const path = `${userId}/avatar.${file.name.split(".").pop()}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
