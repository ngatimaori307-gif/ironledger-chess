/* The board, as Iron Ledger draws it: 64 square squares in the theme's colours, his "Staunton wood" pieces, tap a piece then
   where it goes, or drag it. Legal targets show as dots; the last move and a king in check are marked; a pawn reaching the end
   asks what it becomes. The motion is Iron Ledger's (app.js Board.slide, app/board2d.js): a move slides (a knight flies an arc
   over the corner of its L) and settles with a small squash; a captured piece goes with one of Iron Ledger's capture effects
   (js/capturefx.js); a dragged piece follows the finger on the graphics chip, a third of a square above it, its landing square
   ringed. A redraw writes only the squares that changed, so the selected piece's lift animates and a running move isn't cut. */
import { ANIM_MS, MOTION } from "./config.js";
import { settings } from "./store.js";

const FILES = "abcdefgh";
const PROMO = ["q", "r", "b", "n"];
let lastDropped = null;                                   // a move dropped by hand settles where it lands (no slide back)
const NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
let fxMod = null;
const fx = () => (fxMod ||= import("./capturefx.js"));
const calm = () => settings.motion === "calm" || matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createBoard(host, { onMove, canMove }) {
  let chess = null, flipped = false, picked = null, last = null, locked = false, before = null, drag = null, dropped = false;
  host.classList.add("bd");
  host.innerHTML = "";
  const grid = document.createElement("div"); grid.className = "bd-grid"; host.append(grid);
  const promo = document.createElement("div"); promo.className = "bd-promo"; promo.hidden = true; host.append(promo);
  const squares = {}, shown = new Map();                          // square → its button; button → the markup it shows
  for (let i = 0; i < 64; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "bd-sq"; grid.append(b); }
  function order() { const out = []; for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) out.push(FILES[f] + (r + 1)); return flipped ? out.reverse() : out; }
  function pieceImg(p) { return `<img alt="" src="${window.WOOD_PIECES[p.color + p.type.toUpperCase()]}" draggable="false">`; }
  function draw() {
    const sqs = order(), targets = picked ? new Set(chess.moves({ square: picked, verbose: true }).map((m) => m.to)) : new Set();
    const checkSq = chess.inCheck() ? sqs.find((s) => { const p = chess.get(s); return p && p.type === "k" && p.color === chess.turn(); }) : null;
    [...grid.children].forEach((b, i) => {
      const s = sqs[i], p = chess.get(s), fi = FILES.indexOf(s[0]), ri = Number(s[1]) - 1;
      b.dataset.sq = s; squares[s] = b;
      const cls = `bd-sq ${(fi + ri) % 2 ? "bd-l" : "bd-d"}` + (last && (s === last.from || s === last.to) ? " bd-last" : "") +
        (s === picked ? " bd-pick" : "") + (s === checkSq ? " bd-check" : "") + (targets.has(s) ? (p ? " bd-take" : " bd-dot") : "");
      if (b.className !== cls) b.className = cls;
      const coordF = i >= 56 ? `<span class="bd-cf">${s[0]}</span>` : "", coordR = i % 8 === 0 ? `<span class="bd-cr">${s[1]}</span>` : "";
      const html = (p ? pieceImg(p) : "") + coordF + coordR;
      if (shown.get(b) !== html) { b.innerHTML = html; shown.set(b, html); }   // only the squares that changed
      b.setAttribute("aria-label", `${s}${p ? " " + (p.color === "w" ? "white " : "black ") + NAMES[p.type] : ""}`);
    });
  }
  function centre(s) { const r = squares[s].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; }
  /* The move just made, slid from where it came from; what it took goes with an effect. */
  function animate(mv, prev) {
    if (calm() || !mv) return;
    const img = squares[mv.to] && squares[mv.to].querySelector("img"); if (!img || !img.animate) return;
    const [fx0, fy0] = centre(mv.from), [tx, ty] = centre(mv.to), dx = fx0 - tx, dy = fy0 - ty, ms = MOTION.moveMs, slide = !mv.dropped;
    let frames;
    if (mv.piece === "n") {                                         // the knight's arc over the corner of its L (a quadratic Bézier)
      const cx = Math.abs(dx) > Math.abs(dy) ? 0 : dx, cy = Math.abs(dx) > Math.abs(dy) ? dy : 0;
      frames = Array.from({ length: MOTION.knightSteps + 1 }, (_, i) => { const u = i / MOTION.knightSteps, w = 1 - u, up = Math.sin(Math.PI * u);
        return { offset: u * MOTION.landAt, transform: `translate(${(w * w * dx + 2 * w * u * cx).toFixed(1)}px, ${(w * w * dy + 2 * w * u * cy).toFixed(1)}px) scale(${(1 + 0.12 * up).toFixed(3)})` }; });
    } else frames = [{ offset: 0, transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { offset: MOTION.landAt, transform: "none" }];
    frames.push({ offset: MOTION.landAt + (1 - MOTION.landAt) / 2, transform: `scale(${1 + MOTION.landStretch}, ${1 - MOTION.landSquash})` }, { offset: 1, transform: "none" });
    if (!slide) frames = [{ offset: 0, transform: "none" }, ...frames.slice(-2)];   // dropped by hand: it only settles
    img.style.zIndex = 5; img.style.transformOrigin = "50% 90%";
    img.animate(frames, { duration: ms / MOTION.landAt, easing: MOTION.ease }).finished.then(() => { img.style.zIndex = ""; }, () => {});
    const at = mv.flags.includes("e") ? mv.to[0] + mv.from[1] : mv.to, taken = mv.captured && prev ? prev.get(at) : null;
    if (taken && settings.captureFx !== "off") {
      const cell = squares[at], len = Math.hypot(tx - fx0, ty - fy0) || 1;
      fx().then((m) => m.play(m.pick(settings.captureFx || MOTION.captureFx), cell, pieceImg(taken), ms, [(tx - fx0) / len, (ty - fy0) / len])).catch(() => {});
    }
  }
  function tap(s) {
    if (locked || !chess || !canMove()) return;
    const p = chess.get(s);
    if (picked) {
      const moves = chess.moves({ square: picked, verbose: true }).filter((m) => m.to === s);
      if (moves.length) {
        if (moves.length > 1 || moves[0].promotion) return askPromotion(picked, s);
        const from = picked; picked = null; lastDropped = dropped ? from : null; onMove({ from, to: s }); return;
      }
    }
    picked = p && p.color === chess.turn() && chess.moves({ square: s }).length ? s : null; draw();
  }
  function askPromotion(from, to) {
    const color = chess.turn();
    promo.innerHTML = `<p>Your pawn becomes</p><div>${PROMO.map((t) => `<button type="button" data-p="${t}">${pieceImg({ color, type: t })}<span>${NAMES[t]}</span></button>`).join("")}</div>`;
    promo.hidden = false;
    promo.onclick = (e) => { const b = e.target.closest("[data-p]"); if (!b) return; promo.hidden = true; picked = null; onMove({ from, to, promotion: b.dataset.p }); };
  }
  /* Drag (Iron Ledger's app/board2d.js): the piece follows the finger once a frame; the square it would land on is ringed. */
  const at = (x, y) => { const el = document.elementFromPoint(x, y); const b = el && el.closest && el.closest(".bd-sq"); return b && grid.contains(b) ? b.dataset.sq : null; };
  function paintDrag() {
    drag.raf = 0; if (!drag.ghost) return;
    drag.ghost.style.transform = `translate3d(${(drag.x - drag.size / 2).toFixed(1)}px, ${(drag.y - drag.size / 2 - drag.lift).toFixed(1)}px, 0) scale(${MOTION.dragScale})`;
    drag.ghost.style.visibility = "hidden"; const s = at(drag.x, drag.y); drag.ghost.style.visibility = "";
    if (s !== drag.over) { if (drag.over) squares[drag.over].classList.remove("bd-over"); drag.over = s; if (s) squares[s].classList.add("bd-over"); }
  }
  grid.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".bd-sq"); if (!b || locked || !chess || !canMove()) return;
    const p = chess.get(b.dataset.sq);
    drag = { from: b.dataset.sq, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, mine: !!(p && p.color === chess.turn()), on: false, pointer: e.pointerType };
    if (drag.mine) grid.setPointerCapture(e.pointerId);
  });
  grid.addEventListener("pointermove", (e) => {
    if (!drag || !drag.mine) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.on && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > MOTION.dragStartPx) {
      const img = squares[drag.from].querySelector("img"); if (!img) return;
      if (picked !== drag.from) { picked = drag.from; draw(); }
      const size = squares[drag.from].getBoundingClientRect().width, g = img.cloneNode(true);
      g.className = "bd-ghost"; g.style.width = g.style.height = size + "px"; document.body.append(g);
      squares[drag.from].querySelector("img").classList.add("bd-lifted");
      Object.assign(drag, { on: true, ghost: g, size, lift: drag.pointer === "touch" ? size * MOTION.dragLiftTouch : 0 });
    }
    if (drag.on && !drag.raf) drag.raf = requestAnimationFrame(paintDrag);
  });
  const endDrag = (e, cancel) => {
    const d = drag; drag = null; if (!d) return;
    if (!d.on) { if (!cancel) tap(at(e.clientX, e.clientY) || d.from); return; }
    if (d.raf) cancelAnimationFrame(d.raf); if (d.over) squares[d.over].classList.remove("bd-over"); d.ghost.remove();
    const lifted = squares[d.from] && squares[d.from].querySelector("img"); if (lifted) lifted.classList.remove("bd-lifted");
    const to = cancel ? null : at(e.clientX, e.clientY);
    if (to && to !== d.from) { picked = d.from; dropped = true; tap(to); dropped = false; } else { picked = null; draw(); }
  };
  grid.addEventListener("pointerup", (e) => endDrag(e, false));
  grid.addEventListener("pointercancel", (e) => endDrag(e, true));
  grid.addEventListener("click", (e) => { if (e.detail === 0) { const b = e.target.closest(".bd-sq"); if (b) tap(b.dataset.sq); } });   // the keyboard's Enter / Space
  return {
    set(c, { lastMove = null, flip = flipped } = {}) {
      const moved = lastMove && before && last !== lastMove && c.history().length === before.n + 1;
      const prev = moved ? before : null;
      chess = c; last = lastMove; flipped = flip; picked = null; draw();
      if (moved) animate({ ...lastMove, dropped: lastMove.from === lastDropped }, prev);
      const snap = {}; c.board().forEach((row) => row.forEach((p) => { if (p) snap[p.square] = p; }));
      before = { n: c.history().length, get: (s) => snap[s] || null };   // what stood where, for the next move's capture effect
    },
    lock(on) { locked = on; host.toggleAttribute("data-locked", on); },
    flash(sq) { const b = squares[sq]; if (!b) return; b.classList.add("bd-flash"); setTimeout(() => b.classList.remove("bd-flash"), ANIM_MS * 3); },
  };
}
