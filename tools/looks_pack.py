"""Packs Lichess's openly licensed piece sets and board pictures into the site (vendor/lichess/) and writes js/looks-data.js,
the list the app reads. Run with a sparse checkout of github.com/lichess-org/lila (public/piece, public/images/board, COPYING.md):
    python3 tools/looks_pack.py /path/to/lila
Only sets whose COPYING.md line names an open licence are taken (GPL, AGPL, Apache, MIT, CC0, CC BY, CC BY-SA, CC BY-NC-SA);
"freeware", "personal use", "non-derivative" and unlicensed sets are left out. Each board picture's light and dark squares are
measured (the mean colour of all 32 of each), so coordinates, highlights and the menu swatch match the picture."""
import json, os, re, shutil, sys
from PIL import Image

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(SITE, "vendor", "lichess")
OPEN = ("GPL", "AGPL", "Apache", "MIT", "CC0", "CC BY")          # "CC BY" covers CC BY, CC BY-SA, CC BY-NC-SA
NOT_OPEN = ("freeware", "personal", "non-derivative", "non-modify")
CODES = [c + p for c in "wb" for p in "KQRBNP"]
BOARD_SKIP = (".thumbnail.", ".orig.", ".current-premove.", ".last-move.", ".move-dest.", ".selected.")
SAMPLE = 0.3                                                     # the middle 30 % of each square is measured (no edge blur)

def title(name): return " ".join(w.capitalize() for w in re.split(r"[-_]", name))
def hexc(rgb): return "#%02X%02X%02X" % tuple(int(round(v)) for v in rgb)

def licences(lila):
    found = {}
    for line in open(os.path.join(lila, "COPYING.md"), encoding="utf-8"):
        m = re.match(r"\s*public/(piece/[\w-]+|images/board)\b[^|]*\|\s*([^|]*)\|\s*(.*)$", line)
        if not m: continue
        lic = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", m.group(3)).strip().strip('"'); by = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", m.group(2)).strip()
        found[m.group(1).lower()] = (by, lic, line.strip())
    return found

def is_open(lic): return lic and any(o in lic for o in OPEN) and not any(n in lic.lower() for n in NOT_OPEN)

def squares(path):
    im = Image.open(path).convert("RGB"); w, h = im.size; s = w / 8
    sums = {0: [0, 0, 0, 0], 1: [0, 0, 0, 0]}
    for r in range(8):
        for f in range(8):
            box = (int((f + .5 - SAMPLE / 2) * s), int((r + .5 - SAMPLE / 2) * s), int((f + .5 + SAMPLE / 2) * s), int((r + .5 + SAMPLE / 2) * s))
            px = im.crop(box).resize((1, 1), Image.BOX).getpixel((0, 0)); acc = sums[(r + f) % 2]   # (r+f) even = a8's colour = light
            for i in range(3): acc[i] += px[i]
            acc[3] += 1
    return [hexc([v / sums[k][3] for v in sums[k][:3]]) for k in (0, 1)]

def main(lila):
    lic = licences(lila); shutil.rmtree(OUT, ignore_errors=True); os.makedirs(os.path.join(OUT, "piece")); os.makedirs(os.path.join(OUT, "board"))
    sets, left_out, notes = [], [], []
    for name in sorted(os.listdir(os.path.join(lila, "public", "piece")), key=str.lower):
        d = os.path.join(lila, "public", "piece", name); by, l, line = lic.get("piece/" + name.lower(), ("", "", ""))
        if not is_open(l) or not all(os.path.exists(os.path.join(d, c + ".svg")) for c in CODES): left_out.append(f"{name} ({l or 'no licence given'})"); continue
        os.makedirs(os.path.join(OUT, "piece", name.lower()))
        for c in CODES: shutil.copy(os.path.join(d, c + ".svg"), os.path.join(OUT, "piece", name.lower(), c + ".svg"))
        sets.append({"id": name.lower(), "name": title(name), "by": by, "licence": l}); notes.append(line)
    bdir = os.path.join(lila, "public", "images", "board"); boards = []
    _, blic, bline = lic["images/board"]; notes.append(bline)
    for n in sorted(os.listdir(bdir)):
        p = os.path.join(bdir, n)
        if os.path.isdir(p) or any(x in n for x in BOARD_SKIP) or n.startswith("ncf-") or not n.endswith((".jpg", ".png")): continue
        stem, ext = os.path.splitext(n); shutil.copy(p, os.path.join(OUT, "board", n))
        th = next((t for t in (stem + ".thumbnail" + ext, stem + ".thumbnail.jpg", stem + ".thumbnail.png") if os.path.exists(os.path.join(bdir, t))), None)
        if th: shutil.copy(os.path.join(bdir, th), os.path.join(OUT, "board", th))
        light, dark = squares(p)
        boards.append({"id": "lc-" + stem, "name": title(stem), "file": n, "thumb": th or n, "light": light, "dark": dark, "licence": blic})
    open(os.path.join(OUT, "COPYING.md"), "w", encoding="utf-8").write(
        "# Lichess artwork in Iron Ledger Chess\nCopied from https://github.com/lichess-org/lila (public/piece, public/images/board), with the lines of its\n"
        "COPYING.md that cover them. Only openly licensed sets are included; each keeps its author's licence.\n\n" + "\n".join(notes) + "\n")
    js = ("/* Written by tools/looks_pack.py from Lichess (lichess-org/lila) — don't edit by hand. Piece sets: vendor/lichess/piece/<id>/<wK…bP>.svg;\n"
          "   board pictures: vendor/lichess/board/<file>; light / dark = the measured mean colour of each picture's 32 light and 32 dark squares. */\n"
          f"export const LICHESS_SETS = {json.dumps(sets, ensure_ascii=False)};\nexport const LICHESS_BOARDS = {json.dumps(boards, ensure_ascii=False)};\n")
    open(os.path.join(SITE, "js", "looks-data.js"), "w", encoding="utf-8").write(js)
    print(f"{len(sets)} piece sets, {len(boards)} board pictures; left out: {', '.join(left_out)}")

if __name__ == "__main__": main(sys.argv[1])
