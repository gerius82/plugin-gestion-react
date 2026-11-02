delete from public.reservas_mercadopago
where alumno_id = 'e1f45f21-e20d-4645-a7be-0bea57b2a6b8';

delete from public.matriculas
where id = '135457ef-7e45-49ee-9f84-4dd22867b9f1';

delete from public.inscripciones
where id = 'e1f45f21-e20d-4645-a7be-0bea57b2a6b8'
  and nombre = 'PRUEBA'
  and apellido = 'MERCADO PAGO';
