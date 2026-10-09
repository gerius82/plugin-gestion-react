drop function if exists public.queue_daily_summary(date);

create function public.queue_daily_summary(
  summary_date date,
  force_resend boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  weekday_name text;
  payments_count integer;
  payments_total numeric;
  cash_count integer;
  cash_total numeric;
  transfer_count integer;
  transfer_total numeric;
  attendance_details jsonb;
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
    count(*) filter (where lower(coalesce(p.medio_pago, '')) = 'efectivo')::integer,
    coalesce(sum(p.monto_total) filter (where lower(coalesce(p.medio_pago, '')) = 'efectivo'), 0),
    count(*) filter (where lower(coalesce(p.medio_pago, '')) = 'transferencia')::integer,
    coalesce(sum(p.monto_total) filter (where lower(coalesce(p.medio_pago, '')) = 'transferencia'), 0)
  into payments_count, payments_total, cash_count, cash_total, transfer_count, transfer_total
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
  ), combined as (
    select
      e.site,
      e.shift,
      s.id is not null as recorded,
      coalesce(s.present_count, 0) as present_count,
      coalesce(s.absent_count, 0) as absent_count,
      coalesce(s.recovery_count, 0) as recovery_count
    from expected e
    left join public.attendance_sessions s
      on s.attendance_date = summary_date
      and s.site = e.site
      and s.shift = e.shift

    union all

    select
      s.site,
      s.shift,
      true,
      s.present_count,
      s.absent_count,
      s.recovery_count
    from public.attendance_sessions s
    where s.attendance_date = summary_date
      and not exists (
        select 1 from expected e
        where e.site = s.site and e.shift = s.shift
      )
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'site', site,
          'shift', shift,
          'recorded', recorded,
          'present', present_count,
          'absent', absent_count,
          'recoveries', recovery_count
        ) order by site, shift
      ),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object('site', site, 'shift', shift)
        order by site, shift
      ) filter (where not recorded),
      '[]'::jsonb
    )
  into attendance_details, missing_sessions
  from combined;

  insert into public.notification_events (event_type, dedupe_key, payload)
  values (
    'daily_summary',
    'daily_summary:' || summary_date::text,
    jsonb_build_object(
      'date', summary_date,
      'payments_count', payments_count,
      'payments_total', payments_total,
      'cash_count', cash_count,
      'cash_total', cash_total,
      'transfer_count', transfer_count,
      'transfer_total', transfer_total,
      'attendance_sessions', attendance_details,
      'missing_sessions', missing_sessions
    )
  )
  on conflict (dedupe_key) do update
  set payload = excluded.payload,
      status = 'queued',
      error = null,
      processed_at = null
  where force_resend
  returning id into event_id;

  if event_id is not null then
    perform public.invoke_push_event(event_id);
  end if;
end;
$$;

revoke all on function public.queue_daily_summary(date, boolean) from public, anon, authenticated;
