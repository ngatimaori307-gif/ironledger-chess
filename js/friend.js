/* Play a Friend. The host makes a game code; the friend opens the link with it. Both phones meet once through PeerJS's
   public broker and then talk directly. Messages (version 1), all JSON:
     {t:"hello", v, name, moves}            joiner → host on every (re)connect: who I am and the moves I have
     {t:"start", hostColor, moves, name}    host → joiner: the colours and the game so far (the longer valid list wins)
     {t:"move", uci, ply}                   a move; ply = how many moves were played before it (out-of-step moves are refused)
     {t:"resign"} {t:"draw?"} {t:"draw!"} {t:"draw-no"} {t:"again?"} {t:"again!"}
   The same protocol is spoken by the developer app's Play a Friend screen. */
import { FRIEND } from "./config.js";
import { record } from "./log.js";

export const PROTOCOL = 1;
export function newCode() {
  const a = FRIEND.codeAlphabet, r = crypto.getRandomValues(new Uint32Array(FRIEND.codeLength));
  return [...r].map((x) => a[x % a.length]).join("");
}
export function cleanCode(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, FRIEND.codeLength); }
export function inviteLink(code) { return `${location.origin}${location.pathname}#${FRIEND.joinHashKey}=${code}`; }

export class FriendLink {
  constructor({ code, host, name, onMessage, onState }) {
    Object.assign(this, { code, host, name, onMessage, onState, conn: null, peer: null, closed: false });
  }
  state(s, detail = "") { this.status = s; this.onState(s, detail); }
  /* v1.6.1: the link to the meeting server comes back by itself. On an iPhone, leaving the app (to send the link in Messenger)
     suspends the page and iOS closes its connection to PeerJS's server: v1.6.0 then showed "No connection to the meeting server"
     for good, and the friend's phone could no longer find the game (his dad's report, 19 Nov 13:01: a 37 s freeze on #friend,
     then "network: Lost connection to server"). Now a lost server link is re-made — at once when the app is back on screen,
     else every reconnectEveryMs — keeping the same game code; only a real fault (no WebRTC, a code in use) stops it. */
  start() {
    if (!window.Peer) { this.state("failed", "the connection part of the app didn't load — check the internet and open the link again"); return; }
    this.makePeer();
    this.onVisible = () => { if (document.visibilityState === "visible") this.revive("back on screen"); };
    document.addEventListener("visibilitychange", this.onVisible);
    addEventListener("online", this.onVisible); addEventListener("pageshow", this.onVisible);
  }
  makePeer() {
    let opts = FRIEND.peer;                                       // a test setup may point at its own meeting server
    try { opts = { ...opts, ...JSON.parse(localStorage.getItem(FRIEND.serverOverrideKey) || "{}") }; } catch { /* none */ }
    const peer = this.peer = this.host ? new window.Peer(FRIEND.idPrefix + this.code, opts) : new window.Peer(opts);
    if (!this.conn || !this.conn.open) this.state("waiting", this.host ? "Waiting for your friend to open the link" : "Connecting…");
    peer.on("open", () => { if (this.peer !== peer) return; this.triedReconnect = false; this.serverLost = false; if (!this.host && !(this.conn && this.conn.open)) this.dial(); else this.refresh(); });
    peer.on("connection", (c) => { if (this.host) this.adopt(c); else c.close(); });
    peer.on("disconnected", () => { if (this.peer !== peer || this.closed) return; this.serverLost = true; this.later(); });
    peer.on("close", () => { if (this.peer === peer && !this.closed) { this.serverLost = true; this.later(); } });
    peer.on("error", (e) => {
      if (this.peer !== peer) return;
      record("friend", `${e.type || "error"}: ${e.message}`);
      if (e.type === "peer-unavailable") { if (!this.closed) { this.state("waiting", "Your friend's game isn't open yet — it joins as soon as it is"); this.retry(); } return; }
      if (e.type === "browser-incompatible") { this.state("failed", "This browser can't make direct connections"); return; }
      if (e.type === "unavailable-id" && !this.remade) { this.state("failed", "That game code is already in use — make a new invite"); return; }
      this.serverLost = true; this.later();                     // network, server-error, socket-error, socket-closed, unavailable-id after a re-make
    });
  }
  refresh() { if (this.conn && this.conn.open) this.state("connected"); else this.state("waiting", this.host ? "Waiting for your friend to open the link" : "Connecting…"); }
  later() {
    if (this.closed) return;
    if (!(this.conn && this.conn.open)) this.state("waiting", "Reconnecting to the meeting server…");
    clearTimeout(this.lt); this.lt = setTimeout(() => this.revive("timer"), FRIEND.reconnectEveryMs);
  }
  revive(why) {
    if (this.closed || !this.peer) return;
    const p = this.peer;
    if (p.open && !p.disconnected) { if (!this.host && !(this.conn && this.conn.open)) this.dial(); return; }
    record("info", `friend: re-making the server link (${why})`);
    clearTimeout(this.lt);
    this.remade = true;                                    // from here a "code in use" is our own old link, not another game
    if (!p.destroyed && p.disconnected && p.id && !this.triedReconnect) { this.triedReconnect = true; try { p.reconnect(); this.lt = setTimeout(() => this.revive("reconnect timed out"), FRIEND.connectTimeoutMs); return; } catch { /* re-make below */ } }
    try { p.destroy(); } catch { /* gone */ }
    this.triedReconnect = false; this.makePeer();
    this.lt = setTimeout(() => this.revive("re-make timed out"), FRIEND.connectTimeoutMs);
  }
  dial() {
    if (!this.peer || !this.peer.open) return;                   // revive() dials once the server link is back
    const c = this.peer.connect(FRIEND.idPrefix + this.code, { reliable: true });
    const t = setTimeout(() => { if (!c.open) { c.close(); this.retry(); } }, FRIEND.connectTimeoutMs);
    c.on("open", () => clearTimeout(t));
    this.adopt(c);
  }
  retry() { clearTimeout(this.rt); if (!this.closed && !this.host) this.rt = setTimeout(() => this.dial(), FRIEND.reconnectEveryMs); }
  adopt(c) {
    if (this.conn && this.conn !== c && this.conn.open) { c.close(); return; }       // one friend per game
    this.conn = c;
    c.on("open", () => { this.state("connected"); this.onMessage({ t: "_open" }); });
    c.on("data", (d) => { let m = d; if (typeof d === "string") { try { m = JSON.parse(d); } catch { return; } } if (m && typeof m.t === "string") this.onMessage(m); });
    c.on("close", () => { if (this.conn !== c || this.closed) return; this.state("lost", "Connection lost — reconnecting…"); record("friend", "connection lost"); this.retry(); });
    c.on("error", (e) => record("friend", `data channel: ${e.message || e}`));
  }
  send(m) { if (this.conn && this.conn.open) { this.conn.send(JSON.stringify(m)); return true; } return false; }
  close() { this.closed = true; clearTimeout(this.rt); clearTimeout(this.lt);
    if (this.onVisible) { document.removeEventListener("visibilitychange", this.onVisible); removeEventListener("online", this.onVisible); removeEventListener("pageshow", this.onVisible); } try { this.conn && this.conn.close(); } catch { /* already gone */ } try { this.peer && this.peer.destroy(); } catch { /* already gone */ } }
}

/* Two move lists from the two phones: the one that contains the other wins; if they differ, the host's stands. */
export function mergeMoves(hostMoves, joinerMoves) {
  const short = hostMoves.length <= joinerMoves.length ? hostMoves : joinerMoves, long = short === hostMoves ? joinerMoves : hostMoves;
  return short.every((u, i) => long[i] === u) ? [...long] : [...hostMoves];
}
