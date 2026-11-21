/* Small shared pieces of the screens: a mode card (design system: ModeCard) and text made safe for HTML. */
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
export function card(href, icon, name, line, extra = "") {
  return `<a class="ilc-card" href="${href}"${extra}><span class="ilc-card__icon" aria-hidden="true">${icon}</span><span><span class="ilc-card__name">${esc(name)}</span><span class="ilc-card__line">${esc(line)}</span></span><span class="ilc-card__go" aria-hidden="true">›</span></a>`;
}
/* 1.9.0: extra choices beside White / Black / Either — Swap (a rematch: the other colour from last game), In turn (The Ladder). */
export const SWAP = ["s", "Swap"], IN_TURN = ["t", "In turn"];
export function colorPicker(name, value, extra = []) {
  return `<div class="seg" role="radiogroup" aria-label="Your colour">${[["w", "White"], ["b", "Black"], ["r", "Either"], ...extra].map(([k, l]) =>
    `<label class="seg-opt"><input type="radio" name="${name}" value="${k}"${k === value ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
}
export function pickColor(v) { return v === "r" ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "w" : "b") : v; }
/* The colour for a rematch: Swap = the other one from the game just played; White / Black / Either as asked. */
export function rematchColor(pick, played) { return pick === SWAP[0] || !pick ? (played === "w" ? "b" : "w") : pickColor(pick); }
