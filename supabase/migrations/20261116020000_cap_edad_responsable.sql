alter table public.cap_inscripciones
  add column if not exists edad integer,
  add column if not exists adulto_responsable text,
  add column if not exists lista_espera boolean not null default false;

alter table public.cap_inscripciones
  drop constraint if exists cap_inscripciones_edad_check;

alter table public.cap_inscripciones
  add constraint cap_inscripciones_edad_check
  check (edad is null or edad between 0 and 120);

comment on column public.cap_inscripciones.edad is
  'Edad informada al momento de la inscripción.';

comment on column public.cap_inscripciones.adulto_responsable is
  'Nombre y apellido del adulto responsable.';

comment on column public.cap_inscripciones.lista_espera is
  'Indica que el alumno figura en lista de espera y no como inscripto activo.';
