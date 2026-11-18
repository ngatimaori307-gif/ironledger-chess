/* Home: the game in progress first, then the three ways to play, then the last result. */
import { current, games, ladder } from "../store.js";
import { OPPONENTS, ALL_OPPONENTS } from "../config.js";
import { card, esc } from "./ui.js";

export function render(v) {
  const cur = current(), last = games()[0], beaten = ladder().beaten, next = OPPONENTS.find((o) => !beaten.includes(o.id));
  const resume = cur ? card("#game/resume", "▶", "Carry On", `Your game against ${ALL_OPPONENTS.find((o) => o.id === cur.oppId)?.name || "the computer"}, move ${Math.ceil(cur.moves.length / 2) || 1}`) : "";
  v.innerHTML = `<section class="pg">
    <header class="home-head"><img src="img/icon-192.png" alt="" class="home-logo"><div><h1 class="ilc-title title-xl">Iron Ledger Chess</h1>
      <p class="ilc-card__line">Carved in pounamu, bone, tōtara and stone</p></div></header>
    <nav class="cards">${resume}
      ${card("#computer", "⚔", "Play the Computer", "A full game at the level you choose")}
      ${card("#ladder", "♜", "The Ladder", next ? `Next rung: ${next.name} · ${next.rating}` : "Every rung beaten")}
      ${card("#friend", "♞", "Play a Friend", "Send a link, play on two phones")}
    </nav>
    ${last ? `<h2 class="overline">Last game</h2><div class="ilc-plate"><div><div class="ilc-plate__over">${last.mode === "friend" ? "Against a friend" : "Against the computer"}</div>
      <div class="ilc-plate__rank">${esc(last.opp)}</div></div><div><div class="ilc-plate__fig ${last.mine === "win" ? "ilc-up" : last.mine === "loss" ? "ilc-down" : ""}">${{ win: "Won", loss: "Lost", draw: "Draw" }[last.mine]}</div>
      <div class="ilc-plate__delta">${esc(last.why || "")}</div></div></div>` : ""}
  </section>`;
}
