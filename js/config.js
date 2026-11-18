/* Iron Ledger Chess (player build) — every number and name the app uses, in one place. */
export const APP = { name: "Iron Ledger Chess", version: "1.5.0", build: "2026-11-18" };

/* The engine: Stockfish 19 (lite NNUE, one thread), run in a Web Worker so the board never waits for it. */
export const ENGINE = {
  worker: "vendor/stockfish/stockfish-19-lite-single.js",
  hashMb: 16,
  readyTimeoutMs: 20000,
  moveTimeMs: 600,                 // thinking time per move against the player
  weakLines: 6,                    // below the engine's own strength floor, it picks among its top lines …
  weakDepth: 10,
  eloFloor: 1320,                  // … because Stockfish limits itself only from 1320 (UCI_Elo)
  eloCeiling: 3190,
  retries: 2, retryAfterMs: 1500,  // an engine that doesn't answer is asked again this many times
};

/* Opponents, weakest first: the same names and ratings as the developer app (spar.py, config.SPAR_PERSONAS).
   temp = how loosely a weakened level picks among its top lines (centipawns); none = Stockfish's own limit. */
export const OPPONENTS = [
  { id: "weak-800", name: "Rusty Hinge", rating: 800, temp: 300 },
  { id: "weak-1000", name: "Bent Nail", rating: 1000, temp: 180 },
  { id: "weak-1100", name: "Loose Rivet", rating: 1100, temp: 130 },
  { id: "weak-1200", name: "Dull Blade", rating: 1200, temp: 90 },
  { id: "sf-1320", name: "Tin Soldier", rating: 1320 }, { id: "sf-1400", name: "Copper Page", rating: 1400 },
  { id: "sf-1500", name: "Brass Sentry", rating: 1500 }, { id: "sf-1600", name: "Bronze Guard", rating: 1600 },
  { id: "sf-1700", name: "Iron Squire", rating: 1700 }, { id: "sf-1800", name: "Iron Knight", rating: 1800 },
  { id: "sf-1900", name: "Steel Captain", rating: 1900 }, { id: "sf-2000", name: "Steel Warden", rating: 2000 },
  { id: "sf-2100", name: "Forge Marshal", rating: 2100 }, { id: "sf-2200", name: "Chain Baron", rating: 2200 },
  { id: "sf-2300", name: "Hammer Duke", rating: 2300 }, { id: "sf-2400", name: "Furnace Count", rating: 2400 },
  { id: "sf-2500", name: "The Iron Prince", rating: 2500 }, { id: "sf-2600", name: "The Steel Queen", rating: 2600 },
  { id: "sf-2700", name: "The Forge King", rating: 2700 }, { id: "sf-2800", name: "The Engine", rating: 2800 },
  { id: "sf-2900", name: "The Juggernaut", rating: 2900 }, { id: "sf-3000", name: "The Colossus", rating: 3000 },
  { id: "sf-3100", name: "The Leviathan", rating: 3100 }, { id: "sf-3190", name: "The Anvil", rating: 3190 },
];
/* Maia opponents: they play like people at their rating (CSSLab's Maia networks, packed by tools/maia_pack.py). Names as in the
   developer app (config.SPAR_NAMES["maia"]: townsfolk). They are not on The Ladder, which stays Stockfish's. */
export const MAIA = { dir: "vendor/maia", minShare: 0.1, temperature: 1, timeoutMs: 30000 };
export const MAIA_OPPONENTS = [
  { id: "maia-1100", name: "Pip the Stable Boy", rating: 1100, maia: true }, { id: "maia-1200", name: "Tam the Baker", rating: 1200, maia: true },
  { id: "maia-1300", name: "Mara the Weaver", rating: 1300, maia: true }, { id: "maia-1400", name: "Odo the Miller", rating: 1400, maia: true },
  { id: "maia-1500", name: "Bren the Blacksmith", rating: 1500, maia: true }, { id: "maia-1600", name: "Isolde the Scribe", rating: 1600, maia: true },
  { id: "maia-1700", name: "Garrick the Sergeant", rating: 1700, maia: true }, { id: "maia-1800", name: "Elowen the Merchant", rating: 1800, maia: true },
  { id: "maia-1900", name: "Aldric the Steward", rating: 1900, maia: true }, { id: "maia-2200", name: "Seraphine the Court Champion", rating: 2200, maia: true },
];
/* Maia-3 opponents (CSSLab's Maia-3, model maia3-5m — the one Iron Ledger runs): one network for every rating, told its own
   rating and its opponent's. Names and ratings as in the developer app (config.SPAR_NAMES["m3"], MAIA3_RATINGS 1100–2500 by 100).
   It plays as the developer app's Maia-3 does: a move drawn by its probability (temperature 1). Not on The Ladder. */
export const MAIA3 = { file: "vendor/maia3/maia3-5m.bin", sizeMb: 10, firstTimeoutMs: 180000, timeoutMs: 30000 };
const MAIA3_NAMES = ["The Understudy", "The Shadow Pupil", "The Copyist", "The Parrot", "The Mimic", "The Echo", "The Double", "The Stand-In",
  "The Impostor", "The Doppelgänger", "The Changeling", "The Looking-Glass", "The Mirror Knight", "The Mirror Queen", "The Mirror King"];
