import { vi } from "vitest";
import type { ZoomConfig } from "./api";

export const config: ZoomConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:8080/api/zoom/callback",
  webhookSecret: "webhook-secret",
  encryptionKey: Buffer.alloc(32, 7).toString("base64"),
};

export type FetchCall = { url: string; init: RequestInit };

/** Replaces global fetch with a queue of canned responses and records every request. */
export function mockFetch(...responses: Response[]) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected fetch: ${String(url)}`);
    return next;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function noContent() {
  return new Response(null, { status: 204 });
}
