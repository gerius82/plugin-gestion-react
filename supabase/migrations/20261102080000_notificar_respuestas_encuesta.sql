alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'new_student',
    'payment_received',
    'attendance_recorded',
    'daily_summary',
    'birthday_summary',
    'survey_response',
    'custom_notification'
  ));

insert into public.notification_type_settings (
  event_type,
  label,
  description,
  enabled,
  sort_order
)
values (
  'survey_response',
  'Respuestas de la encuesta',
  'Se envía cuando una familia completa la encuesta de la Colonia Tecnológica 2027.',
  true,
  60
)
on conflict (event_type) do update
set label = excluded.label,
    description = excluded.description,
    enabled = true,
    sort_order = excluded.sort_order,
    updated_at = now();

create or replace function public.queue_survey_response_notification()
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
    'survey_response',
    'survey_response:' || new.id::text,
    jsonb_build_object(
      'response_id', new.id,
      'intention', new.intencion_inscripcion,
      'site', new.sede_preferida,
      'period', new.periodo_interes,
      'wants_news', new.quiere_novedades,
      'contact_name', new.nombre_contacto,
      'phone', new.whatsapp_contacto
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

revoke all on function public.queue_survey_response_notification() from public, anon, authenticated;

drop trigger if exists notify_survey_response on public.encuesta_colonia_2027;
create trigger notify_survey_response
after insert on public.encuesta_colonia_2027
for each row execute function public.queue_survey_response_notification();
