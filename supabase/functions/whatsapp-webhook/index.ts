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
  if (message.type === "reaction") {
    return String(message.reaction?.emoji || "");
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
        const appendMessage = (message: Record<string, any>, direction: "inbound" | "outbound") => {
          const timestamp = Number(message.timestamp || 0);
          const contactPhone = direction === "outbound" ? String(message.to || "") : String(message.from || "");
          if (!message.id || !contactPhone) return;
          records.push({
            wa_message_id: String(message.id),
            from_phone: contactPhone,
            contact_name: contactNames.get(contactPhone) || null,
            message_type: String(message.type || "unknown"),
            text_body: extractText(message) || null,
            media_id: extractMediaId(message) || null,
            payload: { ...message, _direction: direction },
            received_at: timestamp
              ? new Date(timestamp * 1000).toISOString()
              : new Date().toISOString(),
            status: direction === "outbound" ? "read" : "unread",
            direction,
          });
        };

        for (const message of value.messages || []) appendMessage(message, "inbound");
        for (const message of value.message_echoes || []) appendMessage(message, "outbound");
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
            Prefer: "resolution=ignore-duplicates,return=representation",
          },
          body: JSON.stringify(records.map(({ direction: _direction, ...record }) => record)),
        },
      );
      if (!saveResponse.ok) {
        console.error("No se pudieron guardar los mensajes", await saveResponse.text());
        return jsonResponse(500, { ok: false, error: "No se pudieron guardar los mensajes" });
      }

      const savedRecords = await saveResponse.json();
      for (const record of savedRecords) {
        const direction = record.payload?._direction === "outbound" ? "outbound" : "inbound";
        if (direction === "outbound") {
          const preview = record.text_body || `[${record.message_type}]`;
          const updateResponse = await fetch(
            `${supabaseUrl}/rest/v1/whatsapp_conversations?phone=eq.${encodeURIComponent(record.from_phone)}`,
            {
              method: "PATCH",
              headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({
                bot_mode: "human",
                last_message_at: record.received_at,
                last_message_preview: preview,
                updated_at: new Date().toISOString(),
              }),
            },
          );
          if (!updateResponse.ok) {
            console.error("No se pudo actualizar la conversación saliente", await updateResponse.text());
            continue;
          }
          const updated = await updateResponse.json();
          if (!updated.length) {
            const insertResponse = await fetch(`${supabaseUrl}/rest/v1/whatsapp_conversations`, {
              method: "POST",
              headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                phone: record.from_phone,
                contact_name: record.contact_name,
                bot_mode: "human",
                unread_count: 0,
                last_message_at: record.received_at,
                last_message_preview: preview,
              }),
            });
            if (!insertResponse.ok) console.error("No se pudo crear la conversación saliente", await insertResponse.text());
          }
          continue;
        }
        const conversationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/record_whatsapp_inbound`, {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_phone: record.from_phone,
            p_contact_name: record.contact_name,
            p_received_at: record.received_at,
            p_preview: record.text_body || `[${record.message_type}]`,
          }),
        });
        if (!conversationResponse.ok) {
          console.error("No se pudo actualizar la conversación", await conversationResponse.text());
        }
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
