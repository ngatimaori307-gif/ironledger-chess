/* 1.15.0 — Iron Ledger v8.31's eye-strain log (eyes.py), on this phone: after each game one tap — eyes 1 (fresh) … 5 (sore), with
   glasses on or off — kept in localStorage; Profile compares glasses on with off, and evening with day, by a two-sided permutation
   test of the mean rating (EYES.permutations shuffles, a fixed seed so the same log always gives the same answer), each p doubled for
   the two comparisons (Bonferroni) and weighed against EYES.alpha; nothing is read below EYES.minN ratings a side. Every figure with
   its n. The same constants as Iron Ledger's config.py EYES_*. */
export const EYES = { ratings: [1, 2, 3, 4, 5], minN: 5, alpha: 0.05, permutations: 5000, seed: 31, eveningHour: 18, key: "ilc-eyes", glassesKey: "ilc-eyes-glasses", kept: 2000 };
const WORDS = { 1: "fresh", 3: "tired", 5: "sore" };
function read() { try { const v = JSON.parse(localStorage.getItem(EYES.key)); return Array.isArray(v) ? v : []; } catch { return []; } }
export function rows() { return read().filter((r) => r && EYES.ratings.includes(r.rating) && typeof r.glasses === "boolean" && Number.isInteger(r.hour)); }
export function add(rating, glasses, kind = "game", now = Date.now()) {
  if (!EYES.ratings.includes(rating)) throw new Error("a rating from 1 to 5");
  const row = { t: Math.round(now / 1000), rating, glasses: !!glasses, hour: new Date(now).getHours(), kind };
  const all = [...read(), row].slice(-EYES.kept);
  try { localStorage.setItem(EYES.key, JSON.stringify(all)); localStorage.setItem(EYES.glassesKey, glasses ? "1" : "0"); } catch { /* storage full: not kept */ }
  return row;
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function permP(a, b, n = EYES.permutations, seed = EYES.seed) {
  if (!a.length || !b.length) return 1;
  const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length, obs = Math.abs(mean(a) - mean(b)), pool = [...a, ...b], k = a.length, r = rng(seed);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    for (let j = pool.length - 1; j > 0; j--) { const q = Math.floor(r() * (j + 1)); [pool[j], pool[q]] = [pool[q], pool[j]]; }
    let sa = 0, sb = 0; for (let j = 0; j < pool.length; j++) if (j < k) sa += pool[j]; else sb += pool[j];
    if (Math.abs(sa / k - sb / (pool.length - k)) >= obs - 1e-12) hits++;
  }
  return (hits + 1) / (n + 1);
}
export function compare(name, aLabel, a, bLabel, b, tests) {
  const m = (x) => x.length ? Math.round(100 * x.reduce((s, v) => s + v, 0) / x.length) / 100 : null;
  const out = { what: name, a: { label: aLabel, n: a.length, mean: m(a) }, b: { label: bLabel, n: b.length, mean: m(b) } };
  if (a.length < EYES.minN || b.length < EYES.minN) return { ...out, verdict: "too few yet", say: `${name}: ${a.length} and ${b.length} ratings — at least ${EYES.minN} each are needed before any difference is read` };
  const p = Math.min(1, permP(a, b) * tests), d = out.a.mean - out.b.mean;
  if (p < EYES.alpha) return { ...out, p, verdict: "bigger than chance", say: `${name}: eyes rated ${Math.abs(d).toFixed(1)} lower ${d < 0 ? aLabel : bLabel} (means ${out.a.mean} vs ${out.b.mean}, n ${a.length} and ${b.length}; p ${p.toFixed(3)} after counting the ${tests} comparisons)` };
  return { ...out, p, verdict: "within chance", say: `${name}: means ${out.a.mean} vs ${out.b.mean} (n ${a.length} and ${b.length}) — within chance (p ${p.toFixed(2)} after counting the ${tests} comparisons)` };
}
export function summary(rs = rows()) {
  const on = rs.filter((r) => r.glasses).map((r) => r.rating), off = rs.filter((r) => !r.glasses).map((r) => r.rating);
  const day = rs.filter((r) => r.hour < EYES.eveningHour).map((r) => r.rating), eve = rs.filter((r) => r.hour >= EYES.eveningHour).map((r) => r.rating);
  return { n: rs.length, comparisons: [compare("Glasses on against off", "with glasses", on, "without", off, 2),
    compare(`Evening (from ${EYES.eveningHour}:00) against day`, "in the evening", eve, "in the day", day, 2)] };
}
/* The question on a game's end plate: five numbers and the glasses button (the last answer remembered). */
export function ask(host, kind) {
  let g = false; try { g = localStorage.getItem(EYES.glassesKey) === "1"; } catch { /* private mode */ }
  host.innerHTML = `<span class="eyes-q">Your eyes now</span>${EYES.ratings.map((n) => `<button class="ilc-btn eyes-n" data-eyes="${n}" aria-label="${n}${WORDS[n] ? " " + WORDS[n] : ""}">${n}${WORDS[n] ? `<small>${WORDS[n]}</small>` : ""}</button>`).join("")}
    <button class="ilc-btn eyes-g" aria-pressed="${g}">${g ? "Glasses on" : "No glasses"}</button>`;
  host.onclick = (e) => {
    const gb = e.target.closest(".eyes-g");
    if (gb) { const on = gb.getAttribute("aria-pressed") !== "true"; gb.setAttribute("aria-pressed", String(on)); gb.textContent = on ? "Glasses on" : "No glasses"; return; }
    const b = e.target.closest("[data-eyes]"); if (!b) return;
    const on = host.querySelector(".eyes-g").getAttribute("aria-pressed") === "true";
    add(+b.dataset.eyes, on, kind); host.innerHTML = `<span class="ilc-card__line">Noted: ${b.dataset.eyes}${on ? ", glasses on" : ", no glasses"} — Me → Profile → Eyes and glasses.</span>`;
  };
}
