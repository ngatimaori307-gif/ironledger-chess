/* 1.14.0 — your playstyle, Iron Ledger's (style.py, v7.45–v7.66). Every trait is a count from his own finished games set beside
   the same count for his OPPONENTS in those same games, so "unique" means unlike the opponents he actually plays, never against a
   made-up average. Board traits come from the moves alone (every game); review traits (accuracy by phase, blunders, great moves,
   punishing blunders, converting and saving positions) only from reviewed games. A trait needs STYLE.minGames games, a rate
   STYLE.minEvents chances; below that it is left out, never guessed.
   The style is the best of four scores, each the average of its traits' differences from his opponents (each clipped to ±clip):
   Attacker (checks, flank pawns, captures), Tactician (great moves, punishing blunders, middlegame accuracy), Endgame grinder
   (endgame accuracy, converting won positions, score once an endgame is reached), Rock (few blunders, saving lost positions,
   castling early). Not here, unlike Iron Ledger: sound sacrifices (its "!!" check isn't in this review). */
import { Chess } from "../vendor/chess.js";
import { STYLE } from "./config.js";
import { winChance } from "./guard.js";

const FLANK = new Set(["a", "b", "g", "h"]), PHASES = ["opening", "middlegame", "endgame"], VALUE = { n: 3, b: 3, r: 5, q: 9 };
const QUALITY = ["acc_opening", "acc_middlegame", "acc_endgame", "blunders", "punish", "convert", "save", "endgame_score"];
const GOOD_EXTRA = ["great", "castled_at"];
export const STYLES = { Attacker: ["checks", "flank", "captures"], Tactician: ["great", "punish", "acc_middlegame"],
  "Endgame grinder": ["acc_endgame", "convert", "endgame_score"], Rock: ["blunders", "save", "castled_at"] };

