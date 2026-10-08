create table if not exists public.google_contacts_connection (
  id smallint primary key default 1 check (id = 1),
  account_email text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_contact_links (
  normalized_phone text primary key,
  resource_name text not null,
  etag text,
  display_name text,
  updated_at timestamptz not null default now()
);

alter table public.google_contacts_connection enable row level security;
alter table public.google_contact_links enable row level security;

revoke all on table public.google_contacts_connection from anon, authenticated;
revoke all on table public.google_contact_links from anon, authenticated;

comment on table public.google_contacts_connection is
  'Conexión cifrada de la cuenta institucional utilizada para sincronizar Google Contactos.';
comment on table public.google_contact_links is
  'Relación interna entre teléfonos de responsables y contactos creados en Google.';
