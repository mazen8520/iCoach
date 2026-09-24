import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminClient, requireCoach } from "./server/supabase";
import {
  ZoomError,
  authorizeUrl,
  createMeeting,
  deleteMeeting,
  getMeeting,
  pkceChallenge,
  randomUrlToken,
  revokeToken,
  updateMeeting,
  zoomConfig,
  type MeetingInput,
} from "./server/zoom/api";
import { getValidAccessToken, supabaseConnectionStore, withZoomToken } from "./server/zoom/tokens";
import type { MeetingRow } from "./database.types";

function validator<T extends z.ZodTypeAny>(schema: T) {
  return (data: unknown): z.infer<T> => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new Error("INVALID_INPUT");
    return parsed.data;
  };
}

const auth = z.object({ accessToken: z.string().min(1) });

const meetingFields = z.object({
  title: z.string().trim().min(1).max(200),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  notes: z.string().trim().max(2000).nullable().optional(),
  timezone: z.string().max(64).optional(),
});

function zoomInput(fields: z.infer<typeof meetingFields>): MeetingInput {
  return {
    topic: fields.title,
    startTime: fields.scheduledAt,
    durationMinutes: fields.durationMinutes,
    timezone: fields.timezone,
    agenda: fields.notes,
  };
}

function zoomContext() {
  const config = zoomConfig();
  const store = supabaseConnectionStore(adminClient());
  return {
    config,
    store,
    run: <T>(coachId: string, call: (token: string) => Promise<T>) =>
      withZoomToken(store, config, coachId, call),
  };
}

/** The coach's own meeting, read through RLS (so another coach's meeting is simply not found). */
async function ownMeeting(
  db: Awaited<ReturnType<typeof requireCoach>>["db"],
  coachId: string,
  meetingId: string,
): Promise<MeetingRow> {
  const { data, error } = await db
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("MEETING_NOT_FOUND");
  return data as MeetingRow;
}

// ============================================================
// Connection
// ============================================================

export const getZoomStatus = createServerFn({ method: "POST" })
  .validator(validator(auth))
  .handler(async ({ data }) => {
    const { coachId } = await requireCoach(data.accessToken);
    let configured = true;
    try {
      zoomConfig();
    } catch {
      configured = false;
    }
    const { data: row, error } = await adminClient()
      .from("zoom_connections")
      .select("zoom_email, created_at")
      .eq("coach_id", coachId)
      .maybeSingle();
    if (error) throw error;
    return {
      configured,
      connected: !!row,
      email: (row?.zoom_email as string | null) ?? null,
      connectedAt: (row?.created_at as string | null) ?? null,
    };
  });

/** Returns the Zoom authorize URL; the browser navigates to it. The one-time state row ties the
 *  callback to this coach (CSRF protection) and carries the PKCE verifier. */
export const startZoomConnect = createServerFn({ method: "POST" })
  .validator(validator(auth))
  .handler(async ({ data }) => {
    const { coachId } = await requireCoach(data.accessToken);
    const config = zoomConfig();
    const state = randomUrlToken();
    const codeVerifier = randomUrlToken(48);
    const { error } = await adminClient()
      .from("zoom_oauth_states")
      .insert({ state, coach_id: coachId, code_verifier: codeVerifier });
    if (error) throw error;
    return { url: authorizeUrl(config, state, pkceChallenge(codeVerifier)) };
  });

export const disconnectZoom = createServerFn({ method: "POST" })
  .validator(validator(auth))
  .handler(async ({ data }) => {
    const { coachId } = await requireCoach(data.accessToken);
    const { config, store } = zoomContext();
    if (await store.get(coachId)) {
      // Zoom's revoke endpoint takes an access token, so get a current one (refreshing if it has
      // expired). If that fails the grant is already gone on Zoom's side.
      const accessToken = await getValidAccessToken(store, config, coachId).catch(() => null);
      const revoked = accessToken ? await revokeToken(config, accessToken) : false;
      console.log(`Zoom disconnect: revoke ${revoked ? "succeeded" : "not confirmed"}`);
      await store.remove(coachId);
    }
    return { disconnected: true };
  });

// ============================================================
// Meetings
// ============================================================

