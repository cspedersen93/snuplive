// Relived · appen på hjemmeskærmen. Tre ting:
// 1) besked på telefonen (web push), og et tal på app-ikonet, mens der er ulæste beskeder,
// 2) en side uden net (public/offline.html), når man åbner en side uden forbindelse,
// 3) ikke andet: alt andet hentes som normalt fra nettet, så siden aldrig er gammel.
const OFFLINE_CACHE = "relived-offline-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_FILES = [OFFLINE_URL];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((c) => c.addAll(OFFLINE_FILES))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("relived-offline-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Kun sideskift: prøv nettet først. Kun hvis der ikke er net, vises offline.html (alt står i den ene fil).
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode !== "navigate" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).catch(() =>
      caches.match(OFFLINE_URL).then(
        (r) => r || new Response("Du er ikke på nettet.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }),
      ),
    ),
  );
});

async function updateBadge() {
  if (!self.navigator || !("setAppBadge" in self.navigator)) return;
  try {
    const n = (await self.registration.getNotifications()).length;
    if (n > 0) await self.navigator.setAppBadge(n);
    else await self.navigator.clearAppBadge();
  } catch {
    // Tallet på ikonet er pynt.
  }
}

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration
      .showNotification(d.title || "Relived", {
        body: d.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: d.tag || undefined,
        data: { url: d.url || "/" },
      })
      .then(updateBadge),
  );
});

self.addEventListener("notificationclose", (e) => {
  e.waitUntil(updateBadge());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin);
  if (url.origin !== self.location.origin) url = new URL("/", self.location.origin);
  e.waitUntil(
    updateBadge().then(() =>
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const c of list) {
          if (c.url === url.href && "focus" in c) return c.focus();
        }
        return self.clients.openWindow(url.href);
      }),
    ),
  );
});
