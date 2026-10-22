import { createClient } from "@supabase/supabase-js";

let clientPromise;

export function getSupabaseAuthClient() {
  if (!clientPromise) {
    clientPromise = fetch("/config.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la configuración.");
        return response.json();
      })
      .then((config) => {
        if (!config?.supabaseUrl || !config?.supabaseKey) {
          throw new Error("La configuración de acceso está incompleta.");
        }
        return createClient(config.supabaseUrl, config.supabaseKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
      });
  }

  return clientPromise;
}
