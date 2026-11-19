/* Engine Duel, as Iron Ledger's (match.py, app/screens/match.js): Stockfish against itself, each side a personality — a style and
   a strength — from the start or from a position of one of his games. One move at a time: play through, pause, step. */
import { Chess } from "../../vendor/chess.js";
import { PERSONALITY, DUEL } from "../config.js";
import { settings, saveSettings } from "../store.js";
import { createBoard } from "../board.js";
import { STYLE_NAMES } from "../personality.js";
import * as engine from "../engine.js";
import { esc } from "./ui.js";
import { sound } from "../sound.js";
import { onLeave } from "../app.js";

export const START_KEY = "ilc-duel-start";            // a position handed over from a replay (sessionStorage)
function over(c, plies) {
  if (c.isCheckmate()) return { result: c.turn() === "w" ? "0-1" : "1-0", why: "checkmate" };
  if (c.isStalemate()) return { result: "1/2-1/2", why: "stalemate" };
  if (c.isInsufficientMaterial()) return { result: "1/2-1/2", why: "insufficient material" };
  if (c.isThreefoldRepetition()) return { result: "1/2-1/2", why: "repetition" };
  if (c.isDraw()) return { result: "1/2-1/2", why: "50-move rule" };
  if (plies >= DUEL.maxPlies) return { result: "1/2-1/2", why: `${DUEL.maxPlies} half-moves played` };
  return null;
}
export function render(v) {
  let start = null; try { start = sessionStorage.getItem(START_KEY); } catch {}
  const elos = []; for (let r = PERSONALITY.eloMin; r <= PERSONALITY.eloMax; r += PERSONALITY.eloStep) elos.push(r);
  const pick = (k, label, d) => { const c = { ...d, ...(settings[k] || {}) };
    return `<div class="field duel-side"><label for="${k}s">${label}</label><select id="${k}s">${Object.entries(STYLE_NAMES).map(([id, n]) => `<option value="${id}"${c.style === id ? " selected" : ""}>${n}</option>`).join("")}</select>
      <select id="${k}e" aria-label="${label} strength">${elos.map((r) => `<option${c.elo === r ? " selected" : ""}>${r}</option>`).join("")}</select></div>`; };
  v.innerHTML = `<section class="pg duel"><h1 class="ilc-title">Engine Duel</h1>
    <p class="sub">Stockfish against itself, each side with a style and a strength, ${start ? "from the position you chose" : "from the start"}.</p>
    <div class="duel-row">${pick("duelWhite", "White", { style: "aggressive", elo: 2000 })}${pick("duelBlack", "Black", { style: "defensive", elo: 2000 })}</div>
    <div id="du-board"></div><div class="gm-moves" id="du-moves" aria-label="Moves"></div>
    <p class="ilc-card__line" id="du-msg" role="status">Ready.</p>
    <nav class="gm-bar"><button class="ilc-btn ilc-btn--primary" id="du-go">▶ Play</button><button class="ilc-btn" id="du-step">Step</button>
      <button class="ilc-btn" id="du-new">Start again</button>${start ? `<button class="ilc-btn" id="du-fromstart">From the start</button>` : ""}</nav></section>`;
  const c = new Chess(start || undefined), board = createBoard(v.querySelector("#du-board"), { canMove: () => false, onMove: () => {} });
  board.lock(true); board.set(c, { flip: false });
  let running = false, done = null, plies = 0, gone = false;
  const cfg = (k) => ({ style: v.querySelector(`#${k}s`).value, elo: Number(v.querySelector(`#${k}e`).value) });
  v.querySelector(".duel-row").onchange = () => { settings.duelWhite = cfg("duelWhite"); settings.duelBlack = cfg("duelBlack"); saveSettings(); };
  const msg = (h) => { v.querySelector("#du-msg").innerHTML = h; };
  async function step() {
    if (done) return false;
    const end = over(c, plies); if (end) { finish(end); return false; }
    const who = c.turn() === "w" ? "White" : "Black", side = cfg(who === "White" ? "duelWhite" : "duelBlack"), fen = c.fen();
    let r; try { r = await engine.styledMove(fen, side.style, side.elo); } catch (e) { msg(esc(e.message)); return false; }
    if (gone || c.fen() !== fen) return false;
    const mv = c.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] }); plies++;
    board.set(c, { lastMove: mv }); sound(mv.captured ? "capture" : "move", mv);
    const sans = c.history(), list = v.querySelector("#du-moves");
    list.innerHTML = sans.map((s, i) => (i % 2 ? "" : `<span class="gm-no">${i / 2 + 1}.</span>`) + `<span class="gm-san${i === sans.length - 1 ? " on" : ""}">${esc(s)}</span>`).join(""); list.scrollLeft = 1e6;
    msg(`${who} (${esc(STYLE_NAMES[side.style])} ${side.elo}): <b>${esc(mv.san)}</b> — ${esc(r.why)} · Stockfish ${r.cp >= 0 ? "+" : ""}${(Math.max(-9999, Math.min(9999, r.cp)) / 100).toFixed(2)} for ${who}`);
    const e2 = over(c, plies); if (e2) { finish(e2); return false; }
    return true;
  }
  function finish(e) { done = e; running = false; v.querySelector("#du-go").textContent = "▶ Play"; sound("end");
    v.querySelector("#du-msg").innerHTML += `<br><b>${e.result}</b> — ${esc(e.why)} after ${plies} half-moves.`; }
  async function run() { while (running && !gone && (await step())) await new Promise((res) => setTimeout(res, DUEL.pauseMs)); }
  v.querySelector("#du-go").onclick = (e) => { if (done) return; running = !running; e.currentTarget.textContent = running ? "⏸ Pause" : "▶ Play"; if (running) run(); };
  v.querySelector("#du-step").onclick = () => { running = false; v.querySelector("#du-go").textContent = "▶ Play"; step(); };
  v.querySelector("#du-new").onclick = () => { running = false; gone = true; render(v); };
  v.querySelector("#du-fromstart")?.addEventListener("click", () => { running = false; gone = true; try { sessionStorage.removeItem(START_KEY); } catch {} render(v); });
  onLeave(() => { gone = true; running = false; });   // another screen: the duel stops, a move in flight is dropped
}
