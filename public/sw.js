/* Lull service worker: push reminders + offline crisis page. No health data is cached. */

// One offline page per language. Keep in sync with offlinePagePath() in lib/offline.ts.
const OFFLINE_PAGES = { en: "/offline-safety.html", hi: "/offline-safety.hi.html" };
const DEFAULT_LOCALE = "en";
const CACHE = "lull-crisis-v2";
// The page posts its language here; a service worker cannot read document.cookie.
const LOCALE_KEY = "/__lull_locale";

self.addEventListener("install", (event) => {
  // Crisis numbers must survive being offline, so every language is precached on install.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(Object.values(OFFLINE_PAGES).map((url) => c.add(new Request(url, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

/** Remembers the language the app is being used in, so the offline page matches it. */
self.addEventListener("message", (event) => {
  const locale = event.data && event.data.type === "locale" ? event.data.locale : null;
  if (locale && OFFLINE_PAGES[locale]) {
    event.waitUntil(caches.open(CACHE).then((c) => c.put(LOCALE_KEY, new Response(locale))));
  }
});

/**
 * Best guess at the reader's language while offline: what the app last told us, then the
 * browser's own language, then English.
 */
async function offlineUrl() {
  const cache = await caches.open(CACHE);
  try {
    const saved = await cache.match(LOCALE_KEY);
    if (saved) {
      const locale = (await saved.text()).trim();
      if (OFFLINE_PAGES[locale]) return OFFLINE_PAGES[locale];
    }
  } catch {}
  const browser = (self.navigator.language || "").toLowerCase().split("-")[0];
  return OFFLINE_PAGES[browser] || OFFLINE_PAGES[DEFAULT_LOCALE];
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for page loads; if the network fails, serve the offline crisis page.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(async () => {
      const url = await offlineUrl();
      return (await caches.match(url)) ?? Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Lull", body: "Your plan is waiting.", url: "/app/plan", tag: "plan" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app/plan", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
