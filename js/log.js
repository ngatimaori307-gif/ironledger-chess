/* Problem log: every uncaught error, refused promise, engine failure, lost connection and long stall is kept on the phone, and
   (unless switched off) sent to the developer's ntfy topic. report() is the text Me → Report a problem copies. */
import { APP, LOG } from "./config.js";

let entries = load();
let lastSent = 0, pending = null, sendOn = () => true;

function load() { try { return JSON.parse(localStorage.getItem(LOG.key) || "[]"); } catch { return []; } }
function save() { try { localStorage.setItem(LOG.key, JSON.stringify(entries.slice(-LOG.keep))); } catch { /* storage full or blocked */ } }

export function device() {
  const n = navigator, s = screen;
  return { ua: n.userAgent, lang: n.language, screen: `${s.width}×${s.height} @${devicePixelRatio}`, standalone: matchMedia("(display-mode: standalone)").matches || !!n.standalone,
    memory: n.deviceMemory || null, cores: n.hardwareConcurrency || null, online: n.onLine };
}

export function record(kind, message, extra = {}) {
  const e = { at: new Date().toISOString(), kind, message: String(message).slice(0, 500), screen: location.hash || "#home", ...extra };
  entries.push(e); entries = entries.slice(-LOG.keep); save();
  if (kind !== "info" && !(kind === "stall" && extra.ms < LOG.sendStallMs)) queueSend(e);
  return e;
}

function queueSend(e) {
  if (!sendOn() || !navigator.onLine) return;
  pending = e; const wait = Math.max(0, lastSent + LOG.sendAtMostEveryMs - Date.now());
  clearTimeout(queueSend.t); queueSend.t = setTimeout(flush, wait);
}
async function flush() {
  if (!pending) return; const e = pending; pending = null; lastSent = Date.now();
  const d = device();
  const body = `${e.kind}: ${e.message}\n${e.stack || ""}\nscreen ${e.screen} · ${APP.name} ${APP.version}\n${d.ua}\n${d.screen}${d.standalone ? " · home screen app" : ""}`;
  try { await fetch(LOG.ntfyUrl, { method: "POST", body, headers: { Title: `${APP.name}: ${e.kind}`, Tags: "warning" } }); }
  catch { /* offline or blocked: it stays in the phone's log */ }
}

export function report() {
  const d = device();
  const head = [`${APP.name} ${APP.version} (${APP.build})`, d.ua, `screen ${d.screen}${d.standalone ? ", home screen app" : ""}`, `cores ${d.cores ?? "?"} · memory ${d.memory ?? "?"} GB`, ""];
  return head.concat(entries.slice(-60).map((e) => `${e.at} [${e.kind}] ${e.screen} ${e.message}${e.stack ? "\n  " + e.stack.split("\n").slice(0, 4).join("\n  ") : ""}`)).join("\n");
}
export function count() { return entries.filter((e) => e.kind !== "info").length; }
export function clear() { entries = []; save(); }
export function setSending(fn) { sendOn = fn; }

export function install() {
  addEventListener("error", (ev) => record("error", ev.message || "error", { stack: ev.error && ev.error.stack, src: `${ev.filename || ""}:${ev.lineno || ""}` }));
  addEventListener("unhandledrejection", (ev) => { const r = ev.reason; record("promise", (r && r.message) || String(r), { stack: r && r.stack }); });
  let last = performance.now();
  const tick = (now) => { if (now - last > LOG.slowFrameMs && document.visibilityState === "visible") record("stall", `the page froze for ${Math.round(now - last)} ms`, { ms: Math.round(now - last) }); last = now; requestAnimationFrame(tick); };
  document.addEventListener("visibilitychange", () => { last = performance.now(); });
  requestAnimationFrame(tick);
  record("info", "opened");
}
