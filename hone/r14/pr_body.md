Queue items 233 + 234 (r11 judges): tactile taps and coin-tray physicality; phone legibility of small wall notes; floor tile variation.

## Tactile machine parts
- **Start button:** the cap bottoms out fast (about 9 mm of travel), springs back past rest and settles. Before, it moved 5 mm on a sine.
- **Coin plate:** the chrome plate gives about a millimetre and rebounds each time a coin drops through the slot.
- **Change tray:** coins hop once and wobble flat when they land, and the steel tray rocks on its rivets. Scooping first rakes the coins over the floor to the front lip, one after another, then lifts them out.

## Wall notes on a phone
- In portrait (aspect < 0.75) the four notes regroup into one column in the strip of wall between the window and the changer. The pinned notes grow 1.3–1.4x. Before, the price card hung off the left edge and body text was about 6 px.
- **Tap any note to read it:**
  - It lifts into a paper card in the note's own colour, with an 18 px body and a strip of tape.
  - A tap, Esc or Enter puts it back, and it also closes by itself after 7 s.
  - The closing tap never reaches the room. This works on desktop too.
- New i18n key `note_close` (EN/ID). Parity 148/148.

## Floor
- Per-tile glaze sheen on its own diagonal.
- About 3.5 % of tiles are near-match replacements from a later batch, and about 5 % carry hairline cracks.
- The grout darkens along the walking path.

## Tests
- New `tests/tactile.py`, run on phone and desktop, covers:
  - Compact layout on/off.
  - All notes on screen on phone.
  - Tap-to-read card text and size, and that the closing tap doesn't feed the changer.
  - Tray rock.
  - Start-button travel and return.
- `tests/flow.py` now checks the coin plate's give as real coins are dragged into the washer slot.
- sw cache `bilas-v16`.

## Checks (system Edge via `hone/r12/edge_run.py`)
- gates:
  - G4 shows no overflow, clipping or small text at all 5 sizes.
  - G6 parity is 148/148, and contrast is ok in both themes.
  - G1 and G7 show no errors.
- flow 1280x800 and 390x844: 0 fails, 31 sounds, coin plate gives under coins.
- sit (desktop and phone), gestures, dialdrawer: 0 fails.
- tactile (desktop and phone): 0 fails.
- The first full run had three timeouts while the machine sat at 100 % CPU with other sessions' browsers open: gates at 320 px, the final Settings click in phone sit, and the gestures partial pour. All three passed when rerun one at a time (`hone/r14/rerun.ps1`).
