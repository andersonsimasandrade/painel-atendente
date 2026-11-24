// Service worker do painel: só recebe os avisos (push) e abre a tela certa ao tocar. Não guarda páginas em cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = {};
  }
  const opts = {
    body: d.corpo || "",
    icon: "/img/icone-app-192.png",
    badge: "/img/icone-app-192.png",
    data: { url: d.url || "/" },
  };
  if (d.tag) {
    opts.tag = d.tag;
    opts.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(d.titulo || "Painel", opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alvo = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) {
          if ("navigate" in c) c.navigate(alvo).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(alvo);
    }),
  );
});
