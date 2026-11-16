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

const normalizeBotText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesBotIntent = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

const summerEnrollmentUrl = "https://gestion.plugin.ar/verano2027";

const sendSummerBotReply = async (
  record: Record<string, any>,
  text: string,
  mode: "active" | "paused" | "human" = "active",
) => {
  const supabaseUrl = requiredSecret("SUPABASE_URL");
  const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
  const phoneNumberId = requiredSecret("WHATSAPP_PHONE_NUMBER_ID");
  const graphResponse = await fetch(`https://graph.facebook.com/v24.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredSecret("WHATSAPP_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: record.from_phone,
      context: record.wa_message_id ? { message_id: record.wa_message_id } : undefined,
      type: "text",
      text: { preview_url: true, body: text },
    }),
  });
  const graphResult = await graphResponse.json().catch(() => ({}));
  const messageId = String(graphResult?.messages?.[0]?.id || "");
  if (!graphResponse.ok || !messageId) {
    console.error("No se pudo enviar la respuesta automatica del Taller de Verano", graphResult);
    return false;
  }

  const sentAt = new Date().toISOString();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  await fetch(`${supabaseUrl}/rest/v1/whatsapp_messages?on_conflict=wa_message_id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      wa_message_id: messageId,
      from_phone: record.from_phone,
      message_type: "text",
      text_body: text,
      payload: {
        id: messageId,
        to: record.from_phone,
        type: "text",
        text: { body: text },
        _direction: "outbound",
        _source: "summer_campaign_bot",
      },
      received_at: sentAt,
      status: "sent",
    }),
  });
  await fetch(`${supabaseUrl}/rest/v1/whatsapp_conversations?phone=eq.${encodeURIComponent(record.from_phone)}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      bot_mode: mode,
      bot_step: mode === "human" ? "human" : "summer_enrollment",
      last_message_at: sentAt,
      last_message_preview: text,
      updated_at: sentAt,
    }),
  });
  return true;
};

const handleSummerCampaignReply = async (record: Record<string, any>) => {
  if (!record.text_body || !["text", "button", "interactive"].includes(String(record.message_type || ""))) return;
  const supabaseUrl = requiredSecret("SUPABASE_URL");
  const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  const recipientResponse = await fetch(
    `${supabaseUrl}/rest/v1/whatsapp_campaign_recipients?phone=eq.${encodeURIComponent(record.from_phone)}&status=in.(sent,delivered,read)&select=campaign_id&order=created_at.desc&limit=10`,
    { headers },
  );
  if (!recipientResponse.ok) {
    console.error("No se pudo identificar al destinatario de la campana", await recipientResponse.text());
    return;
  }
  const recipients = await recipientResponse.json();
  const campaignIds = [...new Set((recipients || []).map((item: Record<string, any>) => String(item.campaign_id || "")).filter(Boolean))];
  if (!campaignIds.length) return;
  const campaignResponse = await fetch(
    `${supabaseUrl}/rest/v1/whatsapp_campaigns?id=in.(${campaignIds.join(",")})&template_name=eq.inscripcion_verano_2027&select=id&limit=1`,
    { headers },
  );
  if (!campaignResponse.ok || !(await campaignResponse.json()).length) return;

  const conversationResponse = await fetch(
    `${supabaseUrl}/rest/v1/whatsapp_conversations?phone=eq.${encodeURIComponent(record.from_phone)}&select=bot_mode&limit=1`,
    { headers },
  );
  const conversation = conversationResponse.ok ? (await conversationResponse.json())?.[0] : null;
  if (conversation && conversation.bot_mode !== "active") return;

  const input = normalizeBotText(record.text_body);
  if (includesBotIntent(input, ["persona", "humano", "asesor", "hablar con alguien", "quiero consultar"])) {
    await sendSummerBotReply(
      record,
      "Perfecto. Dejé pausadas las respuestas automáticas y una persona continuará la conversación apenas esté disponible.",
      "human",
    );
    return;
  }
  if (includesBotIntent(input, ["no me interesa", "dar de baja", "no enviar", "no quiero recibir", "stop", "baja"])) {
    await sendSummerBotReply(record, "Entendido. No enviaremos más respuestas automáticas en esta conversación.", "paused");
    return;
  }

  const detail = includesBotIntent(input, ["horario", "turno", "sede", "direccion", "precio", "cuota", "valor"])
    ? "En el formulario vas a poder ver y elegir la sede y el turno disponible. La cuota mensual es de $65.000 y la inscripción no tiene cargo."
    : "Podés completar la inscripción y elegir sede y turno desde el formulario.";
  await sendSummerBotReply(
    record,
    `${detail}\n\n👉 Inscribite al Taller de Verano 2027:\n${summerEnrollmentUrl}\n\nSi necesitás ayuda, respondé *persona* y te atendemos.`,
  );
};

const notifyIncomingMedia = async (record: Record<string, any>) => {
  if (!["image", "document"].includes(String(record.message_type || ""))) return;
  const label = String(record.contact_name || "").trim() || `+${record.from_phone}`;
  const fileType = record.message_type === "document" ? "PDF o documento" : "imagen";
  try {
    const response = await fetch(`${requiredSecret("SUPABASE_URL")}/functions/v1/push-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-code": requiredSecret("PUSH_ADMIN_CODE"),
      },
      body: JSON.stringify({
        action: "send_custom_notification",
        title: "Posible comprobante por WhatsApp",
        body: `${label} envió una ${fileType}. Tocá para analizarla.`,
        url: `/whatsapp-centro?phone=${encodeURIComponent(record.from_phone)}&analyze=${encodeURIComponent(record.id)}`,
        actionTitle: "Analizar pago",
      }),
    });
    if (!response.ok) console.error("No se pudo notificar el archivo recibido", await response.text());
  } catch (error) {
    console.error("No se pudo notificar el archivo recibido", error);
  }
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
    const deliveryStatuses: Array<Record<string, any>> = [];
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
        for (const status of value.statuses || []) {
          if (status?.id && status?.status) deliveryStatuses.push(status);
        }
      }
    }

    if (deliveryStatuses.length) {
      const supabaseUrl = requiredSecret("SUPABASE_URL");
      const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
      const touchedCampaigns = new Set<string>();
      for (const item of deliveryStatuses) {
        const messageId = String(item.id || "");
        const state = String(item.status || "").toLowerCase();
        if (!messageId || !["sent", "delivered", "read", "failed"].includes(state)) continue;
        const timestamp = Number(item.timestamp || 0);
        const occurredAt = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
        const error = (item.errors || [])
          .map((entry: Record<string, any>) => entry?.error_data?.details || entry?.title || entry?.message)
          .filter(Boolean)
          .join(" · ")
          .slice(0, 1000);
        const messageUpdate = await fetch(
          `${supabaseUrl}/rest/v1/whatsapp_messages?wa_message_id=eq.${encodeURIComponent(messageId)}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ status: state }),
          },
        );
        if (!messageUpdate.ok) console.error("No se pudo actualizar el estado del mensaje", await messageUpdate.text());

        const recipientPatch: Record<string, any> = { status: state, updated_at: occurredAt };
        if (state === "delivered") recipientPatch.delivered_at = occurredAt;
        if (state === "read") recipientPatch.read_at = occurredAt;
        if (state === "failed") recipientPatch.error = error || "Meta informó que el mensaje no pudo entregarse.";
        const recipientUpdate = await fetch(
          `${supabaseUrl}/rest/v1/whatsapp_campaign_recipients?wa_message_id=eq.${encodeURIComponent(messageId)}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(recipientPatch),
          },
        );
        if (!recipientUpdate.ok) {
          console.error("No se pudo actualizar el destinatario de campaña", await recipientUpdate.text());
        } else {
          const updatedRecipients = await recipientUpdate.json().catch(() => []);
          for (const recipient of updatedRecipients || []) {
            if (recipient?.campaign_id) touchedCampaigns.add(String(recipient.campaign_id));
          }
        }
      }

      for (const campaignId of touchedCampaigns) {
        const statusesResponse = await fetch(
          `${supabaseUrl}/rest/v1/whatsapp_campaign_recipients?campaign_id=eq.${encodeURIComponent(campaignId)}&select=status`,
          { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
        );
        if (!statusesResponse.ok) continue;
        const statuses = await statusesResponse.json();
        const sentCount = statuses.filter((entry: Record<string, any>) => ["sent", "delivered", "read"].includes(entry.status)).length;
        const failedCount = statuses.filter((entry: Record<string, any>) => entry.status === "failed").length;
        const pendingCount = statuses.filter((entry: Record<string, any>) => ["queued", "processing"].includes(entry.status)).length;
        const campaignUpdate = await fetch(
          `${supabaseUrl}/rest/v1/whatsapp_campaigns?id=eq.${encodeURIComponent(campaignId)}&status=neq.cancelled`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              sent_count: sentCount,
              failed_count: failedCount,
              ...(pendingCount === 0 ? { status: "completed", completed_at: new Date().toISOString() } : {}),
            }),
          },
        );
        if (!campaignUpdate.ok) console.error("No se pudo actualizar el resumen de campaña", await campaignUpdate.text());
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
        await notifyIncomingMedia(record);
        await handleSummerCampaignReply(record);
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
