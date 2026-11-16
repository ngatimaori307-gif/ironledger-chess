/* Small shared pieces of the screens: a mode card (design system: ModeCard) and text made safe for HTML. */
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
export function card(href, icon, name, line, extra = "") {
  return `<a class="ilc-card" href="${href}"${extra}><span class="ilc-card__icon" aria-hidden="true">${icon}</span><span><span class="ilc-card__name">${esc(name)}</span><span class="ilc-card__line">${esc(line)}</span></span><span class="ilc-card__go" aria-hidden="true">›</span></a>`;
}
export function colorPicker(name, value) {
  return `<div class="seg" role="radiogroup" aria-label="Your colour">${[["w", "White"], ["b", "Black"], ["r", "Either"]].map(([k, l]) =>
    `<label class="seg-opt"><input type="radio" name="${name}" value="${k}"${k === value ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
}
export function pickColor(v) { return v === "r" ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "w" : "b") : v; }
