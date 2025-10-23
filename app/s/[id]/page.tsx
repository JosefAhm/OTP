"use client";

import { useEffect, useMemo, useState } from "react";

type SecretState =
  | { status: "idle" }
  | { status: "decrypting" }
  | { status: "success"; message: string }
  | { status: "error"; error: string };

type RedeemResponse = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const base64 = normalized + "=".repeat(padding);
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}

async function decryptPayload(payload: RedeemResponse, key: string) {
  const cleanKey = key.trim();
  const keyBytes = decodeBase64Url(cleanKey);

  if (keyBytes.length !== 32) {
    throw new Error("Invalid key length");
  }

  const cipherBytes = decodeBase64Url(payload.ciphertext);
  const authTagBytes = decodeBase64Url(payload.authTag);
  const ivBytes = decodeBase64Url(payload.iv);

  const combined = new Uint8Array(cipherBytes.length + authTagBytes.length);
  combined.set(cipherBytes);
  combined.set(authTagBytes, cipherBytes.length);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes
    },
    cryptoKey,
    combined
  );

  return new TextDecoder().decode(new Uint8Array(decrypted));
}

export default function SecretPage({ params }: { params: { id: string } }) {
  const [key, setKey] = useState("");
  const [state, setState] = useState<SecretState>({ status: "idle" });
  const [hasRevealed, setHasRevealed] = useState(false);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');

  useEffect(() => {
    const fragmentKey = window.location.hash.slice(1).trim();
    if (fragmentKey) {
      setKey(fragmentKey);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetch(`/api/secrets/${params.id}`)
      .then(res => {
        if (res.ok) {
          return res.json();
        } else if (res.status === 404) {
          throw new Error('invalid');
        } else {
          throw new Error('error');
        }
      })
      .then(data => {
        if (data.expiresAt) {
          setExpiry(data.expiresAt);
          setFetchStatus('ready');
        }
      })
      .catch(err => {
        if (err.message === 'invalid') {
          setFetchStatus('invalid');
        } else {
          setFetchStatus('invalid'); // treat other errors as invalid too
        }
      });
  }, [params.id]);

  useEffect(() => {
    if (!expiry) return;
    const updateTimeLeft = () => {
      const now = new Date();
      const exp = new Date(expiry);
      const diff = exp.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        // Calculate days, hours, minutes, seconds
        let remaining = Math.floor(diff / 1000);
        const days = Math.floor(remaining / 86400);
        remaining %= 86400;
        const hours = Math.floor(remaining / 3600);
        remaining %= 3600;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        // Build a compact string, skipping zero-value leading units
        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

        setTimeLeft(parts.join(" "));
      }
    };
    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiry]);

  const disabled = useMemo(() => state.status === "decrypting", [state.status]);

  const revealSecret = async () => {
    if (!key.trim()) {
      setState({ status: "error", error: "Add the secret key from the shared link." });
      return;
    }

    setState({ status: "decrypting" });

    try {
      const response = await fetch("/api/secrets/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: params.id })
      });

      if (response.status === 404) {
        setState({
          status: "error",
          error: "This secret does not exist or has already been opened."
        });
        return;
      }

      if (response.status === 410) {
        setState({ status: "error", error: "This secret has expired." });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status}`);
      }

      const payload: RedeemResponse = await response.json();
      const message = await decryptPayload(payload, key);
      setState({ status: "success", message });
      setHasRevealed(true);
    } catch (error) {
      console.error("Failed to decrypt secret", error);
      setState({
        status: "error",
        error:
          "Unable to decrypt the message. Confirm that the key is correct and the link has not already been used."
      });
    }
  };

  return (
    <main className="container" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
      <div className="card" style={{ display: "grid", gap: "1.25rem" }}>
        <header style={{ display: "grid", gap: "0.5rem" }}>
          <div className="badge badge-box" title="One-time access" aria-label="One-time access">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ width: 14, height: 14 }}>
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V8a5 5 0 0 1 10 0v3" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>One-time</span>
          </div>
          <h1 style={{ margin: 0 }}>Reveal secret</h1>
          <p className="text-subtle" style={{ margin: 0 }}>
            Once decrypted, the message is gone forever. If you reload the page you will not be
            able to recover it.
          </p>
          {fetchStatus === 'loading' && (
            <p className="text-subtle" style={{ margin: 0 }}>
              Checking secret status...
            </p>
          )}
          {fetchStatus === 'ready' && timeLeft && (
            <p className="text-subtle" style={{ margin: 0, fontWeight: 'bold' }}>
              Expires in: {timeLeft}
            </p>
          )}
          {fetchStatus === 'invalid' && (
            <p className="text-subtle" style={{ margin: 0, color: 'red' }}>
              This secret is no longer available.
            </p>
          )}
        </header>

        {fetchStatus === 'ready' && (
          <button className="button" onClick={revealSecret} disabled={disabled || hasRevealed}>
            {state.status === "decrypting" ? "Decrypting…" : "Reveal message"}
          </button>
        )}

        {state.status === "error" && <div className="alert">{state.error}</div>}

        {state.status === "success" && (
          <article className="card" style={{ background: "rgba(15,23,42,0.55)" }}>
            <header style={{ marginBottom: "0.75rem" }}>
              <strong style={{ fontSize: "1.1rem" }}>Secret</strong>
            </header>
            <pre
              style={{
                margin: 0,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily:
                  "ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
              }}
            >
              {state.message}
            </pre>
          </article>
        )}
      </div>
    </main>
  );
}
