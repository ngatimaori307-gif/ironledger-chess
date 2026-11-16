/* Iron Ledger Chess (player build) — every number and name the app uses, in one place. */
export const APP = { name: "Iron Ledger Chess", version: "1.0.0", build: "2026-11-17" };

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
export const GAMES_KEPT = 50;
export const THEMES = [
  { id: "pounamu", name: "Pounamu" }, { id: "toroa", name: "Iwi Toroa" },
  { id: "totara", name: "Whakairo Tōtara" }, { id: "ahika", name: "Te Ahi Kā" },
];
export const DEFAULTS = { theme: "pounamu", sound: true, name: "", showCoords: true };
export const ANIM_MS = 160;
