create table if not exists secrets (
  id text primary key,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table secrets enable row level security;

create index if not exists secrets_expires_at_idx on secrets (expires_at);
