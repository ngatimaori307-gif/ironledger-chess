# Iron Ledger Chess

A chess game for the phone: play the computer at the level you choose — Stockfish, or Maia-3 and Maia, which play like people — climb The Ladder, or play a friend on another phone
with an invite link. Open it at **https://ngatimaori307-gif.github.io/ironledger-chess/** and, on an iPhone, tap Share →
Add to Home Screen to keep it as an app.

The sets and colours are modern Māori art, designed by the developer of Iron Ledger.

## What it's built from
- Stockfish 19 (GPL-3.0) in the browser, from Stockfish.js by Nathan Rugg — `vendor/stockfish/`, licence in `COPYING.txt`;
  source: https://github.com/official-stockfish/Stockfish and https://github.com/nmrugg/stockfish.js
- Maia (GPL-3.0) by CSSLab, University of Toronto — opponents that play like people at their rating; ten networks,
  1100–1900 and 2200, re-packed for the browser in `vendor/maia/` (tools/maia_pack.py), licence in `vendor/maia/LICENSE.txt`;
  source: https://github.com/CSSLab/maia-chess
- Maia-3 (AGPL-3.0) by CSSLab, University of Toronto — fifteen opponents, 1100–2500, from one network (maia3-5m, the model
  Iron Ledger runs), told both players' ratings. The checkpoint (https://huggingface.co/UofTCSSLab/Maia3-5M) is re-packed for the
  browser in `vendor/maia3/` (tools/maia3_pack.py, half precision, no PyTorch needed) and run by `js/maia3-net.js`, a JavaScript
  copy of the model's maths; licence in `vendor/maia3/LICENSE.txt`; source: https://github.com/CSSLab/maia3
- Boards and piece sets (Me → Board, Me → Pieces): Lichess's board pictures (AGPLv3+) and its 33 openly licensed piece sets, each
  under its own licence — `vendor/lichess/`, list in `vendor/lichess/COPYING.md` (tools/looks_pack.py); Iron Ledger's own colour boards
  and its Staunton wood set
- chess.js (BSD-2-Clause) for the rules — `vendor/chess.js`
- PeerJS (MIT) for Play a Friend — `vendor/peerjs.min.js`
- Fonts: Cinzel and Alegreya Sans (SIL Open Font License), from Google Fonts
- From Iron Ledger, by its developer: the flat board's pinch-zoom (`js/flatzoom.js`), the eyes-and-glasses log (`js/eyes.js`) and
  Profile → Share all my games (`js/share.js`), which writes every game as one PGN file for his Iron Ledger opponent book
- From Iron Ledger too (1.16.0): Black's carving made readable without lightening it, the lacquered 3D board with its inlaid line,
  the Lacquered wood board, and the 3D room (`js/room3d.js`, Me → 3D surroundings)
- Wood veneer photographs (CC0) from Poly Haven — `vendor/textures/`, see `vendor/textures/COPYING.md`

The whole app is covered by the GNU General Public License v3 (see `vendor/stockfish/COPYING.txt`), because it includes Stockfish;
Maia-3's network and `js/maia3-net.js` are under the GNU Affero General Public License v3, which may be combined with it. This
repository is the complete source.

## Problem reports
The app keeps a log of anything that goes wrong on the phone (Me → Report a problem copies it) and, unless switched off in
Me → Settings, sends each problem to the developer: what went wrong, the screen, the phone's model and browser, and the
app's version. Nothing else.
