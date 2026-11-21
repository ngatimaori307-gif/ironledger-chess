/* 1.13.0 — spaced repetition, Iron Ledger's (fsrs.py, v8.05): FSRS-4.5 (Jarrett Ye, open-spaced-repetition) with its published
   default parameters, not fitted to him. Each puzzle he tries gets a memory state and a due day; it comes back when his chance of
   remembering it would fall to 90 %. Grades from a puzzle: wrong → Again (1), right but slower than HARD_S → Hard (2), right → Good
   (3), right within EASY_S → Easy (4). The maths is fsrs.py's line for line (tools/fsrs_check.mjs checks it against Iron Ledger). */
export const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
export const RETENTION = 0.9, HARD_S = 60, EASY_S = 10;
const DECAY = -0.5, FACTOR = 19 / 81, DAY = 86400;
const clamp = (d) => Math.min(10, Math.max(1, d));
const d0 = (g) => clamp(W[4] - (g - 3) * W[5]);
const retrievability = (days, s) => (1 + FACTOR * Math.max(0, days) / s) ** DECAY;
const interval = (s) => Math.max(1, Math.round(s / FACTOR * (RETENTION ** (1 / DECAY) - 1)));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
export function grade(ok, seconds) {
  if (!ok) return 1;
  if (seconds != null && seconds > HARD_S) return 2;
  if (seconds != null && seconds <= EASY_S) return 4;
  return 3;
}
/** The card after a review graded g (1–4); card null = first review. now in seconds. → { s, d, last, due, reps, lapses } */
export function review(card, g, now = Date.now() / 1000) {
  let s, d, reps, lapses;
  if (!card || !("s" in card)) { s = W[g - 1]; d = d0(g); reps = 0; lapses = 0; }
  else {
    s = card.s; d = card.d; const r = retrievability((now - card.last) / DAY, s);
    if (g === 1) s = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r));
    else s = s * (Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
    d = clamp(W[7] * d0(3) + (1 - W[7]) * (d - W[6] * (g - 3)));
    reps = card.reps || 0; lapses = (card.lapses || 0) + (g === 1 ? 1 : 0);
  }
  return { s: r4(s), d: r4(d), last: Math.trunc(now), due: Math.trunc(now + interval(s) * DAY), reps: reps + 1, lapses };
}
export const isDue = (card, now = Date.now() / 1000) => !card || !("due" in card) || card.due <= now;