/** report.phase: the first OPENING_PLIES half-moves are the opening; then an endgame once N/B/R/Q points are at or below ENDGAME_MATERIAL. */
export function phase(fen, ply) {
  if (ply < STYLE.openingPlies) return "opening";
  let mat = 0; for (const ch of fen.split(" ")[0]) { const v = VALUE[ch.toLowerCase()]; if (v) mat += v; }
  return mat <= STYLE.endgameMaterial ? "endgame" : "middlegame";
}
/** style.board_traits: counts from the moves alone for both sides, and the game's own facts. */
export function boardTraits(pgn) {
  const g = new Chess(); g.loadPgn(pgn); const moves = g.history({ verbose: true }), b = new Chess();
  const t = { w: { checks: 0, captures: 0, flank: 0, queen_early: 0, castled_at: null }, b: { checks: 0, captures: 0, flank: 0, queen_early: 0, castled_at: null } };
  const own = { w: 0, b: 0 }; let queensOff = null, endgame = false;
  for (const mv of moves) {
    const c = mv.color; own[c]++; const n = own[c];
    if (mv.captured) t[c].captures++;
    if (mv.piece === "p" && FLANK.has(mv.from[0]) && n < STYLE.earlyMoves) t[c].flank++;
    if (mv.piece === "q" && n <= STYLE.queenEarlyMoves) t[c].queen_early = 1;
    if ((mv.flags.includes("k") || mv.flags.includes("q")) && t[c].castled_at == null) t[c].castled_at = n;
    b.move(mv.san);
    if (b.inCheck()) t[c].checks++;
    const placement = b.fen().split(" ")[0];
    if (queensOff == null && !placement.includes("Q") && !placement.includes("q")) queensOff = Number(b.fen().split(" ")[5]);
    if (!endgame && phase(b.fen(), b.history().length) === "endgame") endgame = true;
  }
  return { t, game: { queenless: queensOff != null && queensOff <= STYLE.queensOffMove, endgame, moves: Math.floor((moves.length + 1) / 2), plies: moves.length } };
}
/** style.report_traits, from this site's review (js/review.js): for "white" and "black". */
export function reportTraits(rep) {
  const out = {}, ms = rep.moves;
  for (const c of ["white", "black"]) {
    const mine = ms.filter((m) => m.color === c), acc = { opening: [], middlegame: [], endgame: [] };
    for (const m of mine) if (m.accuracy != null && m.fen) acc[phase(m.fen, m.ply - 1)].push(m.accuracy);
    out[c] = { acc, blunders: mine.filter((m) => m.label === "blunder").length, great: mine.filter((m) => m.great || m.quality === "great").length, moves: mine.length };
  }
  for (const c of ["white", "black"]) {
    const chances = []; for (let k = 1; k < ms.length; k++) if (ms[k].color === c && ms[k - 1].label === "blunder") chances.push(k);
    out[c].punish_chances = chances.length; out[c].punished = chances.filter((k) => ms[k].label !== "mistake" && ms[k].label !== "blunder").length;
  }
  const wcs = [...(ms[0]?.cpBefore != null ? [ms[0].cpBefore] : []), ...ms.map((m) => m.cpAfter)].filter((x) => x != null).map(winChance);   // White's chance at each ply
  for (const [c, sign] of [["white", 1], ["black", -1]]) {
    const mine = wcs.map((w) => (sign === 1 ? w : 100 - w));
    out[c].was_winning = mine.some((w) => w >= STYLE.winningWc); out[c].was_lost = mine.some((w) => w <= 100 - STYLE.winningWc);
  }
  return out;
}
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function diff(a, b) {
  if (a == null || b == null) return null;
  if (b === 0) return a > 0 ? STYLE.clip : 0;
  return Math.max(-STYLE.clip, Math.min(STYLE.clip, (a - b) / Math.abs(b)));
}
const enough = (t) => (t.n || 0) >= (t.rate ? STYLE.minEvents : STYLE.minGames);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
function fmt(v, unit) {
  if (v == null) return "–";
  return unit === "pct" ? `${Math.round(100 * v)} %` : unit === "acc" ? `${v.toFixed(1)} %` : unit === "move" ? `move ${Math.round(v)}` : v < 1 ? v.toFixed(2) : v.toFixed(1);
}
const line = (k, t) => ({ key: k, text: t.words, me: fmt(t.me, t.unit), opp: fmt(t.opp, t.unit), diff: Math.round(t.diff * 100) / 100, n: t.n });
const POINTS = { win: 1, draw: 0.5, loss: 0 };

