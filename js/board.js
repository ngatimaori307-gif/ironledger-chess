/* The board: 64 squares in the theme's own colours, his "Staunton wood" pieces, tap a piece then tap where it goes.
   Legal targets show as dots; the last move and a king in check are marked; a pawn reaching the end asks what it becomes. */
import { ANIM_MS } from "./config.js";

const FILES = "abcdefgh";
const PROMO = ["q", "r", "b", "n"];

export function createBoard(host, { onMove, canMove }) {
  let chess = null, flipped = false, picked = null, last = null, locked = false;
  host.classList.add("bd");
  host.innerHTML = "";
  const grid = document.createElement("div"); grid.className = "bd-grid"; host.append(grid);
  const promo = document.createElement("div"); promo.className = "bd-promo"; promo.hidden = true; host.append(promo);
  const squares = {};
  for (let i = 0; i < 64; i++) {
    const b = document.createElement("button"); b.type = "button"; b.className = "bd-sq"; grid.append(b);
    b.addEventListener("click", () => tap(b.dataset.sq));
  }
  function order() { const out = []; for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) out.push(FILES[f] + (r + 1)); return flipped ? out.reverse() : out; }
  function pieceImg(p) { return `<img alt="" src="${window.WOOD_PIECES[p.color + p.type.toUpperCase()]}" draggable="false">`; }
  function draw() {
    const sqs = order(), targets = picked ? new Set(chess.moves({ square: picked, verbose: true }).map((m) => m.to)) : new Set();
    const checkSq = chess.inCheck() ? sqs.find((s) => { const p = chess.get(s); return p && p.type === "k" && p.color === chess.turn(); }) : null;
    [...grid.children].forEach((b, i) => {
      const s = sqs[i], p = chess.get(s), fi = FILES.indexOf(s[0]), ri = Number(s[1]) - 1;
      b.dataset.sq = s; squares[s] = b;
      b.className = `bd-sq ${(fi + ri) % 2 ? "bd-l" : "bd-d"}` + (last && (s === last.from || s === last.to) ? " bd-last" : "") +
        (s === picked ? " bd-pick" : "") + (s === checkSq ? " bd-check" : "") + (targets.has(s) ? (p ? " bd-take" : " bd-dot") : "");
      const coordF = i >= 56 ? `<span class="bd-cf">${s[0]}</span>` : "", coordR = i % 8 === 0 ? `<span class="bd-cr">${s[1]}</span>` : "";
      b.innerHTML = (p ? pieceImg(p) : "") + coordF + coordR;
      b.setAttribute("aria-label", `${s}${p ? " " + (p.color === "w" ? "white " : "black ") + NAMES[p.type] : ""}`);
    });
  }
  const NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
  function tap(s) {
    if (locked || !chess || !canMove()) return;
    const p = chess.get(s);
    if (picked) {
      const moves = chess.moves({ square: picked, verbose: true }).filter((m) => m.to === s);
      if (moves.length) {
        if (moves.length > 1 || moves[0].promotion) return askPromotion(picked, s);
        const from = picked; picked = null; onMove({ from, to: s }); return;
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
  return {
    set(c, { lastMove = null, flip = flipped } = {}) { chess = c; last = lastMove; flipped = flip; picked = null; draw(); },
    lock(on) { locked = on; host.toggleAttribute("data-locked", on); },
    flash(sq) { const b = squares[sq]; if (!b) return; b.classList.add("bd-flash"); setTimeout(() => b.classList.remove("bd-flash"), ANIM_MS * 3); },
  };
}
