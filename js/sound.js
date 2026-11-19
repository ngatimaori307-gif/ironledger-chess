/* v1.8 — Iron Ledger's sounds, the same as the developer app (app.js v6.55–v7.77): every piece its own voice for a move and a
   capture (pawn steps, the knight's hooves, a bishop's chime, the rook's stone block, the queen's and king's royal aura; daggers,
   crossed swords and a falling wall when they take) — recordings from vendor/sounds/pieces, with sounds made in the page standing
   in until it has arrived; or "Struck metal", Iron Ledger's older bar sounds. A heartbeat while the king is in check, loud and
   steady until it is out. Taps, tabs and switches around the app as soft wood (Off / Soft / Full). And the fireside: a fire,
   rain, a café, an old library, a storm … quietly behind everything while the app is on screen.
   Recordings: Moodist (Pixabay licence / CC0) and Kenney's RPG Audio (CC0) — vendor/sounds/CREDITS.md. Each is shipped as Ogg Opus
   and AAC; the phone takes the one it can play. */
import { settings } from "./store.js";

let audio = null;
const ctx = () => { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); return audio; };
const EXT = (() => { try { return new Audio().canPlayType('audio/ogg; codecs="opus"') ? "ogg" : "m4a"; } catch { return "m4a"; } })();

/* ---- the made-in-page instruments (app.js: strike, knock, hiss, bell, clang, aura, heartbeat) ---- */
const BAR_PARTIALS = [[1, 1], [2.76, .45], [5.4, .2]];
let hammer = null, noise = null;
function strike(hz, at, ring, loud, hard) {
  const out = audio.createGain(); out.gain.setValueAtTime(loud, at); out.gain.exponentialRampToValueAtTime(.0008, at + ring); out.connect(audio.destination);
  for (const [ratio, share] of BAR_PARTIALS) {
    const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = hz * ratio;
    g.gain.setValueAtTime(share, at); g.gain.exponentialRampToValueAtTime(.0008, at + ring / ratio);
    o.connect(g).connect(out); o.start(at); o.stop(at + ring);
  }
  if (!hammer) { hammer = audio.createBuffer(1, Math.round(audio.sampleRate * .02), audio.sampleRate); const d = hammer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
  const blow = audio.createBufferSource(), bg = audio.createGain(); blow.buffer = hammer; bg.gain.value = loud * hard; blow.connect(bg).connect(audio.destination); blow.start(at);
}
function noiseBuf() {
  if (!noise) { noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return noise;
}
function hiss(at, len, loud, from, to, q = 1.2) {
  const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
  src.buffer = noiseBuf(); src.loop = true; f.type = "bandpass"; f.Q.value = q;
  f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + len);
  g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(loud, at + len * .25); g.gain.exponentialRampToValueAtTime(.0001, at + len);
  src.connect(f).connect(g).connect(audio.destination); src.start(at, Math.random() * 1.5); src.stop(at + len + .02);
}
function knock(hz, at, len, loud) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.setValueAtTime(hz * 1.5, at); o.frequency.exponentialRampToValueAtTime(hz, at + .012);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(loud, at + .003); g.gain.exponentialRampToValueAtTime(.0001, at + len);
  o.connect(g).connect(audio.destination); o.start(at); o.stop(at + len + .02);
  hiss(at, .012, loud * .6, hz * 4, hz * 4);
}
function bell(hz, at, ring, loud) {
  for (const [r, share] of [[1, 1], [2, .3], [3, .08]]) {
    const o = audio.createOscillator(), g = audio.createGain(); o.type = "sine"; o.frequency.value = hz * r;
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(loud * share, at + .012); g.gain.exponentialRampToValueAtTime(.0001, at + ring / r);
    o.connect(g).connect(audio.destination); o.start(at); o.stop(at + ring);
  }
}
function clang(hz, at, ring, loud) {
  for (const [r, share] of [[1, 1], [2.76, .6], [5.4, .35], [8.93, .2], [13.3, .12]]) {
    const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = hz * r * (1 + (Math.random() - .5) * .01);
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(loud * share, at + .002); g.gain.exponentialRampToValueAtTime(.0001, at + ring / Math.sqrt(r));
    o.connect(g).connect(audio.destination); o.start(at); o.stop(at + ring);
  }
  hiss(at, .04, loud * 1.4, 7000, 5000, .8); hiss(at + .015, .22, loud * .5, 6500, 2200, 1.4);
}
function aura(at, loud, chord = [1, 1.25, 1.5, 2]) {
  const base = 392;
  for (const k of chord) for (const d of [-3, 3]) {
    const o = audio.createOscillator(), g = audio.createGain(); o.type = "sine"; o.frequency.value = base * k; o.detune.value = d;
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(loud / chord.length, at + .18); g.gain.exponentialRampToValueAtTime(.0001, at + 1.6);
    o.connect(g).connect(audio.destination); o.start(at); o.stop(at + 1.7);
  }
  bell(base * 4, at + .12, 1.4, loud * .35); bell(base * 5, at + .24, 1.2, loud * .25);
}

