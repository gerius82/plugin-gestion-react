alter table public.inscripciones
  add column if not exists autoriza_imagenes boolean,
  add column if not exists autorizacion_imagenes_en timestamptz,
  add column if not exists autorizacion_imagenes_version text;

comment on column public.inscripciones.autoriza_imagenes is
  'Decisión explícita del responsable sobre el uso institucional de fotos y videos.';
comment on column public.inscripciones.autorizacion_imagenes_en is
  'Fecha y hora en que el responsable expresó o actualizó la decisión.';
comment on column public.inscripciones.autorizacion_imagenes_version is
  'Versión del texto de consentimiento presentado al responsable.';
