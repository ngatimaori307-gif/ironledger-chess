/* Maia opponents: they play the moves people at their rating play (CSSLab's Maia networks, as in the developer app). The
   network runs in a worker (js/maia-worker.js); if this browser can't start one, on the page instead. */
import { Chess } from "../vendor/chess.js";
import { MAIA } from "./config.js";
import { pick } from "./maia-net.js";
import { record } from "./log.js";

let worker = null, seq = 0, onPage = null;
const waiting = new Map();
function url(rating) { return new URL(`../${MAIA.dir}/maia-${rating}.bin`, import.meta.url).href; }
function viaWorker(job) {
  if (!worker) {
    worker = new Worker(new URL("./maia-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); clearTimeout(w.t); e.data.error ? w.no(new Error(e.data.error)) : w.ok(e.data.probs); };
    worker.onerror = (e) => { record("maia", `worker: ${e.message || "stopped"}`); worker = null; for (const [, w] of waiting) w.no(new Error("worker")); waiting.clear(); };
  }
  return new Promise((ok, no) => {
    const id = ++seq, t = setTimeout(() => { waiting.delete(id); no(new Error("Maia took too long")); }, MAIA.timeoutMs);
    waiting.set(id, { ok, no, t }); worker.postMessage({ id, ...job });
  });
}
async function onThisPage(job) {
  onPage ||= Promise.all([import("./maia-net.js"), fetch(job.url).then((r) => r.arrayBuffer())]);
  const [net, bytes] = await onPage; onPage = null;
  return net.moveProbs(net.readNet(bytes), job.fens, job.moves);
}
/* moves: the game's moves so far (UCI, from the start) → Maia's move (UCI) */
export async function move(moves, rating) {
  const c = new Chess(), fens = [c.fen()];
  for (const u of moves) { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); fens.push(c.fen()); }
  const legal = c.moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion || ""), from: m.from, to: m.to,
    castle: m.flags.includes("k") ? "k" : m.flags.includes("q") ? "q" : "", promo: m.promotion || "" }));
  const job = { url: url(rating), fens, moves: legal };
  let probs;
  try { probs = await viaWorker(job); }
  catch (e) { record("maia", `${e.message} — thinking on the page instead`); probs = await onThisPage(job); }
  return pick(probs, MAIA);
}
