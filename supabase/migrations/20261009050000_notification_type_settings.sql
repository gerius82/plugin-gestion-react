create table if not exists public.notification_type_settings (
  event_type text primary key,
  label text not null,
  description text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.notification_type_settings (event_type, label, description, enabled, sort_order)
values
  ('new_student', 'Nuevas inscripciones', 'Se envía al registrar un alumno y su matrícula.', true, 10),
  ('payment_received', 'Pagos recibidos', 'Se envía al registrar una cuota o inscripción en efectivo o transferencia.', true, 20),
  ('attendance_recorded', 'Asistencias registradas', 'Se envía al guardar la asistencia de un turno.', true, 30),
  ('daily_summary', 'Resumen diario', 'Resumen de asistencias y pagos al cierre del día.', true, 40),
  ('birthday_summary', 'Cumpleaños del día', 'Resumen diario de cumpleaños a las 11:00.', true, 50)
on conflict (event_type) do nothing;

alter table public.notification_type_settings enable row level security;
revoke all on table public.notification_type_settings from anon, authenticated;

alter table public.notification_events
  drop constraint if exists notification_events_status_check;

alter table public.notification_events
  add constraint notification_events_status_check
  check (status in ('queued', 'processing', 'sent', 'failed', 'skipped'));
