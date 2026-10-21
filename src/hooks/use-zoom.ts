import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { disconnectZoom, getZoomStatus, startZoomConnect } from "@/lib/zoom.functions";
import { isNativeApp, openInAppBrowser } from "@/lib/native";

export function useZoomStatus() {
  const { user, profile, session } = useAuth();
  return useQuery({
    queryKey: ["zoom-status", user?.id],
    enabled: !!session && profile?.role === "coach",
    queryFn: () => getZoomStatus({ data: { accessToken: session!.access_token } }),
    staleTime: 30_000,
  });
}

/** Sends the browser to Zoom's consent page; Zoom redirects back to /api/zoom/callback.
 *  The mobile app opens it in the in-app browser instead (Zoom's Google/Apple sign-in refuses
 *  embedded web views), and the callback hands the result back through icoach://zoom. */
export function useConnectZoom() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("SESSION_EXPIRED");
      const app = isNativeApp();
      const { url } = await startZoomConnect({
        data: { accessToken: session.access_token, ...(app ? { returnTo: "app" as const } : {}) },
      });
      if (app) await openInAppBrowser(url);
      else window.location.assign(url);
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
