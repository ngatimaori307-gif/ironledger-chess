/* Play: the ways to play, each a card. */
import { card } from "./ui.js";
export function render(v) {
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Play</h1><p class="sub">Choose who you play against</p>
    <nav class="cards">
      ${card("#computer", "⚔", "Play the Computer", "A full game at the level you choose")}
      ${card("#ladder", "♜", "The Ladder", "Win a game, climb a rung")}
      ${card("#hardcore", "🛡", "Hardcore ladders", "Human, Engine, Human + Guard — every rung open")}
      ${card("#friend", "♞", "Play a Friend", "Send a link, play on two phones")}
    </nav></section>`;
}
