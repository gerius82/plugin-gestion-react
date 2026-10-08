create extension if not exists pg_net with schema extensions;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('new_student', 'payment_received')),
  dedupe_key text unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.notification_events enable row level security;
revoke all on table public.notification_events from anon, authenticated;

comment on table public.notification_events is
  'Cola interna de eventos que generan notificaciones push automáticas.';

create or replace function public.invoke_push_event(event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://cvogoablzgymmodegfft.supabase.co/functions/v1/push-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'dispatch_event', 'eventId', event_id),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.invoke_push_event(uuid) from public, anon, authenticated;

create or replace function public.queue_new_student_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  student public.inscripciones%rowtype;
  event_id uuid;
begin
  select * into student
  from public.inscripciones
  where id = new.alumno_id;

  if student.id is null or student.creado_en < now() - interval '15 minutes' then
    return new;
  end if;

  insert into public.notification_events (event_type, dedupe_key, payload)
  values (
    'new_student',
    'new_student:' || student.id::text,
    jsonb_build_object(
      'student_id', student.id,
      'name', trim(concat_ws(' ', student.nombre, student.apellido)),
      'course', coalesce(new.curso_nombre, student.curso, ''),
      'site', coalesce(new.sede, student.sede, ''),
      'schedule', trim(concat_ws(' ', new.dia, new.hora)),
      'wait_list', coalesce(new.lista_espera, false)
    )
  )
  on conflict (dedupe_key) do nothing
  returning id into event_id;

  if event_id is not null then
    perform public.invoke_push_event(event_id);
  end if;

  return new;
end;
$$;

drop trigger if exists notify_new_student on public.matriculas;
create trigger notify_new_student
after insert on public.matriculas
for each row execute function public.queue_new_student_notification();

create or replace function public.queue_payment_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  event_id uuid;
begin
  insert into public.notification_events (event_type, payload)
  select
    'payment_received',
    jsonb_build_object(
      'payment_ids', jsonb_agg(rows.id),
      'student_ids', jsonb_agg(rows.alumno_id),
      'amount', coalesce(sum(rows.monto_total), 0),
      'payment_method', min(rows.medio_pago),
      'month', min(rows.mes),
      'tuition', bool_or(coalesce(rows.pago_mes, false)),
      'registration', bool_or(coalesce(rows.pago_inscripcion, false))
    )
  from new_payment_rows rows
  where lower(coalesce(rows.medio_pago, '')) in ('efectivo', 'transferencia')
    and (coalesce(rows.pago_mes, false) or coalesce(rows.pago_inscripcion, false))
  having count(*) > 0
  returning id into event_id;

  if event_id is not null then
    perform public.invoke_push_event(event_id);
  end if;

  return null;
end;
$$;

drop trigger if exists notify_payment_received on public.pagos;
create trigger notify_payment_received
after insert on public.pagos
referencing new table as new_payment_rows
for each statement execute function public.queue_payment_notification();

revoke all on function public.queue_new_student_notification() from public, anon, authenticated;
revoke all on function public.queue_payment_notification() from public, anon, authenticated;
