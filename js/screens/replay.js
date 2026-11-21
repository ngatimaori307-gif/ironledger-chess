/* A finished game, move by move: ⏮ ◀ ▶ ⏭, a tap on any move jumps there, the board turned to his side; Copy PGN and Share.
   v1.6: Review with Stockfish (js/review.js — Iron Ledger's report rules): accuracy, each move's mark and the best move; for a
   Hardcore game the review between rungs — the moments that decided it, each set up again to find the better move; and an
   Engine Duel from any position. */
import { Chess } from "../../vendor/chess.js";
import { createBoard } from "../board.js";
import { games } from "../store.js";
import { esc } from "./ui.js";
import { toolsHtml, wireTools } from "./gameview.js";
import { sound } from "../sound.js";
import { record } from "../log.js";
import { go, onLeave } from "../app.js";
import { REVIEW } from "../config.js";
import * as rv from "../review.js";
import { START_KEY } from "./duel.js";
import { setCurrent } from "../store.js";
import { illusion } from "../illusion.js";

const MARK = { blunder: "??", mistake: "?", inaccuracy: "?!", miss: "✗", great: "!" };
const WORD = { blunder: "a blunder", mistake: "a mistake", inaccuracy: "an inaccuracy", miss: "a miss", great: "the only good move", best: "the best move", good: "good" };
const score = (cp) => (Math.abs(cp) >= 9000 ? (cp > 0 ? "mate for White" : "mate for Black") : `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(2)}`);

