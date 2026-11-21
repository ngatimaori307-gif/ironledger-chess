/* 1.10.0 — arrows drawn as shapes, Iron Ledger's own (app/arrowart.js, v8.12, by the developer of Iron Ledger): a shaft that widens
   from a rounded tail, a head with swept-back barbs and a notched back, a dark hairline edge, an offset shadow (no blur) and a
   light streak; a knight's arrow turns on the corner of its L. Your own arrows (✎ Draw) come in four inks, numbered in the order
   drawn when an ink holds a path of two or more. The maths below is Iron Ledger's, unchanged; board units are squares (0–8). */

  var DASHED = { planx: 1, ghost: 1, ghostx: 1, xray: 1 };    // kinds drawn as a dashed line (their own CSS)
  var TAIL = 0.32;            // the shaft's half-width at its tail, as a share of the arrow's width
  var NECK = 0.55;            // … and where it meets the head
  var HEAD_W = 1.3;           // the head's half-width, in arrow widths …
  var HEAD_PAD = 0.05;        // … plus this many squares
  var HEAD_L = 1.5;           // the head's length, in arrow widths …
  var HEAD_L_MIN = 0.2;       // … at least this many squares …
  var HEAD_L_SHARE = 0.5;     // … and at most this share of the arrow's length
  var NOTCH = 0.72;           // the head's back is notched: the shaft meets it this far back along the head
  var SHADOW_DX = 0.035, SHADOW_DY = 0.05;   // the shadow's offset, in squares (light from the top left, as the board's)
  var SHINE = 0.45;           // the light streak's width, as a share of the tail's
  var INKS = 4;               // your arrows' inks: orange (as before), green, blue, red

  function f(n) { return Math.round(n * 1000) / 1000; }
  function pt(x, y) { return f(x) + "," + f(y); }

  /* The shape's outline, for a shaft through pts (two points, or three for a knight) ending in a head at the last point. */
  function geometry(pts, w) {
    var a = pts[pts.length - 2], b = pts[pts.length - 1];
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var whole = 0; for (var i = 1; i < pts.length; i++) whole += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    var hl = Math.min(Math.max(HEAD_L * w, HEAD_L_MIN), whole * HEAD_L_SHARE, len * 0.9), hw = HEAD_W * w + HEAD_PAD;
    var base = [b[0] - ux * hl, b[1] - uy * hl], neck = [b[0] - ux * hl * NOTCH, b[1] - uy * hl * NOTCH];
    return { a: a, b: b, ux: ux, uy: uy, nx: nx, ny: ny, hl: hl, hw: hw, base: base, neck: neck };
  }
  /* A straight arrow: one closed shape, tail rounded. */
  function straightPath(x1, y1, x2, y2, w) {
    var g = geometry([[x1, y1], [x2, y2]], w), t0 = TAIL * w, t1 = NECK * w;
    var tl = [x1 + g.nx * t0, y1 + g.ny * t0], tr = [x1 - g.nx * t0, y1 - g.ny * t0];
    var nl = [g.neck[0] + g.nx * t1, g.neck[1] + g.ny * t1], nr = [g.neck[0] - g.nx * t1, g.neck[1] - g.ny * t1];
    var bl = [g.base[0] + g.nx * g.hw, g.base[1] + g.ny * g.hw], br = [g.base[0] - g.nx * g.hw, g.base[1] - g.ny * g.hw];
    return { d: "M" + pt(tl[0], tl[1]) + "L" + pt(nl[0], nl[1]) + "L" + pt(bl[0], bl[1]) + "L" + pt(x2, y2) + "L" + pt(br[0], br[1]) +
      "L" + pt(nr[0], nr[1]) + "L" + pt(tr[0], tr[1]) + "A" + f(t0) + " " + f(t0) + " 0 0 1 " + pt(tl[0], tl[1]) + "Z", g: g };
  }
  /* The head alone (for a knight's L or a dashed shaft). */
  function headPath(g, w) {
    var t1 = NECK * w, nl = [g.neck[0] + g.nx * t1, g.neck[1] + g.ny * t1], nr = [g.neck[0] - g.nx * t1, g.neck[1] - g.ny * t1];
    var bl = [g.base[0] + g.nx * g.hw, g.base[1] + g.ny * g.hw], br = [g.base[0] - g.nx * g.hw, g.base[1] - g.ny * g.hw];
    return "M" + pt(nl[0], nl[1]) + "L" + pt(bl[0], bl[1]) + "L" + pt(g.b[0], g.b[1]) + "L" + pt(br[0], br[1]) + "L" + pt(nr[0], nr[1]) + "Z";
  }
  function shift(s) { return ' transform="translate(' + SHADOW_DX + " " + SHADOW_DY + ')"'; }

  /* An arrow as SVG. cls: its kind (eng, usr, usr1…, plan, planx, xray, trail, ghost, ghostx); w: its width in squares;
     bend: the knight's corner [x, y] or null. */
  function svg(x1, y1, x2, y2, cls, w, bend) {
    var pts = bend ? [[x1, y1], bend, [x2, y2]] : [[x1, y1], [x2, y2]], g = geometry(pts, w);
    var shaftEnd = [g.neck[0], g.neck[1]], head = headPath(g, w), out = "";
    if (!bend && !DASHED[cls]) {
      var s = straightPath(x1, y1, x2, y2, w);
      out += '<path class="ash" d="' + s.d + '"' + shift() + "/>";
      out += '<path class="' + cls + '-head ab" d="' + s.d + '"/>';
    } else {
      var line = "M" + pts.slice(0, -1).map(function (p) { return pt(p[0], p[1]); }).join("L") + "L" + pt(shaftEnd[0], shaftEnd[1]);
      var sw = f(2 * NECK * w);
      out += '<path class="ash ash-line" d="' + line + '" stroke-width="' + sw + '"' + shift() + "/>";
      out += '<path class="ash" d="' + head + '"' + shift() + "/>";
      out += '<path class="' + cls + (bend ? " bend" : "") + ' as" d="' + line + '" stroke-width="' + sw + '"/>';
      out += '<path class="' + cls + '-head ab" d="' + head + '"/>';
    }
    if (!DASHED[cls]) {                       // the light streak along the shaft, tail to neck
      var a0 = pts[0], a1 = bend ? bend : shaftEnd;
      out += '<path class="ahl" d="M' + pt(a0[0] - g.nx * TAIL * w * 0.35, a0[1] - g.ny * TAIL * w * 0.35) + "L" + pt(a1[0] - g.nx * TAIL * w * 0.35, a1[1] - g.ny * TAIL * w * 0.35) +
        '" stroke-width="' + f(TAIL * w * SHINE) + '"/>';
    }
    return out;
  }
  /* Your arrows ("e2e4" ink 0, "e2e4~2" ink 2): each in its ink; an ink holding two or more arrows is a path, numbered in the
     order drawn. draw(from, to, cls) and number(sq, n, cls) are the board's own. */
  function ink(a) { var k = +(String(a).split("~")[1] || 0); return k > 0 && k < INKS ? k : 0; }
  function kind(a) { var k = ink(a); return k ? "usr" + k : "usr"; }
  function mine(list, draw, number) {
    var seen = {}, count = {}, out = "";
    (list || []).forEach(function (a) { count[ink(a)] = (count[ink(a)] || 0) + 1; });
    (list || []).forEach(function (a) {
      var k = ink(a); seen[k] = (seen[k] || 0) + 1;
      out += draw(a.slice(0, 2), a.slice(2, 4), kind(a)) + (count[k] > 1 ? number(a.slice(2, 4), seen[k], kind(a)) : "");
    });
    return out;
  }

export { svg, mine, ink, kind, INKS, DASHED };
