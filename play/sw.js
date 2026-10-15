// keeps the game on the device after the first load, so it starts fast and works offline.
// bump VERSION on every new build so players get the update.
const VERSION = "rooms-1.30.0-b3";
// the small files are saved right away. the big ones (index.wasm, index.pck) get saved the first time the game loads them,
// so nothing downloads twice
const FILES = ["index.html", "index.js", "index.audio.worklet.js", "index.audio.position.worklet.js",
  "logo.png", "manifest.webmanifest", "index.icon.png", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  const page = e.request.mode === "navigate";
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // the page itself: try the network first so updates show up, fall back to the cached copy offline
    if (page) {
      try { const r = await fetch(e.request); if (r.ok) cache.put("index.html", r.clone()); return r; }
      catch (err) { return (await cache.match("index.html")) || Response.error(); }
    }
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const r = await fetch(e.request);
    if (r.ok) cache.put(e.request, r.clone());
    return r;
  })());
});
