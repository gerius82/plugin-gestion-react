self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "Tenés una nueva notificación." };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "PLUGIN Gestión", {
      body: payload.body || "Tenés una nueva notificación.",
      icon: "/app-icon-192.png",
      badge: "/notification-badge-96.png",
      data: { url: payload.url || "/menu-gestion" },
      ...(Array.isArray(payload.actions) && payload.actions.length
        ? { actions: payload.actions.slice(0, 2) }
        : {}),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(
    event.notification.data?.url || "/menu-gestion",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existingClient) {
        existingClient.navigate(destination);
        return existingClient.focus();
      }
      return self.clients.openWindow(destination);
    })
  );
});

// No se interceptan peticiones ni se cachean datos. La aplicación continúa
// trabajando siempre contra la web y Supabase, igual que antes de instalarla.
