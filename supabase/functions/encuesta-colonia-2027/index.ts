const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
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

const serviceHeaders = (extra: Record<string, string> = {}) => ({
  apikey: serviceRoleKey(),
  Authorization: `Bearer ${serviceRoleKey()}`,
  ...extra,
});

const allowed = {
  interes: ["encanta", "interesante", "dudas", "no_interesa"],
  intencion_inscripcion: ["definitivamente", "probablemente", "tal_vez", "no"],
  sede_preferida: ["centro", "fisherton", "cualquiera"],
  turno_preferido: ["manana", "tarde", "cualquiera", "ninguno"],
  periodo_interes: ["enero", "febrero", "ambos", "no_sabe"],
  actividades: ["robotica", "experimentos", "arte", "electronica", "juegos", "programacion"],
} as const;

const cleanText = (value: unknown, max: number) => String(value || "").trim().slice(0, max);

const parseBody = async (request: Request) => {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) throw new Error("Solicitud demasiado grande");
  try {
    return await request.json();
  } catch {
    throw new Error("Solicitud inválida");
  }
};

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders({ ...((init.headers as Record<string, string>) || {}) }),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(text || `Error ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
};

const verifyAdmin = async (request: Request) => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return false;
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: requiredSecret("SUPABASE_ANON_KEY"),
      Authorization: authorization,
    },
  });
  if (!response.ok) return false;
  const user = await response.json();
  return String(user?.email || "").trim().toLowerCase() === "plugin.robotica@gmail.com";
};

const hash = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
};

const requireAllowed = (field: keyof typeof allowed, value: unknown) => {
  const normalized = String(value || "");
  if (!(allowed[field] as readonly string[]).includes(normalized)) {
    throw new Error(`Respuesta inválida en ${field}`);
  }
  return normalized;
};

const publicSubmit = async (request: Request) => {
  const body = await parseBody(request);
  if (cleanText(body.website, 100)) return jsonResponse(200, { ok: true });

  const startedAt = Number(body.started_at || 0);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < 2500) {
    return jsonResponse(429, { ok: false, error: "Esperá unos segundos antes de enviar." });
  }

  const submissionId = String(body.submission_id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
    return jsonResponse(400, { ok: false, error: "Identificador de envío inválido." });
  }

  const activities = [...new Set(Array.isArray(body.actividades) ? body.actividades.map(String) : [])];
  if (!activities.length || activities.some((item) => !(allowed.actividades as readonly string[]).includes(item))) {
    return jsonResponse(400, { ok: false, error: "Elegí al menos una actividad válida." });
  }

  const wantsNews = body.quiere_novedades === true;
  const name = wantsNews ? cleanText(body.nombre_contacto, 120) : null;
  const phone = wantsNews ? cleanText(body.whatsapp_contacto, 40) : null;
  if (wantsNews && (!name || !/^[+()\d\s-]{8,40}$/.test(phone || ""))) {
    return jsonResponse(400, { ok: false, error: "Completá un nombre y un WhatsApp válidos." });
  }

  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const fingerprint = await hash(`${ip.trim()}|${userAgent.slice(0, 180)}`);
  const since = encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const recent = await rest(
    `encuesta_colonia_2027?select=id&abuse_fingerprint=eq.${fingerprint}&created_at=gte.${since}&limit=6`,
  );
  if ((recent || []).length >= 5) {
    return jsonResponse(429, { ok: false, error: "Se alcanzó el límite temporal de respuestas. Probá nuevamente más tarde." });
  }

  const row = {
    submission_id: submissionId,
    interes: requireAllowed("interes", body.interes),
    intencion_inscripcion: requireAllowed("intencion_inscripcion", body.intencion_inscripcion),
    sede_preferida: requireAllowed("sede_preferida", body.sede_preferida),
    turno_preferido: requireAllowed("turno_preferido", body.turno_preferido),
    periodo_interes: requireAllowed("periodo_interes", body.periodo_interes),
    actividades: activities,
    sugerencias: cleanText(body.sugerencias, 1500) || null,
    quiere_novedades: wantsNews,
    nombre_contacto: name,
    whatsapp_contacto: phone,
    abuse_fingerprint: fingerprint,
  };

  try {
    await rest("encuesta_colonia_2027", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch (error) {
    if ((error as Error & { status?: number }).status === 409) return jsonResponse(200, { ok: true, duplicate: true });
    throw error;
  }
  return jsonResponse(201, { ok: true });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (request.method === "POST") return await publicSubmit(request);
    if (request.method === "GET") {
      if (!(await verifyAdmin(request))) return jsonResponse(403, { ok: false, error: "Acceso administrativo requerido" });
      const rows = await rest(
        "encuesta_colonia_2027?select=id,created_at,interes,intencion_inscripcion,sede_preferida,turno_preferido,periodo_interes,actividades,sugerencias,quiere_novedades,nombre_contacto,whatsapp_contacto&order=created_at.desc&limit=1000",
      );
      return jsonResponse(200, { ok: true, responses: rows || [] });
    }
    return jsonResponse(405, { ok: false, error: "Método no permitido" });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { ok: false, error: error instanceof Error ? error.message : "Error interno" });
  }
});

