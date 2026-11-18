/* One game in progress, whoever the opponent is. The opponent is a "side": the computer (engine.js) or a friend's phone
   (friend.js). Every move is checked by the rules (chess.js) before it is played, on both phones. */
import { Chess } from "../vendor/chess.js";
import * as engine from "./engine.js";
import { ALL_OPPONENTS } from "./config.js";
import * as maia from "./maia.js";
import { addGame, setCurrent, beat } from "./store.js";
import { record } from "./log.js";

export function newMatch({ mode, me, oppId = null, code = null, ladder = false, moves = [], startedAt = Date.now(), result = null, oppName = "" }) {
  const chess = new Chess();
  const ok = [];
  for (const u of moves) { try { chess.move(uciObj(u)); ok.push(u); } catch { record("game", `a saved move didn't fit the rules: ${u}`); break; } }
  return { mode, me, oppId, code, ladder, moves: ok, startedAt, result, oppName, chess, listeners: [] };
}
export function uciObj(u) { return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }; }
export function opponent(m) { return ALL_OPPONENTS.find((o) => o.id === m.oppId) || null; }
export function oppLabel(m) {
  if (m.mode === "friend") return m.oppName || "Your friend";
  const o = opponent(m); return o ? `${o.name} · ${o.rating}` : "The computer";
}
export function lastMove(m) { const h = m.chess.history({ verbose: true }); return h.length ? h[h.length - 1] : null; }
export function myTurn(m) { return !m.result && m.chess.turn() === m.me; }

function snapshot(m) { const { chess, listeners, ...keep } = m; return keep; }
export function persist(m) { if (m.mode === "computer") setCurrent(m.result ? null : snapshot(m)); }

/* Plays a move from either side; returns the move or null when the rules refuse it. */
export function play(m, mv) {
  if (m.result) return null;
  let done; try { done = m.chess.move(mv); } catch { return null; }
  if (!done) return null;
  m.moves.push(done.from + done.to + (done.promotion || ""));
  const r = outcome(m.chess); if (r) finish(m, r.result, r.why);
  persist(m); m.listeners.forEach((fn) => fn("move", done)); return done;
}
export function outcome(c) {
  if (c.isCheckmate()) return { result: c.turn() === "w" ? "0-1" : "1-0", why: "checkmate" };
  if (c.isStalemate()) return { result: "1/2-1/2", why: "stalemate" };
  if (c.isInsufficientMaterial()) return { result: "1/2-1/2", why: "not enough pieces to mate" };
  if (c.isThreefoldRepetition()) return { result: "1/2-1/2", why: "the same position three times" };
  if (c.isDraw()) return { result: "1/2-1/2", why: "the fifty-move rule" };
  return null;
}
export function finish(m, result, why) {
  if (m.result) return;
  m.result = result; m.why = why;
  const mine = result === "1/2-1/2" ? "draw" : (result === "1-0") === (m.me === "w") ? "win" : "loss";
  m.mine = mine;
  if (m.ladder && mine === "win") beat(m.oppId);
  const pgnHead = { White: m.me === "w" ? "You" : oppLabel(m), Black: m.me === "b" ? "You" : oppLabel(m), Result: result, Date: new Date(m.startedAt).toISOString().slice(0, 10).replace(/-/g, ".") };
  for (const [k, v] of Object.entries(pgnHead)) m.chess.setHeader(k, v);
  addGame({ at: Date.now(), mode: m.mode, opp: oppLabel(m), me: m.me, result, why, mine, moves: m.moves.length, pgn: m.chess.pgn() });
  persist(m); m.listeners.forEach((fn) => fn("end", { result, why, mine }));
}

/* The computer's turn: asks the engine, then plays its answer. */
export async function computerReply(m) {
  if (m.mode !== "computer" || m.result || m.chess.turn() === m.me) return null;
  const o = opponent(m), fen = m.chess.fen();
  try {
    const u = o && o.maia ? await maia.move(m.moves, o.rating) : await engine.move(fen, o);
    if (m.chess.fen() !== fen || m.result) return null;            // he took back or resigned meanwhile
    return play(m, uciObj(u));
  } catch (e) { record("engine", e.message); m.listeners.forEach((fn) => fn("error", e)); return null; }
}
