/* 1.13.0 — Train, Iron Ledger's (Train → My mistakes, v5.99 + v8.05 spaced repetition; Blindfold, v7.x):
   - My mistakes: one puzzle for every mistake or blunder of his in a reviewed game — find the move Stockfish preferred. A different
     move counts when Stockfish rates it within TRAIN.altDrop win-chance points of the best (puzzles.alternative_ok). Each try is
     graded and scheduled by FSRS-4.5 (js/fsrs.js): due puzzles first, then new ones, TRAIN.session at a time.
   - Blindfold: a game against any computer opponent with the pieces hidden. He types (or says, where the phone can) his move; the
     opponent's moves are read aloud and listed; Peek shows the board for a moment and is counted. Not saved to his games. */
import { Chess } from "../../vendor/chess.js";
import { games, settings, saveSettings } from "../store.js";
import { createBoard } from "../board.js";
import { loadReport } from "../review.js";
import * as engine from "../engine.js";
import { winChance } from "../guard.js";
import { review as fsrsReview, grade, isDue } from "../fsrs.js";
import { ALL_OPPONENTS, MAIA3_OPPONENTS, TRAIN } from "../config.js";
import { opponentMove, outcome } from "../match.js";
import { esc, colorPicker, pickColor } from "./ui.js";
import { toolsHtml, wireTools } from "./gameview.js";
import { onLeave } from "../app.js";

const KEY = "ilc-puzzles";
const progress = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const saveProgress = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* full: this try isn't kept */ } };

/** Every mistake or blunder of his in a reviewed game, as a puzzle. */
export function mistakes() {
  const out = [];
  for (const g of games()) {
    const rep = loadReport(g.at); if (!rep) continue;
    const col = g.me === "w" ? "white" : "black";
    for (const m of rep.moves) if (m.color === col && (m.label === "mistake" || m.label === "blunder") && m.bestUci && m.fen)
      out.push({ id: `${g.at}:${m.ply}`, fen: m.fen, solution: m.bestUci, best: m.best, played: m.san, ply: m.ply, opp: g.opp, at: g.at, label: m.label });
  }
  return out;
}
export function session(all = mistakes(), prog = progress(), now = Date.now() / 1000) {
  const due = all.filter((p) => prog[p.id] && isDue(prog[p.id].srs, now)).sort((a, b) => (prog[a.id].srs?.due || 0) - (prog[b.id].srs?.due || 0));
  const fresh = all.filter((p) => !prog[p.id]);
  return [...due, ...fresh].slice(0, TRAIN.session);
}

