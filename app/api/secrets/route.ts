import { NextResponse } from "next/server";

import { EXPIRY_CHOICES, MAX_CHARACTERS, type ExpiryChoice } from "@/lib/constants";
import { generateSecretId } from "@/lib/crypto";
import { applyRateLimit } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase";

const BASE64URL_REGEX = /^[A-Za-z0-9\-_]+$/;
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;
const MAX_CIPHERTEXT_BYTES = MAX_CHARACTERS * 6;

type CreateSecretBody = {
  ciphertext?: unknown;
  iv?: unknown;
  authTag?: unknown;
  expiry?: unknown;
};

function decodeBase64Url(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || !BASE64URL_REGEX.test(value)) {
    return null;
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const base64 = normalized + "=".repeat(padding);

  try {
    const buffer = Buffer.from(base64, "base64");
    const reencoded = buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return reencoded === value ? buffer : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rateLimit = applyRateLimit(request, { limit: 30, windowMs: 60_000 });
  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    for (const [key, value] of Object.entries(rateLimit.headers)) {
      response.headers.set(key, value);
    }
    return response;
  };

  if (!rateLimit.success) {
    return respond(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: CreateSecretBody;

  try {
    body = await request.json();
  } catch {
    return respond({ error: "Invalid request payload" }, { status: 400 });
  }

  const expiry = body.expiry;
  if (typeof expiry !== "string" || !(expiry in EXPIRY_CHOICES)) {
    return respond(
      { error: "Select how long the secret should stay available." },
      { status: 400 }
    );
  }

  const ciphertextValue = typeof body.ciphertext === "string" ? body.ciphertext : undefined;
  if (!ciphertextValue) {
    return respond({ error: "Invalid encrypted payload." }, { status: 400 });
  }

  const ciphertext = decodeBase64Url(ciphertextValue);
  if (!ciphertext || ciphertext.length === 0) {
    return respond({ error: "Invalid encrypted payload." }, { status: 400 });
  }

  if (ciphertext.length > MAX_CIPHERTEXT_BYTES) {
    return respond({ error: "Encrypted payload exceeds maximum size." }, { status: 400 });
  }

  const ivValue = typeof body.iv === "string" ? body.iv : undefined;
  if (!ivValue) {
    return respond({ error: "Invalid initialization vector." }, { status: 400 });
  }

  const iv = decodeBase64Url(ivValue);
  if (!iv || iv.length !== IV_BYTE_LENGTH) {
    return respond({ error: "Invalid initialization vector." }, { status: 400 });
  }

  const authTagValue = typeof body.authTag === "string" ? body.authTag : undefined;
  if (!authTagValue) {
    return respond({ error: "Invalid authentication tag." }, { status: 400 });
  }

  const authTag = decodeBase64Url(authTagValue);
  if (!authTag || authTag.length !== AUTH_TAG_BYTE_LENGTH) {
    return respond({ error: "Invalid authentication tag." }, { status: 400 });
  }

  const expiryChoice = expiry as ExpiryChoice;
  const seconds = EXPIRY_CHOICES[expiryChoice];
  const expiresAt = new Date(Date.now() + seconds * 1000);
  const expiresAtIso = expiresAt.toISOString();

  try {
    const supabase = getAdminClient();
    let attempts = 0;

    while (attempts < 5) {
      attempts += 1;
      const id = generateSecretId();

      const { error } = await supabase.from("secrets").insert({
        id,
        ciphertext: ciphertextValue,
        iv: ivValue,
        auth_tag: authTagValue,
        expires_at: expiresAtIso
      });

      if (!error) {
        return respond({ id, expiresAt: expiresAtIso }, { status: 201 });
      }

      if (error?.code !== "23505") {
        console.error("Failed to persist encrypted secret", error);
        return respond(
          { error: "We could not store your secret. Please try again." },
          { status: 500 }
        );
      }
    }

    console.error("Failed to persist encrypted secret after repeated id collisions");
    return respond(
      { error: "We could not store your secret. Please try again." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Unexpected error while storing secret", error);
    return respond({ error: "We could not store your secret. Please try again." }, { status: 500 });
  }
}
