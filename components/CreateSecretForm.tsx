"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { createSecret, type CreateSecretState } from "@/app/actions";

const initialState: CreateSecretState = { status: "idle" };

const EXPIRY_OPTIONS = [
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "24 hours" },
  { value: "7d", label: "7 days" }
];

function SubmitButton() {
  const status = useFormStatus();
  return (
    <button className="button" type="submit" disabled={status.pending}>
      {status.pending ? "Encrypting…" : "Create one-time secret"}
    </button>
  );
}

export function CreateSecretForm() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction] = useFormState(createSecret, initialState);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

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

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("Copied to clipboard");
    } catch (error) {
      console.error("Failed to copy secret link", error);
      setCopyStatus("Copy failed. Manually copy the link above.");
    }
  };

  return (
    <div className="card" style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <div className="badge">End-to-end encrypted</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>Share secrets safely.</h1>
        <p className="text-subtle" style={{ margin: 0 }}>
          Encrypt a note with a randomly generated key. The link self-destructs the moment
          it is opened or when the timer expires.
        </p>
      </header>

      <form
        ref={formRef}
        action={formAction}
        style={{ display: "grid", gap: "1rem" }}
        autoComplete="off"
      >
        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>Secret message</span>
          <textarea
            className="input"
            name="message"
            placeholder="Paste credentials, API keys, or any sensitive text"
            rows={6}
            required
            maxLength={5000}
          />
        </label>

        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>Expiry</span>
          <select className="input" name="expiry" defaultValue="1h" required>
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <SubmitButton />
      </form>

      {state.status === "error" && <div className="alert">{state.error}</div>}

      {state.status === "success" && shareUrl && (
        <section style={{ display: "grid", gap: "0.75rem" }}>
          <div className="success">
            <strong style={{ display: "block", marginBottom: "0.5rem" }}>Secret ready</strong>
            <span>
              Send the link below to your recipient. It can only be opened once before being
              permanently destroyed.
            </span>
          </div>
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
              Copy link
            </button>
          </div>
          <p className="text-subtle" style={{ margin: 0 }}>
            Keep the secret key safe — it never touches our servers. Anyone with this link can
            view the message exactly once.
          </p>
          {expiryDisplay && (
            <p className="text-subtle" style={{ margin: 0 }}>
              Expires at <strong style={{ color: "rgba(226,232,240,0.95)" }}>{expiryDisplay}</strong>.
            </p>
          )}
          {copyStatus && <span className="text-subtle">{copyStatus}</span>}
        </section>
      )}
    </div>
  );
}
