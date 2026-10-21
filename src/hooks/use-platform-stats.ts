import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PlatformStats } from "@/lib/landing-stats";

/** Whole-platform totals for the public home page (aggregate counts only). */
export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_stats");
      if (error) throw error;
      const stats = data as Partial<PlatformStats> | null;
      if (!stats || typeof stats.athletes_coached !== "number") throw new Error("no_stats");
      return stats as PlatformStats;
    },
  });
}
