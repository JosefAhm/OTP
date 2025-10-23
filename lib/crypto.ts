import { createCipheriv, randomBytes } from "crypto";

export type EncryptionResult = {
  ciphertext: string;
  iv: string;
  authTag: string;
  key: string;
  id: string;
};

function toBase64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateSecretId() {
  return randomBytes(16).toString("hex");
}

export function createEncryptedPayload(message: string): EncryptionResult {
  const id = generateSecretId();
  const keyBytes = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes, iv);
  const ciphertext = Buffer.concat([cipher.update(message, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    id,
    key: toBase64Url(keyBytes),
    iv: toBase64Url(iv),
    authTag: toBase64Url(authTag),
    ciphertext: toBase64Url(ciphertext)
  };
}

