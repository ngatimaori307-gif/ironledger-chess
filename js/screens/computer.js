/* Play the Computer: pick an opponent by name and rating, pick a colour, start. */
import { OPPONENTS, MAIA_OPPONENTS, ALL_OPPONENTS } from "../config.js";
import { settings, saveSettings, setCurrent } from "../store.js";
import { colorPicker, pickColor, esc } from "./ui.js";
import { go } from "../app.js";

export function render(v) {
  const chosen = settings.lastOpp && ALL_OPPONENTS.some((o) => o.id === settings.lastOpp) ? settings.lastOpp : OPPONENTS[2].id;
  const row = (o) => `<label class="opp${o.maia ? " opp--maia" : ""}"><input type="radio" name="opp" value="${o.id}"${o.id === chosen ? " checked" : ""}>
      <span class="opp-name">${esc(o.name)}</span><span class="opp-rating">${o.rating}</span></label>`;
  const group = chosen.startsWith("maia-") ? "maia" : "sf";
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Play the Computer</h1><p class="sub">Pick your opponent. The rating is roughly how strong it plays.</p>
    <div class="seg opp-tabs" role="radiogroup" aria-label="Kind of opponent">${[["maia", "Like people"], ["sf", "Stockfish"]].map(([k, l]) =>
      `<label class="seg-opt"><input type="radio" name="grp" value="${k}"${k === group ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
    <p class="sub opp-note" data-for="maia">Maia plays the moves people at that rating play, mistakes and all.</p>
    <div class="opp-list" role="radiogroup" aria-label="Opponent" data-grp="${group}">${MAIA_OPPONENTS.map(row).join("")}${OPPONENTS.map(row).join("")}</div>
    <h2 class="overline">You play</h2>${colorPicker("col", settings.lastColor || "w")}
    <p><button class="ilc-btn ilc-btn--primary wide" id="start">Start the game</button></p></section>`;
  const list = v.querySelector(".opp-list"), note = v.querySelector(".opp-note");
  const show = (g) => { list.dataset.grp = g; note.hidden = g !== "maia";
    if (!list.querySelector(`.opp${g === "maia" ? ".opp--maia" : ":not(.opp--maia)"} input:checked`)) list.querySelector(`.opp${g === "maia" ? ".opp--maia" : ":not(.opp--maia)"} input`).checked = true; };
  show(group); v.querySelectorAll("input[name=grp]").forEach((r) => { r.onchange = () => show(r.value); });
  v.querySelector(".opp input:checked")?.closest(".opp").scrollIntoView({ block: "center" });
  v.querySelector("#start").onclick = () => {
    const oppId = v.querySelector("input[name=opp]:checked").value, col = v.querySelector("input[name=col]:checked").value;
    settings.lastOpp = oppId; settings.lastColor = col; saveSettings();
    setCurrent({ mode: "computer", me: pickColor(col), oppId, moves: [], startedAt: Date.now(), ladder: false });
    go("#game/resume");
  };
}
