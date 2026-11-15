create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_name text not null,
  template_language text not null default 'es_AR',
  audience text not null check (audience in ('active', 'inactive', 'all')),
  image_media_id text not null,
  image_file_name text,
  scheduled_date date not null,
  window_start time not null,
  window_end time not null,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'cancelled', 'failed')),
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint whatsapp_campaign_window_check check (window_end > window_start)
);

create table if not exists public.whatsapp_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  phone text not null,
  display_name text,
  student_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  scheduled_for timestamptz not null,
  attempts integer not null default 0,
  wa_message_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, phone)
);

create index if not exists whatsapp_campaign_recipients_due_idx
  on public.whatsapp_campaign_recipients (status, scheduled_for);

create index if not exists whatsapp_campaign_recipients_message_idx
  on public.whatsapp_campaign_recipients (wa_message_id)
  where wa_message_id is not null;

alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_campaign_recipients enable row level security;

revoke all on table public.whatsapp_campaigns from anon, authenticated;
revoke all on table public.whatsapp_campaign_recipients from anon, authenticated;
grant all on table public.whatsapp_campaigns to service_role;
grant all on table public.whatsapp_campaign_recipients to service_role;

comment on table public.whatsapp_campaigns is
  'Campañas salientes de WhatsApp creadas desde el panel administrativo.';
comment on table public.whatsapp_campaign_recipients is
  'Cola de destinatarios únicos y seguimiento de cada envío de campaña.';

create or replace function public.invoke_whatsapp_campaign_worker()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://cvogoablzgymmodegfft.supabase.co/functions/v1/whatsapp-campaign-worker',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function public.invoke_whatsapp_campaign_worker() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'plugin-whatsapp-campaign-worker';

select cron.schedule(
  'plugin-whatsapp-campaign-worker',
  '* * * * *',
  $cron$select public.invoke_whatsapp_campaign_worker();$cron$
);
