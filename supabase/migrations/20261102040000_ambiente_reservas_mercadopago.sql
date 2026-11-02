alter table public.reservas_mercadopago
  add column if not exists ambiente text not null default 'produccion'
  check (ambiente in ('prueba', 'produccion'));

-- La tabla se creó durante la puesta en marcha del entorno de prueba y,
-- hasta esta migración, solo contiene movimientos técnicos de validación.
update public.reservas_mercadopago
set ambiente = 'prueba'
where ambiente = 'produccion';
