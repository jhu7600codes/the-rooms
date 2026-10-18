// keeps the game on the device after the first load, so it starts fast and works offline.
// two caches: the engine (big, almost never changes) and the game data (changes every update).
// a game update only bumps GAME, so players download the ~24mb game data and keep the ~43mb engine.
// ENGINE is named after the engine files' md5, so a new godot version gets downloaded once too.
const ENGINE = "rooms-engine-785eaee5";
const GAME = "rooms-game-1.37.0";
const ENGINE_FILES = ["index.wasm", "index.js", "index.audio.worklet.js", "index.audio.position.worklet.js"];
// small files are saved right away, the big ones the first time the game loads them (nothing downloads twice)
const SMALL = ["index.html", "logo.png", "manifest.webmanifest", "index.icon.png", "icon-180.png", "icon-192.png", "icon-512.png"];

const isEngine = (url) => ENGINE_FILES.includes(new URL(url).pathname.split("/").pop());

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    await (await caches.open(GAME)).addAll(SMALL);
    // players from before this split have the engine in their old cache: move it over instead of downloading it again
    const engine = await caches.open(ENGINE);
    for (const key of await caches.keys()) {
      if (key === ENGINE || key === GAME) continue;
      const old = await caches.open(key);
      for (const f of ENGINE_FILES) {
        const url = new URL(f, self.registration.scope).href;
        if (await engine.match(url)) continue;
        const hit = await old.match(url, { ignoreSearch: true });
        if (hit) await engine.put(url, hit);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== ENGINE && k !== GAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    // the page itself: network first so updates show up, the saved copy when offline
    if (e.request.mode === "navigate") {
      const cache = await caches.open(GAME);
      try { const r = await fetch(e.request); if (r.ok) cache.put("index.html", r.clone()); return r; }
      catch (err) { return (await cache.match("index.html")) || Response.error(); }
    }
    const cache = await caches.open(isEngine(e.request.url) ? ENGINE : GAME);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const r = await fetch(e.request);
    if (r.ok) cache.put(e.request, r.clone());
    return r;
  })());
});
