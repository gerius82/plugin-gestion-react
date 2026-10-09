import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-admin-code",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
};

const validSubscription = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const subscription = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  return (
    typeof subscription.endpoint === "string" &&
    subscription.endpoint.startsWith("https://") &&
    typeof subscription.keys?.p256dh === "string" &&
    typeof subscription.keys?.auth === "string"
  );
};

const databaseHeaders = (serviceRoleKey: string, prefer?: string) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {}),
});

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value: unknown) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
};

const fromBase64Url = (value: string) =>
  Uint8Array.from(
    atob(
      value.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - value.length % 4) % 4),
    ),
    (character) => character.charCodeAt(0),
  );

const decryptGoogleRefreshToken = async (ciphertext: string, iv: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(requiredSecret("GOOGLE_CONTACTS_TOKEN_KEY")), (character) =>
      character.charCodeAt(0)
    ),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    key,
    fromBase64Url(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
};

const joinNames = (names: string[]) => {
  if (names.length < 2) return names[0] || "";
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
};

const syncStudentToGoogleContacts = async (
  eventPayload: Record<string, unknown>,
  supabaseUrl: string,
  serviceRoleKey: string,
) => {
  const normalizedPhone = String(eventPayload.phone || "").replace(/\D/g, "");
  if (!normalizedPhone) return;

  const connectionResponse = await fetch(
    `${supabaseUrl}/rest/v1/google_contacts_connection?id=eq.1&select=refresh_token_ciphertext,refresh_token_iv`,
    { headers: databaseHeaders(serviceRoleKey) },
  );
  if (!connectionResponse.ok) {
    throw new Error("No se pudo consultar la conexión con Google Contactos");
  }
  const connectionRows = await connectionResponse.json();
  const connection = Array.isArray(connectionRows) ? connectionRows[0] : null;
  if (!connection) return;

  const studentsResponse = await fetch(
    `${supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=id,nombre,apellido,telefono,creado_en&order=creado_en.asc`,
    { headers: databaseHeaders(serviceRoleKey) },
  );
  if (!studentsResponse.ok) throw new Error("No se pudieron buscar los hermanos");
  const students = (await studentsResponse.json() as Array<Record<string, unknown>>)
    .filter((student) => String(student.telefono || "").replace(/\D/g, "") === normalizedPhone);
  if (!students.length) return;

  const uniqueStudents = [...new Map(students.map((student) => [String(student.id), student])).values()];
  const surnames = uniqueStudents.map((student) => String(student.apellido || "").trim()).filter(Boolean);
  const sameSurname = surnames.length === uniqueStudents.length &&
    surnames.every((surname) => surname.localeCompare(surnames[0], "es", { sensitivity: "base" }) === 0);
  const givenNames = sameSurname
    ? uniqueStudents.map((student) => String(student.nombre || "").trim()).filter(Boolean)
    : uniqueStudents.map((student) =>
      `${String(student.nombre || "").trim()} ${String(student.apellido || "").trim()}`.trim()
    ).filter(Boolean);
  const contactName = joinNames(givenNames);
  const familyName = sameSurname ? surnames[0] : "";
  if (!contactName) return;

  const refreshToken = await decryptGoogleRefreshToken(
    connection.refresh_token_ciphertext,
    connection.refresh_token_iv,
  );
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredSecret("GOOGLE_CONTACTS_CLIENT_ID"),
      client_secret: requiredSecret("GOOGLE_CONTACTS_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error("Google rechazó la renovación del acceso a Contactos");
  }
  const googleHeaders = {
    Authorization: `Bearer ${tokenData.access_token}`,
    "Content-Type": "application/json",
  };

  const linkResponse = await fetch(
    `${supabaseUrl}/rest/v1/google_contact_links?normalized_phone=eq.${encodeURIComponent(normalizedPhone)}&select=resource_name`,
    { headers: databaseHeaders(serviceRoleKey) },
  );
  const linkRows = linkResponse.ok ? await linkResponse.json() : [];
  const linkedResource = Array.isArray(linkRows) ? linkRows[0]?.resource_name : null;

  const personBody: Record<string, unknown> = {
    names: [{ givenName: contactName, ...(familyName ? { familyName } : {}) }],
    phoneNumbers: [{ value: normalizedPhone, type: "mobile" }],
  };
  let savedPerson: Record<string, unknown> | null = null;

  if (linkedResource) {
    const existingResponse = await fetch(
      `https://people.googleapis.com/v1/${linkedResource}?personFields=names,phoneNumbers,metadata`,
      { headers: googleHeaders },
    );
    if (existingResponse.ok) {
      const existingPerson = await existingResponse.json();
      const updateResponse = await fetch(
        `https://people.googleapis.com/v1/${linkedResource}:updateContact?updatePersonFields=names,phoneNumbers&personFields=names,phoneNumbers,metadata`,
        {
          method: "PATCH",
          headers: googleHeaders,
          body: JSON.stringify({
            ...personBody,
            etag: existingPerson.etag,
            metadata: existingPerson.metadata,
          }),
        },
      );
      if (!updateResponse.ok) {
        throw new Error(`Google no pudo actualizar el contacto (${updateResponse.status})`);
      }
      savedPerson = await updateResponse.json();
    } else if (existingResponse.status !== 404) {
      throw new Error(`Google no pudo consultar el contacto (${existingResponse.status})`);
    }
  }

  if (!savedPerson) {
    const createResponse = await fetch(
      "https://people.googleapis.com/v1/people:createContact?personFields=names,phoneNumbers,metadata",
      { method: "POST", headers: googleHeaders, body: JSON.stringify(personBody) },
    );
    if (!createResponse.ok) {
      throw new Error(`Google no pudo crear el contacto (${createResponse.status})`);
    }
    savedPerson = await createResponse.json();
  }

  const resourceName = String(savedPerson.resourceName || "");
  if (!resourceName) throw new Error("Google no devolvió el identificador del contacto");
  const saveLinkResponse = await fetch(
    `${supabaseUrl}/rest/v1/google_contact_links?on_conflict=normalized_phone`,
    {
      method: "POST",
      headers: databaseHeaders(serviceRoleKey, "resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify({
        normalized_phone: normalizedPhone,
        resource_name: resourceName,
        etag: String(savedPerson.etag || ""),
        display_name: `${contactName}${familyName ? ` ${familyName}` : ""}`,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!saveLinkResponse.ok) throw new Error("No se pudo guardar el vínculo del contacto");
};

const dispatchEvent = async (eventId: unknown, vapidPublicKey: string) => {
  if (typeof eventId !== "string" || !/^[0-9a-f-]{36}$/i.test(eventId)) {
    return jsonResponse(400, { ok: false, error: "Evento inválido" });
  }

  const supabaseUrl = requiredSecret("SUPABASE_URL");
  const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
  const claimResponse = await fetch(
    `${supabaseUrl}/rest/v1/notification_events?id=eq.${encodeURIComponent(eventId)}&status=eq.queued&select=id,event_type,payload`,
    {
      method: "PATCH",
      headers: databaseHeaders(serviceRoleKey, "return=representation"),
      body: JSON.stringify({ status: "processing", error: null }),
    },
  );
  const claimedEvents = claimResponse.ok ? await claimResponse.json() : [];
  const event = Array.isArray(claimedEvents) ? claimedEvents[0] : null;
  if (!claimResponse.ok) {
    console.error("No se pudo tomar el evento", await claimResponse.text());
    return jsonResponse(500, { ok: false, error: "No se pudo procesar el evento" });
  }
  if (!event) {
    return jsonResponse(200, { ok: true, ignored: true });
  }

  const eventPayload = event.payload || {};
  let notification: { title: string; body: string; url: string };

  if (event.event_type === "new_student") {
    const details: string[] = [];
    const addDetail = (label: string, value: unknown) => {
      const text = String(value ?? "").trim();
      if (text) details.push(`${label}: ${text}`);
    };
    addDetail("Alumno", eventPayload.name);
    addDetail("Nacimiento", formatDate(eventPayload.birth_date));
    addDetail("Edad", eventPayload.age !== null && eventPayload.age !== undefined ? `${eventPayload.age} años` : "");
    addDetail("Escuela", eventPayload.school);
    addDetail("Responsable", eventPayload.responsible);
    addDetail("Teléfono", eventPayload.phone);
    addDetail("Email", eventPayload.email);
    addDetail("Ciclo", eventPayload.cycle || eventPayload.enrollment_type);
    addDetail("Curso", eventPayload.course);
    addDetail("Sede", eventPayload.site);
    addDetail("Turno", eventPayload.schedule);
    addDetail("Estado", eventPayload.wait_list ? "Lista de espera" : "Inscripción confirmada");
    addDetail("Comentarios", String(eventPayload.comments || "").slice(0, 500));
    notification = {
      title: eventPayload.wait_list ? "Nuevo alumno en lista de espera" : "Nuevo alumno inscripto",
      body: details.join("\n"),
      url: `/ficha-alumno/${eventPayload.student_id}`,
    };
  } else if (event.event_type === "payment_received") {
    const studentIds = Array.isArray(eventPayload.student_ids)
      ? [...new Set(eventPayload.student_ids.map(String))]
      : [];
    let names: string[] = [];
    if (studentIds.length) {
      const studentsResponse = await fetch(
        `${supabaseUrl}/rest/v1/inscripciones?id=in.(${studentIds.map(encodeURIComponent).join(",")})&select=id,nombre,apellido`,
        { headers: databaseHeaders(serviceRoleKey) },
      );
      if (studentsResponse.ok) {
        const students = await studentsResponse.json();
        const namesById = new Map(
          (Array.isArray(students) ? students : []).map((student) => [
            String(student.id),
            `${student.nombre || ""} ${student.apellido || ""}`.trim(),
          ]),
        );
        names = studentIds.map((id) => namesById.get(id) || `Alumno ${id}`);
      }
    }
    const concepts = [];
    if (eventPayload.tuition) concepts.push(`cuota${eventPayload.month && eventPayload.month !== "N/A" ? ` de ${eventPayload.month}` : ""}`);
    if (eventPayload.registration) concepts.push("inscripción");
    const method = String(eventPayload.payment_method || "").toLowerCase();
    notification = {
      title: "Pago recibido",
      body: `${formatCurrency(eventPayload.amount)}${method ? ` en ${method}` : ""}${names.length ? ` — ${names.join(", ")}` : ""}${concepts.length ? ` — ${concepts.join(" e ")}` : ""}.`,
      url: "/pagos?from=pagos-menu",
    };
  } else if (event.event_type === "attendance_recorded") {
    const present = Number(eventPayload.present || 0);
    const absent = Number(eventPayload.absent || 0);
    notification = {
      title: "Asistencia registrada",
      body: `${eventPayload.site || "Sede"} · ${eventPayload.shift || "Turno"} — ${present} presente${present === 1 ? "" : "s"}, ${absent} ausente${absent === 1 ? "" : "s"}.`,
      url: "/asistencias?from=asistencia-menu",
    };
  } else if (event.event_type === "daily_summary") {
    const missingSessions = Array.isArray(eventPayload.missing_sessions)
      ? eventPayload.missing_sessions
      : [];
    const visibleMissing = missingSessions
      .slice(0, 5)
      .map((item) => `${item.site || "Sede"} (${item.shift || "turno"})`);
    const missingText = missingSessions.length
      ? `Falta asistencia: ${visibleMissing.join(", ")}${missingSessions.length > visibleMissing.length ? ` y ${missingSessions.length - visibleMissing.length} más` : ""}.`
      : "Asistencias completas.";
    const paymentCount = Number(eventPayload.payments_count || 0);
    notification = {
      title: "Resumen del día",
      body: `Pagos: ${paymentCount} por ${formatCurrency(eventPayload.payments_total)} (efectivo ${formatCurrency(eventPayload.cash_total)} · transferencias ${formatCurrency(eventPayload.transfer_total)}). ${missingText}`,
      url: "/menu-resumen",
    };
  } else {
    await fetch(`${supabaseUrl}/rest/v1/notification_events?id=eq.${event.id}`, {
      method: "PATCH",
      headers: databaseHeaders(serviceRoleKey),
      body: JSON.stringify({ status: "failed", error: "Tipo de evento desconocido", processed_at: new Date().toISOString() }),
    });
    return jsonResponse(400, { ok: false, error: "Tipo de evento desconocido" });
  }

  if (event.event_type === "new_student") {
    try {
      await syncStudentToGoogleContacts(eventPayload, supabaseUrl, serviceRoleKey);
    } catch (error) {
      console.error("No se pudo sincronizar Google Contactos", error);
    }
  }

  const subscriptionsResponse = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?enabled=eq.true&select=id,endpoint,p256dh,auth`,
    { headers: databaseHeaders(serviceRoleKey) },
  );
  if (!subscriptionsResponse.ok) {
    throw new Error("No se pudieron cargar los celulares registrados");
  }
  const subscriptions = await subscriptionsResponse.json();

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/notification_events?id=eq.${event.id}`, {
      method: "PATCH",
      headers: databaseHeaders(serviceRoleKey),
      body: JSON.stringify({
        status: "failed",
        error: "No hay celulares registrados para recibir notificaciones",
        processed_at: new Date().toISOString(),
      }),
    });
    return jsonResponse(200, { ok: false, delivered: 0, failed: 0, noSubscriptions: true });
  }

  webpush.setVapidDetails(
    requiredSecret("VAPID_SUBJECT"),
    vapidPublicKey,
    requiredSecret("VAPID_PRIVATE_KEY"),
  );

  const results = await Promise.allSettled(
    (Array.isArray(subscriptions) ? subscriptions : []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(notification),
          { TTL: 300 },
        );
        return true;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${subscription.id}`, {
            method: "PATCH",
            headers: databaseHeaders(serviceRoleKey),
            body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
          });
        }
        throw error;
      }
    }),
  );
  const delivered = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - delivered;

  await fetch(`${supabaseUrl}/rest/v1/notification_events?id=eq.${event.id}`, {
    method: "PATCH",
    headers: databaseHeaders(serviceRoleKey),
    body: JSON.stringify({
      status: failed > 0 && delivered === 0 ? "failed" : "sent",
      error: failed > 0 ? `${failed} entrega(s) fallida(s)` : null,
      processed_at: new Date().toISOString(),
    }),
  });

  return jsonResponse(200, { ok: true, delivered, failed });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = requiredSecret("VAPID_PUBLIC_KEY");

    if (request.method === "GET") {
      return jsonResponse(200, { ok: true, publicKey: vapidPublicKey });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Método no permitido" });
    }

    const payload = await request.json();
    if (payload?.action === "dispatch_event") {
      return await dispatchEvent(payload.eventId, vapidPublicKey);
    }

    const adminCode = requiredSecret("PUSH_ADMIN_CODE");
    if (request.headers.get("x-admin-code")?.trim() !== adminCode) {
      return jsonResponse(401, { ok: false, error: "Código privado incorrecto" });
    }

    if (payload?.action === "retry_event") {
      const eventId = String(payload.eventId || "");
      if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
        return jsonResponse(400, { ok: false, error: "Evento inválido" });
      }
      const supabaseUrl = requiredSecret("SUPABASE_URL");
      const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
      const resetResponse = await fetch(
        `${supabaseUrl}/rest/v1/notification_events?id=eq.${encodeURIComponent(eventId)}&select=id`,
        {
          method: "PATCH",
          headers: databaseHeaders(serviceRoleKey, "return=representation"),
          body: JSON.stringify({ status: "queued", error: null, processed_at: null }),
        },
      );
      const resetEvents = resetResponse.ok ? await resetResponse.json() : [];
      if (!resetResponse.ok || !Array.isArray(resetEvents) || !resetEvents.length) {
        return jsonResponse(404, { ok: false, error: "No se encontró el evento" });
      }
      return await dispatchEvent(eventId, vapidPublicKey);
    }

    if (payload?.action === "diagnostics") {
      const supabaseUrl = requiredSecret("SUPABASE_URL");
      const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
      const [subscriptionsResponse, eventsResponse] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/push_subscriptions?select=id,enabled,device_name,updated_at&order=updated_at.desc`,
          { headers: databaseHeaders(serviceRoleKey) },
        ),
        fetch(
          `${supabaseUrl}/rest/v1/notification_events?select=id,event_type,status,error,created_at,processed_at&order=created_at.desc&limit=20`,
          { headers: databaseHeaders(serviceRoleKey) },
        ),
      ]);
      if (!subscriptionsResponse.ok || !eventsResponse.ok) {
        return jsonResponse(500, { ok: false, error: "No se pudo obtener el diagnóstico" });
      }
      const subscriptions = await subscriptionsResponse.json();
      const events = await eventsResponse.json();
      return jsonResponse(200, {
        ok: true,
        subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
        events: Array.isArray(events) ? events : [],
      });
    }

    if (payload?.action !== "register_and_test" || !validSubscription(payload.subscription)) {
      return jsonResponse(400, { ok: false, error: "Suscripción inválida" });
    }

    const subscription = payload.subscription as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    const supabaseUrl = requiredSecret("SUPABASE_URL");
    const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");

    const databaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          device_name: String(payload.deviceName || "Android").slice(0, 100),
          user_agent: String(payload.userAgent || "").slice(0, 500),
          enabled: true,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!databaseResponse.ok) {
      const detail = await databaseResponse.text();
      console.error("No se pudo guardar la suscripción", detail);
      return jsonResponse(500, { ok: false, error: "No se pudo registrar el dispositivo" });
    }

    webpush.setVapidDetails(
      requiredSecret("VAPID_SUBJECT"),
      vapidPublicKey,
      requiredSecret("VAPID_PRIVATE_KEY"),
    );

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: "PLUGIN Gestión",
        body: "¡Notificaciones activadas correctamente!",
        url: "/menu-gestion",
      }),
      { TTL: 60 },
    );

    return jsonResponse(200, { ok: true, message: "Dispositivo registrado y prueba enviada" });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Error interno",
    });
  }
});
