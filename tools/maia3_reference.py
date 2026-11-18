"""Maia-3 reference for the browser check: NumPy copy of maia3.models.MAIA3Model.forward (maia3-5m config) from the raw checkpoint, float32, written from models.py,
dataset.py and uci.py (--use-uci-history) — to check js/maia3-net.js. Prints JSON: positions with fens, legal moves, logits."""
import json, math, random, sys
from collections import deque
import chess, numpy as np
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import maia3_pack
from math import erf
CK = sys.argv[1]; sd = {k: v.astype(np.float32) for k, v in maia3_pack.load_checkpoint(CK).items()}
C = maia3_pack.CFG
PIECE_MAP = {chess.PAWN: 1, chess.KNIGHT: 2, chess.BISHOP: 3, chess.ROOK: 4, chess.QUEEN: 5, chess.KING: 6}
def tokenize_board(board):
    t = np.zeros((64, 12), np.float32)
    if board.turn == chess.BLACK: board = board.mirror()
    for s in chess.SQUARES:
        p = board.piece_at(s)
        if p: t[s][PIECE_MAP[p.piece_type] + (6 if p.color == chess.BLACK else 0) - 1] = 1
    return t
def hist_tokens(history):
    h = np.concatenate(list(history), axis=1)
    if len(history) < C["history"]: h = np.concatenate([np.tile(history[0], (1, C["history"] - len(history))), h], axis=1)
    return h
def all_moves():
    out = []
    for r in range(8):
        for f in range(8):
            s = chess.square(f, r)
            for tr in range(8):
                for tf in range(8): out.append(chess.square_name(s) + chess.square_name(chess.square(tf, tr)))
    out += [f"{a}7{b}8{p}" for a in "abcdefgh" for b in "abcdefgh" for p in "qrbn"]
    return out
ALL = all_moves(); IDX = {m: i for i, m in enumerate(ALL)}
def mirror_move(u): return u[0] + str(9 - int(u[1])) + u[2] + str(9 - int(u[3])) + u[4:]
gelu = np.vectorize(lambda x: 0.5 * x * (1 + erf(x / math.sqrt(2))), otypes=[np.float32])
def ln(x, w, b, eps=1e-5): m = x.mean(-1, keepdims=True); v = ((x - m) ** 2).mean(-1, keepdims=True); return (x - m) / np.sqrt(v + eps) * w + b
def rms(x, w): return x / np.sqrt((x * x).mean(-1, keepdims=True) + np.finfo(np.float32).eps) * w
def lin(x, k, bias=True): y = x @ sd[k + ".weight"].T; return y + sd[k + ".bias"] if bias and k + ".bias" in sd else y
def elo(e):
    e = min(max(e, 0), 5000); wl = e / 5000; return wl * sd["elo_embedding_low.weight"][0] + (1 - wl) * sd["elo_embedding_high.weight"][0]
def forward(tokens, se, oe):
    x = np.concatenate([tokens, np.tile(elo(se), (64, 1)), np.tile(elo(oe), (64, 1))], 1)
    x = lin(x, "token_projection")
    H, d = C["num_heads"], C["dim_vit"]; hd = d // H
    for i in range(C["num_blocks"]):
        p = f"transformer.layers.{i}."
        y = gelu(lin(x.mean(0), p + "self_attn.sm2")); y = ln(y, sd[p + "self_attn.ln1.weight"], sd[p + "self_attn.ln1.bias"])
        y = gelu(lin(y, p + "self_attn.sm3")); y = ln(y, sd[p + "self_attn.ln2.weight"], sd[p + "self_attn.ln2.bias"]).reshape(H, 64)
        bias = np.einsum("hi,oi->ho", y, sd["gab_shared_weight"]).reshape(H, 64, 64)
        qkv = x @ sd[p + "self_attn.mha.in_proj_weight"].T; q, k, v = qkv[:, :d], qkv[:, d:2 * d], qkv[:, 2 * d:]
        o = np.zeros((64, d), np.float32)
        for h in range(H):
            s = q[:, h*hd:(h+1)*hd] @ k[:, h*hd:(h+1)*hd].T / math.sqrt(hd) + bias[h]
            s = np.exp(s - s.max(1, keepdims=True)); s /= s.sum(1, keepdims=True); o[:, h*hd:(h+1)*hd] = s @ v[:, h*hd:(h+1)*hd]
        a = o @ sd[p + "self_attn.mha.out_proj.weight"].T
        x = rms(x + a, sd[p + "norm1.weight"])
        x = rms(x + lin(gelu(lin(x, p + "linear1")), p + "linear2"), sd[p + "norm2.weight"])
    x = ln(x, sd["transformer.norm.weight"], sd["transformer.norm.bias"])
    fr, to = lin(x, "proj_sq_from", False), lin(x, "proj_sq_to", False); hid = C["head_hid_dim"]
    base = fr @ to.T / math.sqrt(hid)
    pb = lin(to[56:64], "promo_bias_proj", False) * math.sqrt(hid)
    promo = [base[48 + a, 56 + b] + pb[b, c] for a in range(8) for b in range(8) for c in range(4)]
    return np.concatenate([base.reshape(-1), np.array(promo, np.float32)])
def positions(seed, n_games, plies):
    rnd = random.Random(seed); out = []
    for g in range(n_games):
        b = chess.Board(); fens = [b.fen()]; hist = deque([tokenize_board(b)], maxlen=8)
        for ply in range(plies):
            if b.is_game_over(): break
            if ply % 7 == g % 7 or ply in (0, 1): out.append((list(fens), b.copy(), list(hist)))
            m = rnd.choice(list(b.legal_moves)); b.push(m); fens.append(b.fen()); hist.append(tokenize_board(b))
    for fen in ("8/P6k/8/8/8/8/8/4K3 w - - 0 1", "4k3/8/8/8/8/8/p6K/8 b - - 0 1", "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 4 8"):
        b = chess.Board(fen); out.append(([fen], b, [tokenize_board(b)]))
    return out
res = []
for fens, b, hist in positions(int(sys.argv[2]) if len(sys.argv) > 2 else 7, 6, 60):
    se, oe = random.Random(len(res)).choice([(1100, 1100), (1500, 1300), (1900, 2200), (2500, 1100)])
    z = forward(hist_tokens(deque(hist, maxlen=8)), se, oe)
    legal = [m.uci() for m in b.legal_moves]
    idx = [IDX[m if b.turn == chess.WHITE else mirror_move(m)] for m in legal]
    lz = z[idx]; pr = np.exp(lz - lz.max()); pr /= pr.sum()
    res.append({"fens": fens, "self": se, "oppo": oe, "legal": legal, "probs": [float(x) for x in pr],
                "best": legal[int(np.argmax(pr))]})
json.dump(res, sys.stdout)
