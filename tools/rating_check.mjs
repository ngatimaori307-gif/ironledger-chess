/* Checks js/rating.js's Glicko-2 against Glickman's worked example (Glickman 2012, "Example of the Glicko-2 system": a 1500 ± 200
   player, volatility 0.06, beats 1400 ± 30 and loses to 1550 ± 100 and 1700 ± 300 → 1464.06 ± 151.52, volatility 0.05999;
   the paper rounds as it goes, so within 0.02). Iron Ledger's elo.py gives the same over 300 random games (checked 19 Nov). */
import { Player, performance } from "../js/rating.js";
const p = new Player(1500, 200, 0.06); p.period([[1400, 30, 1], [1550, 100, 0], [1700, 300, 0]]);
const ok = Math.abs(p.rating - 1464.06) < 0.02 && Math.abs(p.rd - 151.52) < 0.02 && Math.abs(p.vol - 0.05999) < 0.00002
  && performance([{ s: 1, oe: 1500 }, { s: 0, oe: 1500 }]) === 1500;
console.log(`${p.rating.toFixed(2)} ± ${p.rd.toFixed(2)}, volatility ${p.vol.toFixed(5)}: ${ok ? "as Glickman's example" : "DIFFERS"}`);
process.exit(ok ? 0 : 1);
