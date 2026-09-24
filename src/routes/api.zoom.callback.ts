import { createFileRoute } from "@tanstack/react-router";
import { adminClient } from "@/lib/server/supabase";
import { ZoomError, exchangeCode, getMe, zoomConfig } from "@/lib/server/zoom/api";
import { saveConnection, supabaseConnectionStore } from "@/lib/server/zoom/tokens";

/** How long a Connect Zoom attempt stays valid. */
const STATE_TTL_MS = 10 * 60_000;

function backToSettings(redirectUri: string, result: string) {
  // Build from the configured redirect URI's origin, never from request headers.
  const url = new URL("/coach/settings", redirectUri);
  url.searchParams.set("tab", "integrations");
  url.searchParams.set("zoom", result);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export const Route = createFileRoute("/api/zoom/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let config;
        try {
          config = zoomConfig();
        } catch {
          return new Response("Zoom is not configured on this server.", { status: 500 });
        }

        const params = new URL(request.url).searchParams;
        const code = params.get("code");
        const state = params.get("state");
        if (params.get("error")) return backToSettings(config.redirectUri, "denied");
        // Installed from Zoom's side (Marketplace / "Add app"): there is no state to tell us which
        // iCoach coach this is, and accepting it would let anyone attach their Zoom account to
        // whoever opens the link (OAuth CSRF). The coach finishes with Connect Zoom in iCoach.
        if (code && !state) return backToSettings(config.redirectUri, "install");
        if (!code || !state) return backToSettings(config.redirectUri, "error");

        const admin = adminClient();
        // Consume the state: single use, so a replayed callback URL does nothing.
        const { data: rows, error } = await admin
          .from("zoom_oauth_states")
          .delete()
          .eq("state", state)
          .select("coach_id, code_verifier, created_at");
        const pending = rows?.[0];
        if (error || !pending) return backToSettings(config.redirectUri, "error");
        if (Date.now() - new Date(pending.created_at as string).getTime() > STATE_TTL_MS) {
          return backToSettings(config.redirectUri, "expired");
        }

        try {
          const tokens = await exchangeCode(config, code, pending.code_verifier as string);
          const me = await getMe(tokens.access_token);
          await saveConnection(
            supabaseConnectionStore(admin),
            config,
            pending.coach_id as string,
            tokens,
            me,
          );
        } catch (err) {
          console.error(
            "Zoom connect failed:",
            err instanceof ZoomError ? `${err.code} ${err.status ?? ""}` : "storage error",
          );
          return backToSettings(config.redirectUri, "error");
        } finally {
          // Housekeeping: abandoned attempts.
          await admin
            .from("zoom_oauth_states")
            .delete()
            .lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
        }

        return backToSettings(config.redirectUri, "connected");
      },
    },
  },
});
