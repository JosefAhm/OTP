# One-Time Secret Sharing

A secure Next.js application backed by Supabase for sharing sensitive text exactly once. Secrets are encrypted with a random AES-256-GCM key, stored server-side as ciphertext, and deleted as soon as they are retrieved or when their expiry is reached. The decryption key is never persisted and is only shared in the URL fragment.

## Features

- 🔐 **End-to-end encryption** — The browser decrypts using the key embedded in the link fragment so the server never sees the plaintext.
- 💣 **Self-destructing links** — Records are removed immediately after the first successful retrieval.
- ⏱️ **Expiring payloads** — Authors choose how long a secret remains redeemable.
- 🛡️ **Hardened defaults** — Strong random identifiers, strict validation, and service-role-only Supabase access.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file populated from `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

   Provide your Supabase project URL and a **service role** key.

3. Apply the database migration to your Supabase project:

   ```sql
   -- supabase/migrations/0001_create_secrets.sql
   ```

   The table requires row-level security to remain enabled so only the service role (used by the server) can access the data.

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Visit `http://localhost:3000` to create secrets. Recipients should open the generated link once before it expires.

## Security considerations

- Secrets are limited to 5,000 characters to mitigate abuse.
- AES-256-GCM with random IVs and per-secret keys protects data at rest.
- Identifiers are unguessable 32-character hexadecimal tokens to resist brute-force discovery.
- Redeeming a secret performs an atomic delete + return, ensuring only the first request succeeds.
- Expired entries are purged when a redemption is attempted.

Deploy behind HTTPS to keep the decryption key safe in transit.
