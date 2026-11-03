alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'new_student',
    'contact_sync',
    'payment_received',
    'attendance_recorded',
    'daily_summary',
    'birthday_summary',
    'survey_response',
    'custom_notification'
  ));

create or replace function public.queue_existing_summer_student_contact_sync()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  student public.inscripciones%rowtype;
  event_id uuid;
begin
  if new.ciclo_codigo <> 'TDV_2027' then
    return new;
  end if;

  select * into student
  from public.inscripciones
  where id = new.alumno_id;

  if student.id is null then
    return new;
  end if;

  insert into public.notification_events (event_type, dedupe_key, payload)
  values (
    'contact_sync',
    'contact_sync:' || new.id::text,
    jsonb_build_object(
      'student_id', student.id,
      'name', trim(concat_ws(' ', student.nombre, student.apellido)),
      'phone', student.telefono,
      'cycle', new.ciclo_codigo
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

revoke all on function public.queue_existing_summer_student_contact_sync() from public, anon, authenticated;

drop trigger if exists sync_existing_summer_student_contact on public.matriculas;
create trigger sync_existing_summer_student_contact
after insert or update on public.matriculas
for each row execute function public.queue_existing_summer_student_contact_sync();
