alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in ('new_student', 'payment_received', 'attendance_recorded', 'daily_summary'));

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  attendance_date date not null,
  site text not null,
  shift text not null,
  present_count integer not null default 0 check (present_count >= 0),
  absent_count integer not null default 0 check (absent_count >= 0),
  recovery_count integer not null default 0 check (recovery_count >= 0),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendance_date, site, shift)
);

alter table public.attendance_sessions enable row level security;
grant select, insert, update on table public.attendance_sessions to anon, authenticated;

drop policy if exists "attendance_sessions_select" on public.attendance_sessions;
create policy "attendance_sessions_select"
on public.attendance_sessions for select
to anon, authenticated
using (true);

drop policy if exists "attendance_sessions_insert" on public.attendance_sessions;
create policy "attendance_sessions_insert"
on public.attendance_sessions for insert
to anon, authenticated
with check (true);

drop policy if exists "attendance_sessions_update" on public.attendance_sessions;
create policy "attendance_sessions_update"
on public.attendance_sessions for update
to anon, authenticated
using (true)
with check (true);

comment on table public.attendance_sessions is
  'Registro de turnos cuya asistencia ya fue cerrada, usado para avisos y controles diarios.';

create or replace function public.queue_attendance_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  event_id uuid;
begin
  insert into public.notification_events (event_type, dedupe_key, payload)
  values (
    'attendance_recorded',
    'attendance:' || new.attendance_date::text || ':' || new.site || ':' || new.shift,
    jsonb_build_object(
      'date', new.attendance_date,
      'site', new.site,
      'shift', new.shift,
      'present', new.present_count,
      'absent', new.absent_count,
      'recoveries', new.recovery_count
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

drop trigger if exists notify_attendance_recorded on public.attendance_sessions;
create trigger notify_attendance_recorded
after insert on public.attendance_sessions
for each row execute function public.queue_attendance_notification();

revoke all on function public.queue_attendance_notification() from public, anon, authenticated;

create or replace function public.queue_daily_summary(summary_date date)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  weekday_name text;
  payments_count integer;
  payments_total numeric;
  cash_total numeric;
  transfer_total numeric;
  missing_sessions jsonb;
  event_id uuid;
begin
  weekday_name := case extract(isodow from summary_date)::integer
    when 1 then 'lunes'
    when 2 then 'martes'
    when 3 then 'miercoles'
    when 4 then 'jueves'
    when 5 then 'viernes'
    when 6 then 'sabado'
    else 'domingo'
  end;

  select
    count(*)::integer,
    coalesce(sum(p.monto_total), 0),
    coalesce(sum(p.monto_total) filter (where lower(coalesce(p.medio_pago, '')) = 'efectivo'), 0),
    coalesce(sum(p.monto_total) filter (where lower(coalesce(p.medio_pago, '')) = 'transferencia'), 0)
  into payments_count, payments_total, cash_total, transfer_total
  from public.pagos p
  where (p.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = summary_date
    and lower(coalesce(p.medio_pago, '')) in ('efectivo', 'transferencia')
    and (coalesce(p.pago_mes, false) or coalesce(p.pago_inscripcion, false));

  with expected as (
    select distinct
      m.sede as site,
      trim(concat_ws(' ', m.dia, m.hora)) as shift
    from public.matriculas m
    where m.estado = 'activa'
      and not coalesce(m.lista_espera, false)
      and translate(lower(trim(m.dia)), 'áéíóúü', 'aeiouu') = weekday_name
  ), missing as (
    select e.site, e.shift
    from expected e
    where not exists (
      select 1
      from public.attendance_sessions s
      where s.attendance_date = summary_date
        and s.site = e.site
        and s.shift = e.shift
    )
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('site', site, 'shift', shift) order by site, shift),
    '[]'::jsonb
  )
  into missing_sessions
  from missing;

  insert into public.notification_events (event_type, dedupe_key, payload)
  values (
    'daily_summary',
    'daily_summary:' || summary_date::text,
    jsonb_build_object(
      'date', summary_date,
      'payments_count', payments_count,
      'payments_total', payments_total,
      'cash_total', cash_total,
      'transfer_total', transfer_total,
      'missing_sessions', missing_sessions
    )
  )
  on conflict (dedupe_key) do nothing
  returning id into event_id;

  if event_id is not null then
    perform public.invoke_push_event(event_id);
  end if;
end;
$$;

revoke all on function public.queue_daily_summary(date) from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname in ('plugin-daily-summary-weekdays', 'plugin-daily-summary-saturday');

select cron.schedule(
  'plugin-daily-summary-weekdays',
  '0 0 * * 2-6',
  $cron$select public.queue_daily_summary((now() at time zone 'America/Argentina/Buenos_Aires')::date);$cron$
);

select cron.schedule(
  'plugin-daily-summary-saturday',
  '0 17 * * 6',
  $cron$select public.queue_daily_summary((now() at time zone 'America/Argentina/Buenos_Aires')::date);$cron$
);
