"use server";

import { createEncryptedPayload } from "@/lib/crypto";
import { getAdminClient } from "@/lib/supabase";

const MAX_CHARACTERS = 5000;
const EXPIRY_CHOICES: Record<string, number> = {
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60
};

export type CreateSecretState =
  | { status: "idle" }
  | { status: "success"; secret: { id: string; key: string; expiresAt: string } }
  | { status: "error"; error: string };

export async function createSecret(_: CreateSecretState, formData: FormData): Promise<CreateSecretState> {
  const message = (formData.get("message") as string | null)?.trim();
  const expiry = formData.get("expiry") as string | null;

  if (!message) {
    return { status: "error", error: "Enter a secret message to encrypt." };
  }

  if (message.length > MAX_CHARACTERS) {
    return {
      status: "error",
      error: `Secrets are limited to ${MAX_CHARACTERS} characters.`
    };
  }

  if (!expiry || !(expiry in EXPIRY_CHOICES)) {
    return { status: "error", error: "Select how long the secret should stay available." };
  }

  const seconds = EXPIRY_CHOICES[expiry];
  const expiresAt = new Date(Date.now() + seconds * 1000);

  try {
    const encrypted = createEncryptedPayload(message);
    const supabase = getAdminClient();

    const { error } = await supabase.from("secrets").insert({
      id: encrypted.id,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      expires_at: expiresAt.toISOString()
    });

    if (error) {
      console.error("Failed to persist encrypted secret", error);
      return {
        status: "error",
        error: "We could not store your secret. Please try again."
      };
    }

    return {
      status: "success",
      secret: { id: encrypted.id, key: encrypted.key, expiresAt: expiresAt.toISOString() }
    };
  } catch (error) {
    console.error("Unexpected error while creating secret", error);
    return {
      status: "error",
      error: "Something went wrong while encrypting your secret."
    };
  }
}
