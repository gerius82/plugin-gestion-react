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

const normalizePhone = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.slice(-10);
};

const parseBody = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
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

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders({
      ...(init.headers as Record<string, string> || {}),
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const fetchContacts = async (phones: string[]) => {
  const normalized = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  if (!normalized.length) return [];
  const filter = encodeURIComponent(`(${normalized.join(",")})`);
  return await rest(
    `inscripciones?select=id,persona_id,nombre,apellido,responsable,telefono,telefono_busqueda&telefono_busqueda=in.${filter}`,
  );
};

const fetchAllContacts = async () =>
  await rest(
    "inscripciones?select=id,persona_id,nombre,apellido,responsable,telefono,telefono_busqueda&order=responsable.asc.nullslast,nombre.asc&limit=2000",
  );

const fetchAllActiveEnrollments = async () =>
  await rest(
    "matriculas?select=id,alumno_id,estado,curso_nombre,sede,dia,hora,ciclo_codigo&estado=eq.activa&limit=5000",
  );

const fetchEnrollments = async (contacts: Array<Record<string, any>>) => {
  const ids = [...new Set(contacts.flatMap((item) => [item.persona_id, item.id]).filter(Boolean))];
  if (!ids.length) return [];
  const filter = encodeURIComponent(`(${ids.join(",")})`);
  return await rest(
    `matriculas?select=id,alumno_id,estado,curso_nombre,sede,dia,hora,ciclo_codigo&alumno_id=in.${filter}&estado=eq.activa`,
  );
};

const buildInbox = async () => {
  const [conversations, messages, settings, contacts, enrollments] = await Promise.all([
    rest("whatsapp_conversations?select=*&order=last_message_at.desc.nullslast&limit=200"),
    rest("whatsapp_messages?select=id,wa_message_id,from_phone,contact_name,message_type,text_body,media_id,payload,received_at,status&order=received_at.desc&limit=500"),
    rest("whatsapp_bot_settings?select=*&id=eq.true&limit=1"),
    fetchAllContacts(),
    fetchAllActiveEnrollments(),
  ]);
  return {
    conversations: conversations || [],
    messages: messages || [],
    contacts: contacts || [],
    enrollments: enrollments || [],
    settings: settings?.[0] || { simulation_only: true, sending_enabled: false },
  };
};

const findContext = async (phone: string) => {
  const contacts = await fetchContacts([phone]);
  const enrollments = await fetchEnrollments(contacts || []);
  return { contacts: contacts || [], enrollments: enrollments || [] };
};

const studentLabel = (contact: Record<string, any>) =>
  `${contact?.nombre || ""} ${contact?.apellido || ""}`.trim() || "el alumno";

const simulate = async (phone: string, input: string) => {
  const normalizedInput = String(input || "").trim().toLowerCase();
  const context = await findContext(phone);
  const options = [
    { id: "1", label: "Próxima clase" },
    { id: "2", label: "Recuperar una clase" },
    { id: "3", label: "Pagos y comprobantes" },
    { id: "4", label: "Hablar con una persona" },
  ];

  if (["1", "proxima", "próxima", "clase"].includes(normalizedInput)) {
    const enrollment = context.enrollments[0];
    const contact = context.contacts[0];
    const message = enrollment
      ? `La próxima clase de ${studentLabel(contact)} es ${enrollment.dia || "el día habitual"} a las ${enrollment.hora || "el horario habitual"}${enrollment.sede ? ` en ${enrollment.sede}` : ""}.`
      : "No encontré una matrícula activa asociada a este teléfono. Voy a derivar la consulta para que la revisemos.";
    return { message, options, nextStep: enrollment ? "menu" : "human", context };
  }

  if (["2", "recuperar", "recuperacion", "recuperación"].includes(normalizedInput)) {
    return {
      message: "Podés consultar y solicitar una recuperación desde https://gestion.plugin.ar/recuperar. Si preferís, también puedo derivarte con una persona.",
      options,
      nextStep: "menu",
      context,
    };
  }

  if (["3", "pago", "pagos", "comprobante"].includes(normalizedInput)) {
    return {
      message: "Podés consultar pagos y comprobantes desde https://gestion.plugin.ar/pagos. Por seguridad, el sistema te pedirá validar el teléfono registrado.",
      options,
      nextStep: "menu",
      context,
    };
  }

  if (["4", "persona", "humano", "asesor"].includes(normalizedInput)) {
    return {
      message: "Listo, pausé las respuestas automáticas. Una persona continuará la conversación.",
      options: [],
      nextStep: "human",
      context,
    };
  }

  const known = context.contacts.length
    ? ` Encontré ${context.contacts.map(studentLabel).join(" y ")} asociado${context.contacts.length > 1 ? "s" : ""} a este teléfono.`
    : " No encontré alumnos asociados; podés continuar igualmente con una opción.";
  return {
    message: `¡Hola! Soy el asistente de Plugin Robótica 🤖${known} ¿En qué podemos ayudarte?`,
    options,
    nextStep: "menu",
    context,
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await verifyAdmin(request))) {
      return jsonResponse(403, { ok: false, error: "Acceso administrativo requerido" });
    }

    if (request.method === "GET") {
      const mediaId = new URL(request.url).searchParams.get("media_id")?.trim();
      if (mediaId) {
        if (!/^[A-Za-z0-9._-]+$/.test(mediaId)) {
          return jsonResponse(400, { ok: false, error: "Identificador de imagen inválido" });
        }
        const accessToken = requiredSecret("WHATSAPP_ACCESS_TOKEN");
        const phoneNumberId = requiredSecret("WHATSAPP_PHONE_NUMBER_ID");
        const metadataResponse = await fetch(
          `https://graph.facebook.com/v24.0/${encodeURIComponent(mediaId)}?phone_number_id=${encodeURIComponent(phoneNumberId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!metadataResponse.ok) {
          console.error("No se pudo consultar la imagen de WhatsApp", await metadataResponse.text());
          return jsonResponse(502, { ok: false, error: "No se pudo obtener la imagen de WhatsApp" });
        }
        const metadata = await metadataResponse.json();
        const mediaResponse = await fetch(metadata.url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!mediaResponse.ok) {
          console.error("No se pudo descargar la imagen de WhatsApp", await mediaResponse.text());
          return jsonResponse(502, { ok: false, error: "No se pudo descargar la imagen de WhatsApp" });
        }
        return new Response(await mediaResponse.arrayBuffer(), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": metadata.mime_type || mediaResponse.headers.get("content-type") || "application/octet-stream",
            "Cache-Control": "private, max-age=300",
          },
        });
      }
      return jsonResponse(200, { ok: true, ...(await buildInbox()) });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Método no permitido" });
    }

    const body = await parseBody(request);
    if (body.action === "mark_read") {
      const phone = String(body.phone || "");
      await Promise.all([
        rest(`whatsapp_messages?from_phone=eq.${encodeURIComponent(phone)}&status=eq.unread`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "read" }),
        }),
        rest(`whatsapp_conversations?phone=eq.${encodeURIComponent(phone)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ unread_count: 0, updated_at: new Date().toISOString() }),
        }),
      ]);
      return jsonResponse(200, { ok: true });
    }

    if (body.action === "set_bot_mode") {
      const phone = String(body.phone || "");
      const mode = ["active", "paused", "human"].includes(body.mode) ? body.mode : "paused";
      await rest(`whatsapp_conversations?phone=eq.${encodeURIComponent(phone)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ bot_mode: mode, updated_at: new Date().toISOString() }),
      });
      return jsonResponse(200, { ok: true });
    }

    if (body.action === "delete_conversation") {
      const phone = String(body.phone || "").replace(/\D/g, "");
      if (!phone) return jsonResponse(400, { ok: false, error: "Teléfono inválido" });
      await rest(`whatsapp_messages?from_phone=eq.${encodeURIComponent(phone)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      await rest(`whatsapp_conversations?phone=eq.${encodeURIComponent(phone)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      return jsonResponse(200, { ok: true });
    }

    if (body.action === "send_message") {
      const phone = String(body.phone || "").replace(/\D/g, "");
      const text = String(body.text || "").trim();
      if (!phone) return jsonResponse(400, { ok: false, error: "Teléfono inválido" });
      if (!text) return jsonResponse(400, { ok: false, error: "Escribí un mensaje" });
      if (text.length > 4096) return jsonResponse(400, { ok: false, error: "El mensaje es demasiado largo" });

      const recentMessages = await rest(
        `whatsapp_messages?select=received_at,payload&from_phone=eq.${encodeURIComponent(phone)}&order=received_at.desc&limit=100`,
      );
      const lastInbound = (recentMessages || []).find(
        (message: Record<string, any>) => message.payload?._direction !== "outbound",
      );
      const customerWindowOpen = lastInbound?.received_at
        && Date.now() - new Date(lastInbound.received_at).getTime() < 24 * 60 * 60 * 1000;
      if (!customerWindowOpen) {
        return jsonResponse(409, {
          ok: false,
          error: "La ventana de 24 horas está cerrada. Para iniciar la conversación necesitás una plantilla aprobada por Meta.",
        });
      }

      const accessToken = requiredSecret("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = requiredSecret("WHATSAPP_PHONE_NUMBER_ID");
      const graphResponse = await fetch(
        `https://graph.facebook.com/v24.0/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: "text",
            text: { preview_url: true, body: text },
          }),
        },
      );
      const graphResult = await graphResponse.json().catch(() => ({}));
      if (!graphResponse.ok || !graphResult?.messages?.[0]?.id) {
        console.error("No se pudo enviar el mensaje de WhatsApp", graphResult);
        return jsonResponse(502, {
          ok: false,
          error: graphResult?.error?.error_data?.details || graphResult?.error?.message || "Meta rechazó el mensaje",
        });
      }

      const sentAt = new Date().toISOString();
      const messageId = String(graphResult.messages[0].id);
      await rest("whatsapp_messages?on_conflict=wa_message_id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({
          wa_message_id: messageId,
          from_phone: phone,
          message_type: "text",
          text_body: text,
          payload: {
            id: messageId,
            to: phone,
            type: "text",
            text: { body: text },
            _direction: "outbound",
            _source: "plugin_center",
          },
          received_at: sentAt,
          status: "read",
        }),
      });
      await rest(`whatsapp_conversations?phone=eq.${encodeURIComponent(phone)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          bot_mode: "human",
          last_message_at: sentAt,
          last_message_preview: text,
          updated_at: sentAt,
        }),
      });
      return jsonResponse(200, { ok: true, messageId, sentAt });
    }

    if (body.action === "simulate") {
      const phone = normalizePhone(body.phone);
      if (!phone) return jsonResponse(400, { ok: false, error: "Ingresá un teléfono" });
      return jsonResponse(200, { ok: true, ...(await simulate(phone, body.input)) });
    }

    return jsonResponse(400, { ok: false, error: "Acción desconocida" });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Error interno",
    });
  }
});
