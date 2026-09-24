import { createHash, randomBytes } from "node:crypto";

const ZOOM_OAUTH = "https://zoom.us/oauth";
const ZOOM_API = "https://api.zoom.us/v2";

export type ZoomErrorCode =
  | "ZOOM_NOT_CONFIGURED"
  | "ZOOM_NOT_CONNECTED"
  | "ZOOM_REVOKED"
  | "ZOOM_RATE_LIMITED"
  | "ZOOM_NOT_FOUND"
  | "ZOOM_REQUEST_FAILED";

/** message is always the stable code, so it survives server-function serialization and the UI
 *  can translate it. Never carries tokens or response bodies. */
export class ZoomError extends Error {
  constructor(
    readonly code: ZoomErrorCode,
    readonly status?: number,
  ) {
    super(code);
    this.name = "ZoomError";
  }
}

export type ZoomConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webhookSecret: string;
  encryptionKey: string;
};

export function zoomConfig(): ZoomConfig {
  const env = process.env;
  const config = {
    clientId: env["ZOOM_CLIENT_ID"] ?? "",
    clientSecret: env["ZOOM_CLIENT_SECRET"] ?? "",
    redirectUri: env["ZOOM_REDIRECT_URI"] ?? "",
    webhookSecret: env["ZOOM_WEBHOOK_SECRET_TOKEN"] ?? "",
    encryptionKey: env["ZOOM_TOKEN_ENCRYPTION_KEY"] ?? "",
  };
  if (Object.values(config).some((v) => !v)) throw new ZoomError("ZOOM_NOT_CONFIGURED");
  return config;
}

export type ZoomTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

export type ZoomUser = { id: string; email?: string; account_id?: string };

export type ZoomMeeting = {
  id: number | string;
  join_url: string;
  start_url?: string;
  password?: string;
};

export type MeetingInput = {
  topic: string;
  startTime: string;
  durationMinutes: number;
  timezone?: string | undefined;
  agenda?: string | null | undefined;
};

// ---------- PKCE / state ----------

export function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authorizeUrl(config: ZoomConfig, state: string, codeChallenge: string): string {
  const url = new URL(`${ZOOM_OAUTH}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ---------- OAuth token endpoint ----------

function basicAuth(config: ZoomConfig) {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

async function tokenRequest(
  config: ZoomConfig,
  params: Record<string, string>,
): Promise<ZoomTokens> {
  const res = await fetch(`${ZOOM_OAUTH}/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  if (res.status === 429) throw new ZoomError("ZOOM_RATE_LIMITED", 429);
  // 400/401 from the token endpoint means the code or refresh token is no longer valid
  // (expired, already used, or the user removed the app).
  if (res.status === 400 || res.status === 401) throw new ZoomError("ZOOM_REVOKED", res.status);
  if (!res.ok) throw new ZoomError("ZOOM_REQUEST_FAILED", res.status);
  const body = (await res.json()) as Partial<ZoomTokens>;
  if (!body.access_token || !body.refresh_token || !body.expires_in) {
    throw new ZoomError("ZOOM_REQUEST_FAILED", res.status);
  }
  return body as ZoomTokens;
}

export function exchangeCode(config: ZoomConfig, code: string, codeVerifier: string) {
  return tokenRequest(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
}

export function refreshTokens(config: ZoomConfig, refreshToken: string) {
  return tokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Best effort: the connection is removed on our side regardless. */
export async function revokeToken(config: ZoomConfig, token: string): Promise<void> {
  try {
    await fetch(`${ZOOM_OAUTH}/revoke`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Network failure: the token still expires within the hour.
  }
}

// ---------- REST API ----------

async function zoomApi<T>(
  accessToken: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T | null> {
  const res = await fetch(`${ZOOM_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return null;
  if (res.ok) return (await res.json()) as T;
  if (res.status === 401) throw new ZoomError("ZOOM_REVOKED", 401);
  if (res.status === 404) throw new ZoomError("ZOOM_NOT_FOUND", 404);
  if (res.status === 429) throw new ZoomError("ZOOM_RATE_LIMITED", 429);
  // Zoom returns 400 with code 3001 ("Meeting does not exist") for some deleted meetings.
  const detail = (await res.json().catch(() => null)) as { code?: number } | null;
  if (detail?.code === 3001) throw new ZoomError("ZOOM_NOT_FOUND", res.status);
  console.error(
    `Zoom API ${method} ${path.split("/")[1]} failed: ${res.status} code=${detail?.code}`,
  );
  throw new ZoomError("ZOOM_REQUEST_FAILED", res.status);
}

/** Zoom wants "yyyy-MM-ddTHH:mm:ssZ" (no milliseconds) for UTC start times. */
export function zoomStartTime(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function meetingBody(input: MeetingInput) {
  return {
    topic: input.topic.slice(0, 200),
    type: 2,
    start_time: zoomStartTime(input.startTime),
    duration: input.durationMinutes,
    ...(input.timezone ? { timezone: input.timezone } : {}),
    agenda: (input.agenda ?? "").slice(0, 2000),
  };
}

export async function getMe(accessToken: string): Promise<ZoomUser> {
  const me = await zoomApi<ZoomUser>(accessToken, "GET", "/users/me");
  if (!me?.id) throw new ZoomError("ZOOM_REQUEST_FAILED");
  return me;
}

export async function createMeeting(
  accessToken: string,
  input: MeetingInput,
): Promise<ZoomMeeting> {
  const meeting = await zoomApi<ZoomMeeting>(
    accessToken,
    "POST",
    "/users/me/meetings",
    meetingBody(input),
  );
  if (!meeting?.id || !meeting.join_url) throw new ZoomError("ZOOM_REQUEST_FAILED");
  return meeting;
}

export async function updateMeeting(accessToken: string, meetingId: string, input: MeetingInput) {
  await zoomApi(
    accessToken,
    "PATCH",
    `/meetings/${encodeURIComponent(meetingId)}`,
    meetingBody(input),
  );
}

export async function deleteMeeting(accessToken: string, meetingId: string) {
  await zoomApi(accessToken, "DELETE", `/meetings/${encodeURIComponent(meetingId)}`);
}

export async function getMeeting(accessToken: string, meetingId: string): Promise<ZoomMeeting> {
  const meeting = await zoomApi<ZoomMeeting>(
    accessToken,
    "GET",
    `/meetings/${encodeURIComponent(meetingId)}`,
  );
  if (!meeting) throw new ZoomError("ZOOM_NOT_FOUND");
  return meeting;
}
