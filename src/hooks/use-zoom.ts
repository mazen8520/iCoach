import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { disconnectZoom, getZoomStatus, startZoomConnect } from "@/lib/zoom.functions";

export function useZoomStatus() {
  const { user, profile, session } = useAuth();
  return useQuery({
    queryKey: ["zoom-status", user?.id],
    enabled: !!session && profile?.role === "coach",
    queryFn: () => getZoomStatus({ data: { accessToken: session!.access_token } }),
    staleTime: 30_000,
  });
}

/** Sends the browser to Zoom's consent page; Zoom redirects back to /api/zoom/callback. */
export function useConnectZoom() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("SESSION_EXPIRED");
      const { url } = await startZoomConnect({ data: { accessToken: session.access_token } });
      window.location.assign(url);
    },
  });
}

export function useDisconnectZoom() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("SESSION_EXPIRED");
      return disconnectZoom({ data: { accessToken: session.access_token } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["zoom-status"] }),
  });
}
