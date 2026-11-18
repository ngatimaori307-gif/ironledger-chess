/* A finished game, move by move: ⏮ ◀ ▶ ⏭, a tap on any move jumps there, the board turned to his side; Copy PGN and Share. */
import { Chess } from "../../vendor/chess.js";
import { createBoard } from "../board.js";
import { games } from "../store.js";
import { esc } from "./ui.js";
import { sound } from "../sound.js";
import { record } from "../log.js";

export function render(v, arg) {
  const g = games().find((x) => String(x.at) === arg);
  if (!g) { v.innerHTML = `<section class="pg"><h1 class="ilc-title">Game not found</h1><p class="sub">It may be older than the games this phone keeps.</p><a class="ilc-btn" href="#profile">Back to your profile</a></section>`; return; }
  const full = new Chess();
  try { full.loadPgn(g.pgn); } catch (e) { record("replay", e.message); }
  const moves = full.history({ verbose: true }), sans = moves.map((x) => x.san);
  document.documentElement.setAttribute("data-board", "");
  v.innerHTML = `<section class="gm">
    <header class="gm-top"><a class="ilc-btn gm-back" href="#profile" aria-label="Back to your profile">‹</a>
      <div class="gm-who"><b>${esc(g.opp)}</b><span class="ilc-card__line">${{ win: "You won", loss: "You lost", draw: "A draw" }[g.mine] || ""} · ${esc(g.why || "")} · ${new Date(g.at).toLocaleDateString()}</span></div></header>
    <div id="gm-board"></div>
    <div class="gm-moves" id="gm-moves" aria-label="Moves"></div>
    <nav class="gm-bar">
      <button class="ilc-btn" data-go="start" aria-label="To the start">⏮</button><button class="ilc-btn" data-go="back" aria-label="Back one move">◀</button>
      <button class="ilc-btn" data-go="next" aria-label="Forward one move">▶</button><button class="ilc-btn" data-go="end" aria-label="To the end">⏭</button>
      <button class="ilc-btn" id="rp-flip" aria-label="Turn the board">⇅</button>
    </nav>
    <nav class="gm-bar"><button class="ilc-btn" id="rp-copy">Copy PGN</button>${navigator.share ? `<button class="ilc-btn" id="rp-share">Share</button>` : ""}</nav>
    <p class="sub rp-note" id="rp-note" role="status"></p></section>`;
  const board = createBoard(v.querySelector("#gm-board"), { canMove: () => false, onMove: () => {} });
  board.lock(true);
  let at = sans.length, flip = g.me === "b";
  function show(n, step) {
    at = Math.max(0, Math.min(sans.length, n));
    const c = new Chess(); moves.slice(0, at).forEach((x) => c.move(x.san));
    board.set(c, { lastMove: at ? moves[at - 1] : null, flip });
    if (step && at) { const x = moves[at - 1]; sound(x.captured ? "capture" : "move"); }
    const list = v.querySelector("#gm-moves");
    list.innerHTML = sans.map((s, i) => (i % 2 ? "" : `<span class="gm-no">${i / 2 + 1}.</span>`) + `<button type="button" class="gm-san${i === at - 1 ? " on" : ""}" data-ply="${i + 1}">${esc(s)}</button>`).join("");
    list.querySelector(".gm-san.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }
  v.querySelector("#gm-moves").onclick = (e) => { const b = e.target.closest("[data-ply]"); if (b) show(Number(b.dataset.ply)); };
  v.querySelectorAll("[data-go]").forEach((b) => { b.onclick = () => {
    const go = b.dataset.go; if (go === "next") show(at + 1, true); else if (go === "back") show(at - 1); else show(go === "start" ? 0 : sans.length);
  }; });
  v.querySelector("#rp-flip").onclick = () => { flip = !flip; show(at); };
  const note = (t) => { v.querySelector("#rp-note").textContent = t; };
  v.querySelector("#rp-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(g.pgn); note("Copied — paste it into Lichess, Chess.com or any chess app."); }
    catch { const t = document.createElement("textarea"); t.value = g.pgn; t.className = "rp-pgn"; t.readOnly = true; v.querySelector(".gm").append(t); t.select();
      note("This browser wouldn't copy by itself: the PGN is selected below — hold it and choose Copy."); }
  };
  v.querySelector("#rp-share")?.addEventListener("click", () => navigator.share({ title: `${g.opp} — ${g.result}`, text: g.pgn }).catch(() => {}));
  show(at);
}