/* ---- "Struck metal" (app.js SOUNDS) and the game's end ---- */
const SOUNDS = {
  move: [[1175, 0, .07, .10, .5]], capture: [[392, 0, .20, .16, 1]], check: [[1568, 0, .30, .11, .3]],
  castle: [[880, 0, .06, .10, .6], [659, .09, .09, .10, .6]], promote: [[1047, 0, .15, .08, .3], [1319, .08, .2, .08, .3], [1568, .16, .4, .08, .2]],
  good: [[784, 0, .14, .12, .4], [1175, .10, .30, .12, .3]], bad: [[220, 0, .16, .15, 1], [165, .12, .28, .15, .8]],
  plate: [[523, 0, .5, .11, .7], [784, .13, .5, .10, .4], [1047, .26, .8, .10, .3]],
};
const END_SOUND = { win: "good", end: "plate", loss: "bad" };

/* ---- each piece its own voice (app.js PIECE_SPRITE, PIECE_MOVE, PIECE_TAKE, SYNTH_*) ---- */
const PIECE_SPRITE = { drawKnife1: [0.0, 0.3997], drawKnife2: [0.5197, 0.4458], knifeSlice: [1.0855, 0.5995], knifeSlice2: [1.8051, 0.5688], metalPot1: [2.4939, 1.4605], metalPot3: [4.0743, 0.907], footstep00: [5.1013, 0.2489], footstep03: [5.4702, 0.269], footstep05: [5.8592, 0.2758], chop: [6.255, 0.2402], doorClose_1: [6.6152, 0.675], doorClose_4: [7.4103, 0.6034], gallop: [8.1336, 1.15] };
const PIECE_CLIP_GAIN = .28, CLIP_VARY = { pitch: 0.04, level: 0.05 };
const anyOf = (...n) => n[Math.floor(Math.random() * n.length)], vary = (s) => 1 + (Math.random() * 2 - 1) * s;
const recordings = {};
function recording(name) {
  if (!recordings[name]) recordings[name] = fetch(`vendor/sounds/${name}.${EXT}`).then((r) => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.arrayBuffer(); })
    .then((b) => new Promise((ok, no) => audio.decodeAudioData(b, ok, no))).catch((e) => { delete recordings[name]; throw e; });
  return recordings[name];
}
let clipBuf = null, clipAsked = false;
function piecesLoad() {
  if (clipBuf || clipAsked || !settings.sound || settings.pieceVoices === "metal") return;
  clipAsked = true; try { ctx(); } catch { return; }
  recording("pieces").then((b) => { clipBuf = b; }).catch(() => { clipAsked = false; });
}
function clip(name, t, level, rate = 1) {
  if (!clipBuf) return false;
  const [from, len] = PIECE_SPRITE[name], src = audio.createBufferSource(), g = audio.createGain();
  src.buffer = clipBuf; src.playbackRate.value = rate * vary(CLIP_VARY.pitch); g.gain.value = level * PIECE_CLIP_GAIN * vary(CLIP_VARY.level);
  src.connect(g).connect(audio.destination); src.start(t, from, len); return true;
}
const SYNTH_MOVE = {
  p: (t) => { knock(760, t, .05, .16); hiss(t, .03, .04, 3000, 2000, 2); },
  n: (t) => { knock(430, t, .05, .2); knock(340, t + .09, .05, .17); knock(430, t + .26, .05, .2); knock(340, t + .35, .05, .17); },
  b: (t) => { hiss(t, .28, .12, 900, 3600, .9); knock(300, t + .2, .06, .12); },
  r: (t) => { hiss(t, .38, .18, 420, 220, .7); knock(170, t + .3, .14, .26); },
  q: (t) => { aura(t, .05, [1, 1.25, 1.5]); knock(520, t, .05, .12); },
  k: (t) => { knock(190, t, .09, .26); knock(175, t + .28, .09, .22); },
};
const SYNTH_TAKE = {
  p: (t) => { clang(1250, t, .35, .07); knock(600, t, .05, .14); },
  n: (t) => { clang(640, t, .9, .09); clang(700, t + .11, .7, .06); },
  b: (t) => { clang(560, t, 1.0, .09); clang(610, t + .13, .8, .06); },
  r: (t) => { knock(130, t, .3, .3); hiss(t + .02, .45, .2, 900, 260, .6); },
  q: (t) => { clang(820, t, .6, .05); aura(t + .05, .12); },
  k: (t) => { clang(700, t, .5, .04); aura(t + .05, .12, [1, 1.26, 1.5, 1.89, 2]); },
};
const PIECE_MOVE = {
  p: (t) => clip(anyOf("footstep00", "footstep03", "footstep05"), t, .7) || SYNTH_MOVE.p(t),
  n: (t) => clip("gallop", t, .9) || SYNTH_MOVE.n(t),
  b: (t) => (clip(anyOf("footstep03", "footstep05"), t, .5) && (bell(1318, t + .04, .7, .035), bell(1976, t + .1, .6, .02), true)) || SYNTH_MOVE.b(t),
  r: (t) => (hiss(t, .26, .07, 320, 180, .8), clip("chop", t + .18, .7, .7) && clip("doorClose_4", t + .2, .8, .62)) || SYNTH_MOVE.r(t),
  q: (t) => SYNTH_MOVE.q(t), k: (t) => SYNTH_MOVE.k(t),
};
const PIECE_TAKE = {
  p: (t) => (clip(anyOf("knifeSlice", "knifeSlice2"), t, .9) && clip("metalPot3", t + .08, .3, 1.5)) || SYNTH_TAKE.p(t),
  n: (t) => (clip(anyOf("drawKnife1", "drawKnife2"), t, .8) && clip("metalPot1", t + .12, .7)) || SYNTH_TAKE.n(t),
  b: (t) => (clip(anyOf("knifeSlice", "knifeSlice2"), t, .85) && clip("drawKnife2", t + .12, .5, 1.15)) || SYNTH_TAKE.b(t),
  r: (t) => (clip("doorClose_1", t, 1, .62) && clip("chop", t + .14, .9, .7) && (knock(120, t + .14, .3, .22), hiss(t + .2, .5, .12, 600, 160, .6), true)) || SYNTH_TAKE.r(t),
  q: (t) => SYNTH_TAKE.q(t), k: (t) => SYNTH_TAKE.k(t),
};

