const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
};

const serviceHeaders = (extra: Record<string, string> = {}) => ({
  apikey: requiredSecret("SUPABASE_SERVICE_ROLE_KEY"),
  Authorization: `Bearer ${requiredSecret("SUPABASE_SERVICE_ROLE_KEY")}`,
  ...extra,
});

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${requiredSecret("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders({ ...((init.headers as Record<string, string>) || {}) }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Error ${response.status}`);
  return text ? JSON.parse(text) : null;
};

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, "0")).join("");

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
};

const verifySignature = async (request: Request, dataId: string) => {
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const values = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")));
  const ts = values.ts || "";
  const received = values.v1 || "";
  if (!ts || !received) return false;
  const manifest = [dataId && `id:${dataId};`, requestId && `request-id:${requestId};`, ts && `ts:${ts};`].filter(Boolean).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requiredSecret("MERCADOPAGO_WEBHOOK_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  return constantTimeEqual(expected, received.toLowerCase());
};

const mapOrderStatus = (status: unknown) => {
  const value = String(status || "").toLowerCase();
  if (value === "processed") return "aprobado";
  if (["failed", "rejected"].includes(value)) return "rechazado";
  if (["cancelled", "canceled"].includes(value)) return "cancelado";
  if (value === "expired") return "vencido";
  if (["refunded", "charged_back"].includes(value)) return "reintegrado";
  return "pendiente";
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const rawDataId = String(url.searchParams.get("data.id") || url.searchParams.get("data_id") || body?.data?.id || "");
    const signatureDataId = rawDataId.toLowerCase();
    if (!rawDataId || !(await verifySignature(request, signatureDataId))) return new Response("Invalid signature", { status: 401 });
    if (String(body?.type || url.searchParams.get("type") || "").toLowerCase() !== "order") return new Response("ok", { status: 200 });

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(rawDataId)}`, {
      headers: { Authorization: `Bearer ${requiredSecret("MERCADOPAGO_ACCESS_TOKEN")}`, Accept: "application/json" },
    });
    const order = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok) throw new Error(order?.message || `Mercado Pago ${mpResponse.status}`);

    const rows = await rest(`reservas_mercadopago?select=id&mp_order_id=eq.${encodeURIComponent(order.id)}&limit=1`);
    if (!rows?.[0]) return new Response("ok", { status: 200 });
    const estado = mapOrderStatus(order.status);
    await rest(`reservas_mercadopago?id=eq.${rows[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado,
        detalle_estado: String(order.status_detail || order.status || "").slice(0, 160) || null,
        mp_payment_id: order?.transactions?.payments?.[0]?.id || order?.payments?.[0]?.id || null,
        respuesta_mp: order,
        pagado_en: estado === "aprobado" ? order.last_updated_date || new Date().toISOString() : null,
        ultima_notificacion_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      }),
    });
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Internal error", { status: 500 });
  }
});
