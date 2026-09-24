import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ZoomError,
  authorizeUrl,
  createMeeting,
  deleteMeeting,
  exchangeCode,
  getMeeting,
  pkceChallenge,
  refreshTokens,
  updateMeeting,
} from "./api";
import { config, json, mockFetch, noContent } from "./test-helpers";

afterEach(() => vi.unstubAllGlobals());

const input = {
  topic: "Progress review",
  startTime: "2026-10-01T09:30:00.000Z",
  durationMinutes: 45,
  timezone: "Africa/Cairo",
  agenda: "Check squat depth",
};

async function expectZoomError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ZoomError);
  await promise.catch((err: ZoomError) => expect(err.code).toBe(code));
}

describe("OAuth", () => {
  it("builds the authorize URL with state and an S256 PKCE challenge", () => {
    const url = new URL(authorizeUrl(config, "state-123", "challenge-abc"));
    expect(url.origin + url.pathname).toBe("https://zoom.us/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "client-id",
      redirect_uri: config.redirectUri,
      state: "state-123",
      code_challenge: "challenge-abc",
      code_challenge_method: "S256",
    });
  });

  it("computes the RFC 7636 PKCE challenge", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("exchanges the code with Basic auth, redirect URI and verifier", async () => {
    const calls = mockFetch(json({ access_token: "a", refresh_token: "r", expires_in: 3600 }));
    await exchangeCode(config, "the-code", "the-verifier");
    expect(calls[0]!.url).toBe("https://zoom.us/oauth/token");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(
      `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
    );
    expect(Object.fromEntries(calls[0]!.init.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "the-code",
      redirect_uri: config.redirectUri,
      code_verifier: "the-verifier",
    });
  });

  it("refreshes with the refresh_token grant", async () => {
    const calls = mockFetch(json({ access_token: "a2", refresh_token: "r2", expires_in: 3600 }));
    const tokens = await refreshTokens(config, "r1");
    expect(tokens.refresh_token).toBe("r2");
    expect(Object.fromEntries(calls[0]!.init.body as URLSearchParams)).toEqual({
      grant_type: "refresh_token",
      refresh_token: "r1",
    });
  });

  it("treats a rejected refresh token as revoked", async () => {
    mockFetch(json({ reason: "Invalid Token!", error: "invalid_grant" }, 400));
    await expectZoomError(refreshTokens(config, "r1"), "ZOOM_REVOKED");
  });

  it("reports token-endpoint rate limiting", async () => {
    mockFetch(json({}, 429));
    await expectZoomError(refreshTokens(config, "r1"), "ZOOM_RATE_LIMITED");
  });
});

describe("meetings", () => {
  it("creates a scheduled meeting (type 2) for the connected user", async () => {
    const calls = mockFetch(
      json({ id: 81234567890, join_url: "https://zoom.us/j/81234567890?pwd=x", password: "abc" }),
    );
    const meeting = await createMeeting("access-1", input);
    expect(meeting.id).toBe(81234567890);
    expect(calls[0]!.url).toBe("https://api.zoom.us/v2/users/me/meetings");
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer access-1",
    );
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      topic: "Progress review",
      type: 2,
      start_time: "2026-10-01T09:30:00Z",
      duration: 45,
      timezone: "Africa/Cairo",
      agenda: "Check squat depth",
    });
  });

  it("updates with PATCH (Zoom answers 204)", async () => {
    const calls = mockFetch(noContent());
    await updateMeeting("access-1", "81234567890", { ...input, durationMinutes: 60 });
    expect(calls[0]!.url).toBe("https://api.zoom.us/v2/meetings/81234567890");
    expect(calls[0]!.init.method).toBe("PATCH");
    expect(JSON.parse(calls[0]!.init.body as string).duration).toBe(60);
  });

  it("deletes with DELETE", async () => {
    const calls = mockFetch(noContent());
    await deleteMeeting("access-1", "81234567890");
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toBe("https://api.zoom.us/v2/meetings/81234567890");
  });

  it("maps a missing meeting to ZOOM_NOT_FOUND (404 or code 3001)", async () => {
    mockFetch(json({ code: 3001, message: "Meeting does not exist" }, 404));
    await expectZoomError(deleteMeeting("access-1", "1"), "ZOOM_NOT_FOUND");
    mockFetch(json({ code: 3001, message: "Meeting does not exist" }, 400));
    await expectZoomError(deleteMeeting("access-1", "1"), "ZOOM_NOT_FOUND");
  });

  it("maps 401 to ZOOM_REVOKED and 429 to ZOOM_RATE_LIMITED", async () => {
    mockFetch(json({ code: 124 }, 401));
    await expectZoomError(createMeeting("access-1", input), "ZOOM_REVOKED");
    mockFetch(json({ code: 429 }, 429));
    await expectZoomError(createMeeting("access-1", input), "ZOOM_RATE_LIMITED");
  });

  it("fetches the meeting (for a fresh start_url)", async () => {
    mockFetch(json({ id: 1, join_url: "https://zoom.us/j/1", start_url: "https://zoom.us/s/1" }));
    expect((await getMeeting("access-1", "1")).start_url).toBe("https://zoom.us/s/1");
  });
});
