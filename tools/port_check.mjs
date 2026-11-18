/* Checks the copies of Iron Ledger's Python in this site against answers that Python gave (tools/reference/, made 19 Nov 2026 from
   Iron Ledger v7.93's personality.py and report.py, Stockfish 19 for the lines and evaluations):
   - js/personality.js features(): 400 random moves — every feature count the same;
   - js/personality.js choose(): 60 positions × 5 styles at 2000 (no randomness there) — the same move and reason;
   - js/review.js scoreGame(): 8 games, 268 moves — the same label, win chance lost, accuracy and mark; the same game accuracy.
   Run: node tools/port_check.mjs */
import { readFileSync } from "fs";
import { features, choose, STYLES } from "../js/personality.js";
import { scoreGame } from "../js/review.js";
const ref = (f) => JSON.parse(readFileSync(new URL(`reference/${f}`, import.meta.url)));
let bad = 0;
const feat = ref("personality_features.json"), fOk = feat.filter((c) => { const f = features(c.fen, c.uci); return Object.keys(c.f).every((k) => f[k] === c.f[k]); }).length;
console.log(`features: ${fOk} of ${feat.length} moves as personality.py`); bad += feat.length - fOk;
const ch = ref("personality_choose.json"); let cOk = 0, cN = 0;
for (const r of ch) for (const st of STYLES) { cN++; const c = choose(r.fen, r.lines, st, 2000); if (c.uci === r.py[st][0] && c.why === r.py[st][1]) cOk++; }
console.log(`choices: ${cOk} of ${cN} as personality.py`); bad += cN - cOk;
const games = ref("report_moves.json"); let mOk = 0, mN = 0, aOk = 0;
for (const g of games) {
  const r = scoreGame(g.pgn, g.evals);
  r.moves.forEach((m, i) => { const p = g.py[i]; mN++;
    if (m.label === p.label && Math.abs(m.drop - p.drop) < 0.051 && Math.abs(m.accuracy - p.accuracy) < 0.051 && m.quality === p.quality && !!m.great === !!p.great && !!m.missedChance === !!p.missed_chance) mOk++; });
  if (r.sides.white.accuracy === g.acc.white && r.sides.black.accuracy === g.acc.black) aOk++;
}
console.log(`review: ${mOk} of ${mN} moves and ${aOk} of ${games.length} game accuracies as report.py`); bad += mN - mOk + games.length - aOk;
process.exit(bad ? 1 : 0);
