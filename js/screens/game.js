/* A game against the computer (from Play the Computer, The Ladder, the Hardcore ladders or Carry On). */
import { current, setCurrent } from "../store.js";
import { newMatch, computerReply, opponent, persist, myTurn, finish } from "../match.js";
import { drawOffer } from "../guard.js";
import { mountGame } from "./gameview.js";
import { go, toast } from "../app.js";
import * as engine from "../engine.js";
import { ENGINE, MAIA3 } from "../config.js";
import * as maia3 from "../maia3.js";

export function render(v) {
  const saved = current();
  if (!saved) { go("#play"); return; }
  const m = newMatch(saved), o = opponent(m);
  if (!o) { setCurrent(null); go("#play"); return; }
  engine.start().catch(() => toast("The engine couldn't start on this phone"));
  let thinking = false;
  const ui = mountGame(v, m, {
    name: o.name, back: m.hc ? `#hardcore/${m.hc}` : m.ladder ? "#ladder" : "#computer",
    status: () => ((o.m3 || o.guard) && !maia3.ready() && !myTurn(m) && !m.result ? `${o.name} is getting ready — the first Maia-3 game downloads ${MAIA3.sizeMb} MB, once` : ""),
    onMine: () => reply(),
    resign: () => {},
    ...(m.hc ? { offerDraw: async () => {                // Hardcore, as Iron Ledger: from move 20, accepted only when level
      toast("Offering a draw…"); const r = await drawOffer(m.chess.fen(), m.moves.length);
      if (m.result) return; toast(r.why); if (r.accepted) finish(m, "1/2-1/2", "draw agreed");
    } } : {}),
    again: () => { setCurrent({ ...saved, me: m.me === "w" ? "b" : "w", moves: [], startedAt: Date.now() }); render(v); },
  });
  if (o.m3 || o.guard) { maia3.warm(); maia3.onReady(() => ui.redraw()); }     // the download starts while he thinks about his first move
  async function reply() { if (thinking) return; thinking = true; try { await computerReply(m); } finally { thinking = false; ui.redraw(); } }
  persist(m);
  reply();                                            // the computer opens when you play Black, or carries on after a reload
  let retried = 0;
  m.listeners.push((kind) => { if (kind !== "error") return; if (retried++ < ENGINE.retries) { toast("The engine is slow to answer — trying again"); setTimeout(reply, ENGINE.retryAfterMs); } else toast("The engine isn't answering on this phone. Close the app and open it again."); });
}