export function render(v, arg) {
  const g = games().find((x) => String(x.at) === arg);
  if (!g) { v.innerHTML = `<section class="pg"><h1 class="ilc-title">Game not found</h1><p class="sub">It may be older than the games this phone keeps.</p><a class="ilc-btn" href="#profile">Back to your profile</a></section>`; return; }
  const full = new Chess();
  try { full.loadPgn(g.pgn); } catch (e) { record("replay", e.message); }
  const moves = full.history({ verbose: true }), sans = moves.map((x) => x.san), col = g.me === "w" ? "white" : "black";
  const back = g.hc ? `#hardcore/${g.hc}` : "#profile";
  document.documentElement.setAttribute("data-board", "");
  v.innerHTML = `<section class="gm">
    <header class="gm-top"><a class="ilc-btn gm-back" href="${back}" aria-label="Back">‹</a>
      <div class="gm-who"><b>${esc(g.opp)}</b><span class="ilc-card__line">${{ win: "You won", loss: "You lost", draw: "A draw" }[g.mine] || ""} · ${esc(g.why || "")} · ${new Date(g.at).toLocaleDateString()}</span></div></header>
    <div id="gm-board"></div>
    <div class="gm-moves" id="gm-moves" aria-label="Moves"></div>
    <div class="rv-sharp" id="rv-sharp" aria-label="How sharp each move's position was"></div>
    <p class="ilc-card__line rv-line" id="rv-line" role="status"></p>
    <div class="rv-acts" id="rv-acts"></div>
    <div class="rv-ill" id="rv-ill" aria-live="polite"></div>
    <nav class="gm-bar">
      <button class="ilc-btn" data-go="start" aria-label="To the start">⏮</button><button class="ilc-btn" data-go="back" aria-label="Back one move">◀</button>
      <button class="ilc-btn" data-go="next" aria-label="Forward one move">▶</button><button class="ilc-btn" data-go="end" aria-label="To the end">⏭</button>
      <button class="ilc-btn" id="rp-flip" aria-label="Turn the board">⇅</button>
    </nav>
    <nav class="gm-tools" aria-label="Board tools">${toolsHtml()}</nav>
    <div class="rv" id="rv"></div>
    <nav class="gm-bar"><button class="ilc-btn" id="rp-copy">Copy PGN</button>${navigator.share ? `<button class="ilc-btn" id="rp-share">Share</button>` : ""}<button class="ilc-btn" id="rp-duel">Engine Duel from here</button></nav>
    <p class="sub rp-note" id="rp-note" role="status"></p></section>`;
  let at = sans.length, flip = g.me === "b", rep = rv.loadReport(g.at), trying = null, gone = false;
  onLeave(() => { gone = true; });
  const board = createBoard(v.querySelector("#gm-board"), { canMove: () => !!trying, onMove: (mv) => tried(mv) });
  board.lock(true); wireTools(v, board);   // 1.10.0: ✎ Draw and ◫ Tension while looking back over a game
  function position(n) { const c = new Chess(); moves.slice(0, n).forEach((x) => c.move(x.san)); return c; }
  function show(n, step) {
    trying = null; board.lock(true);
    at = Math.max(0, Math.min(sans.length, n));
    board.set(position(at), { lastMove: at ? moves[at - 1] : null, flip });
    if (step && at) { const x = moves[at - 1]; sound(x.captured ? "capture" : "move", x); }
    const list = v.querySelector("#gm-moves");
    list.innerHTML = sans.map((s, i) => { const q = rep?.moves[i]?.quality;
      return (i % 2 ? "" : `<span class="gm-no">${i / 2 + 1}.</span>`) + `<button type="button" class="gm-san${i === at - 1 ? " on" : ""}${q && MARK[q] ? ` q-${q}` : ""}" data-ply="${i + 1}">${esc(s)}${q && MARK[q] ? `<sup>${MARK[q]}</sup>` : ""}</button>`; }).join("");
    list.querySelector(".gm-san.on")?.scrollIntoView({ inline: "center", block: "nearest" });
    const m = rep && at ? rep.moves[at - 1] : null;
    acts(m); v.querySelector("#rv-ill").innerHTML = "";
    v.querySelector("#rv-line").innerHTML = m ? `${Math.ceil(m.ply / 2)}${m.color === "white" ? "." : "…"}${esc(m.san)} — ${WORD[m.quality] || esc(m.quality)}${m.quality === "best" || m.quality === "great" || !m.best ? "" : ` · best was <b>${esc(m.best)}</b>`}${m.drop >= 1 ? ` · gave up ${Math.round(m.drop)} % winning chance` : ""} · ${score(m.cpAfter)} (ENG d${rep.depth})` : "";
  }
  function summary() {
    const el = v.querySelector("#rv");
    if (!rep) {
      el.innerHTML = `<div class="ilc-plate rv-start"><div><div class="ilc-plate__over">Review with Stockfish</div>
        <div class="ilc-card__line">Accuracy, every move marked, and the best move where yours wasn't.</div></div>
        <div class="rv-btns"><button class="ilc-btn ilc-btn--primary" data-lv="quick">Quick</button><button class="ilc-btn" data-lv="normal">Normal</button></div></div>`;
      el.querySelectorAll("[data-lv]").forEach((b) => { b.onclick = () => review(b.dataset.lv); });
      return;
    }
    strip();
    const me = rep.sides[col], them = rep.sides[col === "white" ? "black" : "white"];
    el.innerHTML = `<div class="ilc-plate"><div><div class="ilc-plate__over">Your accuracy</div><div class="ilc-plate__fig">${me.accuracy ?? "–"}</div>
        <div class="ilc-card__line">${me.blunder} blunder${me.blunder === 1 ? "" : "s"} · ${me.mistake} mistake${me.mistake === 1 ? "" : "s"} · ${me.inaccuracy} inaccurac${me.inaccuracy === 1 ? "y" : "ies"}${me.great ? ` · ${me.great} only-move${me.great === 1 ? "" : "s"} found` : ""}</div></div>
      <div><div class="ilc-plate__over">${esc(String(g.opp).split(" · ")[0])}</div><div class="ilc-plate__fig">${them.accuracy ?? "–"}</div></div></div>
      <p class="sub">Stockfish 19 in the browser, ${rep.level}, depth ${rep.depth}+ a position. Tap a move to see its mark and the best move.</p>
      ${g.hc ? hcReview() : ""}`;
    wireHc();
  }
  async function review(level) {
    const el = v.querySelector("#rv"); el.innerHTML = `<p class="sub" id="rv-prog" role="status">Stockfish is looking at the game…</p>`;
    try {
      const r = await rv.analyseGame(g.pgn, level, (d, n) => { if (!gone) { const p = v.querySelector("#rv-prog"); if (p) p.textContent = `Stockfish is looking at the game: position ${d} of ${n}`; } });
      if (gone) return;
      rep = r; if (!rv.saveReport(g.at, r)) record("review", "the phone's storage is full — the review wasn't kept");
      summary(); show(at);
    } catch (e) { record("review", e.message); if (!gone) el.innerHTML = `<p class="sub">The review stopped: ${esc(e.message)}. Try again.</p>`; }
  }
  /* 1.12.0 — Iron Ledger's sharpness strip (v8.10): one cell a move, calm / sharp / an only move (the gap between Stockfish's best
     and next-best move, the mover's side, from the review's own two lines); your only moves marked ✓ found or ✗ missed. */
  function strip() {
    const el = v.querySelector("#rv-sharp");
    if (!rep || !rep.moves.some((x) => x.sharp)) { el.innerHTML = rep ? `<p class="sub">Review it again to see how sharp each move was.</p>` : ""; return; }
    const o = rv.onlyMoves(rep, col);
    el.innerHTML = `<div class="sh-cells">${rep.moves.map((x) => { const mine = x.color === col, k = x.sharp || "none", mark = mine && k === "only" ? (x.uci === x.bestUci ? "✓" : "✗") : "";
      return `<button type="button" class="sh sh-${k}${mine ? " sh-mine" : ""}" data-ply="${x.ply}" title="${Math.ceil(x.ply / 2)}${x.color === "white" ? "." : "…"}${esc(x.san)}: ${k === "only" ? "an only move" : k}${x.gap != null ? ` (gap ${x.gap})` : ""}">${mark}</button>`; }).join("")}</div>
      <p class="ilc-card__line">${o.n ? `Only moves: you found <b>${o.found} of ${o.n}</b>.` : "No only-move positions for you in this game."} <span class="sh-key"><i class="sh sh-calm"></i>calm <i class="sh sh-sharp"></i>sharp <i class="sh sh-only"></i>only move</span></p>`;
    el.querySelector(".sh-cells").onclick = (e) => { const b = e.target.closest("[data-ply]"); if (b) show(Number(b.dataset.ply)); };
  }
  /* 1.12.0 — on one of your moves: What if (play on from just before it, against the same opponent — Iron Ledger v8.00) and, on a
     mistake or blunder, the Illusion window (Iron Ledger v8.13). */
  function acts(m) {
    const el = v.querySelector("#rv-acts"); el.innerHTML = "";
    if (!m || m.color !== col) return;
    const whatIf = g.mode === "computer" && g.oppId, ill = m.label === "mistake" || m.label === "blunder";
    el.innerHTML = `${whatIf ? `<button class="ilc-btn" id="rv-whatif">What if — play from here</button>` : ""}${ill ? `<button class="ilc-btn" id="rv-illusion">Illusion — what you hoped for</button>` : ""}`;
    el.querySelector("#rv-whatif")?.addEventListener("click", () => {
      setCurrent({ mode: "computer", me: g.me, oppId: g.oppId, moves: moves.slice(0, m.ply - 1).map((x) => x.from + x.to + (x.promotion || "")), startedAt: Date.now() });
      go("#game/resume");
    });
    el.querySelector("#rv-illusion")?.addEventListener("click", () => showIllusion(m));
  }
  async function showIllusion(m) {
    const el = v.querySelector("#rv-ill"); el.innerHTML = `<p class="sub" id="ill-step" role="status">Getting ready…</p>`;
    try {
      const r = await illusion(g, m, (t) => { const p = v.querySelector("#ill-step"); if (p && !gone) p.textContent = t; });
      if (gone || at !== m.ply) return;
      const row = (x, cls) => `<li><button type="button" class="ill-row ${cls}" data-fen="${esc(x.fen || "")}" data-u="${esc(x.uci)}"><b>${esc(x.san)}</b>${x.p != null ? ` <span>${Math.round(x.p * 100)} % play it</span>` : ""} <span>your chance ${x.chance} %</span>${x.holds != null ? ` <i>${x.holds ? "holds" : "punished"}</i>` : ""}</button></li>`;
      el.innerHTML = `<div class="ilc-plate ill"><div class="ilc-plate__over">Illusion</div><p class="ill-title"><b>${Math.ceil(m.ply / 2)}${m.color === "white" ? "." : "…"}${esc(m.san)}</b> — your chance before it ${r.before} %</p>
        ${r.refutation ? `<h3 class="ill-h">A — what really happens</h3><ul class="ill-list">${row({ ...r.refutation, fen: "" }, "ill-real")}</ul>` : ""}
        <h3 class="ill-h">B — what you hoped for: what people rated about ${r.rating} reply</h3><ul class="ill-list">${r.replies.map((x) => row(x, x.holds ? "ill-holds" : "ill-no")).join("")}</ul>
        <p class="ilc-card__line">The illusion holds <b>${r.holds} %</b> of the time at that rating. Maia-3 says how often a reply is played; Stockfish (depth ${r.depth}) judges each one. Tap a reply to see it.</p></div>`;
      el.querySelectorAll(".ill-row").forEach((b) => { b.onclick = () => {
        const c = new Chess(r.fenAfter), u = b.dataset.u; const mv = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        board.set(c, { lastMove: mv, flip }); v.querySelector("#gm-board").scrollIntoView({ block: "center" });
      }; });
    } catch (e) { record("illusion", e.message); if (!gone) el.innerHTML = `<p class="sub">The Illusion window stopped: ${esc(e.message)}.</p>`; }
  }
  /* the review between rungs (Iron Ledger's hardcore review) */
  const ms = () => (rep ? rv.moments(rep, col) : []);
  function hcReview() {
    const st = rv.reviews()[g.at] || { tries: {} }, list = ms();
    if (!list.length) return `<p class="sub">Between rungs: no move of yours gave up ${REVIEW.momentMinDrop} % or more — nothing to set up again.</p>`;
    return `<h2 class="overline">Between rungs: the moments that decided it</h2><ul class="games rv-moments">${list.map((m) => { const t = st.tries[m.ply];
      return `<li><span class="res ${t?.ok ? "res--win" : "res--loss"}">${t?.ok ? "✓" : "·"}</span><span class="g-opp">${Math.ceil(m.ply / 2)}${m.color === "white" ? "." : "…"}${esc(m.san)} — ${esc(m.kind)}</span>
        <span class="ilc-card__line">gave up ${Math.round(m.drop)} %${t ? ` · your try ${esc(t.san)}${t.ok ? " — found" : ` gave up ${t.drop} %`}` : ""} <button class="ilc-btn rv-try" data-ply="${m.ply}">${t?.ok ? "Again" : "Find the better move"}</button></span></li>`; }).join("")}</ul>
      ${st.reviewed ? `<p class="sub">Reviewed ${esc(st.reviewed)}.</p>` : `<button class="ilc-btn" id="rv-done">Mark reviewed</button>`}`;
  }
  function wireHc() {
    v.querySelectorAll(".rv-try").forEach((b) => { b.onclick = () => {
      const m = ms().find((x) => x.ply === Number(b.dataset.ply)); if (!m) return;
      at = m.ply - 1; show(at); trying = m; board.lock(false);
      v.querySelector("#rv-line").textContent = `Move ${Math.ceil(m.ply / 2)}: you played ${m.san}. Find a better move for ${m.color} — play it on the board.`;
      v.querySelector("#gm-board").scrollIntoView({ block: "center" });
    }; });
    v.querySelector("#rv-done")?.addEventListener("click", () => { rv.markReviewed(g.at); summary(); });
  }
  async function tried(mv) {
    const m = trying; if (!m) return; trying = null; board.lock(true);
    const uci = mv.from + mv.to + (mv.promotion || ""), line = v.querySelector("#rv-line"), c = new Chess(m.fen);
    try { board.set(c, { lastMove: c.move(mv), flip }); } catch { return; }   // his try stays on the board while it is judged
    line.textContent = "Stockfish is judging it…";
    try {
      const r = await rv.judgeTry(m.fen, uci, m.bestUci); if (gone) return;
      const e = rv.saveTry(g.at, m.ply, { uci, san: r.san, ok: r.ok, drop: r.drop });
      if (ms().every((x) => e.tries[x.ply]?.ok)) rv.markReviewed(g.at);
      line.innerHTML = r.ok ? `Found: <b>${esc(r.san)}</b> gives up ${r.drop} % (Stockfish's best: ${esc(m.best)}).` : `${esc(r.san)} gives up ${r.drop} % — try again. Stockfish's best: <b>${esc(m.best)}</b>.`;
      summary();
    } catch (e) { line.textContent = e.message; }
  }
  v.querySelector("#gm-moves").onclick = (e) => { const b = e.target.closest("[data-ply]"); if (b) show(Number(b.dataset.ply)); };
  v.querySelectorAll("[data-go]").forEach((b) => { b.onclick = () => {
    const d = b.dataset.go; if (d === "next") show(at + 1, true); else if (d === "back") show(at - 1); else show(d === "start" ? 0 : sans.length);
  }; });
  v.querySelector("#rp-flip").onclick = () => { flip = !flip; board.set(position(at), { lastMove: at ? moves[at - 1] : null, flip }); };
  const note = (t) => { v.querySelector("#rp-note").textContent = t; };
  v.querySelector("#rp-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(g.pgn); note("Copied — paste it into Lichess, Chess.com or any chess app."); }
    catch { const t = document.createElement("textarea"); t.value = g.pgn; t.className = "rp-pgn"; t.readOnly = true; v.querySelector(".gm").append(t); t.select();
      note("This browser wouldn't copy by itself: the PGN is selected below — hold it and choose Copy."); }
  };
  v.querySelector("#rp-share")?.addEventListener("click", () => navigator.share({ title: `${g.opp} — ${g.result}`, text: g.pgn }).catch(() => {}));
  v.querySelector("#rp-duel").onclick = () => { try { sessionStorage.setItem(START_KEY, position(at).fen()); } catch {} go("#duel"); };
  summary(); show(at);
}
