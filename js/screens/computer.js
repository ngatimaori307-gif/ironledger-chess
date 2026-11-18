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
  const row = (o) => `<label class="opp" data-kind="${kindOf(o)}"><input type="radio" name="opp" value="${o.id}"${o.id === chosen ? " checked" : ""}>
      <span class="opp-name">${esc(o.name)}</span><span class="opp-rating">${o.rating}</span></label>`;
  const group = kindOf(ALL_OPPONENTS.find((o) => o.id === chosen));
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Play the Computer</h1><p class="sub">Pick your opponent. The rating is roughly how strong it plays.</p>
    <div class="seg opp-tabs" role="radiogroup" aria-label="Kind of opponent">${KINDS.map(([k, l]) =>
      `<label class="seg-opt"><input type="radio" name="grp" value="${k}"${k === group ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
    <p class="sub opp-note"></p>
    <div class="opp-list" role="radiogroup" aria-label="Opponent" data-grp="${group}">${[...MAIA3_OPPONENTS, ...MAIA_OPPONENTS, ...OPPONENTS, ...STYLED_OPPONENTS].map(row).join("")}</div>
    <h2 class="overline">You play</h2>${colorPicker("col", settings.lastColor || "w")}
    <p><button class="ilc-btn ilc-btn--primary wide" id="start">Start the game</button></p></section>`;
  const list = v.querySelector(".opp-list"), note = v.querySelector(".opp-note");
  const show = (g) => {
    list.dataset.grp = g; note.textContent = KINDS.find(([k]) => k === g)[2]; note.hidden = !note.textContent;
    if (!list.querySelector(`.opp[data-kind="${g}"] input:checked`)) list.querySelector(`.opp[data-kind="${g}"] input`).checked = true;
  };
  show(group); v.querySelectorAll("input[name=grp]").forEach((r) => { r.onchange = () => show(r.value); });
  v.querySelector(".opp input:checked")?.closest(".opp").scrollIntoView({ block: "center" });
  v.querySelector("#start").onclick = () => {
    const oppId = v.querySelector("input[name=opp]:checked").value, col = v.querySelector("input[name=col]:checked").value;
    settings.lastOpp = oppId; settings.lastColor = col; saveSettings();
    setCurrent({ mode: "computer", me: pickColor(col), oppId, moves: [], startedAt: Date.now(), ladder: false });
    go("#game/resume");
  };
}
