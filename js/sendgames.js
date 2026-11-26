/* 1.17.0 — every game sent to his son's Iron Ledger by itself (his son's word 26 Nov: "log every game with them and send them to my app
   without the share button, its for his opp book and also … the log we want for the bots he vs on my app so we can improve them aswell,
   and ours"). While this app is open it tries each friend (the people played through Play a Friend) at their invite listener on
   PeerJS's meeting server — the same one invites use, nothing paid, no server of ours. Only Iron Ledger answers "games-hello"; another
   friend's Iron Ledger Chess doesn't, so nothing is sent there. Then the games that app hasn't confirmed go over, SEND.batch at a time,
   as PGN (js/share.js). A game confirmed is never sent again. That road needs both apps open at once; 1.18.0 adds ntfy.sh (postNow below),
   which his son's app collects whenever it runs.
     {t:"games-hello", v, id, name} → {t:"games-want", v}      {t:"games", v, id, name, games:[{key, pgn}]} → {t:"games-ok", keys} | {t:"games-no", why} */
import { PROTOCOL } from "./friend.js";
import { GAMES_NTFY } from "./config.js";
import { friends, myId, options, PRESENCE } from "./presence.js";
import { games, settings } from "./store.js";
import { gamePgn } from "./share.js";

export const SEND = { key: "ilc-sent", batch: 25, helloMs: 9000, batchMs: 30000, everyMs: 5 * 60000, keepKeys: 1500 };
const read = () => { try { return JSON.parse(localStorage.getItem(SEND.key) || "null") || {}; } catch { return {}; } };
const write = (d) => { try { localStorage.setItem(SEND.key, JSON.stringify(d)); } catch { /* full: sent again next time, kept once there */ } };
const localStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;   // his own clock
const parse = (d) => { if (typeof d !== "string") return d; try { return JSON.parse(d); } catch { return null; } };

function sendTo(peer, friend) {                       // → the number sent, or 0 when that app isn't Iron Ledger, isn't open, or has them all
  const done = confirmedKeys();                         // 1.18.0: what arrived by either road isn't sent again
  const todo = games().filter((g) => g && g.pgn && g.at && !done.has(String(g.at))).reverse();   // oldest first
  if (!todo.length) return Promise.resolve(0);
  return new Promise((resolve) => {
    let sent = 0, timer = 0, over = false;
    const c = peer.connect(PRESENCE.prefix + friend.id, { reliable: true });
    const end = () => { if (over) return; over = true; clearTimeout(timer); try { c.close(); } catch { /* gone */ } resolve(sent); };
    const wait = (ms) => { clearTimeout(timer); timer = setTimeout(end, ms); };
    const next = () => {
      const batch = todo.splice(0, SEND.batch); if (!batch.length) return end();
      c.send(JSON.stringify({ t: "games", v: PROTOCOL, id: myId(), name: settings.name || "",
        games: batch.map((g) => ({ key: String(g.at), pgn: gamePgn(g, settings.name) })) }));
      wait(SEND.batchMs);
    };
    c.on("open", () => { c.send(JSON.stringify({ t: "games-hello", v: PROTOCOL, id: myId(), name: settings.name || "" })); wait(SEND.helloMs); });
    c.on("data", (d) => {
      const m = parse(d); if (!m) return;
      if (m.t === "games-want") next();
      else if (m.t === "games-ok") {
        const all = read(), mine = all[friend.id] || { keys: [] }, keys = new Set(mine.keys);
        for (const k of m.keys || []) if (!keys.has(String(k))) { keys.add(String(k)); sent++; }
        all[friend.id] = { keys: [...keys].slice(-SEND.keepKeys), last: localStamp() }; write(all);
        next();
      } else if (m.t === "games-no") end();
    });
    c.on("error", end); c.on("close", end);
    peer.on("error", (e) => { if (e.type === "peer-unavailable") end(); });
    wait(SEND.helloMs);
  });
}
/* 1.18.0 (his son's word 26 Nov 17:43: "we should be able to receive them without having both apps open at once … they go to my app"):
   the same games posted to his son's ntfy.sh topic, which his app collects whenever it runs. Its confirmations (the ack topic) are
   read first; a confirmed game is never posted again, one not yet confirmed is posted again after GAMES_NTFY.repostMs. */
