/* Maia-3 in the browser — the same maths as CSSLab's MAIA3Model (maia3/models.py, maia3-5m), so the opponents play the moves the
   developer app's Maia-3 plays: each of the last 8 positions as 64 square tokens of 12 pieces (from that position's mover's side),
   both players' ratings blended into every token, 8 post-norm transformer blocks with board-aware attention (GAB), and a
   from-square × to-square move head with promotion biases. Pure functions (no page, no chess.js), so it runs in a worker and in
   node for the checks. Network: vendor/maia3/maia3-5m.bin (tools/maia3_pack.py).
   Maia-3: CSSLab, University of Toronto (AGPL-3.0) — https://github.com/CSSLab/maia3 */
export const MAGIC = "IL3M", HISTORY = 8, PIECE_PLANES = 12, SQUARES = 64, MOVES = 4096 + 256;
const PIECES = "PNBRQKpnbrqk";                        // token order: White pawn … king, then Black (dataset.py PIECE_MAP)
const PROMO = "qrbn";                                 // promotion order in the move list (utils.get_all_possible_moves)
const ELO_MAX = 5000;                                 // models.interpolate_elo's clamp
const RMS_EPS = 1.1920928955078125e-7;                // torch.nn.RMSNorm(eps=None): float32's machine epsilon
const LN_EPS = 1e-5;                                  // torch.nn.LayerNorm's default

function half(u16) {                                  // float16 → float32
  const s = u16 & 0x8000 ? -1 : 1, e = (u16 >> 10) & 0x1f, f = u16 & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}
/* bytes: an ArrayBuffer of a packed network → { cfg, T: {name: Float32Array}, scratch } */
export function readNet(bytes) {
  const dv = new DataView(bytes), magic = String.fromCharCode(...new Uint8Array(bytes, 0, 4));
  if (magic !== MAGIC) throw new Error("not a packed Maia-3 network");
  const hl = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 8, hl)));
  let at = 8 + hl;
  const T = {};
  for (const t of head.tensors) {
    const n = t.shape.reduce((a, b) => a * b, 1), a = new Float32Array(n);
    if (t.dtype === "f16") { for (let i = 0; i < n; i++) a[i] = half(dv.getUint16(at + 2 * i, true)); at += 2 * n; }
    else { for (let i = 0; i < n; i++) a[i] = dv.getFloat32(at + 4 * i, true); at += 4 * n; }
    T[t.name] = a;
  }
  if (at !== bytes.byteLength) throw new Error("a packed Maia-3 network of the wrong length");
  return { cfg: head.cfg, T };
}

/* Y[rows × out] = X[rows × inn] · W, W stored transposed (inn × out) by the packer so the inner loop runs along memory */
function matmul(X, rows, inn, W, out, bias) {
  const Y = new Float32Array(rows * out);
  if (bias) for (let r = 0; r < rows; r++) Y.set(bias, r * out);
  let r = 0;
  for (; r + 4 <= rows; r += 4) {                      // four rows at a time: each weight read once for four squares
    const y0 = r * out, y1 = y0 + out, y2 = y1 + out, y3 = y2 + out, x0 = r * inn, x1 = x0 + inn, x2 = x1 + inn, x3 = x2 + inn;
    for (let i = 0; i < inn; i++) {
      const a = X[x0 + i], b = X[x1 + i], c = X[x2 + i], d = X[x3 + i];
      if (a === 0 && b === 0 && c === 0 && d === 0) continue;
      const wo = i * out;
      for (let o = 0; o < out; o++) { const w = W[wo + o]; Y[y0 + o] += a * w; Y[y1 + o] += b * w; Y[y2 + o] += c * w; Y[y3 + o] += d * w; }
    }
  }
  for (; r < rows; r++) {
    const yo = r * out, xo = r * inn;
    for (let i = 0; i < inn; i++) { const xv = X[xo + i]; if (xv === 0) continue; const wo = i * out; for (let o = 0; o < out; o++) Y[yo + o] += xv * W[wo + o]; }
  }
  return Y;
}
function rmsNorm(X, rows, dim, w) {
  for (let r = 0; r < rows; r++) { const o = r * dim; let s = 0; for (let i = 0; i < dim; i++) s += X[o + i] * X[o + i];
    const k = 1 / Math.sqrt(s / dim + RMS_EPS); for (let i = 0; i < dim; i++) X[o + i] = X[o + i] * k * w[i]; }
  return X;
}
function layerNorm(X, rows, dim, w, b) {
  for (let r = 0; r < rows; r++) { const o = r * dim; let m = 0; for (let i = 0; i < dim; i++) m += X[o + i]; m /= dim;
    let v = 0; for (let i = 0; i < dim; i++) { const d = X[o + i] - m; v += d * d; }
    const k = 1 / Math.sqrt(v / dim + LN_EPS); for (let i = 0; i < dim; i++) X[o + i] = (X[o + i] - m) * k * w[i] + b[i]; }
  return X;
}
function erf(x) {                                     // W. J. Cody's rational approximations (|error| < 1.2e-7 in float32 terms)
  const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.5 * a);
  const y = 1 - t * Math.exp(-a * a - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return s * y;
}
function gelu(X) { for (let i = 0; i < X.length; i++) X[i] = 0.5 * X[i] * (1 + erf(X[i] / Math.SQRT2)); return X; }

