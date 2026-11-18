/* v6.99 capture effects on the flat board (his attachment of 18 Oct: knocked over, Voronoi shatter, dither / ash dissolve,
   holographic, black hole). Each works on copies of the captured piece's picture laid over its square, animated by the
   browser (Web Animations), and removed when done. */
export const KINDS = ["topple", "shatter", "dissolve", "holo", "vortex"];
export const FX2D = {
  lengths: { fade: 1.3, topple: 3.0, shatter: 3.2, dissolve: 3.4, holo: 2.8, vortex: 3.2 },   // × the move's own time
  minMs: 480, maxMs: 2200,
  shards: 7, shardFly: 0.9, shardFall: 0.7,            // shatter: Voronoi cells of the square; how far they fly and fall (squares)
  grid: 6, ashRise: 0.35,                              // dissolve: a grid of cells, each gone at its own moment
  holoColour: "#55E8FF",
};
export const pick = (kind) => (kind === "random" ? KINDS[Math.floor(Math.random() * KINDS.length)] : kind);
const lengthOf = (kind, ms) => KINDS.includes(kind) ? Math.min(FX2D.maxMs, Math.max(FX2D.minMs, (ms || 160) * FX2D.lengths[kind])) : (ms || 160) * FX2D.lengths.fade;   // fade: as before
function copyOf(html, cell, z = 4) {
  const holder = document.createElement("span"); holder.innerHTML = html; const g = holder.firstChild;
  g.style.position = "absolute"; g.style.zIndex = z; g.style.pointerEvents = "none"; cell.appendChild(g); return g;
}
const gone = (anims, els) => Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => els.forEach((e) => e.remove()));