/** games: the site's kept games; reportOf(at): its review or null → the playstyle, Iron Ledger's shape. */
export function evaluate(games, reportOf, only = null) {
  const rows = [];
  for (const g of games) {
    const score = POINTS[g.mine]; if (score == null) continue;
    let bt; try { bt = boardTraits(g.pgn); } catch { continue; }
    if (bt.game.plies < STYLE.minPlies) continue;
    const me = g.me === "w" ? "w" : "b", col = me === "w" ? "white" : "black";
    if (only && only !== col) continue;
    const rep = reportOf(g.at);
    rows.push({ col, me: bt.t[me], opp: bt.t[me === "w" ? "b" : "w"], game: bt.game, score, rep: rep && rep.moves ? reportTraits(rep) : null, first: first(g.pgn, me) });
  }
  const n = rows.length, reps = rows.filter((r) => r.rep), out = { games: n, analysed: reps.length, minGames: STYLE.minGames };
  if (n < STYLE.minGames) { out.reason = `needs ${STYLE.minGames} finished games of yours; ${n} so far`; return out; }
  const T = {}, oc = (r) => (r.col === "white" ? "black" : "white");
  const perGame = (f, words, unit) => { T[f] = { me: avg(rows.map((r) => r.me[f])), opp: avg(rows.map((r) => r.opp[f])), n, words, unit }; };
  perGame("checks", "Checks a game", "num"); perGame("captures", "Captures a game", "num");
  perGame("flank", `Flank pawn moves (a, b, g, h) before move ${STYLE.earlyMoves}`, "num");
  perGame("queen_early", `Queen out by move ${STYLE.queenEarlyMoves}`, "pct");
  const ca = rows.map((r) => r.me.castled_at).filter(Boolean), co = rows.map((r) => r.opp.castled_at).filter(Boolean);
  T.castled_at = { me: avg(ca), opp: avg(co), n: ca.length, words: "Castling, on average", unit: "move", lower: true };
  if (reps.length >= STYLE.minGames) {
    for (const ph of PHASES) T["acc_" + ph] = { me: avg(reps.flatMap((r) => r.rep[r.col].acc[ph])), opp: avg(reps.flatMap((r) => r.rep[oc(r)].acc[ph])), n: reps.length, words: `${ph[0].toUpperCase() + ph.slice(1)} accuracy`, unit: "acc" };
    T.blunders = { me: avg(reps.map((r) => r.rep[r.col].blunders)), opp: avg(reps.map((r) => r.rep[oc(r)].blunders)), n: reps.length, words: "Blunders a game", unit: "num", lower: true };
    T.great = { me: avg(reps.map((r) => r.rep[r.col].great)), opp: avg(reps.map((r) => r.rep[oc(r)].great)), n: reps.length, words: "Only-good moves found a game", unit: "num" };
    const rate = (who) => { const c = reps.reduce((s, r) => s + r.rep[who(r)].punish_chances, 0), h = reps.reduce((s, r) => s + r.rep[who(r)].punished, 0); return [c >= STYLE.minEvents ? h / c : null, c]; };
    const mineOf = (r) => r.col, [pm, pc] = rate(mineOf), [po] = rate(oc);
    T.punish = { me: pm, opp: po, n: pc, words: "Opponents' blunders punished", unit: "pct", rate: true };
    const outcome = (who, flag, good) => { const part = reps.filter((r) => r.rep[who(r)][flag]); if (part.length < STYLE.minEvents) return [null, part.length];
      const sc = part.map((r) => (who === mineOf ? r.score : 1 - r.score)); return [sc.filter(good).length / part.length, part.length]; };
    const [cm, cn] = outcome(mineOf, "was_winning", (s) => s === 1), [cop] = outcome(oc, "was_winning", (s) => s === 1);
    T.convert = { me: cm, opp: cop, n: cn, words: "Winning positions won", unit: "pct", rate: true };
    const [sm, sn] = outcome(mineOf, "was_lost", (s) => s >= 0.5), [sop] = outcome(oc, "was_lost", (s) => s >= 0.5);
    T.save = { me: sm, opp: sop, n: sn, words: "Lost positions saved (drawn or won)", unit: "pct", rate: true };
  }
  const eg = rows.filter((r) => r.game.endgame);
  if (eg.length >= STYLE.minEvents) T.endgame_score = { me: avg(eg.map((r) => r.score)), opp: avg(eg.map((r) => 1 - r.score)), n: eg.length, words: "Score once an endgame is reached", unit: "pct", rate: true };
  for (const t of Object.values(T)) { const d = diff(t.me, t.opp); t.diff = d == null ? null : t.lower ? -d : d; }
  out.traits = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, { ...v, me: r3(v.me), opp: r3(v.opp) }]));
  const scores = [];
  for (const [name, keys] of Object.entries(STYLES)) {
    const ks = keys.filter((k) => T[k] && T[k].diff != null && enough(T[k]));
    if (ks.length) scores.push({ style: name, score: Math.round(ks.reduce((s, k) => s + T[k].diff, 0) / ks.length * 100) / 100, traits: ks });
  }
  scores.sort((a, b) => b.score - a.score); out.styles = scores;
  out.style = scores.length && scores[0].score > 0 ? scores[0].style : null;
  if (scores.length && !out.style) out.reason = "no style stands out yet: in these games none of the four is ahead of your opponents";
  out.streak = scores.length > 1 && scores[1].score > 0 ? scores[1].style : null;
  const good = Object.keys(T).filter((k) => T[k].diff != null && enough(T[k]) && T[k].diff > 0 && (QUALITY.includes(k) || GOOD_EXTRA.includes(k))).sort((a, b) => T[b].diff - T[a].diff);
  out.strengths = good.slice(0, STYLE.strengthsShown).map((k) => line(k, T[k]));
  const shown = new Set(good.slice(0, STYLE.strengthsShown));
  out.unique = Object.keys(T).filter((k) => !shown.has(k) && T[k].diff != null && enough(T[k]) && Math.abs(T[k].diff) >= STYLE.diffShown)
    .sort((a, b) => Math.abs(T[b].diff) - Math.abs(T[a].diff)).slice(0, STYLE.uniqueShown).map((k) => line(k, T[k]));
  out.openings = openings(rows);
  if (out.openings.best) { const b = out.openings.best; out.strengths.push({ key: "opening", text: `${b.first} as ${b.col[0].toUpperCase() + b.col.slice(1)}`, me: `${b.score} %`, opp: null, n: b.games }); }
  const bad = Object.keys(T).filter((k) => T[k].diff != null && enough(T[k]) && T[k].diff < -STYLE.diffShown && QUALITY.includes(k)).sort((a, b) => T[a].diff - T[b].diff);
  out.costs = bad.length ? line(bad[0], T[bad[0]]) : null;
  return out;
}
function first(pgn, me) {                      // his first move as White, or his answer to 1.x as Black
  const g = new Chess(); g.loadPgn(pgn); const h = g.history();
  if (me === "w") return h[0] ? `1.${h[0]}` : null;
  return h.length >= 2 ? `1.${h[0]} ${h[1]}` : null;
}
/* robust.trimmed and best_vs_rest: the best-scoring opening counts as a strength only when it beats his other games once the
   picking from several openings is counted (a shuffle test, STYLE.permRuns runs, fixed seed: the same games give the same answer). */
