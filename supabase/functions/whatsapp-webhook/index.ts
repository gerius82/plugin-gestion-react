const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
};

const bytesToHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const validMetaSignature = async (rawBody: string, signatureHeader: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requiredSecret("WHATSAPP_APP_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  return safeEqual(signatureHeader.toLowerCase(), `sha256=${bytesToHex(signature)}`);
};

const extractText = (message: Record<string, any>) => {
  if (message.type === "text") return String(message.text?.body || "");
  if (message.type === "button") return String(message.button?.text || "");
  if (message.type === "interactive") {
    return String(
      message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "",
    );
  }
  if (["image", "video", "document"].includes(message.type)) {
    return String(message[message.type]?.caption || "");
  }
  return "";
};

const extractMediaId = (message: Record<string, any>) => {
  const media = message[message.type];
  return media && typeof media === "object" ? String(media.id || "") : "";
};

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge") || "";
      if (mode === "subscribe" && token === requiredSecret("WHATSAPP_VERIFY_TOKEN")) {
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response("Verificación rechazada", { status: 403 });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Método no permitido" });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";
    if (!signature || !(await validMetaSignature(rawBody, signature))) {
      return jsonResponse(401, { ok: false, error: "Firma de Meta inválida" });
    }

    const payload = JSON.parse(rawBody);
    if (payload?.object !== "whatsapp_business_account") {
      return jsonResponse(200, { ok: true, ignored: true });
    }

    const records: Array<Record<string, unknown>> = [];
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contactNames = new Map(
          (value.contacts || []).map((contact: Record<string, any>) => [
            String(contact.wa_id || ""),
            String(contact.profile?.name || ""),
          ]),
        );
        for (const message of value.messages || []) {
          const timestamp = Number(message.timestamp || 0);
          records.push({
            wa_message_id: String(message.id),
            from_phone: String(message.from || ""),
            contact_name: contactNames.get(String(message.from || "")) || null,
            message_type: String(message.type || "unknown"),
            text_body: extractText(message) || null,
            media_id: extractMediaId(message) || null,
            payload: message,
            received_at: timestamp
              ? new Date(timestamp * 1000).toISOString()
              : new Date().toISOString(),
          });
        }
      }
    }

    if (records.length) {
      const supabaseUrl = requiredSecret("SUPABASE_URL");
      const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
      const saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/whatsapp_messages?on_conflict=wa_message_id`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "resolution=ignore-duplicates,return=minimal",
          },
          body: JSON.stringify(records),
        },
      );
      if (!saveResponse.ok) {
        console.error("No se pudieron guardar los mensajes", await saveResponse.text());
        return jsonResponse(500, { ok: false, error: "No se pudieron guardar los mensajes" });
      }
    }

    return jsonResponse(200, { ok: true, received: records.length });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Error interno",
    });
  }
});
