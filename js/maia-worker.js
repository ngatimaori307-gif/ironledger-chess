/* Maia's thinking off the page's thread, so the board never stalls while it works out a move (js/maia.js asks). */
import { readNet, moveProbs } from "./maia-net.js";
const nets = new Map();
async function net(url) {
  if (!nets.has(url)) nets.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`Maia's network didn't load (${r.status})`); return r.arrayBuffer(); }).then(readNet));
  try { return await nets.get(url); } catch (e) { nets.delete(url); throw e; }
}
onmessage = async (e) => {
  const { id, url, fens, moves } = e.data;
  try { postMessage({ id, probs: moveProbs(await net(url), fens, moves) }); }
  catch (err) { postMessage({ id, error: err.message || String(err) }); }
};
