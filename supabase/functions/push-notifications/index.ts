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
    const details = [eventPayload.course, eventPayload.site, eventPayload.schedule].filter(Boolean);
    notification = {
      title: eventPayload.wait_list ? "Nuevo alumno en lista de espera" : "Nuevo alumno",
      body: `${eventPayload.name || "Alumno"} se inscribió${details.length ? ` — ${details.join(" · ")}` : ""}.`,
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
  } else {
    await fetch(`${supabaseUrl}/rest/v1/notification_events?id=eq.${event.id}`, {
      method: "PATCH",
      headers: databaseHeaders(serviceRoleKey),
      body: JSON.stringify({ status: "failed", error: "Tipo de evento desconocido", processed_at: new Date().toISOString() }),
    });
    return jsonResponse(400, { ok: false, error: "Tipo de evento desconocido" });
  }

  const subscriptionsResponse = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?enabled=eq.true&select=id,endpoint,p256dh,auth`,
    { headers: databaseHeaders(serviceRoleKey) },
  );
  if (!subscriptionsResponse.ok) {
    throw new Error("No se pudieron cargar los celulares registrados");
  }
  const subscriptions = await subscriptionsResponse.json();

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
