import { createHmac, timingSafeEqual } from "node:crypto";

/** Requests older than this are rejected so a captured request can't be replayed later. */
const MAX_AGE_SECONDS = 5 * 60;

function hmacHex(secret: string, message: string) {
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function zoomSignature(secret: string, timestamp: string, rawBody: string): string {
  return `v0=${hmacHex(secret, `v0:${timestamp}:${rawBody}`)}`;
}

export function verifyZoomWebhook({
  secret,
  timestamp,
  signature,
  rawBody,
  now = Date.now(),
}: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  now?: number;
}): boolean {
  if (!secret || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  // Zoom sends seconds; accept milliseconds too.
  const sentMs = timestamp.length > 11 ? Number(timestamp) : Number(timestamp) * 1000;
  if (Math.abs(now - sentMs) > MAX_AGE_SECONDS * 1000) return false;
  const expected = Buffer.from(zoomSignature(secret, timestamp, rawBody));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Response to Zoom's endpoint.url_validation challenge. */
export function urlValidationResponse(secret: string, plainToken: string) {
  return { plainToken, encryptedToken: hmacHex(secret, plainToken) };
}

export type ZoomWebhookEvent = {
  event: string;
  event_ts?: number;
  payload?: {
    plainToken?: string;
    account_id?: string;
    /** app_deauthorized */
    user_id?: string;
    object?: { id?: number | string; uuid?: string; host_id?: string };
  };
};
