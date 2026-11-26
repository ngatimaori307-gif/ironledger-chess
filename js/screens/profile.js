/* His Profile: his name, his rating against the computer (Glicko-2 as Iron Ledger reckons it, with its range and the games it
   rests on), how his latest games went, his record by kind of opponent, and every game kept, to replay or copy as PGN. */
import { GAMES_KEPT } from "../config.js";
import { settings, saveSettings, games } from "../store.js";
import { profile } from "../rating.js";
import { esc } from "./ui.js";
import { evaluate, STYLES } from "../style.js";
import { loadReport } from "../review.js";
import { shareAll } from "../share.js";
import { toast } from "../app.js";
import { summary as eyesSummary, EYES } from "../eyes.js";

const ORDER = ["m3", "guard", "maia", "styled", "sf", "weak", "friend", "other"];
export function render(v) {
  const all = games(), p = profile(all);
  const rating = p.rating == null ? `<div class="ilc-plate__rank">No rating yet</div><div class="ilc-card__line">Play the computer: every game against it counts.</div>`
    : `<div class="ilc-plate__fig">${p.rating}</div><div class="ilc-card__line">${p.low}–${p.high} (95 %) · from ${p.n} game${p.n === 1 ? "" : "s"}${p.provisional ? " · provisional: a few more games settle it" : ""}</div>`;
  const kinds = ORDER.filter((k) => p.record[k]).map((k) => { const c = p.record[k];
    return `<li><span class="g-opp">${esc(c.label)}</span><span class="pf-wdl">${c.win} won · ${c.draw} drawn · ${c.loss} lost</span><span class="pf-score">${c.score ?? "–"} %</span></li>`; }).join("");
  const row = (g) => `<li><a class="pf-game" href="#replay/${g.at}"><span class="res res--${g.mine}">${{ win: "✓ Won", loss: "✗ Lost", draw: "½ Draw" }[g.mine]}</span>
      <span class="g-opp">${esc(g.opp)}</span><span class="ilc-card__line">${esc(g.why)} · ${Math.ceil(g.moves / 2)} move${Math.ceil(g.moves / 2) === 1 ? "" : "s"} · ${new Date(g.at).toLocaleDateString()}</span></a></li>`;
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Profile</h1>
    <div class="field"><label for="pf-name">Your name</label><input id="pf-name" maxlength="24" value="${esc(settings.name)}" placeholder="e.g. Dad"></div>
    <div class="ilc-plate"><div><div class="ilc-plate__over">Your rating against the computer</div>${rating}</div></div>
    ${p.perf != null ? `<p class="sub">Your last ${p.perfN} game${p.perfN === 1 ? "" : "s"} against the computer: played like ${p.perf}.</p>` : ""}
    <p class="sub">Worked out the way Iron Ledger works out ratings (Glicko-2): each result moves it by how strong the opponent is, and the range narrows as games come in. Games with friends have no rating to measure against, so they count in your record only.</p>
    <h2 class="overline">Your playstyle</h2>
    <div class="seg ps-side" role="radiogroup" aria-label="Which games">${[["", "Both"], ["white", "As White"], ["black", "As Black"]].map(([k, l]) =>
      `<label class="seg-opt"><input type="radio" name="ps-side" value="${k}"${k === (settings.styleSide || "") ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
    <div id="ps"></div>
    <h2 class="overline">Your record</h2>
    ${kinds ? `<ul class="games pf-kinds">${kinds}</ul>` : `<p class="sub">No finished games yet.</p>`}
    <h2 class="overline">Eyes and glasses</h2>
    ${eyesCard()}
    <h2 class="overline">Your games</h2>
    ${all.length ? `<p class="sub">Tap a game to replay it or copy it as PGN. This phone keeps your last ${GAMES_KEPT}.</p>
      <div class="row"><button class="ilc-btn" id="pf-share">Share all my games</button></div>
      <p class="sub">One file of all ${all.length} games, with your name on them, for Iron Ledger. Nothing is sent unless you share it.</p>
      <ul class="games">${all.map(row).join("")}</ul>` : ""}
  </section>`;
  const drawStyle = () => { v.querySelector("#ps").innerHTML = styleCard(evaluate(all, loadReport, settings.styleSide || null)); };
  v.querySelectorAll("input[name=ps-side]").forEach((r) => { r.onchange = () => { settings.styleSide = r.value; saveSettings(); drawStyle(); }; });
  drawStyle();
  const nm = v.querySelector("#pf-name");
  nm.onchange = () => { settings.name = nm.value.trim(); saveSettings(); };
  v.querySelector("#pf-share")?.addEventListener("click", async () => {      // 1.15.0: his games for Iron Ledger's opponent book
    if (!settings.name) { nm.focus(); toast("Type your name first, so your games carry it"); return; }
    try { const how = await shareAll(all); toast(how === "shared" ? "Games shared" : "Games saved to Downloads"); } catch (e) { if (e && e.name !== "AbortError") toast("Couldn't share the games"); }
  });
}

/* 1.14.0 — Iron Ledger's playstyle card (Profile → Your playstyle, v7.45): the style and its streak, the four scores as bars (0 in
   the middle: ahead of or behind your opponents), what you're really good at, what's unique, what costs you most, your openings —
   every line with your figure, your opponents' and how many games it rests on. */
function styleCard(st) {
  if (st.reason && !st.styles) return `<p class="sub">Your playstyle ${esc(st.reason)}. It compares your games with your opponents' in the same games.</p>`;
  const bar = (s) => { const w = Math.min(50, Math.abs(s.score) * 50);
    return `<li class="ps-bar"><span class="ps-name">${esc(s.style)}</span><span class="ps-track"><i style="${s.score >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`}" class="${s.score >= 0 ? "ps-up" : "ps-down"}"></i></span><span class="ps-num">${s.score > 0 ? "+" : ""}${Math.round(s.score * 100)}</span></li>`; };
  const rows = (list) => list.map((x) => `<li><span>${esc(x.text)}</span><span class="ps-fig">${esc(x.me)}${x.opp != null ? ` <span class="sub">vs ${esc(x.opp)}</span>` : ""}</span><span class="ilc-card__line">${x.n} ${x.key === "opening" ? (x.n === 1 ? "game" : "games") : "behind it"}</span></li>`).join("");
  const missing = Object.keys(STYLES).filter((k) => !st.styles.some((s) => s.style === k));
  return `<div class="ilc-plate ps"><div><div class="ilc-plate__over">You play like</div>
      <div class="ilc-plate__rank">${st.style ? esc(st.style) + (st.streak ? ` <span class="ps-streak">with a ${esc(st.streak.toLowerCase())} streak</span>` : "") : "No style stands out yet"}</div>
      <div class="ilc-card__line">From ${st.games} games (${st.analysed} reviewed), set beside your opponents in the same games.</div></div></div>
    ${st.styles.length ? `<ul class="ps-bars">${st.styles.map(bar).join("")}</ul>` : ""}
    ${missing.length ? `<p class="sub">${missing.join(", ")}: needs more ${st.analysed < st.minGames ? `reviewed games (${st.analysed} of ${st.minGames})` : "games"}.</p>` : ""}
    ${st.strengths?.length ? `<h3 class="ps-h">What you're really good at</h3><ul class="games ps-list">${rows(st.strengths)}</ul>` : ""}
    ${st.unique?.length ? `<h3 class="ps-h">What's unique</h3><ul class="games ps-list">${rows(st.unique)}</ul>` : ""}
    ${st.costs ? `<h3 class="ps-h">What costs you most</h3><ul class="games ps-list">${rows([st.costs])}</ul>` : ""}
    ${st.openings?.most?.length ? `<h3 class="ps-h">Your openings</h3><ul class="games ps-list">${st.openings.most.map((o) => `<li><span>${esc(o.first)} as ${o.col}</span><span class="ps-fig">${o.score} %</span><span class="ilc-card__line">${o.games} game${o.games === 1 ? "" : "s"}</span></li>`).join("")}</ul>` : ""}
    <p class="sub">The words are names for the sums; the numbers are the evidence. Sound sacrifices aren't counted here (Iron Ledger's own check).</p>`;
}

/* 1.15.0 — the eye-strain log's answer (js/eyes.js = Iron Ledger v8.31): each comparison with its n, a difference only beyond chance. */
function eyesCard() {
  const s = eyesSummary();
  if (!s.n) return `<p class="sub">After each game, one tap: your eyes 1 to 5, glasses on or off. The answer comes once there are ${EYES.minN} ratings on each side.</p>`;
  return `<p class="sub">${s.n} ratings after games (1 fresh … 5 sore).</p>${s.comparisons.map((c) => `<p class="eyes-${c.verdict === "bigger than chance" ? "diff" : "same"}">${esc(c.say)}</p>`).join("")}`;
}
