create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text not null unique,
  from_phone text not null,
  contact_name text,
  message_type text not null,
  text_body text,
  media_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  status text not null default 'unread'
    check (status in ('unread', 'read', 'answered', 'ignored'))
);

create index if not exists whatsapp_messages_from_phone_idx
  on public.whatsapp_messages (from_phone, received_at desc);

create index if not exists whatsapp_messages_received_at_idx
  on public.whatsapp_messages (received_at desc);

alter table public.whatsapp_messages enable row level security;
revoke all on table public.whatsapp_messages from anon, authenticated;

comment on table public.whatsapp_messages is
  'Mensajes entrantes recibidos mediante el webhook oficial de WhatsApp Business Platform.';
