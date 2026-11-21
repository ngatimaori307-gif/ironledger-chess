/* 1.13.0: js/fsrs.js gives the same cards as Iron Ledger's fsrs.py on the same review sequences. Run: node tools/fsrs_check.mjs */
import { readFileSync } from "node:fs";
import { review } from "../js/fsrs.js";
const ref = JSON.parse(readFileSync(new URL("./reference/fsrs.json", import.meta.url)));
let n = 0, bad = 0;
for (const trail of ref) { let card = null;
  for (const [g, now, want] of trail) { card = review(card, g, now); n++;
    if (JSON.stringify(card) !== JSON.stringify({ s: want.s, d: want.d, last: want.last, due: want.due, reps: want.reps, lapses: want.lapses })) { bad++; console.log("DIFFERENT", g, JSON.stringify(card), JSON.stringify(want)); } } }
console.log(`fsrs: ${n - bad} of ${n} reviews as Iron Ledger's fsrs.py`); process.exit(bad ? 1 : 0);
