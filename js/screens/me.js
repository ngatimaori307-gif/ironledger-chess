/* Me: the way to his Profile (rating, record, games), the look, sound, problem reports and what the app is built from. */
import { APP, THEMES, CAPTURE_FX } from "../config.js";
import { settings, saveSettings, games, ladder } from "../store.js";
import { applyTheme } from "../app.js";
import { BOARDS, PIECE_SETS, pieceSrc, boardThumb, applyBoard, pieceSet } from "../looks.js";
import { esc } from "./ui.js";
import { OPPONENTS } from "../config.js";
import { profile } from "../rating.js";

export function render(v) {
  const g = games(), w = g.filter((x) => x.mine === "win").length, d = g.filter((x) => x.mine === "draw").length, l = g.filter((x) => x.mine === "loss").length;
  const rung = ladder().beaten.length, p = profile(g);
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Me</h1>
    <a class="me-profile" href="#profile"><div class="ilc-plate"><div><div class="ilc-plate__over">${esc(settings.name || "Your profile")} ›</div><div class="ilc-plate__rank">${w} won · ${d} drawn · ${l} lost</div>
      <div class="ilc-card__line">${p.rating == null ? "Rating, record and every game to replay" : `Rating ${p.rating}${p.provisional ? " (provisional)" : ""} · record and every game to replay`}</div></div>
      <div><div class="ilc-plate__over">The Ladder</div><div class="ilc-plate__fig">${rung}<small>/${OPPONENTS.length}</small></div></div></div></a>
    <h2 class="overline">Look</h2>
    <div class="themes" role="radiogroup" aria-label="Look">${THEMES.map((t) => `<label class="theme" data-theme="${t.id}"><input type="radio" name="th" value="${t.id}"${t.id === settings.theme ? " checked" : ""}>
      <span class="sw"><i style="background:var(--sq-light)"></i><i style="background:var(--sq-dark)"></i></span><span>${esc(t.name)}</span></label>`).join("")}</div>
    <h2 class="overline">Board</h2>
    <div class="looks boards" role="radiogroup" aria-label="Board">${BOARDS.map((b) => `<label class="look-tile" title="${esc(b.name)}"><input type="radio" name="bd" value="${b.id}"${b.id === (settings.board || "look") ? " checked" : ""}>
      ${b.file ? `<img class="look-pic" src="${boardThumb(b)}" alt="" loading="lazy">` : `<span class="look-pic sw"${b.light ? ` style="--l:${b.light};--d:${b.dark}"` : ""}><i></i><i></i><i></i><i></i></span>`}<span>${esc(b.name)}</span></label>`).join("")}</div>
    <h2 class="overline">Pieces</h2>
    <div class="looks sets" role="radiogroup" aria-label="Pieces">${PIECE_SETS.map((s) => `<label class="look-tile" title="${esc(s.name)}"><input type="radio" name="ps" value="${s.id}"${s.id === pieceSet().id ? " checked" : ""}>
      <span class="look-pic set-pic"><img src="${pieceSrc("wN", s.id)}" alt="" loading="lazy"><img src="${pieceSrc("bQ", s.id)}" alt="" loading="lazy"></span><span>${esc(s.name)}</span></label>`).join("")}</div>
    <p class="ilc-card__line" id="set-by"></p>
    <h2 class="overline">Settings</h2>
    <label class="switch"><span>Sounds</span><input type="checkbox" id="snd"${settings.sound ? " checked" : ""}></label>
    <label class="switch"><span>Moving pieces</span><input type="checkbox" id="mot"${settings.motion !== "calm" ? " checked" : ""}></label>
    <div class="field"><label for="cfx">When a piece is taken</label><select id="cfx">${CAPTURE_FX.map(([k, l]) => `<option value="${k}"${k === settings.captureFx ? " selected" : ""}>${l}</option>`).join("")}</select></div>
    <h2 class="overline">About</h2>
    <p class="ilc-card__line">${APP.name} ${APP.version}. The sets are modern Māori art, his own designs. If something goes wrong, a short problem report (what happened, the phone's model and browser, the app's version) goes to the developer so it can be fixed. Chess engine: Stockfish 19 (GPL-3.0, <a href="https://github.com/official-stockfish/Stockfish">source</a>; in the browser by Stockfish.js). Opponents like people: Maia-3 (AGPL-3.0, <a href="https://github.com/CSSLab/maia3">source</a>) and Maia (GPL-3.0, <a href="https://github.com/CSSLab/maia-chess">source</a>), CSSLab, University of Toronto. Boards and the other piece sets: Lichess and its artists, each under its own licence (<a href="vendor/lichess/COPYING.md">list</a>). Rules: chess.js. Connections: PeerJS. This app's own source: <a href="https://github.com/ngatimaori307-gif/ironledger-chess">ironledger-chess</a>.</p>
  </section>`;
  v.querySelector(".themes").onchange = (e) => { settings.theme = e.target.value; saveSettings(); applyTheme(); };
  const by = () => { const s = pieceSet(); v.querySelector("#set-by").textContent = `${s.name}: ${s.by ? "by " + s.by + " · " : ""}${s.licence}`; };
  by();
  v.querySelector(".boards").onchange = (e) => { settings.board = e.target.value; saveSettings(); applyBoard(); };
  v.querySelector(".sets").onchange = (e) => { settings.pieces = e.target.value; saveSettings(); by(); };
  v.querySelector("#snd").onchange = (e) => { settings.sound = e.target.checked; saveSettings(); };
  v.querySelector("#mot").onchange = (e) => { settings.motion = e.target.checked ? "full" : "calm"; saveSettings(); };
  v.querySelector("#cfx").onchange = (e) => { settings.captureFx = e.target.value; saveSettings(); };
}
