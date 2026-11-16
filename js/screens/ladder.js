/* The Ladder: every opponent in order; beat a rung to open the next. */
import { OPPONENTS, LADDER } from "../config.js";
import { ladder, setCurrent } from "../store.js";
import { esc } from "./ui.js";
import { go } from "../app.js";

export function render(v) {
  const beaten = new Set(ladder().beaten), nextIdx = OPPONENTS.findIndex((o) => !beaten.has(o.id));
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">The Ladder</h1><p class="sub">Win ${LADDER.winsToClimb === 1 ? "a game" : LADDER.winsToClimb + " games"} against a rung to climb to the next. You play White and Black in turn.</p>
    <ol class="rungs">${OPPONENTS.map((o, i) => {
      const state = beaten.has(o.id) ? "done" : i === nextIdx ? "next" : i < nextIdx ? "done" : "locked";
      return `<li class="rung rung--${state}"><span class="rung-mark" aria-hidden="true">${state === "done" ? "✓" : state === "next" ? "▶" : "·"}</span>
        <span class="rung-name">${esc(o.name)}</span><span class="rung-rating">${o.rating}</span>
        ${state !== "locked" ? `<button class="ilc-btn${state === "next" ? " ilc-btn--primary" : ""}" data-id="${o.id}">${state === "done" ? "Again" : "Play"}</button>` : `<span class="rung-lock">locked</span>`}</li>`;
    }).reverse().join("")}</ol></section>`;
  v.querySelector(".rung--next")?.scrollIntoView({ block: "center" });
  v.onclick = (e) => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    const games = ladder().beaten.length;
    setCurrent({ mode: "computer", me: games % 2 ? "b" : "w", oppId: b.dataset.id, moves: [], startedAt: Date.now(), ladder: true });
    go("#game/resume");
  };
}
