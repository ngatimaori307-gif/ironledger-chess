/* Checks js/maia3-net.js against tools/maia3_reference.py (a NumPy copy of CSSLab's model, float32, from the checkpoint itself):
   python3 tools/maia3_reference.py <maia3-5m.pt> > /tmp/maia3_ref.json && node tools/maia3_check.mjs /tmp/maia3_ref.json
   Passes when every position's favourite move is the same and no probability differs by more than MAX_DIFF (half precision). */
import { readFileSync } from "fs";
import { readNet, moveProbs } from "../js/maia3-net.js";
const MAX_DIFF = 0.005;
const buf = readFileSync(new URL("../vendor/maia3/maia3-5m.bin", import.meta.url));
const net = readNet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const ref = JSON.parse(readFileSync(process.argv[2], "utf8"));
let same = 0, worst = 0; const ms = [];
for (const r of ref) {
  const t = Date.now(), p = moveProbs(net, r.fens, r.legal, r.self, r.oppo); ms.push(Date.now() - t);
  const best = Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
  if (best === r.best) same++; else console.log(`differs: ${r.fens.at(-1)} — browser ${best}, reference ${r.best}`);
  r.legal.forEach((u, i) => { worst = Math.max(worst, Math.abs(p[u] - r.probs[i])); });
}
ms.sort((a, b) => a - b);
console.log(`${same} of ${ref.length} positions: the same favourite; largest probability difference ${worst.toFixed(4)}; ${ms[ms.length >> 1]} ms a move (median)`);
process.exit(same === ref.length && worst <= MAX_DIFF ? 0 : 1);
