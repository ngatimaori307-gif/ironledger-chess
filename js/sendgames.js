/* 1.17.0 — every game sent to his son's Iron Ledger by itself (his son's word 26 Nov: "log every game with them and send them to my app
   without the share button, its for his opp book and also … the log we want for the bots he vs on my app so we can improve them aswell,
   and ours"). While this app is open it tries each friend (the people played through Play a Friend) at their invite listener on
   PeerJS's meeting server — the same one invites use, nothing paid, no server of ours. Only Iron Ledger answers "games-hello"; another
   friend's Iron Ledger Chess doesn't, so nothing is sent there. Then the games that app hasn't confirmed go over, SEND.batch at a time,
   as PGN (js/share.js). A game confirmed is never sent again. Both apps must be open at the same time: until then the games wait here.
     {t:"games-hello", v, id, name} → {t:"games-want", v}      {t:"games", v, id, name, games:[{key, pgn}]} → {t:"games-ok", keys} | {t:"games-no", why} */
import { PROTOCOL } from "./friend.js";
import { friends, myId, options, PRESENCE } from "./presence.js";
import { games, settings } from "./store.js";
import { gamePgn } from "./share.js";

export const SEND = { key: "ilc-sent", batch: 25, helloMs: 9000, batchMs: 30000, everyMs: 5 * 60000, keepKeys: 1500 };
const read = () => { try { return JSON.parse(localStorage.getItem(SEND.key) || "null") || {}; } catch { return {}; } };
const write = (d) => { try { localStorage.setItem(SEND.key, JSON.stringify(d)); } catch { /* full: sent again next time, kept once there */ } };
export const sentTo = (id) => { const d = read()[id]; return d ? { games: d.keys.length, last: d.last } : null; };
const localStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;   // his own clock
const parse = (d) => { if (typeof d !== "string") return d; try { return JSON.parse(d); } catch { return null; } };

function sendTo(peer, friend) {                       // → the number sent, or 0 when that app isn't Iron Ledger, isn't open, or has them all
  const done = new Set((read()[friend.id] || { keys: [] }).keys);
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
  sendNow();
  setInterval(() => { if (document.visibilityState === "visible") sendNow(); }, SEND.everyMs);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sendNow(); });
  addEventListener("online", () => sendNow());
  addEventListener("ilc-game-saved", () => sendNow());
}
