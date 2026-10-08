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
      'birth_date', student.fecha_nacimiento,
      'age', student.edad,
      'school', student.escuela,
      'responsible', student.responsable,
      'phone', student.telefono,
      'email', student.email,
      'cycle', new.ciclo_codigo,
      'enrollment_type', student.tipo_inscripcion,
      'course', coalesce(new.curso_nombre, student.curso, ''),
      'site', coalesce(new.sede, student.sede, ''),
      'schedule', trim(concat_ws(' ', new.dia, new.hora)),
      'wait_list', coalesce(new.lista_espera, false),
      'comments', student.comentarios
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

revoke all on function public.queue_new_student_notification() from public, anon, authenticated;
