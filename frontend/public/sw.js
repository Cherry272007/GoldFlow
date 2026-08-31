/* GoldFlow service worker.
 * Registered from the dashboard. Receives Web Push notifications for fresh
 * BUY/SELL signals even when the page is closed, and lets the user tap a
 * notification to open the app.
 */
const CACHE = "goldflow-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = {};
  let body = "";
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    body = event.data ? event.data.text() : "";
  }

  const title = data.title || "GoldFlow";
  const text = data.body || body;

  const options = {
    body: text,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [120, 60, 120],
    data: {
      url: "/",
      signal: data.signal || "",
      confidence: data.confidence || null,
    },
    tag: data.signal || "goldflow",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(target);
      }
    )
  );
});