export function trimmed(xs, cut = STYLE.trim) {
  const a = [...xs].sort((x, y) => x - y); if (!a.length) return null; const k = Math.floor(a.length * cut);
  if (a.length - 2 * k > 0) { const s = a.slice(k, a.length - k); return s.reduce((p, q) => p + q, 0) / s.length; }
  const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function bestVsRest(groups, every) {
  const sizes = groups.map((g) => g.length), total = sizes.reduce((a, b) => a + b, 0);
  if (!groups.length || total > every.length || (total === every.length && groups.length < 2)) return null;
  const pick = (arr) => { const parts = []; let at = 0; for (const s of sizes) { parts.push(arr.slice(at, at + s)); at += s; }
    const stats = parts.map((p) => trimmed(p)); let i = 0; stats.forEach((v, j) => { if (v > stats[i]) i = j; });
    const rest = [...parts.filter((_, j) => j !== i).flat(), ...arr.slice(at)]; return [i, stats[i] - trimmed(rest)]; };
  const order = groups.flat(), left = [...every]; for (const v of order) left.splice(left.indexOf(v), 1);
  const [i, gap] = pick([...order, ...left]), rand = rng(STYLE.permSeed); let hit = 0;
  for (let r = 0; r < STYLE.permRuns; r++) { const a = [...every]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } if (pick(a)[1] >= gap) hit++; }
  const p = (hit + 1) / (STYLE.permRuns + 1);
  return { best: i, gap: Math.round(gap * 100) / 100, p: Math.round(p * 1000) / 1000, real: p < STYLE.p };
}
function openings(rows) {
  const by = new Map();
  for (const r of rows) if (r.first) { const k = r.col + "|" + r.first; if (!by.has(k)) by.set(k, []); by.get(k).push(r.score); }
  const lst = [...by].map(([k, s]) => ({ col: k.split("|")[0], first: k.split("|")[1], games: s.length, score: Math.round(100 * s.reduce((a, b) => a + b, 0) / s.length), scores: s }))
    .sort((a, b) => b.games - a.games);
  const ok = lst.filter((x) => x.games >= STYLE.openingMin);
  let best = null;
  if (ok.length) {
    const t = bestVsRest(ok.map((x) => x.scores), rows.filter((r) => r.first).map((r) => r.score));
    if (t && t.real) best = { ...ok[t.best], p: t.p, compared: ok.length };
  }
  return { most: lst.slice(0, 4).map(({ scores, ...x }) => x), best: best && (({ scores, ...x }) => x)(best) };
}
