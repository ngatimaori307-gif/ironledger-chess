/* Game review with Stockfish — a copy of Iron Ledger's report.py rules, run in the browser: every position searched (its best two
   moves), then each move gets the win chance it gave up (Lichess's curve), an accuracy (Lichess's formula) and a label —
   blunder / mistake / inaccuracy at 30 / 20 / 10 points, "best" for the engine's first choice; "!" when the first choice was the
   only good move (the next-best gives up 20+, the mover not already 90 % sure to win, not a recapture); "✗" a miss (a 70 %+ chance
   let fall under 55 %, or his blunder let go). Game accuracy: Lichess's volatility-weighted and harmonic means.
   Not here, unlike Iron Ledger: the "!!" brilliant and "!?" sacrifice marks (they need its material-given check) and the deeper
   re-check of mistakes. Kept on the phone per game. Also the Hardcore review between rungs: the moments that decided the game. */
import { Chess } from "../vendor/chess.js";
import { REVIEW, STORE } from "./config.js";
import * as engine from "./engine.js";
import { winChance } from "./guard.js";

const MATE = 10000;                                        // report.MATE_CP
const toWhite = (cp, turn) => (turn === "w" ? cp : -cp);
const clampMate = (cp) => Math.max(-MATE, Math.min(MATE, cp));
export function moveAccuracy(before, after) { return Math.max(0, Math.min(100, 103.1668100711649 * Math.exp(-0.04354415386753951 * Math.max(0, before - after)) - 3.166924740191411)); }
function stdev(xs) { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length); }
/* report.game_accuracy: winWhite = White's win chance before every move and after the last; acc = [colour, accuracy] per move */
export function gameAccuracy(winWhite, acc) {
  const n = acc.length, size = Math.max(2, Math.min(8, Math.floor(n / 10))), windows = [];
  for (let i = 0; i < Math.max(0, size - 2); i++) windows.push(winWhite.slice(0, size));
  for (let i = 0; i + size <= winWhite.length; i++) windows.push(winWhite.slice(i, i + size));
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdev(w)))).slice(0, n), out = {};
  for (const col of ["white", "black"]) {
    const pairs = acc.map(([c, a], i) => [c, a, weights[i]]).filter(([c, , w]) => c === col && w !== undefined);
    if (!pairs.length) { out[col] = null; continue; }
    const weighted = pairs.reduce((s, [, a, w]) => s + a * w, 0) / pairs.reduce((s, [, , w]) => s + w, 0);
    const harmonic = pairs.length / pairs.reduce((s, [, a]) => s + 1 / Math.max(a, 1), 0);
    out[col] = Math.round(((weighted + harmonic) / 2) * 10) / 10;
  }
  return out;
}
function label(drop, best) { if (best) return "best"; for (const k of ["blunder", "mistake", "inaccuracy"]) if (drop >= REVIEW.drop[k]) return k; return "good"; }
function quality(lbl, drop, before, after, great) {         // report.quality without the material-given marks
  if (lbl === "blunder") return "blunder";
  if (great) return "great";
  if (lbl === "best") return "best";
  if (drop >= REVIEW.drop.inaccuracy && before >= REVIEW.missFrom && after < REVIEW.missTo) return "miss";
  return lbl;
}
/* pgn → report; level: "quick" | "normal"; onProgress(done, total) */
export async function analyseGame(pgn, level = "quick", onProgress = () => {}) {
  const [depth, secs] = REVIEW.levels[level], g = new Chess(); g.loadPgn(pgn);
  const moves = g.history({ verbose: true }), c = new Chess(), evals = [];
  let depths = [];
  for (let i = 0; i <= moves.length; i++) {
    onProgress(i, moves.length + 1);
    if (c.isGameOver()) evals.push({ cp: c.isCheckmate() ? (c.turn() === "w" ? -MATE : MATE) : 0, best: null });
    else {
      const ls = await engine.lines(c.fen(), { multipv: REVIEW.multipv, depth, ms: Math.round(secs * 1000) }); depths.push(ls.depth);
      const t = c.turn(), b = ls[0] ? new Chess(c.fen()).move({ from: ls[0].uci.slice(0, 2), to: ls[0].uci.slice(2, 4), promotion: ls[0].uci[4] }) : null;
      evals.push({ cp: toWhite(clampMate(ls[0]?.cp ?? 0), t), best: b ? b.san : null, bestUci: ls[0]?.uci || null,
        second: ls[1] ? toWhite(clampMate(ls[1].cp), t) : null, secondSan: ls[1] ? new Chess(c.fen()).move({ from: ls[1].uci.slice(0, 2), to: ls[1].uci.slice(2, 4), promotion: ls[1].uci[4] }).san : null });
    }
    if (i < moves.length) c.move(moves[i].san);
  }
  onProgress(moves.length + 1, moves.length + 1);
  return { level, depth: depths.length ? Math.min(...depths) : null, engine: "Stockfish 19 lite (in the browser, 1 thread)", made: Date.now(), ...scoreGame(pgn, evals) };
}
/* the report from the evaluations (pure: checked against report.py with the same numbers): evals[i] for the position before move i
   and after the last — { cp: White's view, best: SAN, bestUci, second: White's view of the next-best, secondSan } */
