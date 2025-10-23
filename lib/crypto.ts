import { randomBytes } from "crypto";

export function generateSecretId() {
  return randomBytes(16).toString("hex");
}
