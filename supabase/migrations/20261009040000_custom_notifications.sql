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
    'custom_notification'
  ));
