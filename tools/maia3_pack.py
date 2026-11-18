"""Packs Maia-3's checkpoint (maia3-5m.pt, CSSLab, AGPL-3.0) for the browser: vendor/maia3/maia3-5m.bin, read by js/maia3-net.js.
Needs no PyTorch: a .pt file is a zip whose pickle points at raw little-endian arrays (data/N), read here with numpy.
Layout: "IL3M", a 4-byte header length, a JSON header {cfg, tensors: [{name, shape, dtype}]}, then each tensor in order.
Weight matrices are stored transposed (in × out) as float16; biases, norms and the rating embeddings as float32.
Only what plays a move is kept: the value and thinking-time heads are left out, and the attention-bias weight that the
8 blocks share is stored once (the checkpoint repeats it in every block; the copies are checked equal).
Run: python3 tools/maia3_pack.py <maia3-5m.pt>"""
import collections, hashlib, json, os, pickle, struct, sys, zipfile
import numpy as np

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(SITE, "vendor", "maia3", "maia3-5m.bin")
MAGIC = b"IL3M"
# maia3/model_registry.py: BASE_SIZE_CONFIG + the maia3-5m entry (the checkpoint itself carries no config)
CFG = {"history": 8, "dim_emb": 128, "num_blocks": 8, "mlp_ratio": 2.0, "use_rms_norm": True, "dim_vit": 256, "head_hid_dim": 256,
       "num_heads": 8, "gab_gen_size": 64, "gab_per_square_dim": 0, "gab_intermediate_dim": 64}
DTYPES = {"FloatStorage": np.float32, "HalfStorage": np.float16, "LongStorage": np.int64, "IntStorage": np.int32}


def load_checkpoint(path):
    """The checkpoint's state dict as numpy arrays (the 'smolgen' names of older checkpoints kept as they are)."""
    z = zipfile.ZipFile(path)
    root = z.namelist()[0].split("/")[0]

    class Storage:
        def __init__(self, kind, key): self.kind, self.key = kind, key

    def rebuild(storage, offset, size, stride, *_):
        raw = np.frombuffer(z.read(f"{root}/data/{storage.key}"), dtype=DTYPES[storage.kind])
        return np.lib.stride_tricks.as_strided(raw[offset:], shape=size, strides=[s * raw.itemsize for s in stride]).copy()

    class Reader(pickle.Unpickler):
        def find_class(self, mod, name):
            if mod == "torch._utils" and name.startswith("_rebuild_tensor"): return rebuild
            if mod == "torch._utils" and name == "_rebuild_parameter": return lambda data, *_: data
            if mod == "torch" and name.endswith("Storage"): return name
            if mod == "collections" and name == "OrderedDict": return collections.OrderedDict
            raise pickle.UnpicklingError(f"unexpected object in the checkpoint: {mod}.{name}")   # nothing else is ever run

        def persistent_load(self, pid):
            return Storage(pid[1] if isinstance(pid[1], str) else pid[1].__name__, pid[2])

    ck = Reader(z.open(f"{root}/data.pkl")).load()
    sd = ck["model_state_dict"] if isinstance(ck, dict) and "model_state_dict" in ck else ck
    return {k.replace("smolgen", "gab"): v for k, v in sd.items()}


def tensors(sd):
    """(name, array, dtype) in the order js/maia3-net.js reads them."""
    shared = sd["gab_shared_weight"]
    for i in range(CFG["num_blocks"]):
        if not np.array_equal(sd[f"transformer.layers.{i}.self_attn.gab_weight"], shared):
            sys.exit(f"block {i}'s attention-bias weight differs from the shared one — this packer assumes they are one")
    lin = lambda k: sd[k].T                       # nn.Linear keeps (out × in); the browser reads (in × out)
    yield "elo_low", sd["elo_embedding_low.weight"][0], "f32"
    yield "elo_high", sd["elo_embedding_high.weight"][0], "f32"
    yield "proj.w", lin("token_projection.weight"), "f16"
    yield "proj.b", sd["token_projection.bias"], "f32"
    yield "gab", shared.T, "f16"                  # (64 × 4096)
    for i in range(CFG["num_blocks"]):
        p, q = f"transformer.layers.{i}.", f"b{i}."
        yield q + "in.w", lin(p + "self_attn.mha.in_proj_weight"), "f16"
        yield q + "out.w", lin(p + "self_attn.mha.out_proj.weight"), "f16"
        for a, b in (("sm2", "sm2"), ("sm3", "sm3")):
            yield q + b + ".w", lin(p + f"self_attn.{a}.weight"), "f16"
            yield q + b + ".b", sd[p + f"self_attn.{a}.bias"], "f32"
        for n in ("ln1", "ln2"):
            yield q + n + ".w", sd[p + f"self_attn.{n}.weight"], "f32"
            yield q + n + ".b", sd[p + f"self_attn.{n}.bias"], "f32"
        yield q + "ff1.w", lin(p + "linear1.weight"), "f16"
        yield q + "ff1.b", sd[p + "linear1.bias"], "f32"
        yield q + "ff2.w", lin(p + "linear2.weight"), "f16"
        yield q + "ff2.b", sd[p + "linear2.bias"], "f32"
        yield q + "norm1.w", sd[p + "norm1.weight"], "f32"
        yield q + "norm2.w", sd[p + "norm2.weight"], "f32"
    yield "norm.w", sd["transformer.norm.weight"], "f32"
    yield "norm.b", sd["transformer.norm.bias"], "f32"
    yield "from.w", lin("proj_sq_from.weight"), "f16"
    yield "to.w", lin("proj_sq_to.weight"), "f16"
    yield "promo.w", lin("promo_bias_proj.weight"), "f16"


def pack(checkpoint, out=OUT):
    sd = load_checkpoint(checkpoint)
    if any("bias" in k and "mha" in k for k in sd): sys.exit("this checkpoint has attention biases — not the maia3-5m layout")
    head, body = {"cfg": CFG, "tensors": []}, []
    for name, a, dt in tensors(sd):
        a = np.ascontiguousarray(a, dtype=np.float16 if dt == "f16" else np.float32)
        head["tensors"].append({"name": name, "shape": list(a.shape), "dtype": dt}); body.append(a.astype("<" + a.dtype.str[1:]).tobytes())
    hb = json.dumps(head, separators=(",", ":")).encode()
    data = MAGIC + struct.pack("<I", len(hb)) + hb + b"".join(body)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f: f.write(data)
    print(f"{os.path.relpath(out, SITE)}: {len(data):,} bytes, {sum(np.prod(t['shape']) for t in head['tensors']):,} weights, "
          f"sha256 {hashlib.sha256(data).hexdigest()[:16]}…")


if __name__ == "__main__":
    if len(sys.argv) != 2: sys.exit(__doc__)
    pack(sys.argv[1])