/* the board-aware attention bias (models.MHA._sq_bias with gab_per_square_dim 0): (heads × 64 × 64) */
function gabBias(net, p, x) {
  const { cfg, T } = net, d = cfg.dim_vit, H = cfg.num_heads, G = cfg.gab_gen_size, hid = cfg.gab_intermediate_dim;
  const mean = new Float32Array(d);
  for (let s = 0; s < SQUARES; s++) for (let i = 0; i < d; i++) mean[i] += x[s * d + i];
  for (let i = 0; i < d; i++) mean[i] /= SQUARES;
  let y = gelu(matmul(mean, 1, d, T[p + "sm2.w"], hid, T[p + "sm2.b"]));
  layerNorm(y, 1, hid, T[p + "ln1.w"], T[p + "ln1.b"]);
  y = gelu(matmul(y, 1, hid, T[p + "sm3.w"], H * G, T[p + "sm3.b"]));
  layerNorm(y, 1, H * G, T[p + "ln2.w"], T[p + "ln2.b"]);
  return matmul(y, H, G, T.gab, SQUARES * SQUARES);   // shared weight (4096 × 64) stored as (64 × 4096)
}
function attention(net, p, x) {
  const { cfg, T } = net, d = cfg.dim_vit, H = cfg.num_heads, hd = d / H, scale = 1 / Math.sqrt(hd);
  const qkv = matmul(x, SQUARES, d, T[p + "in.w"], 3 * d, T[p + "in.b"]), bias = gabBias(net, p, x);
  const out = new Float32Array(SQUARES * d), row = new Float32Array(SQUARES), acc = new Float32Array(hd);
  const q = new Float32Array(SQUARES * hd), k = new Float32Array(SQUARES * hd), v = new Float32Array(SQUARES * hd);
  for (let h = 0; h < H; h++) {
    for (let s = 0; s < SQUARES; s++) {                // this head's queries, keys and values side by side in memory
      const src = s * 3 * d + h * hd;
      q.set(qkv.subarray(src, src + hd), s * hd); k.set(qkv.subarray(src + d, src + d + hd), s * hd); v.set(qkv.subarray(src + 2 * d, src + 2 * d + hd), s * hd);
    }
    const bo = h * SQUARES * SQUARES;
    for (let i = 0; i < SQUARES; i++) {
      const qi = i * hd, bi = bo + i * SQUARES; let top = -Infinity;
      for (let j = 0; j < SQUARES; j++) { const kj = j * hd; let s = 0; for (let c = 0; c < hd; c++) s += q[qi + c] * k[kj + c];
        s = s * scale + bias[bi + j]; row[j] = s; if (s > top) top = s; }
      let sum = 0; for (let j = 0; j < SQUARES; j++) { const e = Math.exp(row[j] - top); row[j] = e; sum += e; }
      acc.fill(0);
      for (let j = 0; j < SQUARES; j++) { const pj = row[j], vj = j * hd; for (let c = 0; c < hd; c++) acc[c] += pj * v[vj + c]; }
      const oi = i * d + h * hd, inv = 1 / sum; for (let c = 0; c < hd; c++) out[oi + c] = acc[c] * inv;
    }
  }
  return matmul(out, SQUARES, d, T[p + "out.w"], d, T[p + "out.b"]);
}
function block(net, i, x) {
  const { cfg, T } = net, d = cfg.dim_vit, f = Math.round(d * cfg.mlp_ratio), p = `b${i}.`;
  const norm = cfg.use_rms_norm ? (X, w) => rmsNorm(X, SQUARES, d, T[w + ".w"]) : (X, w) => layerNorm(X, SQUARES, d, T[w + ".w"], T[w + ".b"]);
  const a = attention(net, p, x);
  for (let k = 0; k < a.length; k++) a[k] += x[k];
  norm(a, p + "norm1");
  const h = gelu(matmul(a, SQUARES, d, T[p + "ff1.w"], f, T[p + "ff1.b"])), y = matmul(h, SQUARES, f, T[p + "ff2.w"], d, T[p + "ff2.b"]);
  for (let k = 0; k < y.length; k++) y[k] += a[k];
  return norm(y, p + "norm2");
}
function eloEmbedding(net, elo) {                     // models.interpolate_elo, written as it is there
  const { T } = net, e = Math.min(Math.max(elo, 0), ELO_MAX), low = e / ELO_MAX, high = 1 - low;
  return T.elo_low.map((v, i) => low * v + high * T.elo_high[i]);
}
/* tokens [64 × 96], self and opponent rating → move logits [4352] (index: from * 64 + to; promotions after 4096) */
export function logits(net, tokens, selfElo, oppoElo) {
  const { cfg, T } = net, d = cfg.dim_vit, n = PIECE_PLANES * cfg.history, e = cfg.dim_emb, inn = n + 2 * e, hid = cfg.head_hid_dim;
  const se = eloEmbedding(net, selfElo), oe = eloEmbedding(net, oppoElo), X = new Float32Array(SQUARES * inn);
  for (let s = 0; s < SQUARES; s++) { X.set(tokens.subarray(s * n, s * n + n), s * inn); X.set(se, s * inn + n); X.set(oe, s * inn + n + e); }
  let x = matmul(X, SQUARES, inn, T["proj.w"], d, T["proj.b"]);
  for (let i = 0; i < cfg.num_blocks; i++) x = block(net, i, x);
  layerNorm(x, SQUARES, d, T["norm.w"], T["norm.b"]);
  const from = matmul(x, SQUARES, d, T["from.w"], hid), to = matmul(x, SQUARES, d, T["to.w"], hid), k = 1 / Math.sqrt(hid);
  const out = new Float32Array(MOVES);
  for (let i = 0; i < SQUARES; i++) for (let j = 0; j < SQUARES; j++) { let s = 0; for (let c = 0; c < hid; c++) s += from[i * hid + c] * to[j * hid + c]; out[i * SQUARES + j] = s * k; }
  const promo = matmul(to.subarray(56 * hid), 8, hid, T["promo.w"], 4);   // rank 8's squares → q, r, b, n biases
  const up = Math.sqrt(hid);
  for (let ff = 0; ff < 8; ff++) for (let tf = 0; tf < 8; tf++) for (let pc = 0; pc < 4; pc++)
    out[4096 + (ff * 8 + tf) * 4 + pc] = out[(48 + ff) * SQUARES + 56 + tf] + promo[tf * 4 + pc] * up;
  return out;
}

