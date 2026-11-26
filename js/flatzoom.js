/* 1.15.0 — Iron Ledger v8.29's pinch and zoom on the flat board (app/flatzoom.js, unchanged but for this note).
   His word 25 Nov 12:48: "the pinch and zoom wasnt working after using it, i left app came back an hour later and tried it didnt work at
   all". His screenshots of 23 Nov 09:13–09:16 show the flat board with 3D chosen: after the phone takes the 3D graphics the app keeps the
   flat board for the rest of the sitting (board3d.js flatInstead), and the flat board had no zoom at all.
   Two fingers zoom (FLATZOOM.min–max) round the point between them and move the view with them; one finger still plays moves (a tap's
   square is read from the zoomed board's own box, app.js squareAt). Back to the whole board when pinched below FLATZOOM.snap (a new screen
   makes a new board, whole). The board's row clips the zoomed board so nothing else on the screen is covered. */
export const FLATZOOM = { min: 1, max: 3, snap: 1.04 };

export function attach(board) {
  const el = board.el; if (!el || el.dataset.flatzoom) return board.fz; el.dataset.flatzoom = "1";
  const row = el.parentNode;
  const pts = new Map(); let z = 1, tx = 0, ty = 0, start = null;
  const apply = () => {
    const on = z > 1;
    el.style.transformOrigin = "0 0"; el.style.transform = on ? `translate(${tx}px, ${ty}px) scale(${z})` : "";
    if (row && row.classList) row.classList.toggle("fz-on", on);
    el.classList.toggle("fz-zoomed", on);
  };
  const clampT = () => {                                     // the board's edges never come inside its own box
    const w = el.offsetWidth, h = el.offsetHeight;
    tx = Math.min(0, Math.max(w * (1 - z), tx)); ty = Math.min(0, Math.max(h * (1 - z), ty));
  };
  const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; };
  const reset = () => { pts.clear(); start = null; };
  const down = (e) => {
    if (e.pointerType === "mouse") return;
    if (e.isPrimary && pts.size) reset();                    // a new touch: whatever was left is stale (the 3D board's fault, v8.29)
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      if (board.cancelTouch) board.cancelTouch();            // the first finger was about to play a move: it is a pinch now
      const r = el.getBoundingClientRect(), base = { x: r.left - tx, y: r.top - ty }, t = two();
      start = { d: t.d, z, base, c: { x: (t.m.x - base.x - tx) / z, y: (t.m.y - base.y - ty) / z } };   // the board point under the fingers
    }
  };
  const move = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!start || pts.size < 2) return;
    const t = two(); z = Math.min(FLATZOOM.max, Math.max(FLATZOOM.min, start.z * t.d / start.d));
    tx = t.m.x - start.base.x - start.c.x * z; ty = t.m.y - start.base.y - start.c.y * z; clampT(); apply();
  };
  const up = (e) => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size < 2 && start) { start = null; if (z < FLATZOOM.snap) { z = 1; tx = 0; ty = 0; apply(); } }
  };
  el.addEventListener("pointerdown", down, true);            // before the board's own handler, so a second finger is known first
  el.addEventListener("pointermove", move, true);
  for (const k of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(k, up, true);
  document.addEventListener("visibilitychange", reset);
  const fz = {
    busy: () => pts.size >= 2 || !!start,
    zoom: () => z,
    whole: () => { z = 1; tx = 0; ty = 0; reset(); apply(); },
  };
  board.fz = fz; return fz;
}
