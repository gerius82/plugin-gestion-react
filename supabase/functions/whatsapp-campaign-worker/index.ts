const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
};

const supabaseUrl = () => requiredSecret("SUPABASE_URL");
const serviceRoleKey = () => requiredSecret("SUPABASE_SERVICE_ROLE_KEY");

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey(),
      Authorization: `Bearer ${serviceRoleKey()}`,
      ...(init.headers as Record<string, string> || {}),
    },
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const argentinaParts = (value = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

const campaignIsInWindow = (campaign: Record<string, any>, now = new Date()) => {
  const local = argentinaParts(now);
  const start = String(campaign.window_start || "").slice(0, 5);
  const end = String(campaign.window_end || "").slice(0, 5);
  return local.date >= String(campaign.scheduled_date || "") && local.time >= start && local.time < end;
};

const summarizeCampaign = async (campaignId: string) => {
  const recipients = await rest(
    `whatsapp_campaign_recipients?campaign_id=eq.${encodeURIComponent(campaignId)}&select=status`,
  ) || [];
  const sentStatuses = new Set(["sent", "delivered", "read"]);
  const sentCount = recipients.filter((item: Record<string, any>) => sentStatuses.has(item.status)).length;
  const failedCount = recipients.filter((item: Record<string, any>) => item.status === "failed").length;
  const pendingCount = recipients.filter((item: Record<string, any>) => ["queued", "processing"].includes(item.status)).length;
  const cancelledCount = recipients.filter((item: Record<string, any>) => item.status === "cancelled").length;
  const complete = pendingCount === 0;
  await rest(`whatsapp_campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      sent_count: sentCount,
      failed_count: failedCount,
      ...(complete ? { status: "completed", completed_at: new Date().toISOString() } : {}),
    }),
  });
  return { sentCount, failedCount, pendingCount, cancelledCount, complete };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { ok: false, error: "Método no permitido" });

  try {
    const now = new Date();
    const due = await rest(
      `whatsapp_campaign_recipients?status=eq.queued&scheduled_for=lte.${encodeURIComponent(now.toISOString())}&select=id,campaign_id,phone,display_name,attempts&order=scheduled_for.asc&limit=12`,
    ) || [];
    if (!due.length) return jsonResponse(200, { ok: true, processed: 0 });

    const campaignCache = new Map<string, Record<string, any>>();
    const accessToken = requiredSecret("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = requiredSecret("WHATSAPP_PHONE_NUMBER_ID");
    const touchedCampaigns = new Set<string>();
    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const candidate of due) {
      let campaign = campaignCache.get(candidate.campaign_id);
      if (!campaign) {
        campaign = (await rest(
          `whatsapp_campaigns?id=eq.${encodeURIComponent(candidate.campaign_id)}&select=*&limit=1`,
        ) || [])[0];
        if (campaign) campaignCache.set(candidate.campaign_id, campaign);
      }
      if (!campaign || !["queued", "running"].includes(campaign.status) || !campaignIsInWindow(campaign, now)) continue;

      const claimed = await rest(
        `whatsapp_campaign_recipients?id=eq.${encodeURIComponent(candidate.id)}&status=eq.queued`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({
            status: "processing",
            attempts: Number(candidate.attempts || 0) + 1,
            error: null,
            updated_at: now.toISOString(),
          }),
        },
      ) || [];
      if (!claimed.length) continue;

      touchedCampaigns.add(candidate.campaign_id);
      processed += 1;
      if (campaign.status === "queued") {
        await rest(`whatsapp_campaigns?id=eq.${encodeURIComponent(candidate.campaign_id)}&status=eq.queued`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "running", started_at: now.toISOString() }),
        });
        campaign.status = "running";
      }

      try {
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
              to: candidate.phone,
              type: "template",
              template: {
                name: campaign.template_name,
                language: { code: campaign.template_language },
                components: [{
                  type: "header",
                  parameters: [{ type: "image", image: { id: campaign.image_media_id } }],
                }],
              },
            }),
          },
        );
        const graphResult = await graphResponse.json().catch(() => ({}));
        const messageId = String(graphResult?.messages?.[0]?.id || "");
        if (!graphResponse.ok || !messageId) {
          throw new Error(
            graphResult?.error?.error_data?.details
              || graphResult?.error?.message
              || "Meta rechazó el envío.",
          );
        }

        const sentAt = new Date().toISOString();
        await rest(`whatsapp_campaign_recipients?id=eq.${encodeURIComponent(candidate.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            status: "sent",
            wa_message_id: messageId,
            sent_at: sentAt,
            updated_at: sentAt,
          }),
        });
        await rest("whatsapp_messages?on_conflict=wa_message_id", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({
            wa_message_id: messageId,
            from_phone: candidate.phone,
            contact_name: candidate.display_name || null,
            message_type: "template",
            text_body: "Taller de Robótica de Verano 2027",
            media_id: campaign.image_media_id,
            payload: {
              id: messageId,
              to: candidate.phone,
              type: "template",
              template: { name: campaign.template_name, language: campaign.template_language },
              campaign_id: candidate.campaign_id,
              _direction: "outbound",
              _source: "plugin_campaign",
            },
            received_at: sentAt,
            status: "sent",
          }),
        });
        await rest("whatsapp_conversations?on_conflict=phone", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            phone: candidate.phone,
            unread_count: 0,
            last_message_at: sentAt,
            last_message_preview: "Taller de Robótica de Verano 2027",
            updated_at: sentAt,
          }),
        });
        sent += 1;
      } catch (error) {
        const attempts = Number(candidate.attempts || 0) + 1;
        const retry = attempts < 3;
        const nextAttempt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await rest(`whatsapp_campaign_recipients?id=eq.${encodeURIComponent(candidate.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            status: retry ? "queued" : "failed",
            scheduled_for: retry ? nextAttempt : claimed[0].scheduled_for,
            error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
            updated_at: new Date().toISOString(),
          }),
        });
        if (!retry) failed += 1;
      }
    }

    const summaries: Record<string, unknown> = {};
    for (const campaignId of touchedCampaigns) summaries[campaignId] = await summarizeCampaign(campaignId);
    return jsonResponse(200, { ok: true, processed, sent, failed, campaigns: summaries });
  } catch (error) {
    console.error("whatsapp-campaign-worker", error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo procesar la campaña.",
    });
  }
});
