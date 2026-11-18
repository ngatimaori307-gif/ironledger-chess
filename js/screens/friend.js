/* Play a Friend: make an invite (a code and a link to send), or open one. The game then runs on this screen while the two
   phones stay connected; a dropped connection reconnects and carries on from the same move. */
import { FRIEND } from "../config.js";
import { settings, saveSettings, friendGames, saveFriendGame } from "../store.js";
import { FriendLink, newCode, cleanCode, inviteLink, mergeMoves, PROTOCOL } from "../friend.js";
import { newMatch, play, finish, uciObj } from "../match.js";
import { mountGame } from "./gameview.js";
import { colorPicker, pickColor, esc } from "./ui.js";
import { onLeave, toast } from "../app.js";
import { record } from "../log.js";
import { myId, friends, addFriend, invite } from "../presence.js";

export function render(v, arg) {
  if (arg && arg.startsWith("join:")) return joinScreen(v, cleanCode(arg.slice(5)));
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Play a Friend</h1><p class="sub">A live game on two phones. You both need the app open while you play.</p>
    <div class="ilc-plate col"><h2 class="overline">Invite</h2>${colorPicker("col", "r")}
      <div class="field"><label for="nm">Your name, as your friend sees it</label><input id="nm" maxlength="24" value="${esc(settings.name)}" placeholder="e.g. Dad"></div>
      <button class="ilc-btn ilc-btn--primary wide" id="mk">Make an invite</button></div>
    ${friends().length ? `<div class="ilc-plate col"><h2 class="overline">Friends</h2><ul class="friends">${friends().map((f) => `<li><span>${esc(f.name)}</span><button class="ilc-btn ilc-btn--primary" data-inv="${esc(f.id)}">Invite</button></li>`).join("")}</ul>
      <p class="sub">The invite pops up on their phone while their app is open.</p></div>` : ""}
    <div class="ilc-plate col"><h2 class="overline">Have a code?</h2>
      <div class="field"><label for="cd">Game code</label><input id="cd" maxlength="${FRIEND.codeLength}" autocapitalize="characters" autocomplete="off" placeholder="${"X".repeat(FRIEND.codeLength)}"></div>
      <button class="ilc-btn wide" id="jn">Join the game</button></div></section>`;
  const nameNow = () => { settings.name = v.querySelector("#nm").value.trim(); saveSettings(); return settings.name; };
  v.querySelector("#mk").onclick = () => { nameNow(); hostScreen(v, newCode(), pickColor(v.querySelector("input[name=col]:checked").value)); };
  v.querySelectorAll("[data-inv]").forEach((b) => { b.onclick = () => { nameNow(); const f = friends().find((x) => x.id === b.dataset.inv);
    hostScreen(v, newCode(), pickColor(v.querySelector("input[name=col]:checked").value), f); }; });
  v.querySelector("#jn").onclick = () => { nameNow(); const c = cleanCode(v.querySelector("#cd").value); if (c.length === FRIEND.codeLength) joinScreen(v, c); else toast(`A game code has ${FRIEND.codeLength} letters and numbers`); };
}

function session(v, { code, host, hostColor, inviteTo = null }) {
  const kept = friendGames()[code] || {};
  let wantAgain = null, m = null, link = null, ui = null, theirName = kept.oppName || "", myColor = host ? hostColor : kept.me || null;
  const save = () => m && saveFriendGame(code, { me: m.me, moves: m.moves, oppName: theirName, result: m.result, at: Date.now() });
  const begin = (moves, me) => {
    myColor = me;
    m = newMatch({ mode: "friend", me, code, moves, oppName: theirName });
    m.listeners.push((kind) => { if (kind === "move" || kind === "end") save(); });
    ui = mountGame(v, m, {
      name: theirName || "Your friend", back: "#friend",
      paused: () => link.status !== "connected",
      status: () => link.status !== "connected" ? "Connection lost — reconnecting…" : null,
      onMine: (mv) => { link.send({ t: "move", uci: mv.from + mv.to + (mv.promotion || ""), ply: m.moves.length - 1 }); },
      resign: () => link.send({ t: "resign" }),
      offerDraw: () => { link.send({ t: "draw?" }); toast("Draw offered"); },
      againPick: () => settings.againColor || "r",
      again: (want = "r") => { settings.againColor = want; saveSettings(); wantAgain = want; link.send({ t: "again?", want }); toast("Asked for a rematch"); },
    });
    save();
  };
  const onMessage = (msg) => {
    if (msg.t === "_open") { if (!host) link.send({ t: "hello", v: PROTOCOL, name: settings.name, id: myId(), moves: kept.moves || [] }); if (ui) ui.redraw(); return; }
    if ((msg.t === "hello" || msg.t === "start") && msg.id) addFriend(msg.id, msg.name);   // a friend to invite next time
    if (msg.t === "hello" && host) {
      theirName = String(msg.name || "").slice(0, 24);
      const moves = mergeMoves(m ? m.moves : kept.moves || [], Array.isArray(msg.moves) ? msg.moves.map(String) : []);
      link.send({ t: "start", v: PROTOCOL, hostColor, moves, name: settings.name, id: myId() });
      if (!m || moves.length !== m.moves.length) begin(moves, hostColor); else ui.redraw();
      return;
    }
    if (msg.t === "start" && !host) { theirName = String(msg.name || "").slice(0, 24); begin(Array.isArray(msg.moves) ? msg.moves.map(String) : [], msg.hostColor === "w" ? "b" : "w"); return; }
    if (!m) return;
    if (msg.t === "move") {
      if (msg.ply !== m.moves.length) { record("friend", `move out of step (${msg.ply} vs ${m.moves.length})`); if (!host) link.send({ t: "hello", v: PROTOCOL, name: settings.name, moves: m.moves }); return; }
      if (m.chess.turn() === m.me || !play(m, uciObj(String(msg.uci)))) record("friend", `a move the rules refused: ${msg.uci}`);
    } else if (msg.t === "resign") finish(m, m.me === "w" ? "1-0" : "0-1", `${theirName || "your friend"} resigned`);
    else if (msg.t === "draw?") drawAsk();
    else if (msg.t === "draw!") finish(m, "1/2-1/2", "agreed");
    else if (msg.t === "draw-no") toast("Draw declined");
    else if (msg.t === "again?") againAsk(msg.want);
    else if (msg.t === "again!") restart(wantAgain, true);
    else if (msg.t === "again-no") toast(`${theirName || "Your friend"} said no to a rematch`);
  };
  function ask(text, yes, no) {
    const el = document.createElement("div"); el.className = "ask";
    el.innerHTML = `<div class="ilc-plate col"><p>${esc(text)}</p><div class="row"><button class="ilc-btn ilc-btn--primary" data-a="y">Yes</button><button class="ilc-btn" data-a="n">No</button></div></div>`;
    el.onclick = (e) => { const b = e.target.closest("[data-a]"); if (!b) return; el.remove(); (b.dataset.a === "y" ? yes : no)(); };
    v.append(el);
  }
  function drawAsk() { ask(`${theirName || "Your friend"} offers a draw`, () => { link.send({ t: "draw!" }); finish(m, "1/2-1/2", "agreed"); }, () => link.send({ t: "draw-no" })); }
  function againAsk(want) {
    const yours = want === "w" ? " — you'd play Black" : want === "b" ? " — you'd play White" : "";
    ask(`${theirName || "Your friend"} wants a rematch${yours}`, () => { link.send({ t: "again!" }); restart(want, false); }, () => link.send({ t: "again-no" }));
  }
  /* The host deals the rematch: want = the colour the one who asked wants (w / b / r; none = colours swapped, as before); mine = this phone asked. */
  function restart(want, mine) {
    wantAgain = null; saveFriendGame(code, {}); kept.moves = []; if (!host) return;
    const pick = want === "r" ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "w" : "b") : want;
    hostColor = pick === "w" || pick === "b" ? (mine ? pick : pick === "w" ? "b" : "w") : hostColor === "w" ? "b" : "w";
    link.send({ t: "start", v: PROTOCOL, hostColor, moves: [], name: settings.name, id: myId() }); begin([], hostColor);
  }
  link = new FriendLink({ code, host, name: settings.name, onMessage,
    onState: (s, detail) => { const el = v.querySelector("#fr-state"); if (el) el.textContent = detail || ""; if (ui) ui.redraw(); if (s === "failed" && !m) v.querySelector("#fr-state")?.classList.add("bad"); } });
  link.start();
  if (inviteTo) {                                                             // the invite pops up on their phone
    const el = () => v.querySelector("#fr-state");
    el() && (el().textContent = `Invite sent to ${inviteTo.name} — waiting for them`);
    invite(inviteTo, { code, hostColor, name: settings.name }).then((r) => { if (m) return; const e = el(); if (!e) return;
      e.textContent = { accepted: `${inviteTo.name} accepted — connecting…`, declined: `${inviteTo.name} declined`, offline: `${inviteTo.name}'s app isn't open — send the link instead` }[r]; });
  }
  onLeave(() => link.close());
  return { get myColor() { return myColor; } };
}

function hostScreen(v, code, hostColor, inviteTo = null) {
  const url = inviteLink(code);
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Invite a Friend</h1>
    <div class="ilc-plate col"><p class="ilc-plate__over">Game code</p><p class="code">${code}</p>
      <p>Send your friend this link. When they open it, the game starts here. You play ${hostColor === "w" ? "White" : "Black"}.</p>
      <input class="link" readonly value="${esc(url)}" aria-label="Invite link">
      <div class="row"><button class="ilc-btn ilc-btn--primary" id="share">Send the link</button><button class="ilc-btn" id="copy">Copy</button></div>
      <p class="ilc-card__line" id="fr-state">Setting up…</p></div></section>`;
  v.querySelector("#copy").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { v.querySelector(".link").select(); toast("Hold the link to copy it"); } };
  v.querySelector("#share").onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Iron Ledger Chess", text: "Play me at chess — open this link:", url }); return; } catch { /* closed the share sheet */ } }
    v.querySelector("#copy").click();
  };
  session(v, { code, host: true, hostColor, inviteTo });
}
function joinScreen(v, code) {
  v.innerHTML = `<section class="pg"><h1 class="ilc-title">Joining ${code}</h1><p class="ilc-card__line" id="fr-state">Connecting…</p></section>`;
  session(v, { code, host: false });
}
