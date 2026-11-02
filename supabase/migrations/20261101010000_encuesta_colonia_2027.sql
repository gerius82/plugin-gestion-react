create table if not exists public.encuesta_colonia_2027 (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submission_id uuid not null unique,
  interes text not null check (interes in ('encanta', 'interesante', 'dudas', 'no_interesa')),
  intencion_inscripcion text not null check (intencion_inscripcion in ('definitivamente', 'probablemente', 'tal_vez', 'no')),
  sede_preferida text not null check (sede_preferida in ('centro', 'fisherton', 'cualquiera')),
  turno_preferido text not null check (turno_preferido in ('manana', 'tarde', 'cualquiera', 'ninguno')),
  periodo_interes text not null check (periodo_interes in ('enero', 'febrero', 'ambos', 'no_sabe')),
  actividades text[] not null default '{}',
  sugerencias text,
  quiere_novedades boolean not null,
  nombre_contacto text,
  whatsapp_contacto text,
  abuse_fingerprint text not null,
  constraint encuesta_colonia_2027_actividades_validas check (
    actividades <@ array['robotica', 'experimentos', 'arte', 'electronica', 'juegos', 'programacion']::text[]
  ),
  constraint encuesta_colonia_2027_contacto_consistente check (
    (quiere_novedades and nullif(btrim(nombre_contacto), '') is not null and nullif(btrim(whatsapp_contacto), '') is not null)
    or
    (not quiere_novedades and nombre_contacto is null and whatsapp_contacto is null)
  )
);

create index if not exists encuesta_colonia_2027_created_at_idx
  on public.encuesta_colonia_2027 (created_at desc);

create index if not exists encuesta_colonia_2027_abuse_idx
  on public.encuesta_colonia_2027 (abuse_fingerprint, created_at desc);

alter table public.encuesta_colonia_2027 enable row level security;

revoke all on table public.encuesta_colonia_2027 from anon, authenticated;
grant all on table public.encuesta_colonia_2027 to service_role;

comment on table public.encuesta_colonia_2027 is
  'Respuestas de la encuesta publica Colonia Tecnologica Plugin 2027. Acceso exclusivo mediante Edge Function.';

