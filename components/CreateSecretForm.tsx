"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { EXPIRY_CHOICES, EXPIRY_OPTIONS, MAX_CHARACTERS } from "@/lib/constants";
import CustomDropdown from "./CustomDropdown";

const initialState: CreateSecretState = { status: "idle" };

const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

type CreateSecretState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; secret: { id: string; key: string; expiresAt: string } }
  | { status: "error"; error: string };

type CreateSecretResponse = {
  id: string;
  expiresAt: string;
};

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Encrypting…" : "Create one-time secret"}
    </button>
  );
}

export function CreateSecretForm() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, setState] = useState<CreateSecretState>(initialState);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [showCopyPopup, setShowCopyPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      const origin = window.location.origin;
      const url = `${origin}/s/${state.secret.id}#${state.secret.key}`;
      setShareUrl(url);
      setCopyStatus(null);
      formRef.current?.reset();
    } else {
      setShareUrl(null);
    }
  }, [state]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = setTimeout(() => setCopyStatus(null), 3000);
    return () => clearTimeout(timeout);
  }, [copyStatus]);

  useEffect(() => {
    if (!showCopyPopup) return;
    const timeout = setTimeout(() => setShowCopyPopup(false), 3000);
    return () => clearTimeout(timeout);
  }, [showCopyPopup]);

  useEffect(() => {
    if (!showCopyPopup) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowCopyPopup(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showCopyPopup]);

  const expiryDisplay = useMemo(() => {
    if (state.status !== "success") {
      return null;
    }

    const expiresAt = new Date(state.secret.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return null;
    }

    return expiresAt.toLocaleString();
  }, [state]);

  const pending = state.status === "submitting";

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("Copied to clipboard");
      setShowCopyPopup(true);
    } catch (error) {
      console.error("Failed to copy secret link", error);
      setCopyStatus("Copy failed. Manually copy the link above.");
      setShowCopyPopup(true);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = (formData.get("message") as string | null)?.trim() ?? "";
    const expiry = formData.get("expiry") as string | null;

    setCopyStatus(null);

    if (!message) {
      setState({ status: "error", error: "Enter a secret message to encrypt." });
      return;
    }

    if (message.length > MAX_CHARACTERS) {
      setState({
        status: "error",
        error: `Secrets are limited to ${MAX_CHARACTERS} characters.`
      });
      return;
    }

    if (!expiry || !(expiry in EXPIRY_CHOICES)) {
      setState({
        status: "error",
        error: "Select how long the secret should stay available."
      });
      return;
    }

    setState({ status: "submitting" });

    let keyBytes: Uint8Array;
    let ivBytes: Uint8Array;
    let ciphertext: string;
    let authTag: string;
    let key: string;
    let iv: string;

    try {
      keyBytes = new Uint8Array(KEY_LENGTH);
      crypto.getRandomValues(keyBytes);

      ivBytes = new Uint8Array(IV_LENGTH);
      crypto.getRandomValues(ivBytes);

      // Web Crypto expects BufferSource (ArrayBuffer or view). Use the underlying ArrayBuffer
      // slices to avoid issues in some browsers/environments.
      const keyBuffer = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer as unknown as BufferSource,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );

      const encoded = new TextEncoder().encode(message);
      const encodedBuffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
      const ivBuffer = ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength);

      const encryptedBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: ivBuffer as unknown as BufferSource },
        cryptoKey,
        encodedBuffer as unknown as BufferSource
      );
      const encrypted = new Uint8Array(encryptedBuf);

      if (encrypted.length <= AUTH_TAG_LENGTH) {
        throw new Error("Invalid ciphertext length");
      }

      const authTagBytes = encrypted.slice(encrypted.length - AUTH_TAG_LENGTH);
      const ciphertextBytes = encrypted.slice(0, encrypted.length - AUTH_TAG_LENGTH);

      ciphertext = encodeBase64Url(ciphertextBytes);
      authTag = encodeBase64Url(authTagBytes);
      key = encodeBase64Url(keyBytes);
      iv = encodeBase64Url(ivBytes);
    } catch (error) {
      console.error("Failed to encrypt secret", error);
      setState({
        status: "error",
        error: "Something went wrong while encrypting your secret."
      });
      return;
    }

    try {
      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciphertext,
          iv,
          authTag,
          expiry
        })
      });

      if (!response.ok) {
        let errorMessage = "We could not store your secret. Please try again.";
        try {
          const data = await response.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            errorMessage = data.error;
          }
        } catch {
          // ignore json parse errors
        }
        setState({ status: "error", error: errorMessage });
        return;
      }

      const result: CreateSecretResponse = await response.json();
      setState({
        status: "success",
        secret: { id: result.id, key, expiresAt: result.expiresAt }
      });
    } catch (error) {
      console.error("Failed to persist encrypted secret", error);
      setState({
        status: "error",
        error: "We could not store your secret. Please try again."
      });
    }
  };

  return (
    <div className="card" style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <div className="badge badge-box" title="End-to-end encrypted" aria-label="End-to-end encrypted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ width: 14, height: 14 }}>
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V8a5 5 0 0 1 10 0v3" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Encrypted</span>
        </div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>Share secrets safely.</h1>
        <p className="text-subtle" style={{ margin: 0 }}>
          Encrypt a note with a randomly generated key. The link self-destructs the moment it is
          opened or when the timer expires.
        </p>
      </header>

      <form ref={formRef} onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }} autoComplete="off">
        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>Secret message</span>
          <textarea
            className="input"
            name="message"
            placeholder="Paste credentials, API keys, or any sensitive text"
            rows={6}
            required
            maxLength={MAX_CHARACTERS}
            style={{ resize: 'none' }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>Expiry</span>
          <CustomDropdown name="expiry" options={EXPIRY_OPTIONS as any} defaultValue={"1h"} />
        </label>

        <SubmitButton pending={pending} />
      </form>

      {state.status === "error" && <div className="alert">{state.error}</div>}

      {state.status === "success" && shareUrl && (
        <section style={{ display: "grid", gap: "0.75rem" }}>
          <div className="copy-input">
            <code
              style={{
                overflowWrap: "anywhere",
                fontFamily:
                  "ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
              }}
            >
              {shareUrl}
            </code>
            <button className="copy-button" onClick={handleCopy} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ width: 14, height: 14 }}>
                <rect x="9" y="9" width="10" height="10" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy link
            </button>
          </div>
          <p className="text-subtle" style={{ margin: 0 }}>
            Keep the secret key safe — anyone with this link can view the message exactly once.
          </p>
          {expiryDisplay && (
            <p className="text-subtle" style={{ margin: 0 }}>
              Expires at <strong style={{ color: "rgba(226,232,240,0.95)" }}>{expiryDisplay}</strong>.
            </p>
          )}
        </section>
      )}

      {showCopyPopup && (
        <div className="copy-popup" ref={popupRef}>
          {copyStatus}
        </div>
      )}
    </div>
  );
}
