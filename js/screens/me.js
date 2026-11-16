/* Me: your games, the look, sound, problem reports and what the app is built from. */
import { APP, THEMES } from "../config.js";
import { settings, saveSettings, games, ladder } from "../store.js";
import * as log from "../log.js";
import { applyTheme, toast } from "../app.js";
import { esc } from "./ui.js";
import { OPPONENTS } from "../config.js";

export function render(v) {
  const g = games(), w = g.filter((x) => x.mine === "win").length, d = g.filter((x) => x.mine === "draw").length, l = g.filter((x) => x.mine === "loss").length;
  const rung = ladder().beaten.length;
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Me</h1>
    <div class="ilc-plate"><div><div class="ilc-plate__over">Your games</div><div class="ilc-plate__rank">${w} won · ${d} drawn · ${l} lost</div></div>
      <div><div class="ilc-plate__over">The Ladder</div><div class="ilc-plate__fig">${rung}<small>/${OPPONENTS.length}</small></div></div></div>
    <h2 class="overline">Recent games</h2>
    ${g.length ? `<ul class="games">${g.slice(0, 20).map((x) => `<li><span class="res res--${x.mine}">${{ win: "✓ Won", loss: "✗ Lost", draw: "½ Draw" }[x.mine]}</span>
      <span class="g-opp">${esc(x.opp)}</span><span class="ilc-card__line">${esc(x.why)} · ${Math.ceil(x.moves / 2)} moves · ${new Date(x.at).toLocaleDateString()}</span></li>`).join("")}</ul>` : `<p class="sub">No finished games yet.</p>`}
    <h2 class="overline">Look</h2>
    <div class="themes" role="radiogroup" aria-label="Look">${THEMES.map((t) => `<label class="theme" data-theme="${t.id}"><input type="radio" name="th" value="${t.id}"${t.id === settings.theme ? " checked" : ""}>
      <span class="sw"><i style="background:var(--sq-light)"></i><i style="background:var(--sq-dark)"></i></span><span>${esc(t.name)}</span></label>`).join("")}</div>
    <h2 class="overline">Settings</h2>
    <label class="switch"><span>Sounds</span><input type="checkbox" id="snd"${settings.sound ? " checked" : ""}></label>
    <label class="switch"><span>Send problem reports to the developer</span><input type="checkbox" id="rep"${settings.sendReports ? " checked" : ""}></label>
    <p class="ilc-card__line">A report holds what went wrong, the screen, your phone's model and browser, and the app's version. Nothing else.</p>
    <h2 class="overline">Report a problem</h2>
    <p class="sub">${log.count() ? `${log.count()} problem${log.count() === 1 ? "" : "s"} noted on this phone.` : "Nothing has gone wrong on this phone."} Copy the report and send it in a message.</p>
    <div class="row"><button class="ilc-btn ilc-btn--primary" id="copyrep">Copy the report</button><button class="ilc-btn" id="clr">Clear</button></div>
    <h2 class="overline">About</h2>
    <p class="ilc-card__line">${APP.name} ${APP.version}. The sets are modern Māori art, his own designs. Chess engine: Stockfish 19 (GPL-3.0, <a href="https://github.com/official-stockfish/Stockfish">source</a>; in the browser by Stockfish.js). Rules: chess.js. Connections: PeerJS.</p>
  </section>`;
  v.querySelector(".themes").onchange = (e) => { settings.theme = e.target.value; saveSettings(); applyTheme(); };
  v.querySelector("#snd").onchange = (e) => { settings.sound = e.target.checked; saveSettings(); };
  v.querySelector("#rep").onchange = (e) => { settings.sendReports = e.target.checked; saveSettings(); };
  v.querySelector("#copyrep").onclick = async () => { try { await navigator.clipboard.writeText(log.report()); toast("Report copied — paste it in a message"); } catch { toast("Copying was refused on this phone"); } };
  v.querySelector("#clr").onclick = () => { log.clear(); render(v); };
}