/* sound(kind, move): kind "move" | "capture" | "check" | "win" | "end" | "loss"; move = chess.js's verbose move, when there is one */
export function sound(kind, mv = null) {
  if (!settings.sound) return;
  try {
    ctx(); piecesLoad();
    const t = audio.currentTime + .005;
    if (mv && settings.pieceVoices !== "metal" && (kind === "move" || kind === "capture")) {
      const p = PIECE_MOVE[mv.piece] ? mv.piece : "p", fl = mv.flags || "";
      if (mv.captured) PIECE_TAKE[p](t); else if (fl.includes("k") || fl.includes("q")) { PIECE_MOVE.k(t); PIECE_MOVE.r(t + .25); }
      else if (mv.promotion) { PIECE_MOVE.p(t); aura(t + .1, .14); } else PIECE_MOVE[p](t);
      return;
    }
    if (mv && kind === "move") kind = (mv.flags || "").includes("k") || (mv.flags || "").includes("q") ? "castle" : mv.promotion ? "promote" : kind;
    if (kind === "check" && settings.checkBeat !== false) return;                         // the heartbeat says it (checkBeat below)
    const s = SOUNDS[END_SOUND[kind] || kind]; if (s) for (const [hz, w, r, l, h] of s) strike(hz, t + w, r, l, h);
  } catch { /* no sound on this phone */ }
}
/* Ask early (a board on screen): the pieces' recording arrives before the first move. */
export function warm() { try { piecesLoad(); } catch { /* none */ } }

/* ---- the heartbeat in check (app.js heartLoop: one lub-dub every 760 ms until the position changes, the board leaves, the app
   goes to the background or 5 minutes pass) ---- */
