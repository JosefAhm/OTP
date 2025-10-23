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

  useEffect(() => {
    const fragmentKey = window.location.hash.slice(1).trim();
    if (fragmentKey) {
      setKey(fragmentKey);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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
          <div className="badge">One-time access</div>
          <h1 style={{ margin: 0 }}>Reveal secret</h1>
          <p className="text-subtle" style={{ margin: 0 }}>
            Once decrypted, the message is gone forever. If you reload the page you will not be
            able to recover it.
          </p>
        </header>

        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>Secret key</span>
          <input
            className="input"
            placeholder="Paste the key from the shared link"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            disabled={disabled || hasRevealed}
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <button className="button" onClick={revealSecret} disabled={disabled || hasRevealed}>
          {state.status === "decrypting" ? "Decrypting…" : "Reveal message"}
        </button>

        {state.status === "error" && <div className="alert">{state.error}</div>}

        {state.status === "success" && (
          <article className="card" style={{ background: "rgba(15,23,42,0.55)" }}>
            <header style={{ marginBottom: "0.75rem" }}>
              <strong style={{ fontSize: "1.1rem" }}>Decrypted message</strong>
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
