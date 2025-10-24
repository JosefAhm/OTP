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

type ActiveView = "form" | "transition" | "success";

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
  const [activeView, setActiveView] = useState<ActiveView>("form");
  const transitionTimeoutRef = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const clearTransitionTimeout = () => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (state.status === "success") {
      const origin = window.location.origin;
      const url = `${origin}/s/${state.secret.id}#${state.secret.key}`;
      setShareUrl(url);
      setCopyStatus(null);
      formRef.current?.reset();
      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setActiveView(prefersReducedMotion ? "success" : "transition");
    } else {
      setShareUrl(null);
      setActiveView("form");
    }
  }, [state]);

  useEffect(() => {
    if (activeView !== "transition") {
      clearTransitionTimeout();
      return;
    }

    transitionTimeoutRef.current = window.setTimeout(() => {
      setActiveView("success");
      transitionTimeoutRef.current = null;
    }, 650);

    return () => {
      clearTransitionTimeout();
    };
  }, [activeView]);

  useEffect(() => () => clearTransitionTimeout(), []);

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
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
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

  const handleCreateNew = () => {
    clearTransitionTimeout();
    setActiveView("form");
    setState(initialState);
    setShareUrl(null);
    setCopyStatus(null);
    setShowCopyPopup(false);
  };

  const renderForm = () => (
    <>
      <header style={{ display: "grid", gap: "0.65rem" }}>
        <h1 style={{ fontSize: "2.1rem", fontWeight: 600, lineHeight: 1.2, margin: 0 }}>
          Share secrets safely.
        </h1>
        <p className="text-subtle" style={{ margin: 0, maxWidth: "42ch" }}>
          Encrypt a note with a randomly generated key. The link self-destructs the moment it is
          opened or when the timer expires.
        </p>
      </header>

      <form ref={formRef} onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }} autoComplete="off">
        <label style={{ display: "grid", gap: "0.45rem" }}>
          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>Secret message</span>
          <textarea
            className="input"
            name="message"
            placeholder="Paste credentials, API keys, or any sensitive text"
            rows={6}
            required
            maxLength={MAX_CHARACTERS}
            style={{ resize: "none" }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.45rem" }}>
          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>Expiry</span>
          <CustomDropdown name="expiry" options={EXPIRY_OPTIONS as any} defaultValue={"1h"} />
        </label>

        <SubmitButton pending={pending} />
      </form>

      {state.status === "error" && <div className="alert">{state.error}</div>}
    </>
  );

  const renderTransition = () => (
    <section className="transition-screen" aria-live="assertive" aria-busy={activeView === "transition"}>
      <div className="transition-icon" aria-hidden="true">
        <span className="transition-icon__ring" />
        <span className="transition-icon__check">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Secret secured</h2>
      <p className="text-subtle" style={{ margin: 0, maxWidth: "40ch" }}>
        We encrypted your message and generated a one-time link. Preparing it now…
      </p>
    </section>
  );

  const renderSuccess = () => (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "grid", gap: "0.65rem" }}>
        <h1 style={{ fontSize: "2.1rem", fontWeight: 600, lineHeight: 1.2, margin: 0 }}>
          Secret ready to share.
        </h1>
        <p className="text-subtle" style={{ margin: 0, maxWidth: "48ch" }}>
          Copy the one-time link below and send it to your recipient. It will disappear after it is
          viewed once or when it expires.
        </p>
      </header>

      <div className="success-banner" role="status">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>Link generated</span>
      </div>

      <div className="copy-input">
        <code
          style={{
            overflowWrap: "anywhere",
            fontFamily:
              "ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "0.95rem"
          }}
        >
          {shareUrl}
        </code>
        <button className="copy-button" onClick={handleCopy} type="button">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            style={{ width: 14, height: 14 }}
          >
            <rect x="9" y="9" width="10" height="10" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy link
        </button>
      </div>

      <div style={{ display: "grid", gap: "0.45rem" }}>
        <p className="text-subtle" style={{ margin: 0 }}>
          Keep the secret key safe — anyone with this link can view the message exactly once.
        </p>
        {expiryDisplay && (
          <p className="text-subtle" style={{ margin: 0 }}>
            Expires at <strong style={{ color: "var(--color-accent-strong)" }}>{expiryDisplay}</strong>.
          </p>
        )}
      </div>

      <button className="button" type="button" onClick={handleCreateNew}>
        Create new message
      </button>
    </section>
  );

  const shouldShowSuccess = state.status === "success" && !!shareUrl;

  return (
    <div className="card" style={{ display: "grid", gap: "2rem" }}>
      <div className={`view-wrapper view-${activeView}`}>
        <div className={`view-panel${activeView === "form" ? " is-active" : ""}`} aria-hidden={activeView !== "form"}>
          {renderForm()}
        </div>
        {shouldShowSuccess && (
          <div
            className={`view-panel transition-panel${activeView === "transition" ? " is-active" : ""}`}
            aria-hidden={activeView !== "transition"}
          >
            {renderTransition()}
          </div>
        )}
        {shouldShowSuccess && (
          <div
            className={`view-panel success-panel${activeView === "success" ? " is-active" : ""}`}
            aria-hidden={activeView !== "success"}
          >
            {renderSuccess()}
          </div>
        )}
      </div>

      {showCopyPopup && (
        <div className="copy-popup" ref={popupRef}>
          {copyStatus}
        </div>
      )}
    </div>
  );
}
