/* Maia-3's thinking off the page's thread, so the board never stalls while it works out a move (js/maia3.js asks). */
import { readNet, moveProbs } from "./maia3-net.js";
let net = null;
async function load(url) {
  net ||= fetch(url).then((r) => { if (!r.ok) throw new Error(`Maia-3's network didn't load (${r.status})`); return r.arrayBuffer(); }).then(readNet);
  try { return await net; } catch (e) { net = null; throw e; }
}
onmessage = async (e) => {
  const { id, url, fens, moves, self, oppo, warm } = e.data;
  try {
    const n = await load(url);
    postMessage(warm ? { id, ready: true } : { id, probs: moveProbs(n, fens, moves, self, oppo) });
  } catch (err) { postMessage({ id, error: err.message || String(err) }); }
};