/* Voronoi cells of the unit square for these seeds: each the square cut by the half-planes nearer its seed (polygons, 0–1). */
export function voronoi(seeds) {
  return seeds.map((s, i) => {
    let poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
    seeds.forEach((o, j) => {
      if (j === i) return;
      const nx = o[0] - s[0], ny = o[1] - s[1], c = (o[0] * o[0] + o[1] * o[1] - s[0] * s[0] - s[1] * s[1]) / 2;   // keep points with p·n <= c
      const inside = (p) => p[0] * nx + p[1] * ny <= c + 1e-9, out = [];
      poly.forEach((p, k) => {
        const q = poly[(k + 1) % poly.length], pi = inside(p), qi = inside(q);
        if (pi) out.push(p);
        if (pi !== qi) { const dp = p[0] * nx + p[1] * ny - c, dq = q[0] * nx + q[1] * ny - c, t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      });
      poly = out;
    });
    return poly;
  }).filter((p) => p.length >= 3);
}

/* play(kind, cell, html, ms, away): cell — the captured square's element; html — the piece's picture; away — [x, y], the
   direction from the capturing piece to it on screen. Returns a promise that settles when the copies are gone. */
export function play(kind, cell, html, ms, away = [0, -1]) {
  const total = lengthOf(kind, ms), [ax, ay] = away, sx = ax >= 0 ? 1 : -1;
  if (kind === "topple") {                                    // knocked over, away from the capturer, then gone
    const g = copyOf(html, cell); g.style.transformOrigin = `${50 + sx * 35}% 92%`;
    const a = g.animate([{ transform: "rotate(0deg)", opacity: 1 }, { offset: 0.5, transform: `rotate(${sx * 88}deg)`, opacity: 1, easing: "ease-out" },
      { offset: 0.58, transform: `rotate(${sx * 80}deg)`, opacity: 1 }, { offset: 0.66, transform: `rotate(${sx * 90}deg)`, opacity: 1 },
      { transform: `translate(${sx * 25}%, 30%) rotate(${sx * 90}deg)`, opacity: 0 }], { duration: total, easing: "cubic-bezier(.55,0,1,.45)" });
    return gone([a], [g]);
  }
  if (kind === "shatter") {                                   // the picture cut into Voronoi cells that fly apart and fall
    const seeds = Array.from({ length: FX2D.shards }, () => [0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7]), anims = [], els = [];
    for (const poly of voronoi(seeds)) {
      const g = copyOf(html, cell); g.style.clipPath = `polygon(${poly.map(([x, y]) => `${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%`).join(", ")})`;
      const cx = poly.reduce((t, p) => t + p[0], 0) / poly.length - 0.5, cy = poly.reduce((t, p) => t + p[1], 0) / poly.length - 0.5;
      const fx = (cx * 2 + ax * 0.6) * FX2D.shardFly * 100, fy = (cy * 2 + ay * 0.6) * FX2D.shardFly * 100, spin = (Math.random() - 0.5) * 540;
      anims.push(g.animate([{ transform: "translate(0,0) rotate(0deg)", opacity: 1 }, { offset: 0.35, transform: `translate(${fx * 0.6}%, ${fy * 0.6 - 30}%) rotate(${spin * 0.4}deg)`, opacity: 1 },
        { transform: `translate(${fx}%, ${fy + FX2D.shardFall * 100}%) rotate(${spin}deg)`, opacity: 0 }], { duration: total * (0.8 + Math.random() * 0.2), easing: "cubic-bezier(.2,.6,.6,1)" }));
      els.push(g);
    }
    return gone(anims, els);
  }
  if (kind === "dissolve") {                                  // ash: the picture breaks into a grid of cells, each greying and drifting up
    const n = FX2D.grid, anims = [], els = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const g = copyOf(html, cell); g.style.clipPath = `inset(${(r * 100 / n).toFixed(2)}% ${(100 - (c + 1) * 100 / n).toFixed(2)}% ${(100 - (r + 1) * 100 / n).toFixed(2)}% ${(c * 100 / n).toFixed(2)}%)`;
      const delay = ((r / n) * 0.55 + Math.random() * 0.3) * total * 0.6, life = total - delay;
      anims.push(g.animate([{ transform: "translate(0,0)", opacity: 1, filter: "none" }, { offset: 0.25, filter: "sepia(1) saturate(4) hue-rotate(-20deg) brightness(1.4)", opacity: 1 },
        { transform: `translate(${ax * 15 + (Math.random() - 0.5) * 20}%, ${-FX2D.ashRise * 100}%)`, opacity: 0, filter: "grayscale(1) brightness(.6)" }],
        { duration: life, delay, easing: "ease-in", fill: "backwards" }));
      els.push(g);
    }
    return gone(anims, els);
  }
  if (kind === "holo") {                                      // a hologram: cyan light, flickering, drawn upward
    const g = copyOf(html, cell); g.style.transformOrigin = "50% 100%";
    const glow = `drop-shadow(0 0 4px ${FX2D.holoColour}) brightness(1.5) sepia(1) hue-rotate(150deg) saturate(5)`;
    const a = g.animate([{ transform: "scale(1,1)", opacity: 1, filter: "none" }, { offset: 0.12, opacity: 0.9, filter: glow }, { offset: 0.2, opacity: 0.35, filter: glow },
      { offset: 0.28, opacity: 0.85, filter: glow }, { offset: 0.4, opacity: 0.4, filter: glow }, { offset: 0.5, opacity: 0.8, filter: glow },
      { transform: "translateY(-35%) scale(0.2, 1.7)", opacity: 0, filter: glow }], { duration: total, easing: "ease-in" });
    return gone([a], [g]);
  }
  if (kind === "vortex") {                                    // a black hole opens on the square; the piece spirals in
    const hole = document.createElement("span"); hole.className = "fx-hole"; hole.style.zIndex = 3; cell.appendChild(hole);
    const g = copyOf(html, cell);
    const h = hole.animate([{ transform: "scale(0) rotate(0deg)", opacity: 0 }, { offset: 0.15, transform: "scale(1) rotate(120deg)", opacity: 1 },
      { offset: 0.85, transform: "scale(1) rotate(600deg)", opacity: 1 }, { transform: "scale(0) rotate(720deg)", opacity: 0 }], { duration: total, easing: "linear" });
    const a = g.animate([{ transform: "rotate(0deg) scale(1)", filter: "none", opacity: 1 }, { offset: 0.15, transform: "rotate(30deg) scale(1)" },
      { offset: 0.8, transform: "rotate(900deg) scale(0.05)", filter: "blur(1px) brightness(.4)", opacity: 1 }, { transform: "rotate(1080deg) scale(0)", opacity: 0 }],
      { duration: total, easing: "cubic-bezier(.5,0,.8,.4)" });
    return gone([a, h], [g, hole]);
  }
  const g = copyOf(html, cell);                               // fade (the old way)
  const a = g.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.6)" }], { duration: total, easing: "ease-in" });
  return gone([a], [g]);
}
