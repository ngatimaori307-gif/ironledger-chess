/* 1.10.0: js/tension.js gives the same tension pairs (attacker, target, what the target's owner loses) as Iron Ledger's own count
   (fastcore.py_tension_pairs / exchange.py) on its self-test positions and three more. Run: node tools/tension_check.mjs */
import { readFileSync } from "node:fs";
import { Chess } from "../vendor/chess.js";
import { pairs } from "../js/tension.js";
const ref = JSON.parse(readFileSync(new URL("./reference/tension_pairs.json", import.meta.url)));
let bad = 0;
const key = (l) => l.map((x) => x.join(" ")).sort().join("|");
for (const [fen, want] of ref) {
  const got = pairs(new Chess(fen));
  if (key(got) !== key(want)) { bad++; console.log("DIFFERENT", fen, "\n  Iron Ledger:", key(want), "\n  here:       ", key(got)); }
}
console.log(`tension: ${ref.length - bad} of ${ref.length} positions as Iron Ledger's count`);
process.exit(bad ? 1 : 0);