const HEART_PERIOD_MS = 760, HEART_MAX_MS = 300000, HEART_LOUD = .9, HEART_FIRST_MS = 420;
let heartBus = null;
function heartbeat(at, loud) {
  if (!heartBus) { heartBus = audio.createDynamicsCompressor(); heartBus.threshold.value = -14; heartBus.knee.value = 6; heartBus.ratio.value = 8;
    heartBus.attack.value = .002; heartBus.release.value = .12; heartBus.connect(audio.destination); }
  for (const [t, l] of [[0, 1], [.2, .72]]) {
    for (const [mul, share] of [[1, 1], [2, .55]]) {
      const o = audio.createOscillator(), g = audio.createGain(), f = audio.createBiquadFilter(); o.type = "triangle"; f.type = "lowpass"; f.frequency.value = 520;
      o.frequency.setValueAtTime(120 * mul, at + t); o.frequency.exponentialRampToValueAtTime(58 * mul, at + t + .14);
      g.gain.setValueAtTime(.0001, at + t); g.gain.exponentialRampToValueAtTime(loud * l * share, at + t + .012); g.gain.exponentialRampToValueAtTime(.0001, at + t + .22);
      o.connect(f).connect(g).connect(heartBus); o.start(at + t); o.stop(at + t + .24);
    }
    const n = audio.createBufferSource(), ng = audio.createGain(), nf = audio.createBiquadFilter(); n.buffer = noiseBuf(); nf.type = "lowpass"; nf.frequency.value = 380;
    ng.gain.setValueAtTime(.0001, at + t); ng.gain.exponentialRampToValueAtTime(loud * l * .5, at + t + .005); ng.gain.exponentialRampToValueAtTime(.0001, at + t + .08);
    n.connect(nf).connect(ng).connect(heartBus); n.start(at + t, Math.random(), .1);
  }
}
const heart = { key: "", timer: 0, since: 0, alive: null };
export function heartStop() { clearTimeout(heart.timer); heart.timer = 0; heart.key = ""; heart.alive = null; }
/* key: the position (FEN); inCheck: the side to move is in check; alive(): the board is still on screen */
export function checkBeat(key, inCheck, alive = () => true) {
  if (!inCheck) { heartStop(); return; }
  if (heart.key === key) return;
  heartStop(); if (!settings.sound || settings.checkBeat === false) return;
  heart.key = key; heart.since = performance.now(); heart.alive = alive;
  const beat = () => {
    if (heart.key !== key || !heart.alive() || document.hidden || !settings.sound || settings.checkBeat === false || performance.now() - heart.since > HEART_MAX_MS) { heartStop(); return; }
    try { ctx(); heartbeat(audio.currentTime + .01, HEART_LOUD); } catch { /* none */ }
    heart.timer = setTimeout(beat, HEART_PERIOD_MS);
  };
  heart.timer = setTimeout(beat, HEART_FIRST_MS);
}
document.addEventListener("visibilitychange", () => { if (document.hidden) heartStop(); });

/* ---- sounds around the app (app.js UI_SOUNDS, uiSound and its tap listener) ---- */
const UI_GAP_MS = 45, UI_AFTER_MS = 400;
const UI_SOUNDS = {
  tap: (t, v) => knock(520, t, .07, .18 * v), tab: (t, v) => knock(330, t, .10, .22 * v),
  on: (t, v) => { knock(620, t, .05, .16 * v); knock(880, t + .05, .06, .14 * v); }, off: (t, v) => { knock(700, t, .05, .14 * v); knock(470, t + .05, .07, .14 * v); },
  open: (t, v) => { knock(150, t, .16, .26 * v); hiss(t + .02, .3, .09 * v, 600, 2400, .7); },
  notify: (t, v) => { bell(784, t, .9, .07 * v); bell(1175, t + .11, 1.1, .06 * v); }, error: (t, v) => { knock(200, t, .09, .24 * v); knock(170, t + .13, .11, .24 * v); },
};
let uiAt = 0;
export function uiSound(kind) {
  if (!settings.uiSound || settings.uiSound === "off" || !UI_SOUNDS[kind]) return;
  const now = performance.now(), since = now - uiAt;
  if (since < UI_GAP_MS || (kind === "notify" && since < UI_AFTER_MS)) return;
  try { ctx(); UI_SOUNDS[kind](audio.currentTime + .005, settings.uiSound === "on" ? 1 : .55); uiAt = now; } catch { /* none */ }
}
document.addEventListener("click", (e) => {
  const el = e.target.closest && e.target.closest("button, a[href], summary, [role=button], label.seg-opt, label.look-tile, label.theme, label.switch");
  if (!el || el.closest(".bd")) return;
  if (el.matches(".switch")) { const i = el.querySelector("input"); uiSound(i && !i.checked ? "on" : "off"); }   // the box changes after this click
  else if (el.closest(".ilc-tabbar")) uiSound("tab"); else uiSound("tap");
}, { capture: true });