export const MAIA3_OPPONENTS = MAIA3_NAMES.map((name, i) => ({ id: `m3-${1100 + 100 * i}`, name, rating: 1100 + 100 * i, m3: true }));
/* v1.5 — Hardcore ladders, as Iron Ledger's hardcore.py (config.py HC_*): Human (the Maia-3 opponents), Engine (Stockfish, weakened
   below 1320), Human + Guard (Maia-3's move, checked by Stockfish; a move that loses guard.drop win chance — the report's "mistake" —
   is replaced by Maia-3's next likeliest move that doesn't, else Stockfish's own). Every rung open; a rung is beaten at beatenScore
   of the points from at least beatenGames games. A draw offer is considered from move 20 and accepted only if the position is level. */
export const HARDCORE = { beatenScore: 0.5, beatenGames: 2,
  guard: { ratings: [1100, 2500, 100], drop: 20, depth: 12, ms: 400, alternatives: 5 },
  draw: { minPly: 40, maxCp: 30, depth: 14, ms: 600 } };
export const WIN_CHANCE = { k: 0.00368208, clampCp: 10000 };   // Lichess's curve (Iron Ledger's winchance.py)
export const GUARD_OPPONENTS = [];
for (let r = HARDCORE.guard.ratings[0]; r <= HARDCORE.guard.ratings[1]; r += HARDCORE.guard.ratings[2])
  GUARD_OPPONENTS.push({ id: `g-${r}`, name: `Maia-3 ${r} + Stockfish guard`, rating: r, guard: true });
export const HARDCORE_LADDERS = [["human", "🧠 Human"], ["engine", "⚙ Engine"], ["guard", "🛡 Human + Guard"]];
export const ALL_OPPONENTS = [...MAIA3_OPPONENTS, ...MAIA_OPPONENTS, ...OPPONENTS, ...GUARD_OPPONENTS];
export const LADDER = { winsToClimb: 1 };          // a win against a rung opens the next one

/* Play a Friend: the two phones meet once through PeerJS's public broker, then talk directly (WebRTC). */
export const FRIEND = {
  idPrefix: "ironledger-chess-",
  codeLength: 6,
  codeAlphabet: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",   // no 0/O, 1/I/L: read aloud or typed without mistakes
  joinHashKey: "join",
  serverOverrideKey: "ilc-peer-server",              // tests only: {host, port, path, secure} of a local PeerJS server
  connectTimeoutMs: 20000,
  reconnectEveryMs: 4000,
  peer: { debug: 0, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] } },
};

/* Problem reports: kept on the phone and always sent to the developer's ntfy topic (no switch: his word 17 Nov 00:14). Nothing personal is sent: the error, the screen, the device and browser, the app version. */
export const LOG = {
  key: "ilc-log",
  keep: 200,                        // newest entries kept on the phone
  ntfyUrl: "https://ntfy.sh/ilc-d10d5939ce87e8f05bdb30d9",
  sendAtMostEveryMs: 30000,         // one report at a time, at most this often
  slowFrameMs: 400,                 // a frame this late is logged as a stall …
  sendStallMs: 2000,                // … and sent to the developer only from this long
};

export const STORE = { settings: "ilc-settings", ladder: "ilc-ladder", games: "ilc-games", current: "ilc-current", friend: "ilc-friend" };
export const GAMES_KEPT = 500;                       // v1.4: finished games kept on the phone (~1 KB each), for the Profile and its rating
/* v1.4 — the Profile's rating: Glicko-2 as Iron Ledger's elo.py (Glickman 2012), the same constants (config.py ELO_*). One game is
   one rating period; each 7 days without a game widens the uncertainty by one period. Only games against the computer count:
   their opponents have a rating. Maia-3 / Maia / Stockfish's ratings are the app's own settings, taken as known within OPP_RD;
   the weakened Stockfish below 1320 is uncalibrated (OPP_RD_ROUGH). Friends have no rating, so their games are a record only. */
export const RATING = { scale: 173.7178, start: 1500, startRd: 350, startVol: 0.06, tau: 0.5, volEps: 1e-6, idleDays: 7,
  oppRd: 60, oppRdRough: 120, provisionalRd: 110, z: 1.96, recent: 20, perfIter: 60, perfRange: [0, 4000] };
export const KINDS = { m3: "Maia-3", guard: "Maia-3 + guard", maia: "Maia", sf: "Stockfish", weak: "Stockfish (weakened)", friend: "Friends" };
export const THEMES = [
  { id: "pounamu", name: "Pounamu" }, { id: "toroa", name: "Iwi Toroa" },
  { id: "totara", name: "Whakairo Tōtara" }, { id: "ahika", name: "Te Ahi Kā" },
];
export const DEFAULTS = { theme: "pounamu", sound: true, name: "", showCoords: true, motion: "full", captureFx: "topple" };
export const ANIM_MS = 160;
/* The board's motion, Iron Ledger's own numbers (app.js: KNIGHT_ARC_STEPS, LAND_AT, LAND_SQUASH, LAND_STRETCH; app/board2d.js) */
export const MOTION = { moveMs: 160, ease: "cubic-bezier(.65,0,.35,1)", knightSteps: 8, landAt: 0.82, landSquash: 0.12, landStretch: 0.07,
  dragScale: 1.25, dragLiftTouch: 0.35, dragStartPx: 6, captureFx: "topple" };
export const CAPTURE_FX = [["topple", "Knocked over"], ["shatter", "Shatter"], ["dissolve", "Ash"], ["holo", "Hologram"], ["vortex", "Black hole"], ["random", "Surprise me"], ["off", "Off"]];
