/* Engine personalities — a copy of Iron Ledger's personality.py. Stockfish has no style setting, so a style is a way of choosing
   among Stockfish's own best moves: it searches PERSONALITY.lines moves at a strength-dependent number of positions, every move within
   the style's slack of the best is a candidate, and the style scores each by what it does on the board (checks, captures, coming
   nearer the enemy king, sacrifices, keeping the king covered, trading queens, freeing its pieces). The best total (engine score +
   style) is played; below PERSONALITY.noiseUntil the choice also wanders, as a weaker player's does. A style changes which good move
   is chosen; it never chooses a move the engine judges much worse than the slack. Each feature is a count on the board after the move. */
import { Chess } from "../vendor/chess.js";
import { PERSONALITY } from "./config.js";

export const STYLE_NAMES = { balanced: "Balanced", aggressive: "Aggressive", tactical: "Tactical", positional: "Positional", defensive: "Defensive" };
export const STYLES = Object.keys(PERSONALITY.slackCp);
const WEIGHTS = {                                         // centipawns of preference for one unit of each feature (personality.py WEIGHTS)
  balanced: {},
  aggressive: { check: 30, capture: 6, king_near: 10, sacrifice: 12, pawn_storm: 12, queen_trade: -40 },
  tactical: { check: 25, capture: 10, threat: 15, forcing_replies: -3, sacrifice: 6 },
  positional: { mobility: 2, pawn_structure: 15, centre: 8, queen_trade: 10, capture: -2, castle: 15 },
  defensive: { king_cover: 15, queen_trade: 35, sacrifice: -25, capture: 4, threat_against: -12, castle: 45 },
};
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const WHY = { check: "a check", capture: "a capture", king_near: "nearer his king", sacrifice: "a sacrifice", pawn_storm: "a pawn storm",
  threat: "a threat", mobility: "more room for the pieces", pawn_structure: "a sounder pawn structure", centre: "the centre",
  queen_trade: "queens off", king_cover: "king cover", castle: "castling", forcing_replies: "fewer replies for him" };

/* ---- the board as python-chess sees it: squares 0 (a1) … 63 (h8), what each piece attacks ---- */
const sqi = (s) => (Number(s[1]) - 1) * 8 + (s.charCodeAt(0) - 97);
function pieces(c) { const m = new Map(); c.board().forEach((row) => row.forEach((p) => { if (p) m.set(sqi(p.square), p); })); return m; }
const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]], KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]], BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export function attacks(m, sq) {                          // python-chess Board.attacks(sq): the squares the piece on sq attacks
  const p = m.get(sq); if (!p) return [];
  const f = sq & 7, r = sq >> 3, out = [], on = (ff, rr) => ff >= 0 && ff < 8 && rr >= 0 && rr < 8;
  const steps = (ds) => ds.forEach(([df, dr]) => { if (on(f + df, r + dr)) out.push((r + dr) * 8 + f + df); });
  const slide = (ds) => ds.forEach(([df, dr]) => { let ff = f + df, rr = r + dr; while (on(ff, rr)) { const s = rr * 8 + ff; out.push(s); if (m.has(s)) break; ff += df; rr += dr; } });
  if (p.type === "p") steps(p.color === "w" ? [[-1, 1], [1, 1]] : [[-1, -1], [1, -1]]);
  else if (p.type === "n") steps(KN); else if (p.type === "k") steps(KG);
  else { if (p.type !== "b") slide(ROOK); if (p.type !== "r") slide(BISHOP); }
  return out;
}
export function attackers(m, color, sq) { const out = []; for (const [s, p] of m) if (p.color === color && attacks(m, s).includes(sq)) out.push(s); return out; }
const dist = (a, c) => Math.max(Math.abs((a & 7) - (c & 7)), Math.abs((a >> 3) - (c >> 3)));
const kingOf = (m, color) => { for (const [s, p] of m) if (p.type === "k" && p.color === color) return s; return null; };
function nullMove(fen) { const f = fen.split(" "); f[1] = f[1] === "w" ? "b" : "w"; f[3] = "-"; return f.join(" "); }