export const scheduleZoomMeeting = createServerFn({ method: "POST" })
  .validator(validator(auth.merge(meetingFields).extend({ clientId: z.string().uuid() })))
  .handler(async ({ data }) => {
    const { coachId, db } = await requireCoach(data.accessToken);

    const { data: link } = await db
      .from("coach_clients")
      .select("client_id")
      .eq("coach_id", coachId)
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!link) throw new Error("NOT_YOUR_CLIENT");

    const zoom = zoomContext();
    const created = await zoom.run(coachId, (token) => createMeeting(token, zoomInput(data)));

    const { data: row, error } = await db
      .from("meetings")
      .insert({
        coach_id: coachId,
        client_id: data.clientId,
        title: data.title,
        notes: data.notes || null,
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes,
        video_url: created.join_url,
        zoom_meeting_id: String(created.id),
        zoom_passcode: created.password ?? null,
      })
      .select("id")
      .single();
    if (error) {
      // Don't leave an orphan meeting in the coach's Zoom account.
      await zoom
        .run(coachId, (token) => deleteMeeting(token, String(created.id)))
        .catch(() => undefined);
      throw error;
    }
    return { id: row.id as string };
  });

export const updateZoomMeeting = createServerFn({ method: "POST" })
  .validator(validator(auth.merge(meetingFields).extend({ meetingId: z.string().uuid() })))
  .handler(async ({ data }) => {
    const { coachId, db } = await requireCoach(data.accessToken);
    const meeting = await ownMeeting(db, coachId, data.meetingId);
    if (meeting.status !== "scheduled") throw new Error("MEETING_NOT_EDITABLE");

    const patch: Partial<MeetingRow> = {
      title: data.title,
      notes: data.notes || null,
      scheduled_at: data.scheduledAt,
      duration_minutes: data.durationMinutes,
    };

    if (meeting.zoom_meeting_id) {
      const zoom = zoomContext();
      try {
        await zoom.run(coachId, (token) =>
          updateMeeting(token, meeting.zoom_meeting_id!, zoomInput(data)),
        );
      } catch (err) {
        if (!(err instanceof ZoomError) || err.code !== "ZOOM_NOT_FOUND") throw err;
        // Deleted on Zoom's side: give the session a new Zoom meeting.
        const created = await zoom.run(coachId, (token) => createMeeting(token, zoomInput(data)));
        patch.video_url = created.join_url;
        patch.zoom_meeting_id = String(created.id);
        patch.zoom_passcode = created.password ?? null;
      }
    }

    const { error } = await db.from("meetings").update(patch).eq("id", meeting.id);
    if (error) throw error;
    return { id: meeting.id };
  });

/** Cancels the session and deletes its Zoom meeting. If Zoom can't be reached because the coach
 *  disconnected, the session is still cancelled and zoomSynced is false. */
export const cancelZoomMeeting = createServerFn({ method: "POST" })
  .validator(validator(auth.extend({ meetingId: z.string().uuid() })))
  .handler(async ({ data }) => {
    const { coachId, db } = await requireCoach(data.accessToken);
    const meeting = await ownMeeting(db, coachId, data.meetingId);

    let zoomSynced = true;
    if (meeting.zoom_meeting_id) {
      try {
        await zoomContext().run(coachId, (token) => deleteMeeting(token, meeting.zoom_meeting_id!));
      } catch (err) {
        if (!(err instanceof ZoomError)) throw err;
        if (err.code === "ZOOM_NOT_CONNECTED" || err.code === "ZOOM_REVOKED") zoomSynced = false;
        else if (err.code !== "ZOOM_NOT_FOUND") throw err;
      }
    }

    const { error } = await db
      .from("meetings")
      .update({
        status: "cancelled",
        video_url: null,
        zoom_meeting_id: null,
        zoom_passcode: null,
      })
      .eq("id", meeting.id);
    if (error) throw error;
    return { zoomSynced };
  });

/** A fresh host start link. Never stored: it embeds a host token and expires in about 2 hours. */
export const getZoomStartUrl = createServerFn({ method: "POST" })
  .validator(validator(auth.extend({ meetingId: z.string().uuid() })))
  .handler(async ({ data }) => {
    const { coachId, db } = await requireCoach(data.accessToken);
    const meeting = await ownMeeting(db, coachId, data.meetingId);
    if (!meeting.zoom_meeting_id) throw new Error("MEETING_NOT_ON_ZOOM");
    const zoomMeeting = await zoomContext().run(coachId, (token) =>
      getMeeting(token, meeting.zoom_meeting_id!),
    );
    if (!zoomMeeting.start_url?.startsWith("https://")) throw new ZoomError("ZOOM_REQUEST_FAILED");
    return { url: zoomMeeting.start_url };
  });
