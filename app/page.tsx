import { CreateSecretForm } from "@/components/CreateSecretForm";

export default function HomePage() {
  return (
    <main className="container" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
      <CreateSecretForm />
      <section style={{ marginTop: "2.5rem", color: "rgba(226,232,240,0.65)", fontSize: "0.95rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>How it works</h2>
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
      </section>
    </main>
  );
}
