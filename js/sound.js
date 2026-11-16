/* Board sounds made on the spot (Web Audio): a wooden knock for a move, a heavier one for a capture, two notes for check,
   a short rising figure for a win. Nothing to download; off in Me → Settings. */
import { settings } from "./store.js";

const SOUNDS = {
  move: [{ f: 180, d: 0.06, g: 0.5, type: "triangle" }],
  capture: [{ f: 130, d: 0.09, g: 0.7, type: "triangle" }, { f: 90, d: 0.07, g: 0.4, type: "sine", at: 0.02 }],
  check: [{ f: 520, d: 0.08, g: 0.25, type: "sine" }, { f: 660, d: 0.1, g: 0.25, type: "sine", at: 0.09 }],
  win: [{ f: 392, d: 0.12, g: 0.25, type: "sine" }, { f: 494, d: 0.12, g: 0.25, type: "sine", at: 0.12 }, { f: 587, d: 0.25, g: 0.25, type: "sine", at: 0.24 }],
  end: [{ f: 330, d: 0.18, g: 0.2, type: "sine" }, { f: 262, d: 0.3, g: 0.2, type: "sine", at: 0.16 }],
};
let ctx = null;
export function sound(name) {
  if (!settings.sound || !SOUNDS[name]) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    for (const n of SOUNDS[name]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t0 + (n.at || 0);
      o.type = n.type; o.frequency.value = n.f; g.gain.setValueAtTime(n.g, at); g.gain.exponentialRampToValueAtTime(0.001, at + n.d);
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + n.d + 0.02);
    }
  } catch { /* no audio on this device */ }
}
