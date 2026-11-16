/* A game against the computer (from Play the Computer, The Ladder or Carry On). */
import { current, setCurrent } from "../store.js";
import { newMatch, computerReply, opponent, persist } from "../match.js";
import { mountGame } from "./gameview.js";
import { go, toast } from "../app.js";
import * as engine from "../engine.js";
import { ENGINE } from "../config.js";

export function render(v) {
  const saved = current();
  if (!saved) { go("#play"); return; }
  const m = newMatch(saved), o = opponent(m);
  if (!o) { setCurrent(null); go("#play"); return; }
  engine.start().catch(() => toast("The engine couldn't start on this phone"));
  let thinking = false;
  const ui = mountGame(v, m, {
    name: o.name, back: m.ladder ? "#ladder" : "#computer",
    onMine: () => reply(),
    resign: () => {},
    again: () => { setCurrent({ ...saved, me: m.me === "w" ? "b" : "w", moves: [], startedAt: Date.now() }); render(v); },
  });
  async function reply() { if (thinking) return; thinking = true; try { await computerReply(m); } finally { thinking = false; ui.redraw(); } }
  persist(m);
  reply();                                            // the computer opens when you play Black, or carries on after a reload
  let retried = 0;
  m.listeners.push((kind) => { if (kind !== "error") return; if (retried++ < ENGINE.retries) { toast("The engine is slow to answer — trying again"); setTimeout(reply, ENGINE.retryAfterMs); } else toast("The engine isn't answering on this phone. Close the app and open it again."); });
}
