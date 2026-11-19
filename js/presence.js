/* Invites that pop up, as on chess.com. Friends are the people played through Play a Friend (each app gives itself an id on first use
   and both swap it in the game's hello / start). While the app is open, and there is a friend, it waits for invites at
   "ironledger-chess-u-<its id>" on PeerJS's meeting server — the same scheme as the developer app (Iron Ledger, app/friendpresence.js). An invite shows on any screen: "<name> invites you to a game" with Accept / Decline; Accept opens the game.
     {t:"invite", v, code, hostColor, name, id}   inviter → friend (the inviter hosts the game "code")
     {t:"invite-yes"} {t:"invite-no"}             friend → inviter
   Only while the app is open: a closed app can't be reached (no server of ours to hold the invite) — then the link still works. */
import { FRIEND } from "./config.js";
import { PROTOCOL } from "./friend.js";
import { esc } from "./screens/ui.js";
export const PRESENCE = { key: "ilc-friends", prefix: FRIEND.idPrefix + "u-", idLength: 10, answerMs: 60000, reachMs: 9000, keepFriends: 20 };
const read = () => { try { return JSON.parse(localStorage.getItem(PRESENCE.key) || "null") || { id: "", list: [] }; } catch { return { id: "", list: [] }; } };
const write = (d) => { try { localStorage.setItem(PRESENCE.key, JSON.stringify(d)); } catch { /* full */ } };
export function myId() {
  const d = read(); if (d.id) return d.id;
  const a = FRIEND.codeAlphabet, r = crypto.getRandomValues(new Uint32Array(PRESENCE.idLength));
  d.id = [...r].map((x) => a[x % a.length]).join(""); write(d); return d.id;
}
export function friends() { return read().list; }
export function addFriend(id, name) {
  id = String(id || "").replace(/[^A-Z0-9]/g, "").slice(0, PRESENCE.idLength); if (id.length !== PRESENCE.idLength || id === myId()) return;
  const d = read(); d.list = [{ id, name: String(name || "").slice(0, 24) || "Friend", at: Date.now() }, ...d.list.filter((f) => f.id !== id)].slice(0, PRESENCE.keepFriends);
  write(d); if (!state.peer) start();
}
export function removeFriend(id) { const d = read(); d.list = d.list.filter((f) => f.id !== id); write(d); }
const state = { peer: null, opts: null, waiting: false };
function options() {
  let o = FRIEND.peer; try { o = { ...o, ...JSON.parse(localStorage.getItem(FRIEND.serverOverrideKey) || "{}") }; } catch { /* none */ } return o;
}
/* Waits for invites while the app is open (only once he has a friend; never in Offline mode). */
export async function start() {
  if (state.peer || !friends().length || !window.Peer) return false;
  const p = state.peer = new window.Peer(PRESENCE.prefix + myId(), options());
  p.on("connection", (c) => c.on("data", (d) => { let m = d; if (typeof d === "string") { try { m = JSON.parse(d); } catch { return; } } if (m && m.t === "invite") popUp(c, m); }));
  p.on("disconnected", () => setTimeout(() => { if (state.peer === p && !p.destroyed) p.reconnect(); }, FRIEND.reconnectEveryMs));
  p.on("error", (e) => { if (e.type === "unavailable-id") { p.destroy(); if (state.peer === p) state.peer = null; } });   // the app open twice: the other one listens
  if (!state.watching) {                                         // v1.6.1: iOS closes the server link while the app is away — re-make it on return
    state.watching = true;
    const back = () => { if (document.visibilityState !== "visible") return; const q = state.peer;
      if (q && !q.destroyed && q.disconnected) { try { q.reconnect(); } catch { /* re-made below */ } }
      else if (q && q.destroyed) { state.peer = null; start(); } };
    document.addEventListener("visibilitychange", back); addEventListener("online", back); addEventListener("pageshow", back);
  }
  return true;
}
function popUp(conn, m) {
  const code = String(m.code || "").replace(/[^A-Z0-9]/g, "").slice(0, FRIEND.codeLength); if (code.length !== FRIEND.codeLength) return;
  addFriend(m.id, m.name);
  const box = document.createElement("div"); box.className = "invite-pop"; box.setAttribute("role", "alertdialog");
  const you = m.hostColor === "w" ? "Black" : m.hostColor === "b" ? "White" : "either colour";
  box.innerHTML = `<div class="ilc-plate col"><b class="ip-title">${esc(m.name || "A friend")} invites you to a game</b><p class="sub">You play ${you}</p>
    <div class="row"><button class="ilc-btn ilc-btn--primary" data-a="yes">Accept</button><button class="ilc-btn" data-a="no">Decline</button></div></div>`;
  const done = (yes) => { box.remove(); clearTimeout(t); try { conn.send(JSON.stringify({ t: yes ? "invite-yes" : "invite-no" })); } catch { /* gone */ }
    if (yes) location.hash = "#" + FRIEND.joinHashKey + "=" + code; };
  box.onclick = (e) => { const b = e.target.closest("[data-a]"); if (b) done(b.dataset.a === "yes"); };
  const t = setTimeout(() => box.remove(), PRESENCE.answerMs);
  document.body.append(box);
  try { navigator.vibrate && navigator.vibrate(120); } catch { /* none */ }
}
/* Sends an invite to a friend's open app → "accepted" | "declined" | "offline" (not open, or no answer in time) */
export async function invite(friend, { code, hostColor, name }) {
  if (!window.Peer) return "offline";
  const own = !state.peer, p = state.peer || new window.Peer(options());
  return new Promise((resolve) => {
    let c = null, settled = false;
    const end = (r) => { if (settled) return; settled = true; clearTimeout(t1); clearTimeout(t2); try { c && c.close(); } catch { /* gone */ } if (own) setTimeout(() => p.destroy(), 500); resolve(r); };
    const t1 = setTimeout(() => { if (!c || !c.open) end("offline"); }, PRESENCE.reachMs);
    const t2 = setTimeout(() => end("offline"), PRESENCE.answerMs + PRESENCE.reachMs);
    const go = () => {
      c = p.connect(PRESENCE.prefix + friend.id, { reliable: true });
      c.on("open", () => c.send(JSON.stringify({ t: "invite", v: PROTOCOL, code, hostColor, name, id: myId() })));
      c.on("data", (d) => { let m = d; if (typeof d === "string") { try { m = JSON.parse(d); } catch { return; } } if (m && m.t === "invite-yes") end("accepted"); else if (m && m.t === "invite-no") end("declined"); });
    };
    p.on("error", (e) => { if (e.type === "peer-unavailable") end("offline"); });
    if (p.open) go(); else p.on("open", go);
  });
}
