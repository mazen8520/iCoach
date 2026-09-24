import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZoomWebhookEvent } from "./webhook";

/**
 * Applies a verified Zoom webhook event. Meeting events only touch meetings whose Zoom id matches
 * AND whose coach is connected as the event's host, so one Zoom account's events can never
 * change another coach's meetings.
 */
export async function handleZoomEvent(admin: SupabaseClient, event: ZoomWebhookEvent) {
  const payload = event.payload ?? {};

  if (event.event === "app_deauthorized") {
    if (!payload.user_id) return;
    const { error } = await admin
      .from("zoom_connections")
      .delete()
      .eq("zoom_user_id", payload.user_id);
    if (error) throw error;
    return;
  }

  let patch: Record<string, unknown>;
  let onlyScheduled = false;
  switch (event.event) {
    case "meeting.started":
      patch = { zoom_started_at: new Date().toISOString() };
      break;
    case "meeting.ended":
      // A cancelled meeting stays cancelled.
      patch = { zoom_ended_at: new Date().toISOString(), status: "completed" };
      onlyScheduled = true;
      break;
    case "meeting.deleted":
      patch = { video_url: null, zoom_meeting_id: null, zoom_passcode: null };
      break;
    default:
      return;
  }

  const object = payload.object;
  if (!object?.id || !object.host_id) return;
  const { data: hosts, error: hostError } = await admin
    .from("zoom_connections")
    .select("coach_id")
    .eq("zoom_user_id", object.host_id);
  if (hostError) throw hostError;
  const coachIds = (hosts ?? []).map((r) => r.coach_id as string);
  if (coachIds.length === 0) return;

  let query = admin
    .from("meetings")
    .update(patch)
    .eq("zoom_meeting_id", String(object.id))
    .in("coach_id", coachIds);
  if (onlyScheduled) query = query.eq("status", "scheduled");
  const { error } = await query;
  if (error) throw error;
}
