import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, MIN_PASSWORD_LENGTH, mustChangePassword } from "./account";

describe("generateTemporaryPassword", () => {
  it("returns three groups of four readable characters", () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(
      /^[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}$/,
    );
    expect(password.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
  });

  it("never repeats across accounts", () => {
    const seen = new Set(Array.from({ length: 500 }, generateTemporaryPassword));
    expect(seen.size).toBe(500);
  });

  it("never uses lookalike characters", () => {
    const all = Array.from({ length: 200 }, generateTemporaryPassword).join("");
    expect(all).not.toMatch(/[0O1lIio]/);
  });
});

describe("mustChangePassword", () => {
  it("reads the flag from app_metadata or legacy user_metadata", () => {
    expect(mustChangePassword(null)).toBe(false);
    expect(
      mustChangePassword({ app_metadata: { must_change_password: true }, user_metadata: {} }),
    ).toBe(true);
    expect(
      mustChangePassword({ app_metadata: {}, user_metadata: { must_change_password: true } }),
    ).toBe(true);
    expect(mustChangePassword({ app_metadata: {}, user_metadata: {} })).toBe(false);
  });
});
