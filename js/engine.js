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
  const cp = pv[2] === "mate" ? Math.sign(Number(pv[3])) * 100000 : Number(pv[3]);
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
