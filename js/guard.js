/* The Human + Guard ladder's opponent, as Iron Ledger's hardcore._guard_move: Maia-3 picks a human move; Stockfish checks it, and
   a move that loses HARDCORE.guard.drop or more win chance (the game report's "mistake") is replaced by Maia-3's next likeliest
   move that doesn't; if none of its likeliest few passes, Stockfish's own move. Human style, no hanging pieces. */
import { Chess } from "../vendor/chess.js";
import { HARDCORE, WIN_CHANCE } from "./config.js";
import * as engine from "./engine.js";
import * as maia3 from "./maia3.js";
import { sample } from "./maia3-net.js";

/* Lichess's winning-chance curve, 0–100 for the side the score is for (Iron Ledger's winchance.win) */
export function winChance(cp) { const c = Math.max(-WIN_CHANCE.clampCp, Math.min(WIN_CHANCE.clampCp, cp)); return 50 + 50 * (2 / (1 + Math.exp(-WIN_CHANCE.k * c)) - 1); }

/* moves: the game so far (UCI); rating: the rung's → { uci, guarded: true when Maia-3's first choice was replaced } */
export async function guardMove(moves, rating) {
  const c = new Chess(); for (const u of moves) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const fen = c.fen(), { depth, ms, drop, alternatives } = HARDCORE.guard;
  const best = await engine.analyse(fen, { depth, ms });
  const probs = await maia3.probabilities(moves, rating), first = sample(probs);
  if (best.cp == null || !best.best) return { uci: first, guarded: false };     // Stockfish gave no score (no legal reply): nothing to check
  const wBest = winChance(best.cp);
  const ok = async (u) => { const a = await engine.analyse(fen, { depth, ms, only: u }); return a.cp != null && wBest - winChance(a.cp) < drop; };
  if (await ok(first)) return { uci: first, guarded: false };
  const likeliest = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, alternatives).map(([u]) => u);
  for (const u of likeliest) if (u !== first && (await ok(u))) return { uci: u, guarded: true };
  return { uci: best.best, guarded: true };
}
/* A draw offer to the computer: considered from move 20, accepted only if Stockfish judges the position level */
export async function drawOffer(fen, ply) {
  const { minPly, maxCp, depth, ms } = HARDCORE.draw;
  if (ply < minPly) return { accepted: false, why: `Declined — offers are considered from move ${minPly / 2}` };
  const a = await engine.analyse(fen, { depth, ms });
  if (a.cp == null) return { accepted: false, why: "Declined — the engine couldn't judge it" };
  return Math.abs(a.cp) <= maxCp ? { accepted: true, why: "Accepted — the position is level" } : { accepted: false, why: "Declined — the position isn't level" };
}
