/* Play the Computer: pick an opponent by name and rating, pick a colour, start. */
import { OPPONENTS } from "../config.js";
import { settings, saveSettings, setCurrent } from "../store.js";
import { colorPicker, pickColor, esc } from "./ui.js";
import { go } from "../app.js";

export function render(v) {
  const chosen = settings.lastOpp && OPPONENTS.some((o) => o.id === settings.lastOpp) ? settings.lastOpp : OPPONENTS[2].id;
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Play the Computer</h1><p class="sub">Pick your opponent. The rating is roughly how strong it plays.</p>
    <div class="opp-list" role="radiogroup" aria-label="Opponent">${OPPONENTS.map((o) => `<label class="opp"><input type="radio" name="opp" value="${o.id}"${o.id === chosen ? " checked" : ""}>
      <span class="opp-name">${esc(o.name)}</span><span class="opp-rating">${o.rating}</span></label>`).join("")}</div>
    <h2 class="overline">You play</h2>${colorPicker("col", settings.lastColor || "w")}
    <p><button class="ilc-btn ilc-btn--primary wide" id="start">Start the game</button></p></section>`;
  v.querySelector(".opp input:checked")?.closest(".opp").scrollIntoView({ block: "center" });
  v.querySelector("#start").onclick = () => {
    const oppId = v.querySelector("input[name=opp]:checked").value, col = v.querySelector("input[name=col]:checked").value;
    settings.lastOpp = oppId; settings.lastColor = col; saveSettings();
    setCurrent({ mode: "computer", me: pickColor(col), oppId, moves: [], startedAt: Date.now(), ladder: false });
    go("#game/resume");
  };
}
