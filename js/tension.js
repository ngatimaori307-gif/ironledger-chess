/* 1.10.0 — the Tension layer, Iron Ledger's (v8.11: fastcore.tension_pairs, exchange.py, app/drawlists.js), counted here in the
   browser. A thread runs from each attacker to every piece it attacks (kings left out). Each target's exchange is counted until
   quiet: both sides capture on that square with their cheapest piece in turn, and either side stops as soon as the next capture
   would lose material. A target its owner keeps by that count is a calm, steady green thread (taking is bad for both); one it
   loses is a bright white thread that trembles harder the more it loses, with a ring on the piece. A count, not an engine:
   captures on one square only — a check or a capture elsewhere in between is not seen. */
import { Chess } from "../vendor/chess.js";

export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const KING_LAST = 100;                                       // the king captures last (exchange.py: EXCHANGE_KING_LAST)
export const TENSION = {                                     // Iron Ledger's own numbers (drawlists.js TENSION)
  safe: "rgba(107,208,138,.75)", losing: "rgba(255,255,255,.95)",
  wSafe: 0.035, wLosing: 0.07, wPerPawn: 0.008, bend: 0.18, jitterPerPawn: 0.01, jitterMax: 0.04, ringR: 0.42,
};

function captures(c, sq) {                                   // the side to move's legal captures on sq, cheapest first, pawns promote to a queen
  return c.moves({ verbose: true }).filter((m) => m.captured && (m.flags.includes("e") ? m.to[0] + m.from[1] : m.to) === sq && (!m.promotion || m.promotion === "q"))
    .sort((a, b) => ((a.piece === "k" ? KING_LAST : VALUE[a.piece]) - (b.piece === "k" ? KING_LAST : VALUE[b.piece])) || (a.from < b.from ? -1 : 1));
}
function gain(c, sq) {                                       // what the side to move wins by capturing on sq and seeing it through
  const moves = captures(c, sq); if (!moves.length) return 0;
  const m = moves[0]; let won = VALUE[m.captured]; if (m.promotion) won += VALUE.q - VALUE.p;
  c.move(m); try { return Math.max(0, won - gain(c, m.to)); } finally { c.undo(); }
}
function asOther(fen, side) {                                // the same position with `side` to move, no en passant
  const f = fen.split(" "); f[1] = side; f[3] = "-"; return new Chess(f.join(" "));
}
/** What the owner of the piece on sq loses there if the other side were to move and started capturing (0 = safe by count). */
export function loss(c, sq) {
  const p = c.get(sq); if (!p || p.type === "k") return 0;
  try { return gain(asOther(c.fen(), p.color === "w" ? "b" : "w"), sq); } catch { return 0; }   // a position chess.js refuses with that side to move
}
/** [[attacker, target, loses], …] for every attacked piece but the kings. */
export function pairs(c) {
  const out = [];
  for (const row of c.board()) for (const p of row) {
    if (!p || p.type === "k") continue;
    const att = c.attackers(p.square, p.color === "w" ? "b" : "w"); if (!att.length) continue;
    const l = loss(c, p.square); for (const a of att.sort()) out.push([a, p.square, l]);
  }
  return out;
}
