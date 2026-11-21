/* The board screen, for any opponent: who you play, the board, the moves so far, and the buttons along the bottom.
   side = { name, onMine(move), resign(), offerDraw?(), status? } — the computer or a friend's phone. */
import { createBoard } from "../board.js";
import { play, finish, lastMove, myTurn, oppLabel } from "../match.js";
import { esc, colorPicker } from "./ui.js";
import { settings, saveSettings } from "../store.js";
import { sound, checkBeat, heartStop, warm } from "../sound.js";

export function mountGame(v, m, side) {
  document.documentElement.setAttribute("data-board", "");             // the board takes the screen; the bottom bar comes back on the next screen
  v.innerHTML = `<section class="gm">
    <header class="gm-top"><a class="ilc-btn gm-back" href="${side.back || "#play"}" aria-label="Leave the game">‹</a>
      <div class="gm-who"><b>${esc(oppLabel(m))}</b><span id="gm-state" class="ilc-card__line"></span></div></header>
    <div id="gm-board"></div>
    <div class="gm-moves" id="gm-moves" aria-label="Moves"></div>
    <div class="gm-end" id="gm-end" hidden></div>
    <nav class="gm-bar">
      <button class="ilc-btn" id="gm-flip" aria-label="Turn the board">⇅</button>
      ${side.offerDraw ? `<button class="ilc-btn" id="gm-draw">Offer a draw</button>` : ""}
      <button class="ilc-btn" id="gm-resign">Resign</button>
    </nav>
    <nav class="gm-tools" aria-label="Board tools">${toolsHtml()}</nav></section>`;
  let flip = m.me === "b";
  const board = createBoard(v.querySelector("#gm-board"), {
    canMove: () => myTurn(m) && !side.paused?.(),
    onMove: (mv) => { const done = play(m, mv); if (done) side.onMine(done); else redraw(); },
  });
  wireTools(v, board);
  function redraw() {
    const lm = lastMove(m); board.set(m.chess, { lastMove: lm, flip }); board.lock(!myTurn(m));
    const sans = m.chess.history();
    v.querySelector("#gm-moves").innerHTML = sans.map((s, i) => (i % 2 ? "" : `<span class="gm-no">${i / 2 + 1}.</span>`) + `<span class="gm-san${i === sans.length - 1 ? " on" : ""}">${esc(s)}</span>`).join("");
    v.querySelector("#gm-moves").scrollLeft = 1e6;
    const st = v.querySelector("#gm-state");
    st.textContent = m.result ? "Game over" : side.status?.() || (myTurn(m) ? (m.chess.inCheck() ? "Your move — you're in check" : "Your move") : `${side.name} is thinking…`);
    if (m.result) showEnd();
  }
  function showEnd() {
    const el = v.querySelector("#gm-end"); el.hidden = false;
    const word = { win: "You won", loss: "You lost", draw: "A draw" }[m.mine];
    el.innerHTML = `<div class="ilc-plate"><div><div class="ilc-plate__over">${esc(m.why || "")}</div><div class="ilc-plate__rank">${word}</div></div>
      <div class="gm-again">${side.again && side.againPick ? `<div class="gm-again-pick"><span class="ilc-card__line">Rematch, you play</span>${colorPicker("ag", side.againPick(), side.againExtra || [])}</div>` : ""}${side.again ? `<button class="ilc-btn ilc-btn--primary" id="gm-again">${side.againPick ? "Rematch" : "Play again"}</button>` : ""}<a class="ilc-btn" href="${side.back || "#play"}">Done</a></div></div>`;
    v.querySelector("#gm-again")?.addEventListener("click", () => side.again(v.querySelector("input[name=ag]:checked")?.value));   // the colour he asks for (Play a Friend)
    v.querySelector("#gm-resign").hidden = true; const d = v.querySelector("#gm-draw"); if (d) d.hidden = true;
  }
  warm();                                                            // the pieces' recording, before the first move
  v.querySelector("#gm-flip").onclick = () => { flip = !flip; redraw(); };
  v.querySelector("#gm-resign").onclick = (e) => {
    const b = e.currentTarget; if (b.dataset.sure) { side.resign(); finish(m, m.me === "w" ? "0-1" : "1-0", "you resigned"); return; }
    b.dataset.sure = "1"; b.textContent = "Tap again to resign"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Resign"; }, 3000);
  };
  v.querySelector("#gm-draw")?.addEventListener("click", () => side.offerDraw());
  m.listeners.push((kind, info) => {
    if (kind === "move") {                                         // v1.8: each piece its own voice; a heartbeat while in check (js/sound.js)
      sound(info.captured ? "capture" : "move", info); if (m.chess.inCheck()) sound("check");
      checkBeat(m.chess.fen(), m.chess.inCheck() && !m.result, () => v.querySelector("#gm-board")?.isConnected);
    }
    if (kind === "end") { heartStop(); sound(info.mine === "win" ? "win" : info.mine === "loss" ? "loss" : "end"); }
    redraw();
  });
  redraw();
  return { redraw, board };
}

/* 1.10.0 — Iron Ledger's board tools (v8.12 ✎ Draw with four inks, v8.11 ◫ layers): ✎ turns drawing on (a drag draws an arrow, a
   tap circles a square; the same again removes it); the dot picks the ink (orange, green, blue, red — an ink with two or more arrows
   is a path, numbered in the order drawn); ⌫ clears this position's drawings; ◫ Tension shows who attacks what. Drawings and
   layers are your own marks and counts, never the engine's, so they work in every game, a friend's too. */
export const INK_NAMES = ["orange", "green", "blue", "red"];
export function toolsHtml() {
  return `<button class="ilc-btn gm-tool" id="gm-pen" aria-pressed="false" aria-label="Draw arrows and circles">✎ Draw</button>
    <button class="ilc-btn gm-tool gm-ink" id="gm-ink" data-ink="0" aria-label="Ink: orange" hidden><span></span></button>
    <button class="ilc-btn gm-tool" id="gm-wipe" aria-label="Clear the drawings here" hidden>⌫</button>
    <button class="ilc-btn gm-tool" id="gm-tension" aria-pressed="${!!settings.layerTension}" aria-label="Tension: who attacks what">◫ Tension</button>`;
}
export function wireTools(v, board) {
  const pen = v.querySelector("#gm-pen"), inkB = v.querySelector("#gm-ink"), wipe = v.querySelector("#gm-wipe"), ten = v.querySelector("#gm-tension");
  if (!pen) return;
  pen.onclick = () => { const on = board.draw(pen.getAttribute("aria-pressed") !== "true"); pen.setAttribute("aria-pressed", on); inkB.hidden = wipe.hidden = !on; };
  inkB.onclick = () => { const k = board.ink(board.ink() + 1); inkB.dataset.ink = k; inkB.setAttribute("aria-label", "Ink: " + INK_NAMES[k]); };
  wipe.onclick = () => board.clearMarks();
  ten.onclick = () => { settings.layerTension = !settings.layerTension; saveSettings(); ten.setAttribute("aria-pressed", settings.layerTension); board.layers(); };
}
