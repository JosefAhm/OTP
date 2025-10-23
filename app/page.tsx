"use client";

import { useState } from "react";
import { CreateSecretForm } from "@/components/CreateSecretForm";

export default function HomePage() {
  const [expanded, setExpanded] = useState(false);

  return (
    <main className="container" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
      <CreateSecretForm />
      <section style={{ marginTop: "2.5rem", color: "#1f2937", fontSize: "0.95rem" }}>
        <div style={{ position: "relative", width: "100%" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="howitworks-content"
            style={{
              background: "none",
              border: "none",
              color: "#0f172a",
              fontFamily: "inherit",
              fontSize: "1.1rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: 0,
              marginBottom: "0.75rem"
            }}
          >
            How it works
            <span
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                fontFamily: "inherit",
                color: "#2563eb"
              }}
            >
              {expanded ? "−" : "+"}
            </span>
          </button>

          {/* Render the explanatory content as an overlay so it doesn't affect layout */}
          {expanded && (
            <div
              id="howitworks-content"
              role="region"
              aria-label="How it works"
              style={{
                position: "absolute",
                left: 0,
                top: "100%",
                marginTop: "0.25rem",
                zIndex: 60,
                width: "100%",
                background: "#ffffff",
                border: "1px solid #dbe2ef",
                borderRadius: "0.5rem",
                padding: "1rem 1.25rem",
                boxShadow: "0 18px 36px rgba(15, 23, 42, 0.12)",
                maxWidth: "100%",
              }}
            >
              <ol
                style={{
                  display: "grid",
                  gap: "0.5rem",
                  paddingLeft: "1.25rem",
                  margin: 0,
                  maxHeight: 320,
                  overflow: "auto",
                  color: "#334155"
                }}
              >
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
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