/* What the move does, as counts on the board (the mover's view) — personality.features */
export function features(fen, uci) {
  const a = new Chess(fen), me = a.turn(), them = me === "w" ? "b" : "w", m0 = pieces(a);
  const mv = a.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const took = mv.captured ? { type: mv.captured } : null, theirKing = kingOf(m0, them), myKing0 = kingOf(m0, me);
  const near = (m) => (theirKing == null ? 0 : [...m].reduce((s, [sq, p]) => s + (p.color === me && p.type !== "k" ? dist(sq, theirKing) : 0), 0));
  const mobBefore = new Chess(fen).moves().length, m = pieces(a), to = sqi(mv.to), mover = m.get(to);
  const f = { check: a.inCheck() ? 1 : 0, capture: took ? VALUE[took.type] : 0, castle: /[kq]/.test(mv.flags) ? 1 : 0 };
  f.king_near = near(m0) - near(m);
  f.pawn_storm = mover && mover.type === "p" && theirKing != null && Math.abs((to & 7) - (theirKing & 7)) <= 1 ? 1 : 0;
  f.sacrifice = mover && mover.type !== "k" && attackers(m, them, to).length && !attackers(m, me, to).length ? VALUE[mover.type] : 0;
  f.threat = attacks(m, to).filter((s) => { const p = m.get(s); return p && p.color === them && VALUE[p.type] > VALUE[mover ? mover.type : "p"]; }).length;
  f.forcing_replies = a.inCheck() ? a.moves().length : 0;
  f.queen_trade = took && took.type === "q" && mover && mover.type === "q" ? 1 : 0;
  f.king_cover = myKing0 == null ? 0 : attacks(m, myKing0).filter(   // the king's square before the move, as personality.py (a moved king: 0)
    (s) => { const p = m.get(s); return p && p.color === me; }).length;
  f.mobility = a.inCheck() ? 0 : new Chess(nullMove(a.fen()), { skipValidation: true }).moves().length - mobBefore;
  f.threat_against = [...m].filter(([s, p]) => p.color === me && p.type !== "k" && attackers(m, them, s).length && !attackers(m, me, s).length).length;
  const files = [...m].filter(([, p]) => p.color === me && p.type === "p").map(([s]) => s & 7), set = new Set(files);
  f.pawn_structure = -((files.length - set.size) + [...set].filter((x) => !set.has(x - 1) && !set.has(x + 1)).length);
  f.centre = [27, 28, 35, 36].filter((s) => attackers(m, me, s).length).length;   // d4 e4 d5 e5
  return f;
}
/* positions searched a move for a strength: log-linear between the PERSONALITY.nodesAt points */
export function strengthNodes(elo) {
  const e = Math.max(PERSONALITY.eloMin, Math.min(PERSONALITY.eloMax, Math.round(elo))), xs = PERSONALITY.nodesAt, ys = PERSONALITY.nodes;
  if (e <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) if (e <= xs[i + 1]) return Math.round(Math.exp(Math.log(ys[i]) + (Math.log(ys[i + 1]) - Math.log(ys[i])) * (e - xs[i]) / (xs[i + 1] - xs[i])));
  return ys[ys.length - 1];
}
export const noiseCp = (elo) => Math.max(0, PERSONALITY.noiseCp * (PERSONALITY.noiseUntil - Math.round(elo)) / (PERSONALITY.noiseUntil - PERSONALITY.eloMin));
function gauss(rng, sd) { let u = 0; while (u === 0) u = rng(); return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
/* lines: Stockfish's [{uci, cp for the mover}], best first → { uci, why } (personality.choose) */
export function choose(fen, lines, style = "balanced", elo = PERSONALITY.eloMax, rng = Math.random) {
  if (!lines.length) throw new Error("no moves to choose from");
  const best = lines[0].cp, slack = PERSONALITY.slackCp[style] ?? 0, spread = noiseCp(elo), table = WEIGHTS[style] || {};
  const scored = lines.filter((l) => l.cp >= best - slack - spread).map((l) => {
    const f = features(fen, l.uci), bonus = Object.entries(f).reduce((s, [k, v]) => s + (table[k] || 0) * v, 0);
    return { total: l.cp + bonus + (spread ? gauss(rng, spread) : 0), uci: l.uci, f };
  });
  const first = scored.find((x) => x.uci === lines[0].uci);
  scored.sort((x, y) => y.total - x.total); const pick = scored[0];
  if (pick.uci === lines[0].uci || !first) return { uci: pick.uci, why: "engine's choice" };
  let top = null; for (const [k, v] of Object.entries(pick.f)) { const d = (table[k] || 0) * (v - (first.f[k] || 0)); if (!top || d > top[1]) top = [k, d]; }
  return { uci: pick.uci, why: top && top[1] > 0 ? WHY[top[0]] || STYLE_NAMES[style].toLowerCase() : "engine's choice" };
}
