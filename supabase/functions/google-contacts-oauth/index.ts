const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-admin-code",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const redirectUri =
  "https://cvogoablzgymmodegfft.supabase.co/functions/v1/google-contacts-oauth/callback";
const appUrl = "https://gestionplugin2.netlify.app/instalar-app";
const expectedEmail = "plugin.robotica@gmail.com";

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

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const signState = async () => {
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ expiresAt: Date.now() + 10 * 60 * 1000, nonce: crypto.randomUUID() }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64(requiredSecret("GOOGLE_CONTACTS_TOKEN_KEY")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  return `${payload}.${toBase64Url(signature)}`;
};

const validateState = async (state: string) => {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64(requiredSecret("GOOGLE_CONTACTS_TOKEN_KEY")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - signature.length % 4) % 4)),
      (character) => character.charCodeAt(0),
    ),
    new TextEncoder().encode(payload),
  );
  if (!valid) return false;
  const decoded = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4)),
        (character) => character.charCodeAt(0),
      ),
    ),
  );
  return Number(decoded.expiresAt) > Date.now();
};

const encryptRefreshToken = async (refreshToken: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64(requiredSecret("GOOGLE_CONTACTS_TOKEN_KEY")),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(refreshToken),
    ),
  );
  return { ciphertext: toBase64Url(encrypted), iv: toBase64Url(iv) };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(request.url);
    const supabaseUrl = requiredSecret("SUPABASE_URL");
    const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
    const databaseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    if (request.method === "GET" && url.pathname.endsWith("/callback")) {
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      if (!code || !(await validateState(state))) {
        return Response.redirect(`${appUrl}?googleContacts=error`, 302);
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: requiredSecret("GOOGLE_CONTACTS_CLIENT_ID"),
          client_secret: requiredSecret("GOOGLE_CONTACTS_CLIENT_SECRET"),
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.refresh_token || !tokenData.access_token) {
        console.error("Google no devolvió tokens", tokenData);
        return Response.redirect(`${appUrl}?googleContacts=error`, 302);
      }

      const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const user = await userResponse.json();
      if (!userResponse.ok || String(user.email || "").toLowerCase() !== expectedEmail) {
        return Response.redirect(`${appUrl}?googleContacts=wrong-account`, 302);
      }

      const encrypted = await encryptRefreshToken(tokenData.refresh_token);
      const saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/google_contacts_connection?on_conflict=id`,
        {
          method: "POST",
          headers: { ...databaseHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            id: 1,
            account_email: expectedEmail,
            refresh_token_ciphertext: encrypted.ciphertext,
            refresh_token_iv: encrypted.iv,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!saveResponse.ok) throw new Error("No se pudo guardar la conexión de Google");
      return Response.redirect(`${appUrl}?googleContacts=connected`, 302);
    }

    if (request.method === "GET" && url.searchParams.get("action") === "status") {
      const statusResponse = await fetch(
        `${supabaseUrl}/rest/v1/google_contacts_connection?id=eq.1&select=account_email,connected_at`,
        { headers: databaseHeaders },
      );
      const rows = statusResponse.ok ? await statusResponse.json() : [];
      const connection = Array.isArray(rows) ? rows[0] : null;
      return jsonResponse(200, {
        ok: true,
        connected: !!connection,
        accountEmail: connection?.account_email || null,
        connectedAt: connection?.connected_at || null,
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Método no permitido" });
    }
    if (request.headers.get("x-admin-code")?.trim() !== requiredSecret("PUSH_ADMIN_CODE")) {
      return jsonResponse(401, { ok: false, error: "Código privado incorrecto" });
    }
    const payload = await request.json();
    if (payload?.action !== "start") {
      return jsonResponse(400, { ok: false, error: "Acción inválida" });
    }

    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: requiredSecret("GOOGLE_CONTACTS_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/contacts",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      login_hint: expectedEmail,
      state: await signState(),
    }).toString();
    return jsonResponse(200, { ok: true, authorizationUrl: authorizationUrl.toString() });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Error interno",
    });
  }
});
