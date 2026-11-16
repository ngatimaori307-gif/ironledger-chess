/* Iron Ledger built-in piece set "Staunton wood" (v4.5): boxwood and ebony, drawn as side views, so they read as
   real pieces both from above and standing on the angled board. Original drawings; each is an SVG data URI keyed
   like the other sets: wK, wQ, wR, wB, wN, wP, bK … bP. */
(function () {          // v7.18: plain old JavaScript (no arrows, const or template text) so a TV's old browser draws them too
  var TONES = {
    w: { stops: ["#FFF1D2", "#EBC98E", "#C9964F", "#9C6A2E"], line: "#5E3E1A", accent: "#FFF6E3" },
    b: { stops: ["#7A5640", "#4A2F20", "#2A190F", "#120A06"], line: "#0A0503", accent: "#A07A5E" },
  };
  // bodies share one base and collar; each shape is a path in a 100 × 100 box, standing on y = 94
  var BASE = "M18 94 Q18 88 24 86 L76 86 Q82 88 82 94 Z M26 86 Q28 80 34 79 L66 79 Q72 80 74 86 Z";
  var SHAPES = {
    P: BASE + " M37 79 Q40 62 44 56 L56 56 Q60 62 63 79 Z M38 56 Q38 51 43 50 L57 50 Q62 51 62 56 Z M50 22 A13 13 0 1 1 49.9 22 Z M44 50 Q42 44 45 36 L55 36 Q58 44 56 50 Z",
    R: BASE + " M33 79 Q36 60 36 44 L64 44 Q64 60 67 79 Z M31 44 L31 24 L38 24 L38 30 L45 30 L45 24 L55 24 L55 30 L62 30 L62 24 L69 24 L69 44 Z",
    B: BASE + " M36 79 Q41 62 43 54 L57 54 Q59 62 64 79 Z M37 54 Q37 49 43 48 L57 48 Q63 49 63 54 Z M50 14 Q66 28 60 42 Q57 48 50 48 Q43 48 40 42 Q34 28 50 14 Z M50 8 A4.5 4.5 0 1 1 49.9 8 Z",
    Q: BASE + " M34 79 Q41 60 42 46 L58 46 Q59 60 66 79 Z M36 46 Q36 41 42 40 L58 40 Q64 41 64 46 Z M38 40 L32 20 L41 30 L45 16 L50 28 L55 16 L59 30 L68 20 L62 40 Z M50 7 A4.5 4.5 0 1 1 49.9 7 Z",
    K: BASE + " M34 79 Q41 60 42 46 L58 46 Q59 60 66 79 Z M36 46 Q36 41 42 40 L58 40 Q64 41 64 46 Z M38 40 Q34 26 42 22 L58 22 Q66 26 62 40 Z M47 3 L53 3 L53 9 L59 9 L59 14 L53 14 L53 21 L47 21 L47 14 L41 14 L41 9 L47 9 Z",
    N: BASE + " M30 79 Q30 64 38 54 Q30 50 28 40 Q27 30 36 20 L40 12 L45 18 Q58 16 66 26 Q74 36 73 48 L67 52 Q61 48 56 50 Q64 60 68 79 Z",
  };
  var DETAIL = {                        // light lines that give each piece its carving
    P: "M42 50 L58 50", R: "M36 44 L64 44 M34 60 L66 60", B: "M52 22 L45 34 M42 48 L58 48",
    Q: "M42 40 L58 40 M40 46 L60 46", K: "M42 40 L58 40 M40 46 L60 46", N: "M38 26 A2.6 2.6 0 1 1 37.9 26 M58 26 Q54 36 60 44",
  };
  var OFFSETS = [0.05, 0.35, 0.7, 1];
  function svg(c, p) {
    var t = TONES[c], id = "g" + c + p, stops = "";
    for (var i = 0; i < t.stops.length; i++) stops += '<stop offset="' + OFFSETS[i] + '" stop-color="' + t.stops[i] + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="' + id + '" x1="0" x2="1" y1="0" y2="0">' +
      stops + '</linearGradient></defs>' +
      '<path d="' + SHAPES[p] + '" fill="url(#' + id + ')" stroke="' + t.line + '" stroke-width="2.2" stroke-linejoin="round" fill-rule="nonzero"/>' +
      '<path d="' + DETAIL[p] + '" fill="none" stroke="' + t.accent + '" stroke-width="1.6" stroke-linecap="round" opacity=".55"/></svg>';
  }
  var set = {}, cs = "wb", ps = "KQRBNP";
  for (var a = 0; a < cs.length; a++) for (var b = 0; b < ps.length; b++) set[cs[a] + ps[b]] = "data:image/svg+xml;utf8," + encodeURIComponent(svg(cs[a], ps[b]));
  window.WOOD_PIECES = set;
})();
