/* 1.14.0: js/style.js counts the board traits (checks, captures, flank pawns, early queen, castling move, a queenless game, an
   endgame reached, the moves) exactly as Iron Ledger's style.board_traits, on 40 games. Run: node tools/style_check.mjs */
import { readFileSync } from "node:fs";
import { boardTraits } from "../js/style.js";
const ref = JSON.parse(readFileSync(new URL("./reference/style_board.json", import.meta.url)));
let bad = 0;
for (const [pgn, want, wantGame] of ref) {
  const got = boardTraits(pgn), g = { queenless: got.game.queenless, endgame: got.game.endgame, moves: got.game.moves };
  if (JSON.stringify(got.t) !== JSON.stringify(want) || JSON.stringify(g) !== JSON.stringify(wantGame)) { bad++; console.log("DIFFERENT", pgn.slice(0, 60), JSON.stringify(got.t), JSON.stringify(want), JSON.stringify(g), JSON.stringify(wantGame)); }
}
console.log(`style: ${ref.length - bad} of ${ref.length} games' board traits as Iron Ledger's style.py`); process.exit(bad ? 1 : 0);
