alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'new_student',
    'payment_received',
    'attendance_recorded',
    'daily_summary',
    'birthday_summary'
  ));

create or replace function public.queue_birthday_summary(summary_date date)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  birthdays jsonb := '[]'::jsonb;
  event_id uuid;
begin
  with birthday_students as (
    select distinct on (coalesce(i.persona_id, i.id))
      coalesce(i.persona_id, i.id) as student_id,
      trim(concat_ws(' ', i.nombre, i.apellido)) as student_name,
      extract(year from age(summary_date, i.fecha_nacimiento::date))::integer as student_age
    from public.inscripciones i
    where i.fecha_nacimiento is not null
      and extract(month from i.fecha_nacimiento::date) = extract(month from summary_date)
      and extract(day from i.fecha_nacimiento::date) = extract(day from summary_date)
      and exists (
        select 1
        from public.matriculas m
        where m.alumno_id in (i.id, coalesce(i.persona_id, i.id))
      )
    order by coalesce(i.persona_id, i.id), i.creado_en desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'student_id', student_id,
        'name', student_name,
        'age', student_age
      )
      order by student_name
    ),
    '[]'::jsonb
  )
  into birthdays
  from birthday_students;

  insert into public.notification_events (event_type, dedupe_key, payload)
  values (
    'birthday_summary',
    'birthday_summary:' || summary_date::text,
    jsonb_build_object('date', summary_date, 'birthdays', birthdays)
  )
  on conflict (dedupe_key) do nothing
  returning id into event_id;

  if event_id is not null then
    perform public.invoke_push_event(event_id);
  end if;
end;
$$;

revoke all on function public.queue_birthday_summary(date) from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'plugin-daily-birthdays';

select cron.schedule(
  'plugin-daily-birthdays',
  '0 14 * * *',
  $cron$select public.queue_birthday_summary((now() at time zone 'America/Argentina/Buenos_Aires')::date);$cron$
);
