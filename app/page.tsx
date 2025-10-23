"use client";

import { useState } from "react";
import { CreateSecretForm } from "@/components/CreateSecretForm";

export default function HomePage() {
  const [expanded, setExpanded] = useState(false);

  return (
    <main className="container site-main">
      <CreateSecretForm />
      <section className="info-section">
        <div className="info-toggle-wrapper">
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="howitworks-content"
            className="info-toggle"
          >
            <span>How it works</span>
            <span aria-hidden className={`info-toggle-icon${expanded ? " expanded" : ""}`} />
          </button>

          {/* Render the explanatory content as an overlay so it doesn't affect layout */}
          {expanded && (
            <div id="howitworks-content" role="region" aria-label="How it works" className="info-popover">
              <ol className="info-list">
                <li>
                  Your secret is encrypted in your browser session before it is sent to the database with a
                  random key.
                </li>
                <li>
                  Share the generated link. The decryption key lives only in the link fragment (after the #)
                  and never reaches the server.
                </li>
                <li>
                  When someone opens the link, the encrypted payload is fetched once and deleted immediately
                  after retrieval.
                </li>
              </ol>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
