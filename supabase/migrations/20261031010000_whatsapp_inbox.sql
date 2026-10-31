alter table public.inscripciones
  add column if not exists telefono_busqueda text
  generated always as (
    right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 10)
  ) stored;

create index if not exists inscripciones_telefono_busqueda_idx
  on public.inscripciones (telefono_busqueda);

create table if not exists public.whatsapp_conversations (
  phone text primary key,
  contact_name text,
  bot_mode text not null default 'active'
    check (bot_mode in ('active', 'paused', 'human')),
  bot_step text not null default 'menu',
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_last_message_idx
  on public.whatsapp_conversations (last_message_at desc nulls last);

alter table public.whatsapp_conversations enable row level security;
revoke all on table public.whatsapp_conversations from anon, authenticated;

create table if not exists public.whatsapp_bot_settings (
  id boolean primary key default true check (id),
  simulation_only boolean not null default true,
  sending_enabled boolean not null default false check (sending_enabled = false),
  welcome_message text not null default '¡Hola! Soy el asistente de Plugin Robótica 🤖 ¿En qué podemos ayudarte?',
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_bot_settings enable row level security;
revoke all on table public.whatsapp_bot_settings from anon, authenticated;

insert into public.whatsapp_bot_settings (id)
values (true)
on conflict (id) do nothing;

create or replace function public.record_whatsapp_inbound(
  p_phone text,
  p_contact_name text,
  p_received_at timestamptz,
  p_preview text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.whatsapp_conversations (
    phone,
    contact_name,
    unread_count,
    last_message_at,
    last_message_preview,
    updated_at
  )
  values (
    p_phone,
    nullif(p_contact_name, ''),
    1,
    p_received_at,
    nullif(p_preview, ''),
    now()
  )
  on conflict (phone) do update
  set contact_name = coalesce(nullif(excluded.contact_name, ''), whatsapp_conversations.contact_name),
      unread_count = whatsapp_conversations.unread_count + 1,
      last_message_at = greatest(whatsapp_conversations.last_message_at, excluded.last_message_at),
      last_message_preview = excluded.last_message_preview,
      updated_at = now();
$$;

revoke all on function public.record_whatsapp_inbound(text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.record_whatsapp_inbound(text, text, timestamptz, text)
  to service_role;

insert into public.whatsapp_conversations (
  phone,
  contact_name,
  unread_count,
  last_message_at,
  last_message_preview
)
select distinct on (m.from_phone)
  m.from_phone,
  m.contact_name,
  (count(*) filter (where m.status = 'unread') over (partition by m.from_phone))::integer,
  m.received_at,
  m.text_body
from public.whatsapp_messages m
order by m.from_phone, m.received_at desc
on conflict (phone) do nothing;

comment on table public.whatsapp_conversations is
  'Estado administrativo y del bot por conversación de WhatsApp.';

comment on table public.whatsapp_bot_settings is
  'Interruptores globales del bot. Los envíos reales permanecen bloqueados durante la simulación.';