/* ---- the fireside (app.js SCENES, firesideApply) ---- */
export const SCENES = {
  fire: [["fire", 1]], rain: [["rain", 1]], both: [["fire", 1], ["rain", .35]], cafe: [["cafe", 1], ["fire", .12]],
  library: [["library", .8], ["clock", .35], ["fire", .3], ["pages", .8]], candle: [["fire", .7], ["clock", .3], ["crickets", .22]],
  storm: [["storm", 1], ["heavyrain", .35], ["wind", .45], ["fire", .25]], tea: [["kettle", .45], ["fire", .55], ["rain", .25], ["clock", .25]],
};
export const SCENE_NAMES = [["off", "Off"], ["fire", "Crackling fire"], ["rain", "Rain on the window"], ["both", "Fire and rain"], ["cafe", "Coffee house"],
  ["library", "Old library"], ["candle", "Candlelit night"], ["storm", "Storm outside"], ["tea", "Tea by the window"]];
export const SCENE_VOLUMES = [[0.3, "Quiet"], [0.6, "Medium"], [1, "Loud"]];
const SCENE_EVENTS = { pages: { every: [20, 45], at: [5.2, 6.7, 8.1, 10.8, 12.2], len: 1.2 } };
const AMBIENCE_GAIN = .6;
const fire = { key: "", beds: [], timers: [] };
function fireStop() {
  for (const t of fire.timers) clearTimeout(t);
  for (const b of fire.beds) { try { b.g.gain.setTargetAtTime(.0001, audio.currentTime, .4); b.src.stop(audio.currentTime + 2); } catch { /* gone */ } }
  fire.beds = []; fire.timers = []; fire.key = "";
}
async function fireLoop(name, level, key) {
  const buf = await recording(name); if (fire.key !== key) return;
  const src = audio.createBufferSource(), g = audio.createGain(); src.buffer = buf; src.loop = true;
  g.gain.value = .0001; g.gain.setTargetAtTime(level, audio.currentTime, 1.5);
  src.connect(g).connect(audio.destination); src.start(0, Math.random() * buf.duration); fire.beds.push({ src, g });
}
function fireEvent(name, level, key) {
  const ev = SCENE_EVENTS[name], wait = 1000 * (ev.every[0] + Math.random() * (ev.every[1] - ev.every[0]));
  fire.timers.push(setTimeout(async () => {
    if (fire.key !== key) return;
    try { const buf = await recording(name), at = audio.currentTime + .02, from = ev.at[Math.floor(Math.random() * ev.at.length)];
      const src = audio.createBufferSource(), g = audio.createGain(); src.buffer = buf;
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(level, at + .05); g.gain.setTargetAtTime(.0001, at + ev.len - .2, .08);
      src.connect(g).connect(audio.destination); src.start(at, from, ev.len); } catch { /* not this time */ }
    fireEvent(name, level, key);
  }, wait));
}
/* After a setting changes, a first tap (a phone starts sound only after one) or the app coming back on screen. */
export function fireside() {
  const a = settings.ambience, want = a && a !== "off" && SCENES[a] && document.visibilityState === "visible" ? a : "", key = want && `${want}@${settings.ambienceVol}`;
  if (key === fire.key) return;
  try {
    ctx(); fireStop(); if (!want) return;
    const v = (Number(settings.ambienceVol) || .6) * AMBIENCE_GAIN; fire.key = key;
    for (const [name, level] of SCENES[want]) { if (SCENE_EVENTS[name]) fireEvent(name, level * v, key); else fireLoop(name, level * v, key).catch(() => {}); }
  } catch { /* no sound */ }
}
document.addEventListener("visibilitychange", fireside);
document.addEventListener("pointerdown", () => { if (settings.ambience && settings.ambience !== "off" && !fire.key) fireside(); }, { capture: true });
