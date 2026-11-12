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

const buildMessageUpdates = async () => {
  const [conversations, messages] = await Promise.all([
    rest("whatsapp_conversations?select=*&order=last_message_at.desc.nullslast&limit=200"),
    rest("whatsapp_messages?select=id,wa_message_id,from_phone,contact_name,message_type,text_body,media_id,payload,received_at,status&order=received_at.desc&limit=500"),
  ]);
  return {
    conversations: conversations || [],
    messages: messages || [],
  };
};

const findContext = async (phone: string) => {
  const contacts = await fetchContacts([phone]);
  const enrollments = await fetchEnrollments(contacts || []);
  return { contacts: contacts || [], enrollments: enrollments || [] };
};

const studentLabel = (contact: Record<string, any>) =>
  `${contact?.nombre || ""} ${contact?.apellido || ""}`.trim() || "el alumno";

const normalizeBotInput = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value === term || value.includes(term));

const botOptionDefinitions = [
  { action: "courses", label: "Talleres e inscripciones" },
  { action: "recovery", label: "Recuperar una clase", requiresActiveEnrollment: true },
  { action: "schedule_change", label: "Cambio de turno", requiresActiveEnrollment: true },
  { action: "schedule", label: "Horarios de clase", requiresActiveEnrollment: true },
  { action: "locations", label: "Sedes y direcciones" },
  { action: "promos", label: "Promos" },
  { action: "birthday", label: "Festejá tu cumple" },
  { action: "human", label: "Hablar con una persona" },
];

const buildBotOptions = (hasActiveEnrollment: boolean) =>
  botOptionDefinitions
    .filter((option) => hasActiveEnrollment || !option.requiresActiveEnrollment)
    .map((option, index) => ({ ...option, id: String(index + 1) }));

const publicSiteUrl = () =>
  (Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://gestion.plugin.ar").replace(/\/$/, "");

const numberedOptions = (items: Array<Record<string, any>>) =>
  items.map((item, index) => ({ ...item, id: String(index + 1) }));

const fetchActiveCycles = async () =>
  await rest("ciclos?select=codigo,nombre_publico,descripcion,fecha_inicio,fecha_fin,orden&activo=eq.true&order=orden.asc");

const fetchCycleCourses = async (cycleCode: string) =>
  await rest(
    `cursos?select=id,nombre,descripcion,ciclo,turnos_config,precio_curso,precio_inscripcion,edad_min,edad_max&ciclo=eq.${encodeURIComponent(cycleCode)}&activo=eq.true&order=nombre.asc`,
  );

const fetchCourse = async (courseId: string) => {
  const rows = await rest(
    `cursos?select=id,nombre,descripcion,ciclo,turnos_config,precio_curso,precio_inscripcion,edad_min,edad_max&id=eq.${encodeURIComponent(courseId)}&activo=eq.true&limit=1`,
  );
  return rows?.[0] || null;
};

const formatCurrency = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "A consultar";
  if (amount === 0) return "Sin cargo";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
};

const parseScheduleConfig = (value: unknown) => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const scheduleStart = (value: unknown) => {
  const match = String(value || "").match(/(\d{1,2}:\d{2})/);
  return match ? match[1].padStart(5, "0") : String(value || "").trim();
};

const normalizeSchedulePart = (value: unknown) =>
  normalizeBotInput(value).replace(/\s+/g, " ");

const courseScheduleKeys = (course: Record<string, any>) => {
  const keys = new Set<string>();
  const config = parseScheduleConfig(course.turnos_config);
  for (const [location, days] of Object.entries(config)) {
    if (!days || typeof days !== "object") continue;
    for (const [day, rawTimes] of Object.entries(days as Record<string, any>)) {
      const times = Array.isArray(rawTimes)
        ? rawTimes
        : rawTimes && typeof rawTimes === "object"
          ? Object.values(rawTimes).flat()
          : [rawTimes];
      for (const time of times.filter(Boolean)) {
        keys.add(`${normalizeSchedulePart(location)}|${normalizeSchedulePart(day)}|${scheduleStart(time)}`);
      }
    }
  }
  return keys;
};

