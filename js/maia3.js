/* Maia-3 opponents: the moves people at a rating play, from one network told both players' ratings (CSSLab's Maia-3, as in the
   developer app). It thinks in a worker (js/maia3-worker.js); if this browser can't start one, on the page instead. The network
   (10 MB) is downloaded the first time and then kept on the phone (sw.js). */
import { Chess } from "../vendor/chess.js";
import { MAIA3 } from "./config.js";
import { sample } from "./maia3-net.js";
import { record } from "./log.js";

const url = new URL(`../${MAIA3.file}`, import.meta.url).href;
let worker = null, seq = 0, onPage = null, isReady = false;
const waiting = new Map(), readyListeners = new Set();
function becameReady() { if (isReady) return; isReady = true; readyListeners.forEach((fn) => fn()); readyListeners.clear(); }
function viaWorker(job) {
  if (!worker) {
    worker = new Worker(new URL("./maia3-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); clearTimeout(w.t);
      if (e.data.error) w.no(new Error(e.data.error)); else { becameReady(); w.ok(e.data.probs); } };
    worker.onerror = (e) => { record("maia3", `worker: ${e.message || "stopped"}`); worker = null; for (const [, w] of waiting) w.no(new Error("worker")); waiting.clear(); };
  }
  return new Promise((ok, no) => {
    const id = ++seq, t = setTimeout(() => { waiting.delete(id); no(new Error("Maia-3 took too long")); }, isReady ? MAIA3.timeoutMs : MAIA3.firstTimeoutMs);
    waiting.set(id, { ok, no, t }); worker.postMessage({ id, url, ...job });
  });
}
async function onThisPage(job) {
  onPage ||= Promise.all([import("./maia3-net.js"), fetch(url).then((r) => { if (!r.ok) throw new Error(`Maia-3's network didn't load (${r.status})`); return r.arrayBuffer(); })])
    .then(([m, bytes]) => [m, m.readNet(bytes)]);
  try { const [m, n] = await onPage; becameReady(); return job.warm ? null : m.moveProbs(n, job.fens, job.moves, job.self, job.oppo); }
  catch (e) { onPage = null; throw e; }
}
async function ask(job) {
  try { return await viaWorker(job); }
  catch (e) { record("maia3", `${e.message} — thinking on the page instead`); return onThisPage(job); }
}
export const ready = () => isReady;
export function onReady(fn) { if (isReady) fn(); else readyListeners.add(fn); }
/* starts the download and the network's set-up before the first move is needed */
export function warm() { if (!isReady) ask({ warm: true }).catch((e) => record("maia3", `getting ready: ${e.message}`)); }
/* moves: the game's moves so far (UCI, from the start); rating: Maia-3's own; oppo: its opponent's → Maia-3's move (UCI) */
export async function move(moves, rating, oppo = rating) {
  const c = new Chess(), fens = [c.fen()];
  for (const u of moves) { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); fens.push(c.fen()); }
  const legal = c.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ""));
  return sample(await ask({ fens: fens.slice(-8), moves: legal, self: rating, oppo }));
}