/* "rnbqkbnr/… w …" → 64 × 12 one-hot, the board turned for Black to move (dataset.tokenize_board) */
export function tokenize(fen) {
  const [rows, turn] = fen.split(" "), t = new Float32Array(SQUARES * PIECE_PLANES), black = turn === "b";
  rows.split("/").forEach((row, i) => { let f = 0; const r = 7 - i;
    for (const ch of row) { if (/\d/.test(ch)) { f += Number(ch); continue; }
      let p = PIECES.indexOf(ch), rr = r;
      if (black) { rr = 7 - r; p = (p + 6) % 12; }              // board.mirror(): ranks flipped, colours swapped
      t[(rr * 8 + f++) * PIECE_PLANES + p] = 1; } });
  return t;
}
/* fens: every position of the game from its start to now → [64 × 12·history]: the last 8, oldest first, padded with the oldest
   (dataset.get_historical_tokens with uci.py's --use-uci-history, as the developer app runs it) */
export function encode(fens, history = HISTORY) {
  const last = fens.slice(-history).map(tokenize);
  while (last.length < history) last.unshift(last[0]);
  const n = PIECE_PLANES * history, out = new Float32Array(SQUARES * n);
  for (let s = 0; s < SQUARES; s++) last.forEach((t, h) => out.set(t.subarray(s * PIECE_PLANES, s * PIECE_PLANES + PIECE_PLANES), s * n + h * PIECE_PLANES));
  return out;
}
const sq = (s) => (Number(s[1]) - 1) * 8 + (s.charCodeAt(0) - 97);
/* a move (UCI, from the real board) → its index in Maia-3's move list (board turned for Black: utils.mirror_move) */
export function moveIndex(uci, black) {
  let f = sq(uci.slice(0, 2)), t = sq(uci.slice(2, 4));
  if (black) { f = (7 - (f >> 3)) * 8 + (f & 7); t = (7 - (t >> 3)) * 8 + (t & 7); }
  if (uci.length > 4) return 4096 + ((f & 7) * 8 + (t & 7)) * 4 + PROMO.indexOf(uci[4]);
  return f * SQUARES + t;
}
/* moves: legal UCI moves in the last position → {uci: probability} (softmax over the legal moves only, as uci.py masks) */
export function moveProbs(net, fens, moves, selfElo, oppoElo) {
  const black = fens[fens.length - 1].split(" ")[1] === "b", z = logits(net, encode(fens, net.cfg.history), selfElo, oppoElo);
  const v = moves.map((u) => z[moveIndex(u, black)]), top = Math.max(...v), e = v.map((x) => Math.exp(x - top)), sum = e.reduce((a, b) => a + b, 0);
  const res = {}; moves.forEach((u, i) => { res[u] = e[i] / sum; });
  return res;
}
/* Maia-3's way of playing in the developer app (uci.py, temperature 1, no top-p): a move drawn by its probability */
export function sample(probs, random = Math.random) {
  const c = Object.entries(probs); let r = random();
  for (const [u, p] of c) { r -= p; if (r <= 0) return u; }
  return c[c.length - 1][0];
}
