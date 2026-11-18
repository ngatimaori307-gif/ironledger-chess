/* The Hardcore ladders, as Iron Ledger's: Human (Maia-3), Engine (Stockfish), Human + Guard (Maia-3 checked by Stockfish). Every
   rung open; a rung is beaten at half the points or more from at least two games; his record on each rung from his own games. */
import { HARDCORE, HARDCORE_LADDERS, MAIA3_OPPONENTS, OPPONENTS, GUARD_OPPONENTS } from "../config.js";
import { games, settings, saveSettings, setCurrent } from "../store.js";
import { colorPicker, pickColor, esc } from "./ui.js";
import { go } from "../app.js";
import { reviews } from "../review.js";

const RUNGS = { human: MAIA3_OPPONENTS, engine: OPPONENTS, guard: GUARD_OPPONENTS };
const ABOUT = {
  human: "Maia-3: the moves real players of that rating make, mistakes included.",
  engine: "Stockfish: weakened below 1320, then its own strength limit up to its full strength.",
  guard: "Maia-3 picks a human move; Stockfish checks it, and a move that would be a mistake is swapped for Maia-3's next likeliest one that isn't. Human style, no hanging pieces.",
};
export function rungs(ladder, all = games()) {
  return RUNGS[ladder].map((o) => {
    const mine = all.filter((g) => g.hc === ladder && g.oppId === o.id && g.mine);
    const pts = mine.reduce((a, g) => a + ({ win: 1, draw: 0.5, loss: 0 })[g.mine], 0);
    return { ...o, played: mine.length, won: mine.filter((g) => g.mine === "win").length, drawn: mine.filter((g) => g.mine === "draw").length,
      lost: mine.filter((g) => g.mine === "loss").length, beaten: mine.length >= HARDCORE.beatenGames && pts >= HARDCORE.beatenScore * mine.length };
  });
}
export function render(v, arg) {
  const which = HARDCORE_LADDERS.some(([k]) => k === arg) ? arg : settings.lastHardcore || "human";
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Hardcore ladders</h1>
    <p class="sub">No help, no take-backs. Every rung is open; a rung is beaten at ${Math.round(100 * HARDCORE.beatenScore)} % or more from at least ${HARDCORE.beatenGames} games.</p>
    <div class="seg" role="radiogroup" aria-label="Ladder">${HARDCORE_LADDERS.map(([k, l]) =>
      `<label class="seg-opt"><input type="radio" name="hl" value="${k}"${k === which ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
    <p class="sub" id="hc-about"></p><p class="sub" id="hc-todo"></p>
    <h2 class="overline">You play</h2>${colorPicker("col", settings.lastColor || "w")}
    <ol class="rungs" id="hc-rungs"></ol></section>`;
  const show = (k) => {
    settings.lastHardcore = k; saveSettings(); history.replaceState(null, "", `#hardcore/${k}`);
    v.querySelector("#hc-about").textContent = ABOUT[k];
    const done = reviews(), todo = games().filter((g) => g.hc === k && g.mine && !done[g.at]?.reviewed);   // as Iron Ledger: finished, not reviewed
    v.querySelector("#hc-todo").innerHTML = todo.length ? `<a href="#replay/${todo[0].at}">${todo.length} game${todo.length === 1 ? "" : "s"} to review between rungs ›</a>` : "";
    const rs = rungs(k), you = rs.find((r) => !r.beaten);
    v.querySelector("#hc-rungs").innerHTML = rs.map((r) => {
      const state = r.beaten ? "done" : r === you ? "next" : "open";
      return `<li class="rung rung--${state}"><span class="rung-mark" aria-hidden="true">${r.beaten ? "✓" : r === you ? "▶" : "·"}</span>
        <span class="rung-name">${esc(r.name)}<small class="hc-rec">${r.played ? `${r.won} won · ${r.drawn} drawn · ${r.lost} lost` : "not played yet"}</small></span>
        <span class="rung-rating">${r.rating}</span><button class="ilc-btn${state === "next" ? " ilc-btn--primary" : ""}" data-id="${r.id}">Play</button></li>`;
    }).reverse().join("");
    v.querySelector(".rung--next")?.scrollIntoView({ block: "center" });
  };
  show(which);
  v.querySelectorAll("input[name=hl]").forEach((r) => { r.onchange = () => show(r.value); });
  v.querySelector("#hc-rungs").onclick = (e) => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    const col = v.querySelector("input[name=col]:checked").value; settings.lastColor = col; saveSettings();
    setCurrent({ mode: "computer", me: pickColor(col), oppId: b.dataset.id, moves: [], startedAt: Date.now(), ladder: false, hc: settings.lastHardcore });
    go("#game/resume");
  };
}
