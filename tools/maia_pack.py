"""Pack Maia networks (lc0 .pb.gz) for the browser: vendor/maia/maia-NNNN.bin, read by js/maia.js.
Run from the developer's Iron Ledger (it has the reader, maia.py):
    python3 tools/maia_pack.py <Iron Ledger folder> <folder with maia-NNNN.pb.gz> [out folder]
File: b"ILM1", u32 length of a JSON header, the header, then for each layer in the header's order the weights as float16
and the folded batch-norm scale and shift as float32 (all little-endian). The weights were 16-bit in the source already."""
import json, os, re, struct, sys
import numpy as np
MAGIC = b"ILM1"
PATTERN = r"^maia-(\d{3,4})\.pb\.gz$"

def pack(net):
    head, blobs = {"ch": int(net.input.out), "layers": []}, []
    def conv(name, c, in_ch):
        head["layers"].append({"name": name, "kind": "conv", "out": int(c.out), "in": int(in_ch), "k": int(c.k)})
        blobs.extend([c.w.astype("<f2").tobytes(), c.scale.astype("<f4").tobytes(), c.shift.astype("<f4").tobytes()])
    def se(name, s):
        head["layers"].append({"name": name, "kind": "se", "mid": int(len(s.b1)), "ch": int(s.ch)})
        blobs.extend([s.w1.astype("<f2").tobytes(), s.b1.astype("<f4").tobytes(), s.w2.astype("<f2").tobytes(), s.b2.astype("<f4").tobytes()])
    ch = head["ch"]
    conv("input", net.input, net.input.w.shape[1] // (net.input.k * net.input.k))
    for i, (c1, c2, s) in enumerate(net.blocks):
        conv(f"b{i}c1", c1, ch); conv(f"b{i}c2", c2, ch)
        if s: se(f"b{i}se", s)
    conv("pol1", net.pol1, ch); conv("pol", net.pol, ch)
    head["blocks"] = len(net.blocks); head["se"] = any(s for _, _, s in net.blocks)
    h = json.dumps(head, separators=(",", ":")).encode()
    return MAGIC + struct.pack("<I", len(h)) + h + b"".join(blobs)

def main():
    il, src = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vendor", "maia")
    sys.path.insert(0, il); import maia
    os.makedirs(out, exist_ok=True); done = []
    for n in sorted(os.listdir(src)):
        m = re.match(PATTERN, n)
        if not m: continue
        data = pack(maia.Maia(os.path.join(src, n)))
        with open(os.path.join(out, f"maia-{m.group(1)}.bin"), "wb") as f: f.write(data)
        done.append(int(m.group(1))); print(f"maia-{m.group(1)}.bin  {len(data) / 1e6:.2f} MB")
    print("ratings:", done)

if __name__ == "__main__":
    main()
