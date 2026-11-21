/* 1.12.0 — the Illusion window, Iron Ledger's (illusion.py, v8.13: the Ghost Bracket). For one of his mistakes or blunders in a
   reviewed game, two answers side by side: A — what really happens (Stockfish's refutation, and his winning chance after it) and
   B — what he hoped for: the replies people at his opponent's rating play often (Maia-3's probabilities — Maia predicts how often a
   move is played, it never judges it), each judged by Stockfish. "The illusion holds" for a reply after which his winning chance is
   within ILLUSION.hold points of where it stood before his move; the share it holds is the sum of those replies' probabilities.
   Answers are kept on the phone per game and move, so the same question is never searched twice. */
import { Chess } from "../vendor/chess.js";
import { ILLUSION } from "./config.js";
import * as engine from "./engine.js";
import * as maia3 from "./maia3.js";
import { winChance } from "./guard.js";

const KEY = "ilc-illusions";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
function keep(id, v) {
  const all = read(); all[id] = { ...v, kept: Date.now() };
  const ids = Object.keys(all).sort((a, b) => all[a].kept - all[b].kept); while (ids.length > ILLUSION.kept) delete all[ids.shift()];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full: shown, not kept */ }
}
const MATE = 100000;
const chanceFor = (cp) => winChance(Math.max(-10000, Math.min(10000, cp)));   // cp from the side to move's view → its winning chance

/** g: the saved game ({at, pgn, me, oppRating}); m: the report's move ({ply, cpBefore, color, uci}). onStep(text) while it works. */
export async function illusion(g, m, onStep = () => {}) {
  const id = `${g.at}:${m.ply}`, kept = read()[id]; if (kept) return kept;
  const c = new Chess(); c.loadPgn(g.pgn);
  const ucis = c.history({ verbose: true }).map((x) => x.from + x.to + (x.promotion || "")).slice(0, m.ply);   // up to and with his move
  const after = new Chess(); ucis.forEach((u) => after.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }));
  const sign = m.color === "white" ? 1 : -1, before = Math.round(winChance(sign * m.cpBefore) * 10) / 10;
  if (after.isGameOver()) throw new Error("the game ended with that move");
  onStep("Stockfish is finding the refutation…");
  const refu = await engine.analyse(after.fen(), { depth: ILLUSION.depth, ms: ILLUSION.ms });   // cp for the opponent, to move
  const refSan = refu.best ? new Chess(after.fen()).move({ from: refu.best.slice(0, 2), to: refu.best.slice(2, 4), promotion: refu.best[4] }).san : null;
  const real = Math.round((100 - chanceFor(refu.cp ?? 0)) * 10) / 10;
  onStep("Maia-3 is reading what people at that rating reply (the first time it downloads its network, once)…");
  const rating = Math.max(ILLUSION.rating[0], Math.min(ILLUSION.rating[1], Math.round((g.oppRating || 1500) / 100) * 100));
  const probs = await maia3.probabilities(ucis, rating, rating);
  const top = Object.entries(probs).filter(([, p]) => p >= ILLUSION.minP).sort((a, b) => b[1] - a[1]).slice(0, ILLUSION.replies);
  const replies = [];
  for (const [u, p] of top) {
    onStep(`Stockfish is judging the replies: ${replies.length + 1} of ${top.length}`);
    const pos = new Chess(after.fen()), mv = pos.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    let chance;
    if (pos.isCheckmate()) chance = 0; else if (pos.isGameOver()) chance = 50;
    else { const r = u === refu.best ? refu : await engine.analyse(pos.fen(), { depth: ILLUSION.depth, ms: ILLUSION.ms });   // cp for him, to move
      chance = Math.round((u === refu.best ? 100 - chanceFor(r.cp ?? 0) : chanceFor(r.cp ?? 0)) * 10) / 10; }
    replies.push({ uci: u, san: mv.san, p: Math.round(p * 1000) / 1000, chance, holds: chance >= before - ILLUSION.hold, fen: pos.fen() });
  }
  const holds = Math.round(replies.filter((r) => r.holds).reduce((s, r) => s + r.p, 0) * 100);
  const out = { before, refutation: refSan ? { san: refSan, uci: refu.best, chance: real } : null, replies, holds, rating, depth: ILLUSION.depth, fenAfter: after.fen() };
  keep(id, out); return out;
}
