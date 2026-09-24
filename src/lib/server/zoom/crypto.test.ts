import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./crypto";
import { config } from "./test-helpers";

const key = config.encryptionKey;

describe("token encryption", () => {
  it("round-trips", () => {
    expect(decryptToken(encryptToken("secret-access-token", key), key)).toBe("secret-access-token");
  });

  it("never stores the plaintext and uses a fresh IV each time", () => {
    const a = encryptToken("secret-access-token", key);
    const b = encryptToken("secret-access-token", key);
    expect(a).not.toContain("secret-access-token");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext", () => {
    const [v, iv, tag, data] = encryptToken("secret-access-token", key).split(".");
    const flipped = Buffer.from(data!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() =>
      decryptToken([v, iv, tag, flipped.toString("base64url")].join("."), key),
    ).toThrow();
  });

  it("rejects the wrong key", () => {
    const other = Buffer.alloc(32, 9).toString("base64");
    expect(() => decryptToken(encryptToken("x", key), other)).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => encryptToken("x", Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
