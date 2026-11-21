/* 1.11.0 — the 3D board, Iron Ledger's (app/board3d.js, by the developer of Iron Ledger), made for a phone's browser tab.
   The pieces are turned on a lathe from Iron Ledger's own outlines (PROFILES, KNIGHT_HEAD — unchanged), with a carved knight's
   head, on a board of drawn wood in the theme's square colours, framed and raised, under a key and a fill light. No model files:
   it is light enough for an iPhone. Loaded only when Me → Board view is 3D.
   The flat board underneath keeps every rule (js/board.js): this view draws its position, and a tap on the 3D board is turned
   into a square by casting a ray onto the board. Your arrows and the Tension threads lie flat on the board. If the phone takes
   the 3D graphics away, the flat board comes back by itself. Frames are drawn only when something changed. */
import * as THREE from "../vendor/three/three.module.min.js";

/* Iron Ledger's own numbers (board3d.js): */
const PROFILES = {
  p: [[0, 0], [.33, 0], [.33, .05], [.29, .08], [.24, .1], [.2, .13], [.15, .2], [.12, .3], [.11, .36], [.18, .39], [.18, .41], [.11, .44], [.13, .47], [.16, .53], [.165, .58], [.15, .64], [.11, .69], [.06, .715], [0, .72]],
  r: [[0, 0], [.37, 0], [.37, .05], [.32, .09], [.26, .12], [.22, .17], [.2, .3], [.19, .5], [.21, .56], [.26, .6], [.26, .62], [.23, .64], [.25, .66], [.26, .8], [.2, .8], [.19, .72], [0, .72]],
  b: [[0, 0], [.35, 0], [.35, .05], [.3, .09], [.23, .12], [.18, .17], [.14, .32], [.12, .48], [.2, .52], [.2, .54], [.12, .57], [.15, .62], [.19, .7], [.2, .78], [.17, .88], [.1, .95], [.05, .99], [.07, 1.02], [.06, 1.06], [0, 1.08]],
  q: [[0, 0], [.39, 0], [.39, .05], [.33, .09], [.25, .13], [.2, .18], [.15, .4], [.12, .62], [.22, .66], [.22, .68], [.13, .72], [.17, .78], [.22, .9], [.25, .98], [.2, .98], [.12, .99], [.09, 1.03], [0, 1.04]],
  k: [[0, 0], [.39, 0], [.39, .05], [.33, .09], [.25, .13], [.2, .18], [.16, .42], [.13, .66], [.23, .7], [.23, .72], [.14, .76], [.18, .84], [.22, .96], [.2, 1], [.13, 1.03], [.08, 1.06], [0, 1.07]],
  nBase: [[0, 0], [.35, 0], [.35, .05], [.3, .09], [.23, .12], [.2, .16], [.2, .21], [0, .21]],
};
const KNIGHT_HEAD = [[-.19, 0], [.17, 0], [.15, .07], [.1, .16], [.11, .25], [.17, .31], [.26, .36], [.33, .4], [.37, .45], [.38, .5],
  [.35, .54], [.29, .56], [.22, .55], [.16, .57], [.12, .62], [.1, .69], [.08, .76], [.05, .8], [.02, .77], [0, .72],
  [-.03, .77], [-.06, .74], [-.09, .69], [-.13, .64], [-.18, .58], [-.22, .5], [-.24, .41], [-.25, .31], [-.24, .2], [-.21, .09]];
const KNIGHT_SHAPE = { depth: .12, bevelThickness: .085, bevelSize: .06, bevelSegments: 5, curveSegments: 18 };
const KNIGHT_TURN = 0.95;                       // knights turned this far from straight ahead, to show the profile
const SEGMENTS = 32, PROFILE_POINTS = 32;
const PIECE = { w: { colour: 0xE8CB96 }, b: { colour: 0x5E4232 } };
const FRAME = { colour: 0x4B2E1B, width: 0.55, depth: 0.35 };   // the frame around the squares, and the board's thickness (squares)
const LIFT = 0.45, SLIDE_MS = 260;               // how high a moving piece rises (squares), and how long a move takes
const CAMERA = { fov: 34, elevation: 52 * Math.PI / 180, margin: 1.06 };
const PIXEL_RATIO_MAX = 1.5;                     // sharp enough on a phone, and far less work per frame than 3
const TEX = 1024;                                // the board picture's side, in pixels
const MARK = { pick: "rgba(201,162,77,.6)", last: "rgba(201,162,77,.38)", check: "rgba(214,72,52,.75)", dot: "rgba(20,20,20,.35)" };

