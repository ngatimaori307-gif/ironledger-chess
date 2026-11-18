/* Stockfish 19 in a Web Worker. move(fen, opponent) answers with a UCI move at the opponent's strength:
   from 1320 Stockfish limits itself (UCI_Elo); below it, the app samples among Stockfish's top lines (as the developer app does). */
import { ENGINE } from "./config.js";
import { record } from "./log.js";

let worker = null, ready = null, listeners = [];

function send(cmd) { worker.postMessage(cmd); }
function waitFor(test, timeoutMs, what) {
  return new Promise((resolve, reject) => {
    const lines = [];
    const fn = (line) => { lines.push(line); if (test(line)) { off(); resolve(lines); } };
    const off = () => { listeners = listeners.filter((x) => x !== fn); clearTimeout(t); };
    const t = timeoutMs ? setTimeout(() => { off(); reject(new Error(`the engine didn't answer (${what})`)); }, timeoutMs) : 0;
    listeners.push(fn);
  });
}
export function start() {
  if (ready) return ready;
  ready = (async () => {
    worker = new Worker(ENGINE.worker);
    worker.onmessage = (e) => { const line = typeof e.data === "string" ? e.data : String(e.data); for (const fn of [...listeners]) fn(line); };
    worker.onerror = (e) => { record("engine", e.message || "the engine stopped"); ready = null; };
    send("uci"); await waitFor((l) => l === "uciok", ENGINE.readyTimeoutMs, "uci");
    send(`setoption name Hash value ${ENGINE.hashMb}`);
    send("isready"); await waitFor((l) => l === "readyok", ENGINE.readyTimeoutMs, "isready");
    return true;
  })().catch((e) => { record("engine", e.message); ready = null; throw e; });
  return ready;
}

let busy = Promise.resolve();
function exclusive(fn) { const run = busy.then(fn, fn); busy = run.catch(() => {}); return run; }

function parseInfo(line) {
  const pv = / multipv (\d+) .*?score (cp|mate) (-?\d+).*? pv (\S+)/.exec(line);
  if (!pv) return null;
  const n = Number(pv[3]), cp = pv[2] === "mate" ? (n > 0 ? 100000 - n : -100000 - n) : n;   // python-chess Mate(n).score(mate_score=100000)
  return { k: Number(pv[1]), cp, move: pv[4] };
}

export function move(fen, opp) {
  return exclusive(async () => {
    await start();
    send("ucinewgame"); send("isready"); await waitFor((l) => l === "readyok", ENGINE.readyTimeoutMs, "isready");
    if (opp.temp) {                                   // weakened: sample among the top lines, favouring better ones less the lower the rating
      send("setoption name UCI_LimitStrength value false"); send(`setoption name MultiPV value ${ENGINE.weakLines}`);
      send(`position fen ${fen}`); send(`go depth ${ENGINE.weakDepth}`);
      const lines = await waitFor((l) => l.startsWith("bestmove"), ENGINE.readyTimeoutMs, "go");
      const best = new Map(); for (const l of lines) { const i = parseInfo(l); if (i) best.set(i.k, i); }
      const cands = [...best.values()]; if (!cands.length) return lines.at(-1).split(" ")[1];
      const top = Math.max(...cands.map((c) => c.cp)), w = cands.map((c) => Math.exp((c.cp - top) / opp.temp));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i].move; }
      return cands[0].move;
    }
    send("setoption name MultiPV value 1");
    const elo = Math.min(ENGINE.eloCeiling, Math.max(ENGINE.eloFloor, opp.rating));
    send(`setoption name UCI_LimitStrength value ${opp.rating < ENGINE.eloCeiling}`); send(`setoption name UCI_Elo value ${elo}`);
    send(`position fen ${fen}`); send(`go movetime ${ENGINE.moveTimeMs}`);
    const lines = await waitFor((l) => l.startsWith("bestmove"), ENGINE.readyTimeoutMs + ENGINE.moveTimeMs, "go");
    return lines.at(-1).split(" ")[1];
  });
}

/* v1.5: Stockfish at full strength on one position — its score in centipawns for the side to move (a mate: ±100000), after its
   own best move or after `only` (UCI "searchmoves"). For the Human + Guard ladder's checks and the draw offer. */
export function analyse(fen, { depth, ms, only = null }) {
  return exclusive(async () => {
    await start();
    send("setoption name UCI_LimitStrength value false"); send("setoption name MultiPV value 1");
    send(`position fen ${fen}`); send(`go depth ${depth} movetime ${ms}${only ? ` searchmoves ${only}` : ""}`);
    const lines = await waitFor((l) => l.startsWith("bestmove"), ENGINE.readyTimeoutMs + ms, "analyse");
    let cp = null;
    for (const l of lines) { const s = / score (cp|mate) (-?\d+)/.exec(l); if (s) cp = s[1] === "mate" ? Math.sign(Number(s[2]) || -1) * 100000 : Number(s[2]); }
    const best = lines.at(-1).split(" ")[1];
    return { cp, best: best && best !== "(none)" ? best : null };
  });
}

/* v1.6: Stockfish's best `multipv` moves at full strength after `nodes` positions (or to a depth within a time) → [{uci, cp for the side to move}], best first
   (a mate: ±100000, as personality.py reads it). For the styled opponents and Engine Duel. */
export function lines(fen, { multipv, nodes = null, depth = null, ms = null }) {
  return exclusive(async () => {
    await start();
    send("setoption name UCI_LimitStrength value false"); send(`setoption name MultiPV value ${multipv}`);
    const go = nodes ? `go nodes ${nodes}` : `go depth ${depth}${ms ? ` movetime ${ms}` : ""}`;   // nodes: a personality's strength; depth/time: a review
    send(`position fen ${fen}`); send(go);
    const out = await waitFor((l) => l.startsWith("bestmove"), 0, "lines");
    const depthReached = Math.max(0, ...out.map((l) => Number((/ depth (\d+)/.exec(l) || [])[1] || 0)));
    send("setoption name MultiPV value 1");
    const best = new Map(); for (const l of out) { const i = parseInfo(l); if (i) best.set(i.k, i); }
    return Object.assign([...best.entries()].sort((a, b) => a[0] - b[0]).map(([, i]) => ({ uci: i.move, cp: i.cp })), { depth: depthReached });
  });
}
/* the personality's move and why it was chosen, and Stockfish's score for the mover (personality.play) */
export async function styledMove(fen, style, elo) {
  const { choose, strengthNodes } = await import("./personality.js");
  const { PERSONALITY } = await import("./config.js");
  const ls = await lines(fen, { multipv: PERSONALITY.lines, nodes: strengthNodes(elo) });
  if (!ls.length) throw new Error("the engine found no move");
  return { ...choose(fen, ls, style, elo), cp: ls[0].cp };
}
