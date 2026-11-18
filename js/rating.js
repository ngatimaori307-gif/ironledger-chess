/* The Profile's figures from his finished games: a Glicko-2 rating against the computer (a copy of Iron Ledger's elo.py: the same
   steps, constants and idle rule), the performance of his latest games, and his record by kind of opponent. Pure functions. */
import { RATING as R, ALL_OPPONENTS, KINDS } from "./config.js";

const POINTS = { win: 1, draw: 0.5, loss: 0 };
/* Glicko-2, one player */
export class Player {
  constructor(r = R.start, rd = R.startRd, vol = R.startVol) { this.mu = (r - R.start) / R.scale; this.phi = rd / R.scale; this.vol = vol; }
  get rating() { return R.start + R.scale * this.mu; }
  get rd() { return R.scale * this.phi; }
  idle(periods) { if (periods > 0) this.phi = Math.min(Math.sqrt(this.phi ** 2 + periods * this.vol ** 2), R.startRd / R.scale); }
  play(oppR, oppRd, score) { return this.period([[oppR, oppRd, score]]); }
  /* Glickman's steps 3–8 for one rating period of [oppR, oppRd, score]; returns the rating change */
  period(results) {
    const before = this.rating, terms = results.map(([r, rd, s]) => {
      const mu = (r - R.start) / R.scale, phi = rd / R.scale, g = 1 / Math.sqrt(1 + 3 * phi ** 2 / Math.PI ** 2);
      return [g, 1 / (1 + Math.exp(-g * (this.mu - mu))), s];
    });
    const v = 1 / terms.reduce((a, [g, e]) => a + g * g * e * (1 - e), 0), total = terms.reduce((a, [g, e, s]) => a + g * (s - e), 0), delta = v * total;
    this.vol = volatility(this.phi, this.vol, v, delta);
    const phiStar = Math.sqrt(this.phi ** 2 + this.vol ** 2);
    this.phi = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
    this.mu += this.phi ** 2 * total;
    return this.rating - before;
  }
}
function volatility(phi, sigma, v, delta) {             // Glickman's step 5 (the Illinois method)
  const a = Math.log(sigma ** 2), f = (x) => { const ex = Math.exp(x), d = phi ** 2 + v + ex; return ex * (delta ** 2 - d) / (2 * d * d) - (x - a) / R.tau ** 2; };
  let A = a, B;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else { let k = 1; while (f(a - k * R.tau) < 0) k++; B = a - k * R.tau; }
  let fa = f(A), fb = f(B);
  while (Math.abs(B - A) > R.volEps) {
    const C = A + (A - B) * fa / (fb - fa), fc = f(C);
    if (fc * fb <= 0) { A = B; fa = fb; } else fa /= 2;
    B = C; fb = fc;
  }
  return Math.exp(A / 2);
}
const expected = (r, opp) => 1 / (1 + 10 ** ((opp - r) / 400));
/* the rating at which the expected score equals the score made (a clean sweep or whitewash read half a point less or more) */
export function performance(rows) {
  if (!rows.length) return null;
  const n = rows.length; let s = rows.reduce((a, x) => a + x.s, 0); s = Math.min(Math.max(s, 0.5), n - 0.5);
  let [lo, hi] = R.perfRange;
  for (let i = 0; i < R.perfIter; i++) { const mid = (lo + hi) / 2; if (rows.reduce((a, x) => a + expected(mid, x.oe), 0) < s) lo = mid; else hi = mid; }
  return Math.round((lo + hi) / 2);
}

/* a kept game → its opponent's kind and rating (games kept before v1.4 carry only "Name · rating": read back from the list) */
export function opponentOf(g) {
  if (g.mode === "friend") return { kind: "friend", rating: null };
  if (g.kind) return { kind: g.kind, rating: g.oppRating ?? null };
  const name = String(g.opp || "").split(" · ")[0], o = ALL_OPPONENTS.find((x) => x.name === name);
  return o ? { kind: kindOf(o), rating: o.rating } : { kind: null, rating: null };
}
export const kindOf = (o) => (o.guard ? "guard" : o.m3 ? "m3" : o.maia ? "maia" : o.temp ? "weak" : "sf");

/* games: newest first, as kept → { rating, rd, low, high, provisional, n, perf, perfN, history, record, left } */
export function profile(games) {
  const rows = [], left = [];
  for (const g of [...games].reverse()) {
    const o = opponentOf(g);
    if (o.rating == null || !(g.mine in POINTS)) { if (o.kind !== "friend") left.push(g); continue; }
    rows.push({ at: g.at, oe: o.rating, rd: o.kind === "weak" ? R.oppRdRough : R.oppRd, s: POINTS[g.mine] });
  }
  const p = new Player(); let last = null; const history = [];
  for (const x of rows) {
    if (last) p.idle(Math.floor((x.at - last) / 864e5 / R.idleDays));
    p.play(x.oe, x.rd, x.s); last = x.at; history.push({ at: x.at, r: Math.round(p.rating), rd: Math.round(p.rd) });
  }
  const record = {};
  for (const g of games) {
    const k = opponentOf(g).kind || "other"; const c = (record[k] ||= { win: 0, draw: 0, loss: 0, n: 0, label: KINDS[k] || "Other" });
    if (g.mine in POINTS) { c[g.mine]++; c.n++; }
  }
  for (const c of Object.values(record)) c.score = c.n ? Math.round(100 * (c.win + c.draw / 2) / c.n) : null;
  const recent = rows.slice(-R.recent);
  return { rating: rows.length ? Math.round(p.rating) : null, rd: Math.round(p.rd), low: Math.round(p.rating - R.z * p.rd), high: Math.round(p.rating + R.z * p.rd),
    provisional: p.rd > R.provisionalRd, n: rows.length, perf: performance(recent), perfN: recent.length, history, record, left: left.length };
}
