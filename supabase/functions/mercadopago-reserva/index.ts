const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
};

const supabaseUrl = () => requiredSecret("SUPABASE_URL");
const serviceRoleKey = () => requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
const accessToken = () => Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")?.trim() || "";
const siteUrl = () => (Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://gestion.plugin.ar").replace(/\/$/, "");

const serviceHeaders = (extra: Record<string, string> = {}) => ({
  apikey: serviceRoleKey(),
  Authorization: `Bearer ${serviceRoleKey()}`,
  ...extra,
});

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders({ ...((init.headers as Record<string, string>) || {}) }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Error de base de datos ${response.status}`);
  return text ? JSON.parse(text) : null;
};

const verifyAdmin = async (request: Request) => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return false;
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: requiredSecret("SUPABASE_ANON_KEY"), Authorization: authorization },
  });
  if (!response.ok) return false;
  const user = await response.json();
  return String(user?.email || "").trim().toLowerCase() === "plugin.robotica@gmail.com";
};

const normalizePhone = (value: unknown) => String(value || "").replace(/\D/g, "").slice(-10);
const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const mapOrderStatus = (status: unknown) => {
  const value = String(status || "").toLowerCase();
  if (value === "processed") return "aprobado";
  if (["failed", "rejected"].includes(value)) return "rechazado";
  if (["cancelled", "canceled"].includes(value)) return "cancelado";
  if (value === "expired") return "vencido";
  if (["refunded", "charged_back"].includes(value)) return "reintegrado";
  return "pendiente";
};

const paymentIdFromOrder = (order: Record<string, any>) =>
  order?.transactions?.payments?.[0]?.id || order?.payments?.[0]?.id || null;

const updateFromOrder = async (reservationId: string, order: Record<string, any>, notification = false) => {
  const state = mapOrderStatus(order.status);
  const payload: Record<string, unknown> = {
    estado: state,
    detalle_estado: String(order.status_detail || order.status || "").slice(0, 160) || null,
    mp_order_id: order.id || null,
    mp_payment_id: paymentIdFromOrder(order),
    respuesta_mp: order,
    actualizado_en: new Date().toISOString(),
  };
  if (state === "aprobado") payload.pagado_en = order.last_updated_date || new Date().toISOString();
  if (notification) payload.ultima_notificacion_en = new Date().toISOString();
  await rest(`reservas_mercadopago?id=eq.${reservationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return state;
};

const fetchOrder = async (orderId: string) => {
  const token = accessToken();
  if (!token) throw new Error("Mercado Pago todavía no está configurado.");
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Mercado Pago respondió ${response.status}`);
  return data;
};

const publicStatus = async (body: Record<string, any>) => {
  if (!isUuid(body.token)) return jsonResponse(400, { ok: false, error: "Identificador inválido." });
  const rows = await rest(
    `reservas_mercadopago?select=id,public_token,monto,moneda,estado,detalle_estado,mp_order_id,pagado_en,creado_en&public_token=eq.${body.token}&limit=1`,
  );
  const reservation = rows?.[0];
  if (!reservation) return jsonResponse(404, { ok: false, error: "No encontramos la reserva." });

  if (reservation.mp_order_id && accessToken() && ["creando", "pendiente"].includes(reservation.estado)) {
    try {
      const order = await fetchOrder(reservation.mp_order_id);
      reservation.estado = await updateFromOrder(reservation.id, order);
      reservation.detalle_estado = order.status_detail || order.status;
      reservation.pagado_en = reservation.estado === "aprobado" ? order.last_updated_date || new Date().toISOString() : null;
    } catch (error) {
      console.error("No se pudo sincronizar la order", error);
    }
  }

  delete reservation.id;
  delete reservation.mp_order_id;
  return jsonResponse(200, { ok: true, reservation });
};

const createCheckout = async (body: Record<string, any>) => {
  if (!accessToken()) {
    return jsonResponse(503, { ok: false, code: "not_configured", error: "El pago online estará disponible próximamente." });
  }
  if (!isUuid(body.alumno_id)) return jsonResponse(400, { ok: false, error: "Inscripción inválida." });

  const students = await rest(
    `inscripciones?select=id,nombre,apellido,email,telefono,tipo_inscripcion&id=eq.${body.alumno_id}&limit=1`,
  );
  const student = students?.[0];
  if (!student) return jsonResponse(404, { ok: false, error: "No encontramos la inscripción." });

  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.telefono);
  if (!email || email !== normalizeEmail(student.email) || !phone || phone !== normalizePhone(student.telefono)) {
    return jsonResponse(403, { ok: false, error: "Los datos no coinciden con la inscripción." });
  }

  const enrollments = await rest(
    `matriculas?select=id&alumno_id=eq.${body.alumno_id}&ciclo_codigo=eq.TDV_2027&estado=eq.activa&order=creado_en.desc&limit=1`,
  );
  if (!enrollments?.[0]) return jsonResponse(409, { ok: false, error: "La matrícula del Taller de Verano no está activa." });

  const previous = await rest(
    `reservas_mercadopago?select=id,public_token,estado,checkout_url&alumno_id=eq.${body.alumno_id}&ciclo_codigo=eq.TDV_2027&estado=in.(creando,pendiente,aprobado)&order=creado_en.desc&limit=1`,
  );
  if (previous?.[0]?.estado === "aprobado") {
    return jsonResponse(200, { ok: true, already_paid: true, token: previous[0].public_token, estado: "aprobado" });
  }
  if (previous?.[0]?.checkout_url) {
    return jsonResponse(200, { ok: true, token: previous[0].public_token, checkout_url: previous[0].checkout_url, estado: previous[0].estado });
  }

  const id = crypto.randomUUID();
  const publicToken = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const externalReference = `TDV2027-${id}`;
  await rest("reservas_mercadopago", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      public_token: publicToken,
      alumno_id: body.alumno_id,
      matricula_id: enrollments[0].id,
      monto: 10000,
      ambiente: accessToken().startsWith("TEST-") ? "prueba" : "produccion",
      external_reference: externalReference,
      idempotency_key: idempotencyKey,
      payer_email: email,
    }),
  });

  const resultUrl = `${siteUrl()}/reserva-verano-resultado?token=${publicToken}`;
  const orderPayload = {
    type: "online",
    processing_mode: "manual",
    total_amount: "10000.00",
    external_reference: externalReference,
    description: "Reserva Taller de Verano 2027",
    payer: { email },
    items: [{ title: "Reserva Taller de Verano 2027", unit_price: "10000.00", quantity: 1 }],
    config: {
      online: {
        success_url: `${resultUrl}&resultado=aprobado`,
        failure_url: `${resultUrl}&resultado=rechazado`,
        pending_url: `${resultUrl}&resultado=pendiente`,
        auto_return: "all",
      },
    },
  };

  const response = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(orderPayload),
  });
  const order = await response.json().catch(() => ({}));
  if (!response.ok || !order.checkout_url || !order.id) {
    await rest(`reservas_mercadopago?id=eq.${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "error", detalle_estado: String(order?.message || `HTTP ${response.status}`).slice(0, 160), respuesta_mp: order, actualizado_en: new Date().toISOString() }),
    });
    return jsonResponse(502, { ok: false, error: "Mercado Pago no pudo iniciar el cobro. Probá nuevamente más tarde." });
  }

  await rest(`reservas_mercadopago?id=eq.${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mp_order_id: order.id, checkout_url: order.checkout_url, estado: mapOrderStatus(order.status), detalle_estado: order.status_detail || order.status, respuesta_mp: order, actualizado_en: new Date().toISOString() }),
  });

  return jsonResponse(201, { ok: true, token: publicToken, checkout_url: order.checkout_url, estado: mapOrderStatus(order.status) });
};

const adminList = async (request: Request) => {
  if (!(await verifyAdmin(request))) return jsonResponse(401, { ok: false, error: "Acceso no autorizado." });
  const reservations = await rest(
    "reservas_mercadopago?select=id,alumno_id,matricula_id,ciclo_codigo,concepto,monto,moneda,ambiente,estado,detalle_estado,mp_order_id,mp_payment_id,pagado_en,creado_en,actualizado_en&order=creado_en.desc&limit=500",
  );
  const ids = [...new Set((reservations || []).map((item: Record<string, any>) => item.alumno_id).filter(Boolean))];
  const students = ids.length
    ? await rest(`inscripciones?select=id,nombre,apellido,responsable,telefono,email&id=in.(${ids.join(",")})`)
    : [];
  const studentMap = new Map((students || []).map((item: Record<string, any>) => [item.id, item]));
  return jsonResponse(200, {
    ok: true,
    configured: Boolean(accessToken()),
    reservations: (reservations || []).map((item: Record<string, any>) => ({ ...item, alumno: studentMap.get(item.alumno_id) || null })),
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { ok: false, error: "Método no permitido." });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "status") return await publicStatus(body);
    if (body.action === "admin-list") return await adminList(request);
    if (body.action === "create") return await createCheckout(body);
    return jsonResponse(400, { ok: false, error: "Acción inválida." });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { ok: false, error: "No se pudo procesar la solicitud." });
  }
});
