import { afterEach, describe, expect, it } from "vitest";
import { decryptProviderCredential, encryptProviderCredential } from "./aiCredentials";

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe("AI provider credential encryption", () => {
  it("encrypts a Gemini key without retaining plaintext and restores it only server-side", () => {
    process.env.JWT_SECRET = "test-server-root-secret";
    const apiKey = "AIzaSyDUMMY_PERSONAL_KEY_123456789";
    const encrypted = encryptProviderCredential(apiKey);

    expect(encrypted).not.toContain(apiKey);
    expect(encrypted).not.toBe(apiKey);
    expect(decryptProviderCredential(encrypted)).toBe(apiKey);
  });

  it("rejects a modified encrypted credential", () => {
    process.env.JWT_SECRET = "test-server-root-secret";
    const encrypted = encryptProviderCredential("AIzaSyDUMMY_PERSONAL_KEY_123456789");
    const packed = Buffer.from(encrypted, "base64url");
    packed[packed.length - 1] ^= 0x01;
    const tampered = packed.toString("base64url");

    expect(() => decryptProviderCredential(tampered)).toThrow();
  });
});
