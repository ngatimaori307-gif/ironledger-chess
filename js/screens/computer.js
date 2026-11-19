/* Play the Computer: pick an opponent by name and rating, pick a colour, start. Four kinds, one list at a time: Maia-3 and Maia
   (they play like people at their rating), Stockfish, and Stockfish with a style (js/personality.js). */
import { OPPONENTS, MAIA_OPPONENTS, MAIA3_OPPONENTS, STYLED_OPPONENTS, ALL_OPPONENTS } from "../config.js";
import { settings, saveSettings, setCurrent } from "../store.js";
import { colorPicker, pickColor, esc } from "./ui.js";
import { go } from "../app.js";

const KINDS = [
  ["m3", "Maia-3", "Maia-3 plays the moves people at that rating play, mistakes and all — one network for every rating, the newest. The first game downloads it (10 MB), once."],
  ["maia", "Maia", "The first Maia: a network for each rating, small and quick."],
  ["sf", "Stockfish", ""],
  ["ps", "Styled", "Stockfish with a style: among its best moves it picks the one that suits it — checks and sacrifices, the centre and sound pawns, or a safe king. The rating is approximate."],
];
const kindOf = (o) => (o.style ? "ps" : o.m3 ? "m3" : o.maia ? "maia" : "sf");

export function render(v) {
  const chosen = settings.lastOpp && ALL_OPPONENTS.some((o) => o.id === settings.lastOpp) ? settings.lastOpp : MAIA3_OPPONENTS[0].id;
  /* v1.6.1: each opponent has its own Play button (as The Ladder's rungs). v1.6.0 only selected the row on a tap; its one Start
     button sat below the list and the bottom bar, and the list scrolled inside the page, so on an iPhone a tap seemed to do nothing. */
  const row = (o) => `<div class="opp${o.id === chosen ? " opp--last" : ""}" data-kind="${kindOf(o)}">
      <span class="opp-name">${esc(o.name)}</span><span class="opp-rating">${o.rating}</span>
      <button class="ilc-btn ilc-btn--primary opp-play" data-id="${o.id}" aria-label="Play ${esc(o.name)}">Play</button></div>`;
  const group = kindOf(ALL_OPPONENTS.find((o) => o.id === chosen));
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Play the Computer</h1><p class="sub">Pick your colour, then tap Play beside an opponent. The rating is roughly how strong it plays.</p>
    <h2 class="overline">You play</h2>${colorPicker("col", settings.lastColor || "w")}
    <div class="seg opp-tabs" role="radiogroup" aria-label="Kind of opponent">${KINDS.map(([k, l]) =>
      `<label class="seg-opt"><input type="radio" name="grp" value="${k}"${k === group ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
    <p class="sub opp-note"></p>
    <div class="opp-list" aria-label="Opponents" data-grp="${group}">${[...MAIA3_OPPONENTS, ...MAIA_OPPONENTS, ...OPPONENTS, ...STYLED_OPPONENTS].map(row).join("")}</div></section>`;
  const list = v.querySelector(".opp-list"), note = v.querySelector(".opp-note");
  const show = (g) => { list.dataset.grp = g; note.textContent = KINDS.find(([k]) => k === g)[2]; note.hidden = !note.textContent; };
  show(group); v.querySelectorAll("input[name=grp]").forEach((r) => { r.onchange = () => show(r.value); });
  const start = (oppId) => {
    const col = v.querySelector("input[name=col]:checked").value;
    settings.lastOpp = oppId; settings.lastColor = col; saveSettings();
    setCurrent({ mode: "computer", me: pickColor(col), oppId, moves: [], startedAt: Date.now(), ladder: false });
    go("#game/resume");
  };
  list.onclick = (e) => { const b = e.target.closest("[data-id]") || e.target.closest(".opp")?.querySelector("[data-id]"); if (b) start(b.dataset.id); };
}
