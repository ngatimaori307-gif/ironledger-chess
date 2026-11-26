/* The board, as Iron Ledger draws it: 64 square squares in the theme's colours, his "Staunton wood" pieces, tap a piece then
   where it goes, or drag it. Legal targets show as dots; the last move and a king in check are marked; a pawn reaching the end
   asks what it becomes. The motion is Iron Ledger's (app.js Board.slide, app/board2d.js): a move slides (a knight flies an arc
   over the corner of its L) and settles with a small squash; a captured piece goes with one of Iron Ledger's capture effects
   (js/capturefx.js); a dragged piece follows the finger on the graphics chip, a third of a square above it, its landing square
   ringed. A redraw writes only the squares that changed, so the selected piece's lift animates and a running move isn't cut. */
import { ANIM_MS, MOTION } from "./config.js";
import { settings } from "./store.js";
import { pieceSrc } from "./looks.js";
import * as A from "./arrows.js";
import { pairs as tensionPairs, TENSION } from "./tension.js";
import { attach as attachZoom } from "./flatzoom.js";

const FILES = "abcdefgh";
const PROMO = ["q", "r", "b", "n"];
const ARROW_W = 0.15;                                      // your arrows' width, in squares (Iron Ledger's usr arrows)
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
  /* 1.10.0 (Iron Ledger's ✎ Draw and ◫ layers): a picture layer over the squares — your arrows and circles, kept per position
     while the game is open, and the Tension threads. It never takes a tap: the squares underneath still do. */
  const marks = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  marks.setAttribute("class", "bd-marks"); marks.setAttribute("viewBox", "0 0 8 8"); marks.setAttribute("aria-hidden", "true"); host.append(marks);
  const notes = new Map();                                        // position → { arrows: ["e2e4", "g1f3~2"], circles: ["e4~1"] }
  let drawing = false, ink = 0, drawFrom = null;
  /* 1.11.0: the 3D view (js/board3d.js, loaded only when chosen). It draws what this board holds; its taps come back here. */
  let view3d = null, slide = null, now = { targets: new Set(), checkSq: null };
  function start3d() {
    if (view3d || settings.boardView !== "3d") return;
    import("./board3d.js").then((m) => {
      if (view3d || settings.boardView !== "3d" || !host.isConnected) return;
      view3d = m.create3d(host, {
        room: settings.room3d || "off", veneer: settings.board === "lacquer", alive: settings.room3dLife !== false && !calm(),   // 1.16.0
        onDown: (sq) => { if (drawing) drawFrom = sq; },
        onSquare: (from, to) => {
          if (drawing) { drawFrom = null; if (to) mark(from, to); return; }
          if (!to || locked || !chess || !canMove()) return;
          if (from === to) { tap(to); return; }
          const p = chess.get(from); if (p && p.color === chess.turn()) { picked = from; tap(to); }   // a drag on the 3D board
        },
      });
      if (!view3d) { host.dataset.no3d = "1"; return; }                 // no 3D graphics on this phone: the flat board stays
      host.setAttribute("data-3d", "");
      view3d.onLost = () => { const v = view3d; view3d = null; host.removeAttribute("data-3d"); host.dataset.no3d = "lost"; v.destroy(); if (chess) draw(); };
      if (chess) draw();
    }).catch(() => { host.dataset.no3d = "1"; });
  }
  function sync3d() {
    if (!view3d || !chess) return;
    const occupied = new Set(); chess.board().forEach((row) => row.forEach((p) => { if (p) occupied.add(p.square); }));
    view3d.update({ board: chess.board(), last, picked, targets: now.targets, occupied, checkSq: now.checkSq, flipped, moved: slide, marks: marks.innerHTML });
  }
  const squares = {}, shown = new Map();                          // square → its button; button → the markup it shows
  for (let i = 0; i < 64; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "bd-sq"; grid.append(b); }
  function order() { const out = []; for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) out.push(FILES[f] + (r + 1)); return flipped ? out.reverse() : out; }
  function pieceImg(p) { return `<img alt="" src="${pieceSrc(p.color + p.type.toUpperCase())}" draggable="false">`; }   // v1.7: the chosen set (js/looks.js)
  function draw() {
    const sqs = order(), targets = picked ? new Set(chess.moves({ square: picked, verbose: true }).map((m) => m.to)) : new Set();
    const checkSq = chess.inCheck() ? sqs.find((s) => { const p = chess.get(s); return p && p.type === "k" && p.color === chess.turn(); }) : null;
    now = { targets, checkSq };
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
    paintMarks();
  }
  const posKey = () => chess.fen().split(" ").slice(0, 4).join(" ");
  const note = () => { const k = posKey(); if (!notes.has(k)) notes.set(k, { arrows: [], circles: [] }); return notes.get(k); };
  function xy(s) { const f = FILES.indexOf(s[0]), r = Number(s[1]) - 1; return flipped ? [7 - f + 0.5, r + 0.5] : [f + 0.5, 7 - r + 0.5]; }
  function knightCorner(a, b) { const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]); return (dx === 1 && dy === 2) || (dx === 2 && dy === 1) ? (dx > dy ? [b[0], a[1]] : [a[0], b[1]]) : null; }
  function arrow(from, to, cls) { const a = xy(from), b = xy(to); return A.svg(a[0], a[1], b[0], b[1], cls, ARROW_W, knightCorner(a, b)); }
  const number = (sq, n, cls) => { const [x, y] = xy(sq); return `<circle cx="${x + 0.3}" cy="${y - 0.3}" r="0.17" class="${cls}-dot"/><text x="${x + 0.3}" y="${y - 0.3}" class="bd-num">${n}</text>`; };
  function thread(from, to, loses) {                              // a Tension thread: a bent line with a small head, white and trembling when lost
    const a = xy(from), b = xy(to), dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const cx = (a[0] + b[0]) / 2 - (dy / len) * TENSION.bend * len * 0.5, cy = (a[1] + b[1]) / 2 + (dx / len) * TENSION.bend * len * 0.5;
    const w = loses ? TENSION.wLosing + TENSION.wPerPawn * Math.min(loses, 9) : TENSION.wSafe, col = loses ? TENSION.losing : TENSION.safe;
    const ex = b[0] - cx, ey = b[1] - cy, el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el, h = 0.16 + w, bx = b[0] - ux * 0.3, by = b[1] - uy * 0.3;
    const head = `M${(bx + ux * h).toFixed(3)},${(by + uy * h).toFixed(3)}L${(bx - uy * h * 0.6).toFixed(3)},${(by + ux * h * 0.6).toFixed(3)}L${(bx + uy * h * 0.6).toFixed(3)},${(by - ux * h * 0.6).toFixed(3)}Z`;
    const j = loses ? Math.min(TENSION.jitterMax, TENSION.jitterPerPawn * loses) : 0;
    return `<g class="bd-thread${j ? " bd-tremble" : ""}" style="--j:${j}"><path d="M${a[0]},${a[1]}Q${cx.toFixed(3)},${cy.toFixed(3)} ${bx.toFixed(3)},${by.toFixed(3)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/><path d="${head}" fill="${col}"/></g>`;
  }
  function paintMarks() {
    if (!chess) { marks.innerHTML = ""; return; }
    let out = "";
    if (settings.layerTension) {
      const ps = tensionPairs(chess), lost = new Set();
      for (const [a, t, l] of ps) { out += thread(a, t, l); if (l) lost.add(t); }
      for (const t of lost) { const [x, y] = xy(t); out += `<circle class="bd-lost" cx="${x}" cy="${y}" r="${TENSION.ringR}" fill="none" stroke="${TENSION.losing}" stroke-width="0.05"/>`; }
    }
    const n = notes.get(posKey());
    if (n) {
      for (const c of n.circles) { const [x, y] = xy(c.slice(0, 2)); out += `<circle class="${A.kind(c)}-ring" cx="${x}" cy="${y}" r="0.44" fill="none" stroke-width="0.07"/>`; }
      out += A.mine(n.arrows, arrow, number);
    }
    marks.innerHTML = out;
    sync3d();
  }
  function mark(from, to) {                                       // a tap circles a square; a drag draws an arrow; the same again removes it, another ink recolours it
    const n = note(), id = (to === from ? from : from + to), tag = id + (ink ? "~" + ink : ""), list = to === from ? n.circles : n.arrows;
    const i = list.findIndex((x) => x.split("~")[0] === id);
    if (i >= 0) { const same = list[i] === tag; list.splice(i, 1); if (!same) list.push(tag); } else list.push(tag);
    paintMarks();
  }
  function centre(s) { const r = squares[s].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; }
  /* The move just made, slid from where it came from; what it took goes with an effect. */
  function animate(mv, prev) {
    if (calm() || !mv || view3d) return;                            // the 3D view slides its own pieces
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
    if (drawing) { const b = e.target.closest(".bd-sq"); if (b && chess) { drawFrom = b.dataset.sq; grid.setPointerCapture(e.pointerId); } return; }
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
  grid.addEventListener("pointerup", (e) => {
    if (drawFrom) { const from = drawFrom, to = at(e.clientX, e.clientY); drawFrom = null; if (to) mark(from, to); return; }
    endDrag(e, false);
  });
  grid.addEventListener("pointercancel", (e) => { drawFrom = null; endDrag(e, true); });
  grid.addEventListener("click", (e) => { if (e.detail === 0 && !drawing) { const b = e.target.closest(".bd-sq"); if (b) tap(b.dataset.sq); } });   // the keyboard's Enter / Space
  /* 1.15.0: two fingers zoom the flat board (js/flatzoom.js = Iron Ledger v8.29); a second finger turns a started move into the pinch. */
  attachZoom({ el: grid, cancelTouch() {
    const d = drag; drag = null; drawFrom = null; if (!d) return;
    if (d.raf) cancelAnimationFrame(d.raf); if (d.over) squares[d.over].classList.remove("bd-over"); if (d.ghost) d.ghost.remove();
    const lifted = squares[d.from] && squares[d.from].querySelector("img"); if (lifted) lifted.classList.remove("bd-lifted"); picked = null; if (chess) draw();
  } });
  return {
    set(c, { lastMove = null, flip = flipped } = {}) {
      const moved = lastMove && before && last !== lastMove && c.history().length === before.n + 1;
      const prev = moved ? before : null;
      chess = c; last = lastMove; flipped = flip; picked = null; slide = moved ? lastMove : null; draw(); slide = null; start3d();
      if (moved) animate({ ...lastMove, dropped: lastMove.from === lastDropped }, prev);
      const snap = {}; c.board().forEach((row) => row.forEach((p) => { if (p) snap[p.square] = p; }));
      before = { n: c.history().length, get: (s) => snap[s] || null };   // what stood where, for the next move's capture effect
    },
    lock(on) { locked = on; host.toggleAttribute("data-locked", on); },
    draw(on) { drawing = !!on; drawFrom = null; host.toggleAttribute("data-drawing", drawing); if (drawing) { picked = null; if (chess) draw(); } return drawing; },
    ink(k) { if (k != null) ink = ((k % A.INKS) + A.INKS) % A.INKS; return ink; },
    clearMarks() { if (chess) notes.delete(posKey()); paintMarks(); },
    marks() { const n = chess && notes.get(posKey()); return n ? { arrows: [...n.arrows], circles: [...n.circles] } : { arrows: [], circles: [] }; },
    layers() { paintMarks(); },
    view3d() { return view3d ? "3d" : host.dataset.no3d ? "flat (" + host.dataset.no3d + ")" : "flat"; },
    flash(sq) { const b = squares[sq]; if (!b) return; b.classList.add("bd-flash"); setTimeout(() => b.classList.remove("bd-flash"), ANIM_MS * 3); },
  };
}
