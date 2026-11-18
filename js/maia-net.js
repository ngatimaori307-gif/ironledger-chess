/* Maia in the browser — the same network maths as the developer app's maia.py, so the opponents play the same moves:
   112 input planes from the mover's side, an SE residual tower, the convolutional policy head; promotions to a queen only.
   Pure functions (no page, no chess.js), so it runs in a worker and in node for the checks. Networks: vendor/maia/*.bin
   (tools/maia_pack.py). Maia: CSSLab, University of Toronto (GPL-3.0) — https://github.com/CSSLab/maia-chess */
export const HISTORY = 8, PLANES_PER_POSITION = 13, AUX_BASE = HISTORY * PLANES_PER_POSITION, INPUT_PLANES = AUX_BASE + 8;
const MAGIC = "ILM1", QUEEN_DIRS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
const KNIGHT_DIRS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]], MAX_STEPS = 7, KNIGHT_BASE = 56;
const PIECES = "pnbrqk";                             // python-chess's order: pawn, knight, bishop, rook, queen, king

function half(u16) {                                 // float16 → float32
  const s = u16 & 0x8000 ? -1 : 1, e = (u16 >> 10) & 0x1f, f = u16 & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}
/* bytes: an ArrayBuffer of a packed network → the layers ready to run */
export function readNet(bytes) {
  const dv = new DataView(bytes), magic = String.fromCharCode(...new Uint8Array(bytes, 0, 4));
  if (magic !== MAGIC) throw new Error("not a packed Maia network");
  const hl = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 8, hl)));
  let at = 8 + hl;
  const f16 = (n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = half(dv.getUint16(at + 2 * i, true)); at += 2 * n; return a; };
  const f32 = (n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = dv.getFloat32(at + 4 * i, true); at += 4 * n; return a; };
  const L = {};
  for (const l of head.layers) {
    if (l.kind === "conv") L[l.name] = { ...l, w: f16(l.out * l.in * l.k * l.k), scale: f32(l.out), shift: f32(l.out) };
    else L[l.name] = { ...l, w1: f16(l.mid * l.ch), b1: f32(l.mid), w2: f16(2 * l.ch * l.mid), b2: f32(2 * l.ch) };
  }
  if (at !== bytes.byteLength) throw new Error("a packed Maia network of the wrong length");
  return { head, L };
}
function conv(l, x) {                                // x: [in × 64] → [out × 64], batch-norm folded in
  const { out, k, w, scale, shift } = l, cin = l.in, y = new Float32Array(out * 64);
  if (k === 1) {
    for (let o = 0; o < out; o++) { const wo = o * cin, yo = o * 64;
      for (let c = 0; c < cin; c++) { const wv = w[wo + c]; if (!wv) continue; const xc = c * 64; for (let p = 0; p < 64; p++) y[yo + p] += wv * x[xc + p]; } }
  } else {
    const cols = new Float32Array(cin * 9 * 64);             // im2col, zero padded
    for (let c = 0; c < cin; c++) for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const row = (c * 9 + dy * 3 + dx) * 64;
      for (let r = 0; r < 8; r++) { const sr = r + dy - 1; if (sr < 0 || sr > 7) continue;
        for (let f = 0; f < 8; f++) { const sf = f + dx - 1; if (sf >= 0 && sf <= 7) cols[row + r * 8 + f] = x[c * 64 + sr * 8 + sf]; } }
    }
    const K = cin * 9;
    for (let o = 0; o < out; o++) { const wo = o * K, yo = o * 64;
      for (let j = 0; j < K; j++) { const wv = w[wo + j]; if (!wv) continue; const cj = j * 64; for (let p = 0; p < 64; p++) y[yo + p] += wv * cols[cj + p]; } }
  }
  for (let o = 0; o < out; o++) { const s = scale[o], t = shift[o], yo = o * 64; for (let p = 0; p < 64; p++) y[yo + p] = y[yo + p] * s + t; }
  return y;
}
const relu = (x) => { for (let i = 0; i < x.length; i++) if (x[i] < 0) x[i] = 0; return x; };
function se(l, x) {
  const { ch, mid, w1, b1, w2, b2 } = l, m = new Float32Array(ch), z = new Float32Array(mid), g = new Float32Array(2 * ch);
  for (let c = 0; c < ch; c++) { let s = 0; for (let p = 0; p < 64; p++) s += x[c * 64 + p]; m[c] = s / 64; }
  for (let i = 0; i < mid; i++) { let s = b1[i]; for (let c = 0; c < ch; c++) s += w1[i * ch + c] * m[c]; z[i] = s > 0 ? s : 0; }
  for (let i = 0; i < 2 * ch; i++) { let s = b2[i]; for (let j = 0; j < mid; j++) s += w2[i * mid + j] * z[j]; g[i] = s; }
  for (let c = 0; c < ch; c++) { const gate = 1 / (1 + Math.exp(-g[c])), b = g[ch + c]; for (let p = 0; p < 64; p++) x[c * 64 + p] = x[c * 64 + p] * gate + b; }
  return x;
}
/* planes [112 × 64] → policy [80 × 64], indexed [plane, rank * 8 + file] from the mover's side */
export function policy(net, planes) {
  const { L, head } = net;
  let x = relu(conv(L.input, planes));
  for (let i = 0; i < head.blocks; i++) {
    let y = conv(L[`b${i}c2`], relu(conv(L[`b${i}c1`], x)));
    if (L[`b${i}se`]) y = se(L[`b${i}se`], y);
    for (let j = 0; j < y.length; j++) { const v = y[j] + x[j]; y[j] = v > 0 ? v : 0; }
    x = y;
  }
  return conv(L.pol, relu(conv(L.pol1, x)));
}
/* "rnbqkbnr/…" → 64 entries, index rank * 8 + file (a1 = 0) */
function board(fen) {
  const sq = new Array(64).fill(""), rows = fen.split(" ")[0].split("/");
  rows.forEach((row, i) => { let f = 0; const r = 7 - i; for (const ch of row) { if (/\d/.test(ch)) f += Number(ch); else sq[r * 8 + f++] = ch; } });
  return sq;
}
const key = (fen) => fen.split(" ").slice(0, 4).join(" ");
/* fens: every position of the game from its start to now (the last is the one to move in) */
export function encode(fens) {
  const now = fens[fens.length - 1].split(" "), us = now[1], planes = new Float32Array(INPUT_PLANES * 64);
  const mirror = (i) => (us === "w" ? i : (7 - (i >> 3)) * 8 + (i & 7));
  for (let h = 0; h < HISTORY && h < fens.length; h++) {
    const idx = fens.length - 1 - h, fen = fens[idx], b = board(fen), base = h * PLANES_PER_POSITION;
    for (let i = 0; i < 64; i++) { const p = b[i]; if (!p) continue;
      const mine = (p === p.toUpperCase()) === (us === "w"), t = PIECES.indexOf(p.toLowerCase());
      planes[(base + (mine ? 0 : 6) + t) * 64 + mirror(i)] = 1; }
    const k = key(fen); let seen = 0; for (let j = 0; j <= idx; j++) if (key(fens[j]) === k) seen++;
    if (seen >= 2) planes.fill(1, (base + 12) * 64, (base + 13) * 64);
  }
  const cr = now[2], them = us === "w" ? "b" : "w", has = (side, ch) => cr.includes(side === "w" ? ch.toUpperCase() : ch);
  [has(us, "q"), has(us, "k"), has(them, "q"), has(them, "k")].forEach((ok, i) => { if (ok) planes.fill(1, (AUX_BASE + i) * 64, (AUX_BASE + i + 1) * 64); });
  if (us === "b") planes.fill(1, (AUX_BASE + 4) * 64, (AUX_BASE + 5) * 64);
  planes.fill(Number(now[4]) || 0, (AUX_BASE + 5) * 64, (AUX_BASE + 6) * 64);
  planes.fill(1, (AUX_BASE + 7) * 64, (AUX_BASE + 8) * 64);
  return planes;
}
const sqIndex = (s) => (Number(s[1]) - 1) * 8 + (s.charCodeAt(0) - 97);
/* moves: [{uci, from, to, castle: "k" | "q" | "", promo}] legal in the last position → {uci: probability} (queen promotions only) */
export function moveProbs(net, fens, moves) {
  const us = fens[fens.length - 1].split(" ")[1], out = policy(net, encode(fens));
  const mirror = (i) => (us === "w" ? i : (7 - (i >> 3)) * 8 + (i & 7)), keep = [], z = [];
  for (const m of moves) {
    if (m.promo && m.promo !== "q") continue;
    let to = sqIndex(m.to); const fr = mirror(sqIndex(m.from));
    if (m.castle) to = (to >> 3) * 8 + (m.castle === "k" ? 7 : 0);          // lc0: castling is the king taking its own rook
    to = mirror(to);
    const dx = (to & 7) - (fr & 7), dy = (to >> 3) - (fr >> 3);
    const kn = KNIGHT_DIRS.findIndex(([a, b]) => a === dx && b === dy);
    const plane = kn >= 0 ? KNIGHT_BASE + kn : QUEEN_DIRS.findIndex(([a, b]) => a === Math.sign(dx) && b === Math.sign(dy)) * MAX_STEPS + Math.max(Math.abs(dx), Math.abs(dy)) - 1;
    keep.push(m.uci); z.push(out[plane * 64 + fr]);
  }
  const top = Math.max(...z), e = z.map((v) => Math.exp(v - top)), sum = e.reduce((a, b) => a + b, 0), res = {};
  keep.forEach((u, i) => { res[u] = e[i] / sum; });
  return res;
}
/* Maia's way of playing (the developer app's spar.py): moves under minShare of the favourite dropped, the rest drawn by their
   probability (temperature 1 = as often as people at that rating play them) */
export function pick(probs, { minShare = 0.1, temperature = 1, random = Math.random } = {}) {
  const top = Math.max(...Object.values(probs)), c = Object.entries(probs).filter(([, p]) => p >= top * minShare).map(([u, p]) => [u, p ** (1 / temperature)]);
  let r = random() * c.reduce((a, [, w]) => a + w, 0);
  for (const [u, w] of c) { r -= w; if (r <= 0) return u; }
  return c[0][0];
}