const geos = new Map();
function lathe(t) {
  if (geos.has(t)) return geos.get(t);
  const pts = new THREE.SplineCurve(PROFILES[t].map(([r, h]) => new THREE.Vector2(r, h))).getPoints(PROFILE_POINTS)
    .map((v) => new THREE.Vector2(Math.max(0, v.x), v.y));
  const g = new THREE.LatheGeometry(pts, SEGMENTS); g.computeVertexNormals(); geos.set(t, g); return g;
}
function knightHead() {
  if (geos.has("nHead")) return geos.get("nHead");
  const s = new THREE.Shape(KNIGHT_HEAD.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, KNIGHT_SHAPE); g.translate(0, PROFILES.nBase.at(-1)[1] - 0.02, -KNIGHT_SHAPE.depth / 2);
  g.computeVertexNormals(); geos.set("nHead", g); return g;
}
function pieceMesh(type, color, mats) {
  const grp = new THREE.Group(), m = mats[color];
  if (type === "n") { grp.add(new THREE.Mesh(lathe("nBase"), m)); const h = new THREE.Mesh(knightHead(), m); h.rotation.y = color === "w" ? -KNIGHT_TURN : Math.PI + KNIGHT_TURN; grp.add(h); }
  else grp.add(new THREE.Mesh(lathe(type), m));
  if (type === "k") {                            // the king's cross
    const bar = new THREE.BoxGeometry(0.06, 0.2, 0.06), arm = new THREE.BoxGeometry(0.16, 0.06, 0.06);
    const a = new THREE.Mesh(bar, m); a.position.y = 1.15; const b = new THREE.Mesh(arm, m); b.position.y = 1.17; grp.add(a, b);
  }
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return grp;
}
function grain(ctx, x, y, w, h, rand) {          // Iron Ledger's wood grain over a square (board3d.js grain, lighter)
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(${rand() < .5 ? "60,30,10" : "255,240,210"},${.04 + rand() * .07})`; ctx.lineWidth = 0.6 + rand() * 1.4; ctx.beginPath();
    const off = rand() * h, wob = 1.5 + rand() * 3, per = 0.02 + rand() * 0.05;
    for (let k = 0; k <= 30; k++) { const u = k / 30 * w, v = off + Math.sin(u * per) * wob; k ? ctx.lineTo(x + u, y + v) : ctx.moveTo(x + u, y + v); }
    ctx.stroke();
  }
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** A 3D view over `host` (the flat board's element). Returns null when the phone gives no 3D graphics. */
export function create3d(host, { onSquare, onDown }) {
  const canvas = document.createElement("canvas"); canvas.className = "bd-3d";
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PIXEL_RATIO_MAX));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(canvas);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a1d12, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-4, 9, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.55); fill.position.set(5, 5, -4); scene.add(fill);
  const mats = { w: new THREE.MeshStandardMaterial({ color: PIECE.w.colour, roughness: .5, metalness: .05 }),
                 b: new THREE.MeshStandardMaterial({ color: PIECE.b.colour, roughness: .45, metalness: .05 }) };
  // the board: a box (its side and frame) with the squares' picture on top, and a picture layer for marks just above
  const sqCanvas = document.createElement("canvas"); sqCanvas.width = sqCanvas.height = TEX;
  const sqTex = new THREE.CanvasTexture(sqCanvas); sqTex.colorSpace = THREE.SRGBColorSpace; sqTex.anisotropy = 4;
  const frameMat = new THREE.MeshStandardMaterial({ color: FRAME.colour, roughness: .6 });
  const side = 8 + 2 * FRAME.width, body = new THREE.Mesh(new THREE.BoxGeometry(side, FRAME.depth, side), frameMat); body.position.y = -FRAME.depth / 2; scene.add(body);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ map: sqTex, roughness: .55 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.002; scene.add(top);
  const markCanvas = document.createElement("canvas"); markCanvas.width = markCanvas.height = TEX;
  const markTex = new THREE.CanvasTexture(markCanvas); markTex.colorSpace = THREE.SRGBColorSpace;
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false }));
  marks.rotation.x = -Math.PI / 2; marks.position.y = 0.006; scene.add(marks);
  const pieces = new Map();                      // square → its mesh group
  let flipped = false, lost = false, frame = 0, anim = null, state = null, lastMarks = "";
  const sqPos = (s) => new THREE.Vector3("abcdefgh".indexOf(s[0]) - 3.5, 0, 3.5 - (Number(s[1]) - 1));

  function paintSquares(st) {                    // the squares in the theme's colours, grain, the last move, the pick, legal dots, check
    const c = sqCanvas.getContext("2d"), q = TEX / 8, rand = rng(7), light = css("--sq-light", "#E6C48E"), dark = css("--sq-dark", "#8C5A33");
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const x = f * q, y = (7 - r) * q, s = "abcdefgh"[f] + (r + 1);
      c.fillStyle = (f + r) % 2 ? light : dark; c.fillRect(x, y, q, q); grain(c, x, y, q, q, rand);
      if (st.last && (s === st.last.from || s === st.last.to)) { c.fillStyle = MARK.last; c.fillRect(x, y, q, q); }
      if (s === st.picked) { c.fillStyle = MARK.pick; c.fillRect(x, y, q, q); }
      if (s === st.checkSq) { const g = c.createRadialGradient(x + q / 2, y + q / 2, 0, x + q / 2, y + q / 2, q * .6); g.addColorStop(0, MARK.check); g.addColorStop(1, "rgba(214,72,52,0)"); c.fillStyle = g; c.fillRect(x, y, q, q); }
      if (st.targets.has(s)) { c.fillStyle = MARK.dot; c.beginPath(); c.arc(x + q / 2, y + q / 2, st.occupied.has(s) ? q * .46 : q * .16, 0, 7); st.occupied.has(s) ? (c.lineWidth = q * .08, c.strokeStyle = MARK.dot, c.stroke()) : c.fill(); }
    }
    c.fillStyle = "rgba(0,0,0,.6)"; for (let k = 0; k <= 8; k++) { c.fillRect(Math.min(TEX - 2, k * q - 1), 0, 2, TEX); c.fillRect(0, Math.min(TEX - 2, k * q - 1), TEX, 2); }
    sqTex.needsUpdate = true;
  }
  function paintMarks(svg) {                     // the flat board's own mark layer (arrows, circles, Tension), laid on the 3D board
    if (svg === lastMarks) return; lastMarks = svg;
    const c = markCanvas.getContext("2d"); c.clearRect(0, 0, TEX, TEX);
    if (!svg) { markTex.needsUpdate = true; request(); return; }
    // the SVG is drawn for the flat board's orientation; the 3D board's squares are fixed (a1 bottom left), so undo a flip
    const inner = flipped ? `<g transform="rotate(180 4 4)">${svg}</g>` : svg;
    const img = new Image(), style = MARK_CSS();
    img.onload = () => { if (svg !== lastMarks) return; c.clearRect(0, 0, TEX, TEX); c.drawImage(img, 0, 0, TEX, TEX); markTex.needsUpdate = true; request(); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="${TEX}" height="${TEX}"><style>${style}</style>${inner}</svg>`);
  }
  function fit() {
    const w = host.clientWidth || 300, h = host.clientHeight || w;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const dist = (8 + 2 * FRAME.width) * CAMERA.margin / 2 / Math.tan(THREE.MathUtils.degToRad(CAMERA.fov) / 2) / Math.min(1, camera.aspect) * 1.02;
    const dir = flipped ? -1 : 1;
    camera.position.set(0, Math.sin(CAMERA.elevation) * dist, dir * Math.cos(CAMERA.elevation) * dist);
    camera.lookAt(0, 0.35, dir * 0.6); camera.updateProjectionMatrix(); request();
  }
  function request() { if (!frame && !lost) frame = requestAnimationFrame(render); }
  function render(t) {
    frame = 0;
    if (anim) {
      const u = Math.min(1, (t - anim.t0) / SLIDE_MS), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      anim.g.position.lerpVectors(anim.a, anim.b, e); anim.g.position.y = Math.sin(Math.PI * e) * (anim.knight ? LIFT * 1.4 : LIFT * 0.35);
      if (u >= 1) { anim.g.position.copy(anim.b); anim = null; } else request();
    }
    renderer.render(scene, camera);
  }
  /** st: { board: chess.board(), last, picked, targets, occupied, checkSq, flipped, moved: {from, to} | null, marks: svg } */
  function update(st) {
    if (lost) return; state = st;
    if (st.flipped !== flipped) { flipped = st.flipped; fit(); lastMarks = null; }
    const want = new Map(); st.board.forEach((row) => row.forEach((p) => { if (p) want.set(p.square, p); }));
    let mover = null;
    if (st.moved && pieces.has(st.moved.from) && want.has(st.moved.to)) {          // the piece that moved slides from its square
      const g = pieces.get(st.moved.from), p = want.get(st.moved.to);
      if (g.userData.k === p.color + p.type) { pieces.delete(st.moved.from); const old = pieces.get(st.moved.to); if (old) scene.remove(old); pieces.set(st.moved.to, g); mover = g;
        anim = { g, a: sqPos(st.moved.from), b: sqPos(st.moved.to), t0: performance.now(), knight: p.type === "n" }; }
    }
    for (const [s, g] of pieces) { const p = want.get(s); if (!p || g.userData.k !== p.color + p.type) { scene.remove(g); pieces.delete(s); } }
    for (const [s, p] of want) {
      if (pieces.has(s)) { const g = pieces.get(s); if (g !== mover) g.position.copy(sqPos(s)); continue; }
      const g = pieceMesh(p.type, p.color, mats); g.userData.k = p.color + p.type; g.position.copy(sqPos(s)); scene.add(g); pieces.set(s, g);
    }
    paintSquares(st); paintMarks(st.marks || ""); request();
  }
  // taps: a ray from the camera onto the board's top gives the square
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function squareAt(x, y) {
    const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null;
    const f = Math.floor(hit.x + 4), rk = Math.floor(4 - hit.z); return f >= 0 && f < 8 && rk >= 0 && rk < 8 ? "abcdefgh"[f] + (rk + 1) : null;
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = squareAt(e.clientX, e.clientY); if (down) { onDown(down); canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener("pointerup", (e) => { const from = down; down = null; if (from) onSquare(from, squareAt(e.clientX, e.clientY)); });
  canvas.addEventListener("pointercancel", () => { down = null; });
  const ro = new ResizeObserver(() => fit()); ro.observe(host);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; api.onLost?.(); });
  fit();
  function pointOf(s) {                          // where a square's centre is on screen (for taps by tests and the keyboard)
    const v = sqPos(s).project(camera), r = canvas.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  }
  host.__point3d = pointOf;
  const api = {
    update, squareAt, pointOf,
    destroy() { lost = true; ro.disconnect(); if (frame) cancelAnimationFrame(frame); renderer.dispose(); canvas.remove(); },
    onLost: null,
  };
  return api;
}
/* The mark layer's look (the same as css/app.css's .bd-marks rules, which an SVG drawn as a picture can't read). */
const MARK_CSS = () => `.usr{stroke:#E0763B;stroke-linecap:round}.usr-head,.usr-dot{fill:#E0763B}.usr-ring{stroke:#E0763B}
.usr1{stroke:#3FA34D}.usr1-head,.usr1-dot{fill:#3FA34D}.usr1-ring{stroke:#3FA34D}.usr2{stroke:#3D7FD6}.usr2-head,.usr2-dot{fill:#3D7FD6}.usr2-ring{stroke:#3D7FD6}
.usr3{stroke:#D64834}.usr3-head,.usr3-dot{fill:#D64834}.usr3-ring{stroke:#D64834}.ab{stroke:rgba(0,0,0,.35);stroke-width:.014;stroke-linejoin:round}
.as{fill:none;stroke-linejoin:round;stroke-linecap:round}.ash{fill:rgba(0,0,0,.28)}.ash-line{fill:none;stroke:rgba(0,0,0,.28)}.ahl{fill:none;stroke:rgba(255,255,255,.35);stroke-linecap:round}
.bd-num{font:700 .22px sans-serif;fill:#fff;text-anchor:middle;dominant-baseline:central}`;
