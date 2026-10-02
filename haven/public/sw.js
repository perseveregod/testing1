/* Haven service worker: push notifications and tap-to-open. No offline
   caching here on purpose: incident data must never be stale. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Haven", body: "", url: "/alerts", tag: "haven" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Not JSON: show the text as the body.
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body,
    tag: data.tag,
    renotify: false,
    icon: "/icons/192",
    badge: "/icons/192",
    data: { url: data.url },
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, options);
      if (typeof data.badge === "number" && "setAppBadge" in navigator) {
        try {
          await navigator.setAppBadge(data.badge);
        } catch {
          // Badging unsupported here.
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/alerts";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              // Cross-origin or unsupported: fall through to open.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
