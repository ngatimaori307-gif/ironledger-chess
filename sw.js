/* Offline copy of Iron Ledger Chess (written by tools/build_sw.py — don't edit by hand). */
const CACHE = "ilc-c2f6d09fbb9d";
const FILES = [
"./",
"index.html",
"manifest.webmanifest",
"css/app.css",
"css/components.css",
"css/tokens.css",
"img/icon-192.png",
"img/icon-512.png",
"img/icon-maskable-512.png",
"js/app.js",
"js/arrows.js",
"js/board.js",
"js/board3d.js",
"js/capturefx.js",
"js/config.js",
"js/engine.js",
"js/friend.js",
"js/guard.js",
"js/illusion.js",
"js/log.js",
"js/looks-data.js",
"js/looks.js",
"js/maia-net.js",
"js/maia-worker.js",
"js/maia.js",
"js/maia3-net.js",
"js/maia3-worker.js",
"js/maia3.js",
"js/match.js",
"js/personality.js",
"js/presence.js",
"js/rating.js",
"js/review.js",
"js/sound.js",
"js/store.js",
"js/tension.js",
"js/screens/computer.js",
"js/screens/duel.js",
"js/screens/friend.js",
"js/screens/game.js",
"js/screens/gameview.js",
"js/screens/hardcore.js",
"js/screens/home.js",
"js/screens/ladder.js",
"js/screens/me.js",
"js/screens/play.js",
"js/screens/profile.js",
"js/screens/replay.js",
"js/screens/ui.js",
"vendor/chess.js",
"vendor/peerjs.min.js",
"vendor/pieces-wood.js",
"vendor/stockfish/stockfish-19-lite-single.js",
"vendor/stockfish/stockfish-19-lite-single.wasm"
];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ilc-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin && ["/vendor/maia/", "/vendor/maia3/", "/vendor/lichess/", "/vendor/sounds/", "/vendor/three/"].some((d) => u.pathname.includes(d)))
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((n) => { if (n.ok) c.put(e.request, n.clone()); return n; }))));
  else if (u.origin === location.origin) e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
  else if (u.host.endsWith("fonts.googleapis.com") || u.host.endsWith("fonts.gstatic.com"))
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((n) => { c.put(e.request, n.clone()); return n; }))));
});
