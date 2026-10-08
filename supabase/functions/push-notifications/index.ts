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

    const adminCode = requiredSecret("PUSH_ADMIN_CODE");
    if (request.headers.get("x-admin-code")?.trim() !== adminCode) {
      return jsonResponse(401, { ok: false, error: "Código privado incorrecto" });
    }

    const payload = await request.json();
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
