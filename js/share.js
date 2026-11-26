/* 1.15.0 / 1.17.0 — each kept game as PGN for his son's Iron Ledger (an opponent book reads them: his games against the computer as
   games against bots, his friend games as games against people), sent by js/sendgames.js. Each game carries his Profile name in place
   of "You", the event it came from ("Iron Ledger Chess · Play the Computer", "· The Ladder", "· Hardcore ladder", "· Play a Friend"),
   how it ended (Termination) and, for games against the computer, TimeControl "-" (no clock). */
import { settings } from "./store.js";

export const SHARE = { site: "Iron Ledger Chess", name: "Player" };
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
  if (g.why) out.Termination = g.why;                         // 1.17.0: how it ended, for the bot log (checkmate, resigned, …)
  for (const [k, v] of Object.entries(heads)) if (!(k in out)) out[k] = v;
  return Object.entries(out).map(([k, v]) => tag(k, v)).join("\n") + "\n\n" + (body || out.Result) + "\n";
}
export function allPgn(list, name = settings.name) { return list.filter((g) => g && g.pgn).map((g) => gamePgn(g, name)).join("\n"); }
