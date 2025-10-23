import { NextResponse } from "next/server";

import { EXPIRY_CHOICES, MAX_CHARACTERS, type ExpiryChoice } from "@/lib/constants";
import { generateSecretId } from "@/lib/crypto";
import { getAdminClient } from "@/lib/supabase";

const HEX_ID_REGEX = /^[0-9a-f]{32}$/;
const BASE64URL_REGEX = /^[A-Za-z0-9\-_]+$/;
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;
const MAX_CIPHERTEXT_BYTES = MAX_CHARACTERS * 6;

type CreateSecretBody = {
  ciphertext?: unknown;
  iv?: unknown;
  authTag?: unknown;
  expiry?: unknown;
  id?: unknown;
  messageLength?: unknown;
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
  let body: CreateSecretBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const messageLength = body.messageLength;
  if (
    typeof messageLength !== "number" ||
    !Number.isInteger(messageLength) ||
    messageLength <= 0
  ) {
    return NextResponse.json({ error: "Enter a secret message to encrypt." }, { status: 400 });
  }

  if (messageLength > MAX_CHARACTERS) {
    return NextResponse.json(
      { error: `Secrets are limited to ${MAX_CHARACTERS} characters.` },
      { status: 400 }
    );
  }

  const expiry = body.expiry;
  if (typeof expiry !== "string" || !(expiry in EXPIRY_CHOICES)) {
    return NextResponse.json(
      { error: "Select how long the secret should stay available." },
      { status: 400 }
    );
  }

  const ciphertextValue = typeof body.ciphertext === "string" ? body.ciphertext : undefined;
  if (!ciphertextValue) {
    return NextResponse.json({ error: "Invalid encrypted payload." }, { status: 400 });
  }

  const ciphertext = decodeBase64Url(ciphertextValue);
  if (!ciphertext || ciphertext.length === 0) {
    return NextResponse.json({ error: "Invalid encrypted payload." }, { status: 400 });
  }

  if (ciphertext.length < messageLength) {
    return NextResponse.json({ error: "Invalid encrypted payload." }, { status: 400 });
  }

  if (ciphertext.length > MAX_CIPHERTEXT_BYTES) {
    return NextResponse.json({ error: "Encrypted payload exceeds maximum size." }, { status: 400 });
  }

  const ivValue = typeof body.iv === "string" ? body.iv : undefined;
  if (!ivValue) {
    return NextResponse.json({ error: "Invalid initialization vector." }, { status: 400 });
  }

  const iv = decodeBase64Url(ivValue);
  if (!iv || iv.length !== IV_BYTE_LENGTH) {
    return NextResponse.json({ error: "Invalid initialization vector." }, { status: 400 });
  }

  const authTagValue = typeof body.authTag === "string" ? body.authTag : undefined;
  if (!authTagValue) {
    return NextResponse.json({ error: "Invalid authentication tag." }, { status: 400 });
  }

  const authTag = decodeBase64Url(authTagValue);
  if (!authTag || authTag.length !== AUTH_TAG_BYTE_LENGTH) {
    return NextResponse.json({ error: "Invalid authentication tag." }, { status: 400 });
  }

  const providedId = body.id;
  let id: string;

  if (typeof providedId === "string") {
    if (!HEX_ID_REGEX.test(providedId)) {
      return NextResponse.json({ error: "Invalid secret id." }, { status: 400 });
    }
    id = providedId;
  } else {
    id = generateSecretId();
  }

  const expiryChoice = expiry as ExpiryChoice;
  const seconds = EXPIRY_CHOICES[expiryChoice];
  const expiresAt = new Date(Date.now() + seconds * 1000);

  try {
    const supabase = getAdminClient();
    const { error } = await supabase.from("secrets").insert({
      id,
      ciphertext: ciphertextValue,
      iv: ivValue,
      auth_tag: authTagValue,
      expires_at: expiresAt.toISOString()
    });

    if (error) {
      console.error("Failed to persist encrypted secret", error);
      return NextResponse.json({ error: "We could not store your secret. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ id, expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error while storing secret", error);
    return NextResponse.json({ error: "We could not store your secret. Please try again." }, { status: 500 });
  }
}
