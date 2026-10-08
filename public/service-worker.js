self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No se interceptan peticiones ni se cachean datos. La aplicación continúa
// trabajando siempre contra la web y Supabase, igual que antes de instalarla.
