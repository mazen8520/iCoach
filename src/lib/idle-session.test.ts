import { describe, expect, it } from "vitest";
import { arrivedFromEmailLink, IDLE_LIMIT_MS, isIdleExpired } from "./idle-session";

describe("isIdleExpired", () => {
  const now = 1_800_000_000_000;

  it("keeps a recently active session", () => {
    expect(isIdleExpired(now - 60_000, now)).toBe(false);
    expect(isIdleExpired(now - IDLE_LIMIT_MS + 1, now)).toBe(false);
  });

  it("ends a session idle for the full limit", () => {
    expect(isIdleExpired(now - IDLE_LIMIT_MS, now)).toBe(true);
    expect(isIdleExpired(now - 3 * 24 * 60 * 60 * 1000, now)).toBe(true);
  });

  it("treats a session with no recorded activity as idle", () => {
    expect(isIdleExpired(null, now)).toBe(true);
    expect(isIdleExpired(Number.NaN, now)).toBe(true);
  });
});

describe("arrivedFromEmailLink", () => {
  it("spots the tokens Supabase puts in confirmation and reset links", () => {
    expect(arrivedFromEmailLink({ search: "", hash: "#access_token=abc&type=signup" })).toBe(true);
    expect(arrivedFromEmailLink({ search: "?code=abc", hash: "" })).toBe(true);
    expect(arrivedFromEmailLink({ search: "?as=coach", hash: "" })).toBe(false);
  });
});
