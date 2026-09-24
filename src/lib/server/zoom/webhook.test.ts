import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { handleZoomEvent } from "./events";
import { urlValidationResponse, verifyZoomWebhook, zoomSignature } from "./webhook";

const secret = "webhook-secret";
const NOW = Date.parse("2026-09-23T12:00:00Z");
const ts = String(NOW / 1000);
const body = JSON.stringify({ event: "meeting.started", payload: { object: { id: 1 } } });

/** Zoom's documented formula, written out independently of the implementation. */
function zoomSigns(message: string) {
  return `v0=${createHmac("sha256", secret).update(message).digest("hex")}`;
}

describe("webhook signature", () => {
  const signature = zoomSigns(`v0:${ts}:${body}`);
  const base = { secret, timestamp: ts, signature, rawBody: body, now: NOW };

  it("matches Zoom's v0 signature format", () => {
    expect(zoomSignature(secret, ts, body)).toBe(signature);
  });

  it("accepts a genuine request", () => {
    expect(verifyZoomWebhook(base)).toBe(true);
  });

  it("rejects a modified body", () => {
    expect(verifyZoomWebhook({ ...base, rawBody: body.replace("1", "2") })).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyZoomWebhook({ ...base, secret: "other" })).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(verifyZoomWebhook({ ...base, signature: null })).toBe(false);
    expect(verifyZoomWebhook({ ...base, timestamp: null })).toBe(false);
  });

  it("rejects old requests (replay)", () => {
    const old = String(NOW / 1000 - 10 * 60);
    expect(
      verifyZoomWebhook({ ...base, timestamp: old, signature: zoomSigns(`v0:${old}:${body}`) }),
    ).toBe(false);
  });

  it("answers the endpoint URL validation challenge", () => {
    expect(urlValidationResponse(secret, "plain-123")).toEqual({
      plainToken: "plain-123",
      encryptedToken: createHmac("sha256", secret).update("plain-123").digest("hex"),
    });
  });
});

// ---------- event handling ----------

type Call = { table: string; ops: [string, ...unknown[]][] };

/** Records Supabase query-builder chains; each chain resolves to `results[table]`. */
function fakeAdmin(results: Record<string, { data?: unknown; error?: unknown }> = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const builder: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            const result = { data: null, error: null, ...results[table] };
            return (resolve: (value: unknown) => void) => resolve(result);
          }
          return (...args: unknown[]) => {
            call.ops.push([String(prop), ...args]);
            return builder;
          };
        },
      },
    );
    return builder;
  };
  return { admin: { from } as unknown as SupabaseClient, calls };
}

const hostedBy = (coachIds: string[]) => ({
  zoom_connections: { data: coachIds.map((coach_id) => ({ coach_id })) },
});

describe("webhook events", () => {
  it("meeting.started marks the host's meeting as started", async () => {
    const { admin, calls } = fakeAdmin(hostedBy(["coach-1"]));
    await handleZoomEvent(admin, {
      event: "meeting.started",
      payload: { object: { id: 555, host_id: "zoom-host" } },
    });
    expect(calls[0]!.ops).toContainEqual(["eq", "zoom_user_id", "zoom-host"]);
    const update = calls[1]!;
    expect(update.table).toBe("meetings");
    expect(update.ops[0]![0]).toBe("update");
    expect(update.ops[0]![1]).toHaveProperty("zoom_started_at");
    expect(update.ops).toContainEqual(["eq", "zoom_meeting_id", "555"]);
    expect(update.ops).toContainEqual(["in", "coach_id", ["coach-1"]]);
  });

  it("meeting.ended completes only still-scheduled meetings", async () => {
    const { admin, calls } = fakeAdmin(hostedBy(["coach-1"]));
    await handleZoomEvent(admin, {
      event: "meeting.ended",
      payload: { object: { id: 555, host_id: "zoom-host" } },
    });
    const update = calls[1]!;
    expect(update.ops[0]![1]).toMatchObject({ status: "completed" });
    expect(update.ops).toContainEqual(["eq", "status", "scheduled"]);
  });

  it("meeting.deleted clears the links", async () => {
    const { admin, calls } = fakeAdmin(hostedBy(["coach-1"]));
    await handleZoomEvent(admin, {
      event: "meeting.deleted",
      payload: { object: { id: 555, host_id: "zoom-host" } },
    });
    expect(calls[1]!.ops[0]).toEqual([
      "update",
      { video_url: null, zoom_meeting_id: null, zoom_passcode: null },
    ]);
  });

  it("ignores meetings whose host is not a connected coach", async () => {
    const { admin, calls } = fakeAdmin(hostedBy([]));
    await handleZoomEvent(admin, {
      event: "meeting.ended",
      payload: { object: { id: 555, host_id: "stranger" } },
    });
    expect(calls.map((c) => c.table)).toEqual(["zoom_connections"]);
  });

  it("app_deauthorized deletes the stored tokens", async () => {
    const { admin, calls } = fakeAdmin();
    await handleZoomEvent(admin, {
      event: "app_deauthorized",
      payload: { user_id: "zoom-host", account_id: "acc" },
    });
    expect(calls).toEqual([
      { table: "zoom_connections", ops: [["delete"], ["eq", "zoom_user_id", "zoom-host"]] },
    ]);
  });

  it("ignores unrelated events", async () => {
    const { admin, calls } = fakeAdmin();
    await handleZoomEvent(admin, { event: "recording.completed" });
    expect(calls).toHaveLength(0);
  });
});