const nread = () => { try { return JSON.parse(localStorage.getItem(GAMES_NTFY.key) || "null") || { ok: [], posted: {}, since: "" }; } catch { return { ok: [], posted: {}, since: "" }; } };
const nwrite = (d) => { try { localStorage.setItem(GAMES_NTFY.key, JSON.stringify(d)); } catch { /* full: posted again later */ } };
export function confirmedKeys() {                     // every game his son's app has said it has, by either road
  const out = new Set(nread().ok); for (const f of Object.values(read())) for (const k of f.keys || []) out.add(String(k)); return out;
}
export function parts(text) {                         // one message, or parts under ntfy.sh's limit (whole characters, never split)
  const enc = new TextEncoder(); if (enc.encode(text).length <= GAMES_NTFY.partBytes) return [text];
  const out = []; let cur = "";
  for (const ch of text) { if (enc.encode(cur + ch).length > GAMES_NTFY.partBytes) { out.push(cur); cur = ""; } cur += ch; }
  if (cur) out.push(cur); return out;
}
let posting = null;
export function postNow() {
  if (posting || !navigator.onLine) return posting || Promise.resolve(0);
  posting = (async () => {
    const d = nread(); let posted = 0;
    try {                                              // what arrived (his app's confirmations)
      const r = await fetch(`${GAMES_NTFY.base}/${GAMES_NTFY.ackTopic}/json?poll=1&since=${encodeURIComponent(d.since || GAMES_NTFY.since)}`);
      const lines = (await r.text()).split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((m) => m && m.event === "message");
      const ok = new Set(d.ok);
      for (const m of lines) { try { const b = JSON.parse(m.message); if (b && b.t === "ok") for (const k of b.keys || []) ok.add(String(k)); } catch { /* not ours */ } }
      if (lines.length) d.since = lines[lines.length - 1].id;
      d.ok = [...ok].slice(-SEND.keepKeys);
    } catch { nwrite(d); return 0; }                     // ntfy.sh not reached: tried again next time
    const done = confirmedKeys(); for (const k of d.ok) done.add(k);
    const now = Date.now(), todo = games().filter((g) => g && g.pgn && g.at && !done.has(String(g.at)) && !(now - (d.posted[String(g.at)] || 0) < GAMES_NTFY.repostMs)).reverse();
    for (const g of todo.slice(0, GAMES_NTFY.postsPerRun)) {
      const key = String(g.at), pieces = parts(gamePgn(g, settings.name));
      if (pieces.length > GAMES_NTFY.maxParts) { d.posted[key] = now; continue; }     // far past any real game: left out
      try {
        for (let i = 0; i < pieces.length; i++) {
          const body = { v: PROTOCOL, id: myId(), n: settings.name || "", k: key, p: pieces[i], ...(pieces.length > 1 ? { i, of: pieces.length } : {}) };
          const r = await fetch(`${GAMES_NTFY.base}/${GAMES_NTFY.topic}`, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status);
        }
        d.posted[key] = now; posted++;
      } catch { break; }                                 // ntfy.sh busy or away: the rest wait for the next round
    }
    for (const k of Object.keys(d.posted)) if (done.has(k)) delete d.posted[k];
    nwrite(d); return posted;
  })().finally(() => { posting = null; });
  return posting;
}
export const ntfyState = () => { const d = nread(); return { confirmed: d.ok.length, waiting: Object.keys(d.posted).length }; };
let running = null;
/* One round: every friend tried once. Never two rounds at once. */
export function sendNow() {
  if (running || !window.Peer || !friends().length || !navigator.onLine) return running || Promise.resolve(0);
  running = new Promise((resolve) => {
    const p = new window.Peer(options()); let total = 0, gone = false;
    const finish = () => { if (gone) return; gone = true; setTimeout(() => p.destroy(), 500); running = null; resolve(total); };
    p.on("open", async () => { for (const f of friends()) total += await sendTo(p, f); finish(); });
    p.on("error", (e) => { if (e.type !== "peer-unavailable") finish(); });
    setTimeout(finish, SEND.helloMs * 2 + SEND.batchMs * friends().length * 4);   // never left hanging
  });
  return running;
}
/* Started once: a round now, after every finished game (match.js), every SEND.everyMs while on screen, and when the app comes back. */
export function startSending() {
  const both = () => { postNow(); sendNow(); };      // 1.18.0: ntfy.sh (his app needn't be open) and, when it is, straight across
  both();
  setInterval(() => { if (document.visibilityState === "visible") both(); }, SEND.everyMs);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") both(); });
  addEventListener("online", both);
  addEventListener("ilc-game-saved", both);
}