export function scoreGame(pgn, evals) {
  const g = new Chess(); g.loadPgn(pgn); const moves = g.history({ verbose: true });
  const out = [], winWhite = evals.map((e) => winChance(e.cp));
  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i], sign = mv.color === "w" ? 1 : -1, before = winChance(sign * evals[i].cp), after = winChance(sign * evals[i + 1].cp);
    const drop = Math.max(0, before - after), best = evals[i].bestUci === mv.from + mv.to + (mv.promotion || "");
    const recapture = !!(mv.captured && i > 0 && moves[i - 1].captured && moves[i - 1].to === mv.to);
    const second = evals[i].second, great = best && second != null && !recapture && before < REVIEW.greatWon && after - winChance(sign * second) >= REVIEW.greatGap;
    const lbl = label(drop, best);
    out.push({ ply: i + 1, san: mv.san, uci: mv.from + mv.to + (mv.promotion || ""), color: mv.color === "w" ? "white" : "black", best: evals[i].best, bestUci: evals[i].bestUci,
      cpAfter: evals[i + 1].cp, drop: Math.round(drop * 10) / 10, accuracy: Math.round(moveAccuracy(before, after) * 10) / 10, label: lbl,
      quality: quality(lbl, drop, before, after, great), ...(great ? { great: true, second: evals[i].secondSan } : {}) });
  }
  { const r = new Chess(); out.forEach((m, i) => { m.fen = r.fen(); r.move(moves[i].san); }); }   // the position before each move (for the review)
  for (let k = 1; k < out.length; k++) {                   // his blunder, then not punished
    out[k].missedChance = out[k - 1].label === "blunder" && (out[k].label === "mistake" || out[k].label === "blunder");
    if (out[k].missedChance && out[k].quality === "mistake") out[k].quality = "miss";
  }
  const acc = gameAccuracy(winWhite, out.map((m) => [m.color, m.accuracy])), sides = {};
  for (const col of ["white", "black"]) {
    const mine = out.filter((m) => m.color === col), count = (q) => mine.filter((m) => m.quality === q).length;
    sides[col] = { accuracy: acc[col], blunder: count("blunder"), mistake: count("mistake"), inaccuracy: count("inaccuracy"), miss: count("miss"), great: count("great") };
  }
  return { moves: out, sides };
}

/* the review between Hardcore rungs (hardcore.moments): his moves that gave up 10+ win chance, the worst first — the turning point,
   his blunders let go, then the biggest slips — up to three, in game order */
export function moments(rep, col) {
  const mine = rep.moves.filter((m) => m.color === col && m.best && m.drop >= REVIEW.momentMinDrop), picked = new Set(), out = [];
  const add = (m, kind) => { if (picked.has(m.ply) || out.length >= REVIEW.moments) return; picked.add(m.ply); out.push({ ...m, kind }); };
  if (mine.length) add(mine.reduce((a, b) => (b.drop > a.drop ? b : a)), "turning point");
  [...mine].filter((m) => m.missedChance).sort((a, b) => b.drop - a.drop).forEach((m) => add(m, "his blunder, let go"));
  [...mine].sort((a, b) => b.drop - a.drop).forEach((m) => add(m, m.label));
  return out.sort((a, b) => a.ply - b.ply);
}
/* a second try at a moment, judged as the report judges a move: found if it is the best move or gives up under 10 */
export async function judgeTry(fen, uci, bestUci) {
  const [depth, secs] = REVIEW.levels.normal, c = new Chess(fen);
  const before = await engine.analyse(fen, { depth, ms: secs * 1000 }), tried = await engine.analyse(fen, { depth, ms: secs * 1000, only: uci });
  if (before.cp == null || tried.cp == null) throw new Error("the engine couldn't judge it");
  const drop = Math.max(0, winChance(clampMate(before.cp)) - winChance(clampMate(tried.cp)));
  const san = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  return { ok: uci === bestUci || drop < REVIEW.okDrop, drop: Math.round(drop), san };
}

/* kept on the phone: reports by game (its "at"), and which Hardcore games were reviewed */
function read(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
export const loadReport = (at) => read(STORE.reports, {})[at] || null;
export function saveReport(at, rep) {
  const all = read(STORE.reports, {}); all[at] = rep;
  const keys = Object.keys(all).sort((a, b) => b - a);   // newest kept first if the phone's storage runs short
  for (const k of keys.slice(REVIEW.kept)) delete all[k];
  return write(STORE.reports, all);
}
export const reviews = () => read(STORE.hcReviews, {});
export function saveTry(at, ply, t) { const all = reviews(), e = (all[at] ||= { tries: {} }); e.tries[ply] = t; write(STORE.hcReviews, all); return e; }
export function markReviewed(at) { const all = reviews(); (all[at] ||= { tries: {} }).reviewed = new Date().toISOString().slice(0, 10); write(STORE.hcReviews, all); }
