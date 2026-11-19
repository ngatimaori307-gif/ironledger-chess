/* v1.7 — boards and 2D piece sets, as Iron Ledger offers them (app.css data-board colours; the Lichess sets and board pictures it
   downloads; its built-in "Staunton wood"). Here they ship with the site (tools/looks_pack.py → vendor/lichess, js/looks-data.js)
   and are fetched only when chosen, then kept offline (sw.js). The board is independent of the look (Me → Look): "The look's
   colours" follows it, any other board replaces its two square colours, and a picture board lies under transparent squares. */
import { LICHESS_SETS, LICHESS_BOARDS } from "./looks-data.js";
import { settings } from "./store.js";

export const WOOD = "wood";
export const LOOK_BOARD = "look";
/* Iron Ledger's own colour boards (app.css: :root and :root[data-board=…]) */
export const OWN_BOARDS = [
  { id: LOOK_BOARD, name: "The look's colours" },
  { id: "steel", name: "Steel", light: "#D8D2C4", dark: "#7F8C96" }, { id: "walnut", name: "Walnut", light: "#E3CFA8", dark: "#9A6B43" },
  { id: "slate", name: "Slate", light: "#C9D1D6", dark: "#56636E" }, { id: "moss", name: "Moss", light: "#DDE3CF", dark: "#6F8559" },
];
export const BOARDS = [...OWN_BOARDS, ...LICHESS_BOARDS];
export const PIECE_SETS = [{ id: WOOD, name: "Staunton wood", by: "Iron Ledger", licence: "the app's own" }, ...LICHESS_SETS];
const DIR = "vendor/lichess/";

export const pieceSet = () => PIECE_SETS.find((s) => s.id === settings.pieces) || PIECE_SETS[0];
export const board = () => BOARDS.find((b) => b.id === settings.board) || BOARDS[0];
/* code: "wK" … "bP" */
export function pieceSrc(code, id = pieceSet().id) {
  if (id === WOOD || !PIECE_SETS.some((s) => s.id === id)) return window.WOOD_PIECES[code];
  return `${DIR}piece/${id}/${code}.svg`;
}
export const boardThumb = (b) => (b.file ? `${DIR}board/${b.thumb}` : "");
/* Puts the chosen board on the page: its two colours (also the coordinates' and the menu's), and its picture if it has one. */
export function applyBoard() {
  const b = board(), root = document.documentElement;
  for (const k of ["--sq-light", "--sq-dark", "--board-img"]) root.style.removeProperty(k);
  root.toggleAttribute("data-boardpic", !!b.file);
  if (b.light) { root.style.setProperty("--sq-light", b.light); root.style.setProperty("--sq-dark", b.dark); }
  if (b.file) root.style.setProperty("--board-img", `url("${new URL(DIR + "board/" + b.file, document.baseURI).href}")`);   // a full address: a url() in a variable is read from the stylesheet's folder
}
