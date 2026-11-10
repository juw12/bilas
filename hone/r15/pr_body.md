Queue items 230, 231 and 232 (r11 judges): give each machine its own character, replace the ghost finger with in-world cues, and make water, coins and soap react physically.

## Machine character (232)
- **Brand plates:** each machine has its own riveted, brushed maker plate: 1 SAMUDRA (wave), 2 TIRTA (enamel), 3 SURYA (sun) and 4 BARA (ember). Before, all four machines shared one plate.
- **Wear decals:**
  - Enamel worn away round the door handle.
  - Chipped lower corners.
  - Coin scuffs round the slot.
  - The wear is seeded per machine, so no two match.
- **No tap interference:** all wear is drawn as transparent decal planes with polygonOffset and `userData.pass = true`, so they never catch taps.

## In-world first-run cues (230)
- **Coin arrow:** a worn yellow arrow sticker sits between the coin slot and Start.
- **Taped notes:** a lint pictogram note is taped to each dryer, and a fold card is taped to the corner of the folding board.
- **Ghost finger:** it still exists as a fallback, but now waits 6 s on the first load and 9 s after that, so the in-world cues get read first.
- No new i18n keys: every sticker is a pictogram.

## Water, coins and soap (231)
- **Displacement and splash:**
  - The drum's water line rises a little with each shirt, up to a cap.
  - Each shirt that lands makes the surface heave and sends out rings.
  - Each landing also throws 4 ballistic drops.
- **Coin clink:**
  - A shared point light and an additive glint flash at the coin.
  - The camera gets a tiny kick (about 2.5 mm), skipped under prefers-reduced-motion.
  - Tray coins clink at about half strength.
- **Pour stream:** a tapered column runs from the bottle mouth to the drawer cup, with drops and a splash ring.
- **Camera:** a new `washSoap` view frames the bottle and drawer while soap is due. Before, the bottle sat above the top of the screen.
- sw cache `bilas-v17`.

## Tests
- **New `tests/character.py`**, run at 1280x800 and 390x844, checks:
  - Brands and wear decals.
  - Arrow placement, the lint note and the fold card.
  - Decals never catch a tap.
  - Tray and slot clinks with the glint.
  - The ghost finger is still hidden at 3 s.
  - The pour stream spans mouth to cup.
  - The slot clink camera kick.
  - Splash strength, and the water line loaded vs empty.
- **`tests/flow.py`:**
  - The local server now has a request backlog of 128. The default of 5 refused connections under load, which caused the `#btnStart` click timeouts.
  - It waits for the camera to settle before grabbing the soap.
  - It prints the original exception before trying the failure screenshot.
- **`tests/gestures.py`:**
  - It waits for the camera to settle after the door closes, before dragging the bottle. The new soap view moves the camera there.
  - The early-release pour is now released from inside the page, by a `requestAnimationFrame` watcher on the first frame past 10 % fill.
- **Test hook:** a read-only `window.__bilas.dragInfo()` hook was added.

## Checks (system Edge via `hone/r12/edge_run.py`, machine at 100 % CPU from other sessions)
- **gates:**
  - G4 shows no overflow, clipping or small text at all 5 sizes.
  - G6 parity is 148/148, and contrast is ok in both themes.
  - G1 and G7 show no errors.
- **flow:** 390x844 had 0 fails and 0 errors. For 1280x800, see the note below.
- **sit (desktop and phone), dialdrawer, tactile (desktop and phone):** 0 fails.
- **character:** 390x844 had 0 fails in the suite. 1280x800 had 0 fails when rerun on its own.
- **gestures:** the early-release check now passes (cup 0.10, soap not yet added), and the full pour still works.
  - The suite run failed here at 0.00. Probing showed why: on the loaded machine each scripted mouse move was a slow round trip, so the whole 2 s pour finished before the test's "early" release arrived. The release is now fired from inside the page on the first frame past 10 %.
- **Browser closed mid-run:** in the suite, desktop flow (at the lint scrub) and desktop character (after its pour checks) each lost their browser with TargetClosedError. Character passed on its own afterwards. Desktop flow had already passed every wash and dry step before its browser closed.
- **Desktop flow, 1280x800:**
  - Rerun on its own, it passed every wash and dry step: coin plate 1.5 mm, lint collected, lint trap scrubbed, 2 shirts pegged, Meanwhile hint, 4 dry shirts back. It then stalled at the fold-table scrub under load.
  - Two further reruns failed before reaching r15 code: one browser launch failed, and one first station click timed out after 30 s.
  - Phone flow passes the same fold scrub.
  - The only fold-path change in this PR is the fold card decal. It is `userData.pass`, so `pick()` skips it, and `tests/character.py` checks that decals never catch a tap.
  - Recheck desktop flow when the machine is idle.
