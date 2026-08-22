import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CREDENTIAL_CONTEXT = "studyos:ai-provider-credential:v1";

function encryptionKey() {
  const rootSecret = process.env.JWT_SECRET;
  if (!rootSecret) throw new Error("Credential encryption is unavailable because the server secret is missing.");
  return createHash("sha256").update(`${CREDENTIAL_CONTEXT}\0${rootSecret}`).digest();
}

/** Stores an authenticated user's API key with AES-256-GCM authentication. */
export function encryptProviderCredential(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/** Decrypts credentials only immediately before an outbound provider request. */
export function decryptProviderCredential(encryptedCredential: string) {
  const packed = Buffer.from(encryptedCredential, "base64url");
  if (packed.length <= 28) throw new Error("Stored provider credential is malformed.");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function apiKeySuffix(apiKey: string) {
  return apiKey.slice(-4);
}
