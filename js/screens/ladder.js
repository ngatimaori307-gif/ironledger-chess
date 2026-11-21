/* The Ladder: every opponent in order; beat a rung to open the next. */
import { OPPONENTS, LADDER } from "../config.js";
import { ladder, setCurrent, settings, saveSettings } from "../store.js";
import { esc, colorPicker, pickColor, IN_TURN } from "./ui.js";
import { go } from "../app.js";

export function render(v) {
  const beaten = new Set(ladder().beaten), nextIdx = OPPONENTS.findIndex((o) => !beaten.has(o.id));
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">The Ladder</h1><p class="sub">Win ${LADDER.winsToClimb === 1 ? "a game" : LADDER.winsToClimb + " games"} against a rung to climb to the next. </p>
    <ol class="rungs">${OPPONENTS.map((o, i) => {
      const state = beaten.has(o.id) ? "done" : i === nextIdx ? "next" : i < nextIdx ? "done" : "locked";
      return `<li class="rung rung--${state}"><span class="rung-mark" aria-hidden="true">${state === "done" ? "✓" : state === "next" ? "▶" : "·"}</span>
        <span class="rung-name">${esc(o.name)}</span><span class="rung-rating">${o.rating}</span>
        ${state !== "locked" ? `<button class="ilc-btn${state === "next" ? " ilc-btn--primary" : ""}" data-id="${o.id}">${state === "done" ? "Again" : "Play"}</button>` : `<span class="rung-lock">locked</span>`}</li>`;
    }).reverse().join("")}</ol>
    <div class="ilc-plate col"><h2 class="overline">You play</h2>${colorPicker("col", settings.ladderColor || IN_TURN[0], [IN_TURN])}</div></section>`;
  v.querySelector(".rung--next")?.scrollIntoView({ block: "center" });
  v.onclick = (e) => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    const games = ladder().beaten.length, col = v.querySelector("input[name=col]:checked")?.value || IN_TURN[0];   // 1.9.0: his colour, or in turn as before
    settings.ladderColor = col; saveSettings();
    setCurrent({ mode: "computer", me: col === IN_TURN[0] ? (games % 2 ? "b" : "w") : pickColor(col), oppId: b.dataset.id, moves: [], startedAt: Date.now(), ladder: true });
    go("#game/resume");
  };
}