export function render(v, arg) {
  if (arg === "mistakes") return renderMistakes(v);
  if (arg === "blind") return renderBlind(v);
  const all = mistakes(), prog = progress(), due = all.filter((p) => prog[p.id] && isDue(prog[p.id].srs)).length, fresh = all.filter((p) => !prog[p.id]).length;
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Train</h1><p class="sub">Practise on your own games, and without seeing the board</p>
    <nav class="cards">
      <a class="ilc-card" href="#train/mistakes"><span class="ilc-card__icon" aria-hidden="true">◎</span><span><span class="ilc-card__name">My mistakes</span>
        <span class="ilc-card__line">${all.length ? `${due} due again · ${fresh} new · ${all.length} in all` : "Review a game (Me → a game → Review) and its mistakes come here"}</span></span><span class="ilc-card__go" aria-hidden="true">›</span></a>
      <a class="ilc-card" href="#train/blind"><span class="ilc-card__icon" aria-hidden="true">◐</span><span><span class="ilc-card__name">Blindfold</span>
        <span class="ilc-card__line">A game with the pieces hidden — type or say your moves</span></span><span class="ilc-card__go" aria-hidden="true">›</span></a>
    </nav></section>`;
}

function renderMistakes(v) {
  const list = session();
  if (!list.length) { v.innerHTML = `<section class="pg"><h1 class="ilc-title">My mistakes</h1><p class="sub">${mistakes().length ? "Nothing is due today — each puzzle comes back when you'd start to forget it." : "No mistakes yet: review a game first (Me → a game → Review with Stockfish)."}</p><a class="ilc-btn" href="#train">Back</a></section>`; return; }
  document.documentElement.setAttribute("data-board", "");
  let i = 0, solved = 0, started = 0, busy = false, gone = false;
  onLeave(() => { gone = true; });
  v.innerHTML = `<section class="gm"><header class="gm-top"><a class="ilc-btn gm-back" href="#train" aria-label="Back to Train">‹</a>
      <div class="gm-who"><b>My mistakes</b><span id="pz-count" class="ilc-card__line"></span></div></header>
    <div id="gm-board"></div><p class="ilc-card__line rv-line" id="pz-line" role="status"></p>
    <nav class="gm-bar"><button class="ilc-btn" id="pz-show">Show the answer</button><button class="ilc-btn ilc-btn--primary" id="pz-next" hidden>Next</button></nav>
    <nav class="gm-tools" aria-label="Board tools">${toolsHtml()}</nav></section>`;
  const line = v.querySelector("#pz-line"), next = v.querySelector("#pz-next"), showB = v.querySelector("#pz-show");
  let c = null, p = null;
  const board = createBoard(v.querySelector("#gm-board"), { canMove: () => !busy && !!p, onMove: (mv) => tried(mv) });
  wireTools(v, board);
  function load() {
    p = list[i]; c = new Chess(p.fen); busy = false; started = Date.now();
    board.set(c, { flip: c.turn() === "b" }); board.lock(false);
    v.querySelector("#pz-count").textContent = `${i + 1} of ${list.length} · against ${String(p.opp).split(" · ")[0]}, move ${Math.ceil(p.ply / 2)}`;
    line.innerHTML = `You played <b>${esc(p.played)}</b> here (${p.label}). Find the better move for ${c.turn() === "w" ? "White" : "Black"}.`;
    next.hidden = true; showB.hidden = false;
  }
  function done(ok, text) {
    const prog = progress(), e = prog[p.id] || { tries: 0, solved: 0 }, secs = (Date.now() - started) / 1000;
    e.tries++; if (ok) e.solved++; e.last_ok = ok; e.srs = fsrsReview(e.srs, grade(ok, secs)); prog[p.id] = e; saveProgress(prog);
    if (ok) solved++;
    const days = Math.max(1, Math.round((e.srs.due - Date.now() / 1000) / 86400));
    line.innerHTML = `${text} <span class="sub">Back in ${days} day${days === 1 ? "" : "s"}.</span>`;
    busy = true; board.lock(true); showB.hidden = true; next.hidden = false;
    next.textContent = i + 1 < list.length ? "Next" : `Done — ${solved} of ${list.length}`;
  }
  async function tried(mv) {
    if (busy) return; busy = true; board.lock(true);
    const before = new Chess(p.fen), m = before.move(mv), uci = m.from + m.to + (m.promotion || ""), after = new Chess(before.fen());
    board.set(after, { lastMove: m, flip: c.turn() === "b" });
    if (uci === p.solution) return done(true, `<b>${esc(m.san)}</b> — that's Stockfish's move.`);
    if (after.isCheckmate()) return done(true, `<b>${esc(m.san)}</b> — mate. A different move that works just as well.`);
    line.textContent = "Stockfish is checking your move…";
    try {
      const [b, t] = await Promise.all([engine.analyse(p.fen, { depth: TRAIN.depth, ms: TRAIN.ms }), engine.analyse(p.fen, { depth: TRAIN.depth, ms: TRAIN.ms, only: uci })]);
      if (gone) return;
      const ok = b.cp != null && t.cp != null && winChance(t.cp) >= winChance(b.cp) - TRAIN.altDrop;
      if (ok) return done(true, `<b>${esc(m.san)}</b> — a different move that works just as well (Stockfish's: ${esc(p.best)}).`);
      board.set(new Chess(p.fen), { flip: c.turn() === "b" });
      done(false, `<b>${esc(m.san)}</b> isn't it. The better move was <b>${esc(p.best)}</b>.`);
    } catch (e) { if (!gone) { busy = false; board.lock(false); line.textContent = `Stockfish couldn't check it: ${e.message}. Try a move again.`; } }
  }
  showB.onclick = () => { if (busy) return; const b = new Chess(p.fen), m = b.move({ from: p.solution.slice(0, 2), to: p.solution.slice(2, 4), promotion: p.solution[4] });
    board.set(b, { lastMove: m, flip: c.turn() === "b" }); done(false, `The better move was <b>${esc(p.best)}</b>.`); };
  next.onclick = () => { if (i + 1 < list.length) { i++; load(); } else location.hash = "#train"; };
  load();
}

