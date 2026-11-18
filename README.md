# Iron Ledger Chess

A chess game for the phone: play the computer at the level you choose — Stockfish, or Maia, which plays like people — climb The Ladder, or play a friend on another phone
with an invite link. Open it at **https://ngatimaori307-gif.github.io/ironledger-chess/** and, on an iPhone, tap Share →
Add to Home Screen to keep it as an app.

The sets and colours are modern Māori art, designed by the developer of Iron Ledger.

## What it's built from
- Stockfish 19 (GPL-3.0) in the browser, from Stockfish.js by Nathan Rugg — `vendor/stockfish/`, licence in `COPYING.txt`;
  source: https://github.com/official-stockfish/Stockfish and https://github.com/nmrugg/stockfish.js
- Maia (GPL-3.0) by CSSLab, University of Toronto — opponents that play like people at their rating; ten networks,
  1100–1900 and 2200, re-packed for the browser in `vendor/maia/` (tools/maia_pack.py), licence in `vendor/maia/LICENSE.txt`;
  source: https://github.com/CSSLab/maia-chess
- chess.js (BSD-2-Clause) for the rules — `vendor/chess.js`
- PeerJS (MIT) for Play a Friend — `vendor/peerjs.min.js`
- Fonts: Cinzel and Alegreya Sans (SIL Open Font License), from Google Fonts

The whole app is covered by the GNU General Public License v3 (see `vendor/stockfish/COPYING.txt`), because it includes Stockfish.

## Problem reports
The app keeps a log of anything that goes wrong on the phone (Me → Report a problem copies it) and, unless switched off in
Me → Settings, sends each problem to the developer: what went wrong, the screen, the phone's model and browser, and the
app's version. Nothing else.
