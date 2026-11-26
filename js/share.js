/* 1.15.0 — "Share all my games": every kept game as one PGN file, for his son's Iron Ledger (an opponent book reads them: his games
   against the computer as games against bots, his friend games as games against people). Each game carries his Profile name in
   place of "You", the event it came from ("Iron Ledger Chess · Play the Computer", "· The Ladder", "· Hardcore ladder",
   "· Play a Friend") and, for games against the computer, TimeControl "-" (no clock). Nothing leaves the phone unless he shares it. */
import { settings } from "./store.js";

export const SHARE = { site: "Iron Ledger Chess", name: "Player", file: "iron-ledger-chess-games.pgn" };
export function eventOf(g) {
  if (g.mode === "friend") return "Play a Friend";
  if (g.hc) return "Hardcore ladder";
  if (g.ladder) return "The Ladder";
  return "Play the Computer";
}
function tag(k, v) { return `[${k} "${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`; }
export function gamePgn(g, name) {
  const text = String(g.pgn || ""), heads = {}, body = text.replace(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm, (_, k, v) => { heads[k] = v.replace(/\\(.)/g, "$1"); return ""; }).trim();
  const who = (name || "").trim() || SHARE.name;
  for (const side of ["White", "Black"]) if (heads[side] === "You") heads[side] = who;
  const out = { Event: `${SHARE.site} · ${eventOf(g)}`, Site: SHARE.site, Date: heads.Date || "????.??.??", Round: "-",
    White: heads.White || "?", Black: heads.Black || "?", Result: heads.Result || g.result || "*" };
  if (g.mode !== "friend") out.TimeControl = "-";            // the computer played without a clock
  for (const [k, v] of Object.entries(heads)) if (!(k in out)) out[k] = v;
  return Object.entries(out).map(([k, v]) => tag(k, v)).join("\n") + "\n\n" + (body || out.Result) + "\n";
}
export function allPgn(list, name = settings.name) { return list.filter((g) => g && g.pgn).map((g) => gamePgn(g, name)).join("\n"); }
export async function shareAll(list) {
  const text = allPgn(list), file = new File([text], SHARE.file, { type: "application/x-chess-pgn" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My games" }); return "shared"; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/x-chess-pgn" })); a.download = SHARE.file;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return "downloaded";
}