const fetchAvailableSchedules = async (course: Record<string, any>) => {
  const configuredKeys = courseScheduleKeys(course);
  if (!configuredKeys.size) return [];
  const [schedules, enrollments] = await Promise.all([
    rest(
      `turnos?select=sede,dia,hora,cupo_maximo&ciclo_codigo=eq.${encodeURIComponent(course.ciclo)}&activo=eq.true&order=sede.asc,dia.asc,hora.asc`,
    ),
    rest(
      `matriculas?select=sede,dia,hora&ciclo_codigo=eq.${encodeURIComponent(course.ciclo)}&estado=eq.activa&limit=5000`,
    ),
  ]);
  const counts = new Map<string, number>();
  for (const enrollment of enrollments || []) {
    const key = `${normalizeSchedulePart(enrollment.sede)}|${normalizeSchedulePart(enrollment.dia)}|${scheduleStart(enrollment.hora)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return (schedules || [])
    .map((schedule: Record<string, any>) => {
      const key = `${normalizeSchedulePart(schedule.sede)}|${normalizeSchedulePart(schedule.dia)}|${scheduleStart(schedule.hora)}`;
      const enrolled = counts.get(key) || 0;
      const capacity = schedule.cupo_maximo == null ? null : Number(schedule.cupo_maximo);
      return { ...schedule, key, enrolled, capacity, available: capacity == null || enrolled < capacity };
    })
    .filter((schedule: Record<string, any>) => configuredKeys.has(schedule.key));
};

const simulate = async (phone: string, input: string) => {
  const rawInput = String(input || "").trim();
  const normalizedInput = normalizeBotInput(input);
  const context = await findContext(phone);
  const hasActiveEnrollment = context.enrollments.length > 0;
  const options = buildBotOptions(hasActiveEnrollment);
  const selectedAction = options.find((option) => option.id === normalizedInput)?.action
    || botOptionDefinitions.find((option) => option.action === rawInput)?.action;
  const greeting = includesAny(normalizedInput, ["hola", "buen dia", "buenas tardes", "buenas noches", "menu", "inicio"]);

  if (rawInput.startsWith("cycle:")) {
    const cycleCode = rawInput.slice("cycle:".length);
    const [cycles, courses] = await Promise.all([fetchActiveCycles(), fetchCycleCourses(cycleCode)]);
    const cycle = (cycles || []).find((item: Record<string, any>) => String(item.codigo) === cycleCode);
    if (!courses?.length) {
      return {
        message: "Todavía no hay talleres publicados para esta propuesta.",
        options: numberedOptions([
          { action: "courses", label: "Ver otras propuestas" },
          { action: "menu", label: "Volver al menú principal" },
        ]),
        nextStep: "catalog",
        context,
      };
    }
    return {
      message: `Estos son los talleres disponibles en *${cycle?.nombre_publico || cycleCode}*. Elegí uno para ver la información:`,
      options: numberedOptions([
        ...courses.map((course: Record<string, any>) => ({ action: `course:${course.id}`, label: course.nombre })),
        { action: "courses", label: "Volver a propuestas" },
        { action: "menu", label: "Volver al menú principal" },
      ]),
      nextStep: "courses",
      context,
    };
  }

  if (rawInput.startsWith("course:")) {
    const course = await fetchCourse(rawInput.slice("course:".length));
    if (!course) {
      return {
        message: "Ese taller ya no se encuentra disponible.",
        options,
        nextStep: "menu",
        context,
      };
    }
    const ageText = course.edad_min != null || course.edad_max != null
      ? `${course.edad_min ?? "?"} a ${course.edad_max ?? "?"} años`
      : "A consultar";
    const description = String(course.descripcion || "Consultanos para conocer los contenidos y la modalidad del taller.").trim();
    return {
      message: `*${course.nombre}*\n\n${description}\n\n👦 Edades: ${ageText}\n📝 Inscripción: ${formatCurrency(course.precio_inscripcion)}\n💳 Cuota: ${formatCurrency(course.precio_curso)}`,
      options: numberedOptions([
        { action: `schedules:${course.id}`, label: "Ver horarios disponibles" },
        { action: `enroll:${course.id}`, label: "Quiero inscribirme" },
        { action: `cycle:${course.ciclo}`, label: "Volver a talleres" },
        { action: "menu", label: "Volver al menú principal" },
      ]),
      nextStep: "course_detail",
      context,
    };
  }

  if (rawInput.startsWith("schedules:")) {
    const course = await fetchCourse(rawInput.slice("schedules:".length));
    if (!course) {
      return { message: "Ese taller ya no se encuentra disponible.", options, nextStep: "menu", context };
    }
    const schedules = await fetchAvailableSchedules(course);
    const lines = schedules.map((schedule: Record<string, any>) =>
      `• ${schedule.sede} — ${schedule.dia} ${schedule.hora}${schedule.available ? "" : " (lista de espera)"}`
    );
    return {
      message: lines.length
        ? `Horarios de *${course.nombre}*:\n\n${lines.join("\n")}\n\nLos cupos pueden cambiar mientras completás la inscripción.`
        : `Todavía no hay horarios publicados para *${course.nombre}*.`,
      options: numberedOptions([
        { action: `enroll:${course.id}`, label: "Quiero inscribirme" },
        { action: `course:${course.id}`, label: "Volver a la información" },
        { action: "menu", label: "Volver al menú principal" },
      ]),
      nextStep: "schedules",
      context,
    };
  }

  if (rawInput.startsWith("enroll:")) {
    const course = await fetchCourse(rawInput.slice("enroll:".length));
    if (!course) {
      return { message: "Ese taller ya no se encuentra disponible.", options, nextStep: "menu", context };
    }
    const enrollmentUrl = `${publicSiteUrl()}/formulario?origen=padres&from=menu-inscripcion-cursos&ciclo=${encodeURIComponent(course.ciclo)}&curso_id=${encodeURIComponent(course.id)}`;
    return {
      message: `Podés comenzar la inscripción a *${course.nombre}* desde:\n${enrollmentUrl}`,
      options: numberedOptions([
        { action: `course:${course.id}`, label: "Volver a la información" },
        { action: "menu", label: "Volver al menú principal" },
      ]),
      nextStep: "enrollment",
      context,
    };
  }

  if (selectedAction === "schedule" || includesAny(normalizedInput, ["horario", "cuando tiene", "cuando es", "proxima clase", "dia de clase"])) {
    if (!hasActiveEnrollment) {
      return {
        message: "Para consultar un horario de cursado, elegí *Talleres e inscripciones* o *Hablar con una persona*.",
        options,
        nextStep: "menu",
        context,
      };
    }

    const lines = context.enrollments.map((enrollment: Record<string, any>) => {
      const contact = context.contacts.find((item: Record<string, any>) =>
        [item.id, item.persona_id].filter(Boolean).map(String).includes(String(enrollment.alumno_id))
      );
      const schedule = [enrollment.dia, enrollment.hora ? `${enrollment.hora} hs` : "", enrollment.sede]
        .filter(Boolean)
        .join(" · ");
      return `• ${studentLabel(contact)}${enrollment.curso_nombre ? ` — ${enrollment.curso_nombre}` : ""}: ${schedule || "horario a confirmar"}`;
    });
    return {
      message: `Estos son los horarios activos asociados a este teléfono:\n\n${lines.join("\n")}\n\n¿Necesitás consultar algo más?`,
      options,
      nextStep: "menu",
      context,
    };
  }

  if (selectedAction === "recovery" || includesAny(normalizedInput, ["recuper", "falto", "falta", "ausencia", "cambiar clase"])) {
    if (!hasActiveEnrollment) {
      return {
        message: "La recuperación corresponde a alumnos con cursado activo. Podés elegir *Talleres e inscripciones* o *Hablar con una persona*.",
        options,
        nextStep: "menu",
        context,
      };
    }
    return {
      message: `Podés consultar las ausencias y solicitar una recuperación desde:\n${publicSiteUrl()}/recuperar\n\nEl sistema te pedirá el teléfono registrado. Si no encontrás una opción adecuada, escribí *persona* y te derivamos.`,
      options,
      nextStep: "menu",
      context,
    };
  }

  if (selectedAction === "schedule_change" || includesAny(normalizedInput, ["cambio de turno", "cambiar turno", "cambiar horario", "otro turno"])) {
    if (!hasActiveEnrollment) {
      return {
        message: "El cambio de turno corresponde a alumnos con cursado activo. Podés elegir *Talleres e inscripciones* o *Hablar con una persona*.",
        options,
        nextStep: "menu",
        context,
      };
    }
    return {
      message: `Podés solicitar un cambio de turno desde:\n${publicSiteUrl()}/cambio-turno\n\nEl sistema te pedirá el teléfono registrado. Si necesitás ayuda, escribí *persona*.`,
      options,
      nextStep: "menu",
      context,
    };
  }

  if (selectedAction === "courses" || includesAny(normalizedInput, ["curso", "taller", "inscripcion", "inscribir", "vacante"])) {
    const cycles = await fetchActiveCycles();
    return {
      message: cycles?.length
        ? "Elegí una propuesta para conocer sus talleres:"
        : "Todavía no hay propuestas de talleres publicadas.",
      options: numberedOptions([
        ...(cycles || []).map((cycle: Record<string, any>) => ({
          action: `cycle:${cycle.codigo}`,
          label: cycle.nombre_publico || cycle.codigo,
        })),
        { action: "menu", label: "Volver al menú principal" },
      ]),
      nextStep: "cycles",
      context,
    };
  }

  if (selectedAction === "locations" || includesAny(normalizedInput, ["sede", "direccion", "donde queda", "ubicacion"])) {
    return {
      message: "Nuestras sedes son:\n\n📍 *Fisherton*\nEva Perón 8128, Rosario\n\n📍 *Calle Mendoza*\nMendoza 3024, Rosario",
      options: numberedOptions([
        { action: "courses", label: "Ver talleres" },
        { action: "menu", label: "Volver al menú principal" },
      ]),
      nextStep: "locations",
      context,
    };
  }

  if (selectedAction === "promos" || includesAny(normalizedInput, ["promo", "promocion", "descuento", "beneficio"])) {
    return {
      message: `Podés consultar los descuentos y beneficios vigentes desde:\n${publicSiteUrl()}/promos`,
      options,
      nextStep: "menu",
      context,
    };
  }

  if (selectedAction === "birthday" || includesAny(normalizedInput, ["cumple", "cumpleanos", "festejo", "festejar"] )) {
    return {
      message: `Conocé nuestras propuestas de cumpleaños creativos para chicos desde:\n${publicSiteUrl()}/cumples-info?from=menu-padres`,
      options,
      nextStep: "menu",
      context,
    };
  }

  if (selectedAction === "human" || includesAny(normalizedInput, ["persona", "humano", "asesor", "atencion", "hablar con alguien"])) {
    return {
      message: "Listo, pausé las respuestas automáticas. Una persona continuará la conversación apenas esté disponible.",
      options: [],
      nextStep: "human",
      context,
    };
  }

  const known = context.contacts.length
    ? `Encontré ${context.contacts.map(studentLabel).join(" y ")} asociado${context.contacts.length > 1 ? "s" : ""} a este teléfono.`
    : "";

  if (!greeting) {
    return {
      message: "No llegué a entender esa consulta. Podés elegir una opción o escribir *persona* para que te atienda alguien.",
      options,
      nextStep: "menu",
      context,
    };
  }

  return {
    message: `¡Hola! Soy el asistente de Plugin Robótica 🤖${known ? `\n\n${known}` : ""}\n\n¿En qué podemos ayudarte?`,
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
      const requestUrl = new URL(request.url);
      const mediaId = requestUrl.searchParams.get("media_id")?.trim();
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
      if (requestUrl.searchParams.get("updates") === "1") {
        return jsonResponse(200, { ok: true, ...(await buildMessageUpdates()) });
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
