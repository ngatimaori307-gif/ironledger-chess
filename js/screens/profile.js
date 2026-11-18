/* His Profile: his name, his rating against the computer (Glicko-2 as Iron Ledger reckons it, with its range and the games it
   rests on), how his latest games went, his record by kind of opponent, and every game kept, to replay or copy as PGN. */
import { GAMES_KEPT } from "../config.js";
import { settings, saveSettings, games } from "../store.js";
import { profile } from "../rating.js";
import { esc } from "./ui.js";

const ORDER = ["m3", "guard", "maia", "styled", "sf", "weak", "friend", "other"];
export function render(v) {
  const all = games(), p = profile(all);
  const rating = p.rating == null ? `<div class="ilc-plate__rank">No rating yet</div><div class="ilc-card__line">Play the computer: every game against it counts.</div>`
    : `<div class="ilc-plate__fig">${p.rating}</div><div class="ilc-card__line">${p.low}–${p.high} (95 %) · from ${p.n} game${p.n === 1 ? "" : "s"}${p.provisional ? " · provisional: a few more games settle it" : ""}</div>`;
  const kinds = ORDER.filter((k) => p.record[k]).map((k) => { const c = p.record[k];
    return `<li><span class="g-opp">${esc(c.label)}</span><span class="pf-wdl">${c.win} won · ${c.draw} drawn · ${c.loss} lost</span><span class="pf-score">${c.score ?? "–"} %</span></li>`; }).join("");
  const row = (g) => `<li><a class="pf-game" href="#replay/${g.at}"><span class="res res--${g.mine}">${{ win: "✓ Won", loss: "✗ Lost", draw: "½ Draw" }[g.mine]}</span>
      <span class="g-opp">${esc(g.opp)}</span><span class="ilc-card__line">${esc(g.why)} · ${Math.ceil(g.moves / 2)} move${Math.ceil(g.moves / 2) === 1 ? "" : "s"} · ${new Date(g.at).toLocaleDateString()}</span></a></li>`;
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Profile</h1>
    <div class="field"><label for="pf-name">Your name</label><input id="pf-name" maxlength="24" value="${esc(settings.name)}" placeholder="e.g. Dad"></div>
    <div class="ilc-plate"><div><div class="ilc-plate__over">Your rating against the computer</div>${rating}</div></div>
    ${p.perf != null ? `<p class="sub">Your last ${p.perfN} game${p.perfN === 1 ? "" : "s"} against the computer: played like ${p.perf}.</p>` : ""}
    <p class="sub">Worked out the way Iron Ledger works out ratings (Glicko-2): each result moves it by how strong the opponent is, and the range narrows as games come in. Games with friends have no rating to measure against, so they count in your record only.</p>
    <h2 class="overline">Your record</h2>
    ${kinds ? `<ul class="games pf-kinds">${kinds}</ul>` : `<p class="sub">No finished games yet.</p>`}
    <h2 class="overline">Your games</h2>
    ${all.length ? `<p class="sub">Tap a game to replay it or copy it as PGN. This phone keeps your last ${GAMES_KEPT}.</p><ul class="games">${all.map(row).join("")}</ul>` : ""}
  </section>`;
  const nm = v.querySelector("#pf-name");
  nm.onchange = () => { settings.name = nm.value.trim(); saveSettings(); };
}