/* ---- Blindfold ---- */
function renderBlind(v) {
  const opps = ALL_OPPONENTS.filter((o) => !o.guard), chosen = opps.some((o) => o.id === settings.blindOpp) ? settings.blindOpp : MAIA3_OPPONENTS[0].id;
  let g = null, gone = false;
  onLeave(() => { gone = true; speechSynthesis?.cancel?.(); });
  v.innerHTML = `<section class="pg bl"><h1 class="ilc-title">Blindfold</h1>
    <div id="bl-setup"><p class="sub">The pieces stay hidden. Type your moves (e4, Nf3, O-O), or tap 🎤 where your phone listens. Not saved to your games.</p>
      <div class="field"><label for="bl-opp">Against</label><select id="bl-opp">${opps.map((o) => `<option value="${o.id}"${o.id === chosen ? " selected" : ""}>${esc(o.name)} · ${o.rating}</option>`).join("")}</select></div>
      <h2 class="overline">You play</h2>${colorPicker("bl-col", settings.blindColor || "w")}
      <label class="switch"><span>Read the moves aloud</span><input type="checkbox" id="bl-say"${settings.blindSay !== false ? " checked" : ""}></label>
      <button class="ilc-btn ilc-btn--primary" id="bl-start">Start</button></div>
    <div id="bl-play" hidden>
      <div id="gm-board" class="bl-board"></div>
      <ul class="bl-moves" id="bl-moves" aria-label="The moves"></ul>
      <p class="ilc-card__line" id="bl-line" role="status"></p>
      <form id="bl-form" class="bl-form"><input id="bl-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Your move" aria-label="Your move">
        <button class="ilc-btn ilc-btn--primary">Play</button>${"webkitSpeechRecognition" in window || "SpeechRecognition" in window ? `<button type="button" class="ilc-btn" id="bl-mic" aria-label="Say your move">🎤</button>` : ""}</form>
      <nav class="gm-bar"><button class="ilc-btn" id="bl-again">Say it again</button><button class="ilc-btn" id="bl-peek">Peek</button><button class="ilc-btn" id="bl-resign">Resign</button></nav>
    </div></section>`;
  const $ = (s) => v.querySelector(s), board = createBoard($("#gm-board"), { canMove: () => false, onMove: () => {} });
  const say = (t) => { if (!$("#bl-say").checked || !window.speechSynthesis) return; speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(spoken(t))); };
  function list() {
    const h = g.c.history(), rows = [];
    for (let k = 0; k < h.length; k += 2) rows.push(`<li><b>${k / 2 + 1}.</b> ${esc(h[k])}${h[k + 1] ? ` ${esc(h[k + 1])}` : ""}</li>`);
    $("#bl-moves").innerHTML = rows.join("");
  }
  function end(r) {
    g.over = r; $("#bl-form").hidden = true; $("#bl-peek").hidden = true; $("#bl-resign").hidden = true;
    $("#gm-board").classList.add("bl-shown"); board.set(g.c, { flip: g.me === "b" });
    const mine = r.result === "1/2-1/2" ? "A draw" : (r.result === "1-0") === (g.me === "w") ? "You won" : "You lost";
    $("#bl-line").innerHTML = `<b>${mine}</b> — ${esc(r.why)}. Peeks: <b>${g.peeks}</b>. <button type="button" class="ilc-btn" id="bl-new">New game</button>`;
    $("#bl-new").onclick = () => renderBlind(v);   // the same address: drawn again here, not by the router
    say(`${mine}, ${r.why}`);
  }
  async function theirs() {
    if (g.over || g.c.turn() === g.me) return;
    $("#bl-line").textContent = `${g.o.name} is thinking…`;
    try {
      const u = await opponentMove(g.o, g.moves, g.c.fen()); if (gone || g.over) return;
      const m = g.c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); g.moves.push(u); g.last = m.san; list();
      $("#bl-line").innerHTML = `${esc(g.o.name)} played <b>${esc(m.san)}</b>. Your move.`; say(m.san);
      const r = outcome(g.c); if (r) end(r);
    } catch (e) { $("#bl-line").textContent = `The opponent couldn't answer: ${e.message}`; }
  }
  function mine(text) {
    if (!g || g.over || g.c.turn() !== g.me) return;
    const t = text.trim().replace(/^0-0-0$/i, "O-O-O").replace(/^0-0$/i, "O-O");
    let m = null; try { m = g.c.move(t); } catch { try { m = g.c.move(t.charAt(0).toUpperCase() + t.slice(1)); } catch { m = null; } }
    if (!m) { $("#bl-line").innerHTML = `<b>${esc(text)}</b> isn't a legal move here. Try again (e4, Nf3, exd5, O-O, e8=Q).`; return; }
    g.moves.push(m.from + m.to + (m.promotion || "")); g.last = m.san; list(); $("#bl-in").value = "";
    const r = outcome(g.c); if (r) end(r); else theirs();
  }
  $("#bl-start").onclick = () => {
    const o = ALL_OPPONENTS.find((x) => x.id === $("#bl-opp").value), pick = v.querySelector("input[name=bl-col]:checked").value;
    settings.blindOpp = o.id; settings.blindColor = pick; settings.blindSay = $("#bl-say").checked; saveSettings();
    engine.start().catch(() => {});
    g = { c: new Chess(), moves: [], me: pickColor(pick), o, peeks: 0, over: null, last: null };
    $("#bl-setup").hidden = true; $("#bl-play").hidden = false; board.set(g.c, { flip: g.me === "b" }); list();
    $("#bl-line").textContent = g.me === "w" ? "Your move, White." : `You play Black.`; theirs();
  };
  $("#bl-form").onsubmit = (e) => { e.preventDefault(); mine($("#bl-in").value); };
  $("#bl-again").onclick = () => { if (g && g.last) say(g.last); };
  $("#bl-peek").onclick = () => { if (!g || g.over) return; g.peeks++; board.set(g.c, { flip: g.me === "b" }); $("#gm-board").classList.add("bl-shown");
    setTimeout(() => { if (!g.over) $("#gm-board").classList.remove("bl-shown"); }, TRAIN.peekMs); };
  $("#bl-resign").onclick = (e) => { const b = e.currentTarget; if (b.dataset.sure) return end({ result: g.me === "w" ? "0-1" : "1-0", why: "you resigned" });
    b.dataset.sure = "1"; b.textContent = "Tap again to resign"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Resign"; }, 3000); };
  v.querySelector("#bl-mic")?.addEventListener("click", () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition, rec = new R(); rec.lang = "en"; rec.maxAlternatives = 3;
    rec.onresult = (e) => { const alts = [...e.results[0]].map((a) => heard(a.transcript)); const ok = alts.find((t) => { try { return !!new Chess(g.c.fen()).move(t); } catch { return false; } }); mine(ok || alts[0]); };
    rec.onerror = () => { $("#bl-line").textContent = "The phone didn't catch that — type it instead."; };
    rec.start(); $("#bl-line").textContent = "Listening…";
  });
}
/* SAN read the way a player says it, and what a player says turned back into SAN (a few words, as Iron Ledger's blindfold). */
const NAMES = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight" };
export function spoken(san) {
  if (/^O-O-O/.test(san)) return "castles long"; if (/^O-O/.test(san)) return "castles short";
  return san.replace(/^([KQRBN])/, (_, p) => NAMES[p] + " ").replace("x", " takes ").replace(/=([QRBN])/, (_, p) => " promotes to " + NAMES[p]).replace("+", ", check").replace("#", ", mate").replace(/\s+/g, " ").trim();
}
export function heard(t) {
  const w = String(t).toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (/castle?s? (long|queen)/.test(w)) return "O-O-O"; if (/castle?s?( short| king)?$/.test(w)) return "O-O";
  return w.replace(/\bking\b/g, "K").replace(/\bqueen\b/g, "Q").replace(/\brook\b/g, "R").replace(/\bbishop\b/g, "B").replace(/\b(knight|night)\b/g, "N")
    .replace(/\b(takes|captures|x)\b/g, "x").replace(/\bcheck\b|\bmate\b/g, "").replace(/\bpromotes? to\b\s*/g, "=").replace(/\s+/g, "").replace(/=([qrbn])/i, (_, p) => "=" + p.toUpperCase());
}
