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
  start() {
    const Peer = window.Peer;
    if (!Peer) { this.state("failed", "the connection part of the app didn't load — check the internet and open the link again"); return; }
    let opts = FRIEND.peer;                                       // a test setup may point at its own meeting server
    try { opts = { ...opts, ...JSON.parse(localStorage.getItem(FRIEND.serverOverrideKey) || "{}") }; } catch { /* none */ }
    this.peer = this.host ? new Peer(FRIEND.idPrefix + this.code, opts) : new Peer(opts);
    this.state("waiting", this.host ? "Waiting for your friend to open the link" : "Connecting…");
    this.peer.on("open", () => { if (!this.host) this.dial(); });
    this.peer.on("connection", (c) => { if (this.host) this.adopt(c); else c.close(); });
    this.peer.on("disconnected", () => { if (!this.closed) setTimeout(() => this.peer && !this.peer.destroyed && this.peer.reconnect(), FRIEND.reconnectEveryMs); });
    this.peer.on("error", (e) => {
      const why = { "peer-unavailable": "Your friend's game isn't open — ask them to open Play a Friend again",
        "unavailable-id": "That game code is already in use — make a new invite", network: "No connection to the meeting server — check the internet",
        "browser-incompatible": "This browser can't make direct connections" }[e.type] || e.message;
      record("friend", `${e.type || "error"}: ${e.message}`);
      if (e.type === "peer-unavailable" && !this.closed) { this.state("waiting", why); this.retry(); } else this.state("failed", why);
    });
  }
  dial() {
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
  close() { this.closed = true; clearTimeout(this.rt); try { this.conn && this.conn.close(); } catch { /* already gone */ } try { this.peer && this.peer.destroy(); } catch { /* already gone */ } }
}

/* Two move lists from the two phones: the one that contains the other wins; if they differ, the host's stands. */
export function mergeMoves(hostMoves, joinerMoves) {
  const short = hostMoves.length <= joinerMoves.length ? hostMoves : joinerMoves, long = short === hostMoves ? joinerMoves : hostMoves;
  return short.every((u, i) => long[i] === u) ? [...long] : [...hostMoves];
}
