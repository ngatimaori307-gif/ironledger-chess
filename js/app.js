/* Iron Ledger Chess — the player build. Screens by the page's #name; the bottom bar: Home · Play · Friend · Me. */
import { APP, FRIEND, THEMES } from "./config.js";
import * as log from "./log.js";
import { settings } from "./store.js";
import { applyBoard } from "./looks.js";
import "./sound.js";                                           // v1.8: taps around the app and the fireside listen from the start

log.install();

const SCREENS = { home: "home", play: "play", computer: "computer", ladder: "ladder", hardcore: "hardcore", duel: "duel", friend: "friend", game: "game", me: "me", profile: "profile", replay: "replay", train: "train" };
const TAB_OF = { home: "home", play: "play", computer: "play", ladder: "play", hardcore: "play", duel: "play", game: "play", friend: "friend", me: "me", profile: "me", replay: "me", train: "train" };
const BOARD_SCREENS = ["game", "replay"];
let token = 0, leave = null;

export const view = () => document.getElementById("view");
export function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
export function applyTheme() {
  const t = THEMES.some((x) => x.id === settings.theme) ? settings.theme : THEMES[0].id;
  document.documentElement.dataset.theme = t;
}
export function toast(text) {
  const el = document.getElementById("toast"); el.textContent = text; el.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600);
}
export function onLeave(fn) { leave = fn; }

async function route() {
  const raw = location.hash.slice(1);
  const join = new RegExp(`^${FRIEND.joinHashKey}=([A-Za-z0-9]+)$`).exec(raw);
  const [name, arg] = join ? ["friend", "join:" + join[1]] : raw.split("/");
  const screen = SCREENS[name] || "home";
  if (leave) { try { leave(); } catch (e) { log.record("error", e.message, { stack: e.stack }); } leave = null; }
  document.documentElement.dataset.screen = screen;
  document.documentElement.toggleAttribute("data-board", BOARD_SCREENS.includes(screen));
  document.querySelectorAll(".ilc-tab").forEach((a) => { if (a.dataset.tab === TAB_OF[screen]) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  const mine = ++token;
  try {
    const mod = await import(`./screens/${screen}.js`);
    if (mine !== token) return;
    window.scrollTo(0, 0);
    await mod.render(view(), arg);
  } catch (e) {
    log.record("error", `screen ${screen}: ${e.message}`, { stack: e.stack });
    view().innerHTML = `<section class="pg"><h1 class="ilc-title">Something went wrong</h1><p>This screen couldn't open. It has been noted for the developer.</p><a class="ilc-btn" href="#home">Back to Home</a></section>`;
  }
}

applyTheme(); applyBoard();
document.title = APP.name;
addEventListener("hashchange", route);
route();
import("./presence.js").then((p) => p.start()).catch((e) => log.record("info", `invites not listened for: ${e.message}`));   // friends' invites pop up
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => log.record("info", `offline copy not set up: ${e.message}`));
