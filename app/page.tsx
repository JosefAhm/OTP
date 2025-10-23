"use client";

import { useState } from "react";
import { CreateSecretForm } from "@/components/CreateSecretForm";

export default function HomePage() {
  const [expanded, setExpanded] = useState(false);

  return (
    <main className="container" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
      <CreateSecretForm />
      <section style={{ marginTop: "2.5rem", color: "white", fontSize: "0.95rem" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: 0,
            marginBottom: '0.75rem'
          }}
        >
          How it works
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {expanded ? '−' : '+'}
          </span>
        </button>
        {expanded && (
          <ol style={{ display: "grid", gap: "0.5rem", paddingLeft: "1.25rem", margin: 0 }}>
            <li>
              Your secret is encrypted in your browser session before it is sent to the database with
              a random key.
            </li>
            <li>
              Share the generated link. The decryption key lives only in the link fragment (after the
              #) and never reaches the server.
            </li>
            <li>
              When someone opens the link, the encrypted payload is fetched once and deleted
              immediately after retrieval.
            </li>
          </ol>
        )}
      </section>
    </main>
  );
}
