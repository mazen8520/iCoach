import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZoomError } from "./api";
import { decryptToken } from "./crypto";
import {
  encryptTokens,
  getValidAccessToken,
  withZoomToken,
  type ConnectionStore,
  type StoredConnection,
} from "./tokens";
import { config, json, mockFetch } from "./test-helpers";

const NOW = Date.parse("2026-09-23T12:00:00Z");

beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function memoryStore(initial: StoredConnection | null) {
  let row = initial;
  const store: ConnectionStore = {
    get: async () => (row ? { ...row } : null),
    upsert: async (next) => {
      row = next;
    },
    replaceTokens: async (_coachId, previous, next) => {
      if (!row || row.refresh_token_enc !== previous) return false;
      row = { ...row, ...next };
      return true;
    },
    remove: async () => {
      row = null;
    },
  };
  return { store, current: () => row };
}

/** A stored connection whose access token expires `inMs` from NOW. */
function connection(access: string, refresh: string, inMs: number): StoredConnection {
  return {
    coach_id: "coach-1",
    zoom_user_id: "zoom-user-1",
    zoom_email: "coach@example.com",
    ...encryptTokens(
      config,
      { access_token: access, refresh_token: refresh, expires_in: inMs / 1000 },
      NOW,
    ),
  };
}

describe("getValidAccessToken", () => {
  it("returns the stored token while it is still valid, without calling Zoom", async () => {
    const calls = mockFetch();
    const { store } = memoryStore(connection("access-1", "refresh-1", 30 * 60_000));
    expect(await getValidAccessToken(store, config, "coach-1", { now: NOW })).toBe("access-1");
    expect(calls).toHaveLength(0);
  });

  it("refreshes an expired token and stores the rotated refresh token (encrypted)", async () => {
    const calls = mockFetch(
      json({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 }),
    );
    const { store, current } = memoryStore(connection("access-1", "refresh-1", -1000));
    expect(await getValidAccessToken(store, config, "coach-1", { now: NOW })).toBe("access-2");

    expect(Object.fromEntries(calls[0]!.init.body as URLSearchParams)).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
    });
    const row = current()!;
    expect(decryptToken(row.access_token_enc, config.encryptionKey)).toBe("access-2");
    expect(decryptToken(row.refresh_token_enc, config.encryptionKey)).toBe("refresh-2");
    expect(row.refresh_token_enc).not.toContain("refresh-2");
    expect(Date.parse(row.expires_at)).toBe(NOW + 3600_000);
  });

  it("refreshes a token that is about to expire (within a minute)", async () => {
    mockFetch(json({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 }));
    const { store } = memoryStore(connection("access-1", "refresh-1", 30_000));
    expect(await getValidAccessToken(store, config, "coach-1", { now: NOW })).toBe("access-2");
  });

  it("deletes the connection when Zoom rejects the refresh token (app removed)", async () => {
    mockFetch(json({ error: "invalid_grant" }, 400));
    const { store, current } = memoryStore(connection("access-1", "refresh-1", -1000));
    await expect(getValidAccessToken(store, config, "coach-1", { now: NOW })).rejects.toMatchObject(
      { code: "ZOOM_REVOKED" },
    );
    expect(current()).toBeNull();
  });

  it("uses the winner's tokens when a concurrent request refreshed first", async () => {
    mockFetch(
      json({ access_token: "access-mine", refresh_token: "refresh-mine", expires_in: 3600 }),
    );
    const { store, current } = memoryStore(connection("access-1", "refresh-1", -1000));
    const winner = connection("access-winner", "refresh-winner", 3600_000);
    const realGet = store.get;
    let first = true;
    store.get = async (id) => {
      const row = await realGet(id);
      // After our read, another request rotates the tokens.
      if (first) {
        first = false;
        await store.upsert({ ...winner, zoom_account_id: null, scope: null });
      }
      return row;
    };
    expect(await getValidAccessToken(store, config, "coach-1", { now: NOW })).toBe("access-winner");
    expect(decryptToken(current()!.refresh_token_enc, config.encryptionKey)).toBe("refresh-winner");
  });

  it("asks the coach to reconnect when the stored token no longer decrypts (key changed)", async () => {
    const calls = mockFetch();
    const { store, current } = memoryStore(connection("access-1", "refresh-1", 30 * 60_000));
    const rotatedKey = { ...config, encryptionKey: Buffer.alloc(32, 1).toString("base64") };
    await expect(getValidAccessToken(store, rotatedKey, "coach-1")).rejects.toMatchObject({
      code: "ZOOM_REVOKED",
    });
    expect(current()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("throws ZOOM_NOT_CONNECTED when the coach never connected", async () => {
    mockFetch();
    const { store } = memoryStore(null);
    await expect(getValidAccessToken(store, config, "coach-1")).rejects.toMatchObject({
      code: "ZOOM_NOT_CONNECTED",
    });
  });
});

describe("withZoomToken", () => {
  it("force-refreshes and retries once when Zoom answers 401", async () => {
    mockFetch(json({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 }));
    const { store } = memoryStore(connection("access-1", "refresh-1", 30 * 60_000));
    const call = vi.fn(async (token: string) => {
      if (token === "access-1") throw new ZoomError("ZOOM_REVOKED", 401);
      return `ok with ${token}`;
    });
    expect(await withZoomToken(store, config, "coach-1", call)).toBe("ok with access-2");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not retry other errors", async () => {
    const calls = mockFetch();
    const { store } = memoryStore(connection("access-1", "refresh-1", 30 * 60_000));
    const call = vi.fn(async () => {
      throw new ZoomError("ZOOM_RATE_LIMITED", 429);
    });
    await expect(withZoomToken(store, config, "coach-1", call)).rejects.toMatchObject({
      code: "ZOOM_RATE_LIMITED",
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });
});
