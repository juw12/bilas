Queue item 236 (r11 judges): Sit mode never changes game state by accident; optional film grain; short first-run intro beat.

## What changed
- **Sit is safe.** While sitting, taps on the room no longer reach `pick()`. They change nothing, and Stand up nudges so you can see the way out. Before this fix, a tap while sitting could still grab a shirt or coin.
- **Film grain toggle.** There is a new Settings row, Film grain On/Off, saved in localStorage. With grain off, the lens keeps only the radial vignette and the SVG noise is gone, in both themes.
- **First-run intro beat.** The very first Start shows one quiet caption for about 3.4 s, then the change station. Any tap or key skips it.
  - Night: "Eleven at night. Rain on the awning. One basket, no hurry."
  - Day: "Early. The changer is still cold. One basket, no hurry."
  - Later runs skip the beat. It respects reduced motion and is translated into ID.
- i18n parity 147/147. The service worker cache is now `bilas-v15`.
- New `tests/sit.py` covers:
  - The beat shows, then clears to the change station.
  - Sitting taps leave the state snapshot unchanged and nudge Stand up.
  - Stand up leaves the seat.
  - Grain off drops the noise and keeps the vignette.
  - After a reload, grain stays off and the beat is skipped.

## Checks (system Edge via `hone/r12/edge_run.py`)
- gates: G1, G4 and G7 pass; G6 147/147; contrast ok
- flow 1280x800 and 390x844: 0 fails, 31 sounds
- sit 1280x800 and 390x844: 0 fails
- gestures: 0 fails; dialdrawer: 0 fails
