"""Writes site/sw.js: the offline copy of every app file, named by a hash of their contents (a changed file = a new copy).
Run before every push: python3 tools/build_sw.py"""
import hashlib, json, os, sys
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SKIP = {"sw.js"}
SKIP_DIRS = {"tools"}
ON_USE = ("vendor/maia", "vendor/maia3", "vendor/lichess", "vendor/sounds")   # Maia's networks (1.2 MB each) and Maia-3's (10 MB): kept offline the first time each is played, not at install
SKIP_EXT = (".map", ".LICENSE", ".txt", ".md")
files = []
for root, dirs, names in os.walk(SITE):
    dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS)
    for n in sorted(names):
        rel = os.path.relpath(os.path.join(root, n), SITE).replace(os.sep, "/")
        if n in SKIP or n.endswith(SKIP_EXT) or n.startswith(".") or rel.startswith(tuple(d + "/" for d in ON_USE)): continue
        files.append(rel)
h = hashlib.sha256()
for f in files: h.update(f.encode()); h.update(open(os.path.join(SITE, f), "rb").read())
for d in ON_USE:
    if not os.path.isdir(os.path.join(SITE, d)): continue
    for root, dirs, names in os.walk(os.path.join(SITE, d)):          # v1.7: vendor/lichess has folders (a set each)
        dirs.sort()
        for n in sorted(names): f = os.path.join(root, n); h.update(os.path.relpath(f, SITE).encode()); h.update(open(f, "rb").read())   # a changed network or picture: a new copy too
version = h.hexdigest()[:12]
sw = f"""/* Offline copy of Iron Ledger Chess (written by tools/build_sw.py — don't edit by hand). */
const CACHE = "ilc-{version}";
const FILES = {json.dumps(["./"] + files, indent=0)};
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ilc-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {{
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin && {json.dumps(["/" + d + "/" for d in ON_USE])}.some((d) => u.pathname.includes(d)))
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((n) => {{ if (n.ok) c.put(e.request, n.clone()); return n; }}))));
  else if (u.origin === location.origin) e.respondWith(caches.match(e.request, {{ ignoreSearch: true }}).then((r) => r || fetch(e.request)));
  else if (u.host.endsWith("fonts.googleapis.com") || u.host.endsWith("fonts.gstatic.com"))
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((n) => {{ c.put(e.request, n.clone()); return n; }}))));
}});
"""
open(os.path.join(SITE, "sw.js"), "w").write(sw)
print(f"sw.js: {len(files)} files, cache ilc-{version}")
