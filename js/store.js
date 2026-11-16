/* What the app keeps on the phone: settings, the ladder, finished games and the game in progress (localStorage). */
import { STORE, DEFAULTS, GAMES_KEPT } from "./config.js";

function read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

export const settings = { ...DEFAULTS, ...read(STORE.settings, {}) };
export function saveSettings() { return write(STORE.settings, settings); }

export function ladder() { return read(STORE.ladder, { beaten: [] }); }
export function beat(id) { const l = ladder(); if (!l.beaten.includes(id)) l.beaten.push(id); write(STORE.ladder, l); return l; }

export function games() { return read(STORE.games, []); }
export function addGame(g) { const all = [g, ...games()].slice(0, GAMES_KEPT); write(STORE.games, all); return all; }

export function current() { return read(STORE.current, null); }
export function setCurrent(g) { if (g) write(STORE.current, g); else localStorage.removeItem(STORE.current); }

export function friendGames() { return read(STORE.friend, {}); }
export function saveFriendGame(code, g) { const all = friendGames(); all[code] = g; write(STORE.friend, all); }
