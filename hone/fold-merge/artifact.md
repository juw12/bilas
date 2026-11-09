# Bilas — coin-laundry ASMR (r10)

A browser-only 3D first-person laundromat (three.js, no build step, no audio files). Sibling of Jeda (Sansa-style calm spaces). EN / ID, day and night themes. Screenshots attached: desktop 1280x800 and phone 390x844.

## What the player does (all verified by a real-pointer Playwright run, desktop and phone)
1. Change: feed a note into the changer, coins cascade into the tray, tap to scoop 4 coins.
2. Wash: open washer door, tap the basket to load 4 dirty shirts one by one, tap the bottle to pour detergent into the drawer, close door, DRAG each coin into the slot (2 coins), press start. Drum agitates with shader water and foam; a timer counts down on the LCD; drain then spin.
3. Unload: 4 wet shirts back into the basket (they look darker and heavier).
4. Dry: choose dryer 3 (1 coin, dragged into a coin ledge), load 2 shirts, tumble with warm light; when done pull the lint trap and drag across it to peel the felt off (canvas-erased texture, peel sound).
5. Hang: the other 2 wet shirts go on a line by the window with wooden pegs; drips slow as they dry; tap to take them down.
6. Fold: lay a shirt on the table, drag across it to smooth wrinkles (hand-on-cotton sound tied to drag speed), then fold left sleeve, right sleeve, bottom up; folded shirts stack. 4 shirts.
7. Done: a receipt prints from the changer ("Clean, dry, folded." with every coin listed). Option to sit and just listen ("Sit" station) while background machines from other customers keep running.

## Changes in this version (r10, vs r9)
- Folded shirts read as cloth, not paper: each fold lays a turned-edge shade along the hinge line and a soft contact shadow where the flap's free edge rests on the layer below; the bottom fold gets a rolled-hem shade.
- The shirt has a real T-shirt silhouette on the table (neckline and sleeves), rolled hem and cuff edges shaded inward, and broad soft undulation so the flat shirt is not a uniform plane.
- Far shoulder/sleeve edge no longer z-fights with the board (shirt sits 6 mm above the board, plus a shadow normal bias), so there is no torn or jagged edge and no stray slivers mid-fold.
- "This load" card prints a short state word under every shirt (dirty / wet / dry / folded, Indonesian kotor / basah / kering / lipat), coloured by state with folded in bold green, and dry shirts get their own warm badge, so progress never depends on decoding an icon.
- Fold hints name the gesture: "Now the right side: tap or swipe it in." and "Last fold: tap or swipe the bottom up."

## Changes in this version (r9, vs r8)
- Window view is now a two-layer parallax city: a far layer (sky, clouds, towers) and a near layer (flats, shophouses, cables, street lamp, trees) on separate planes, so the view shifts with depth as the camera moves. Both layers redraw for the day and night themes.
- Shirts on the line billow with the breeze: the same gust that swings each shirt also swells its belly a beat later. Wet cotton sags more and billows less, and lifts as it dries. The base sag between the pegs is deeper.
- Wrinkles are neutral cool grey instead of brown, so they read as cloth shadow, not dirt. The dark crease core is lighter and the lit ridge beside each fold is stronger, so each crease reads as a fold with relief.
- Drag cue: after a short idle (2.2 s on the first load, 4.2 s after) a ghost fingertip demonstrates the current drag gesture in the scene: the smoothing stroke and the left/right/bottom folds on the shirt, peeling the lint felt, and dragging a coin into the slot. It is hidden under reduced motion and whenever the player is dragging.
- Offline cache bumped (sw bilas-v7).

## Changes in r8 (vs r7, still present)
- Phone fold glitch fixed: the cutting board no longer bleeds through the shirt at grazing phone angles (depth offset corrected, shirt rests 2 mm higher).
- Wrinkles rebuilt at 2x texture resolution as real fold ribbons: each fold has a shaded valley, a dark core and a soft lit ridge. Families: drag folds from the armpits, staggered hem ripples, sleeve folds and a collar dip. Smoothing erases them along the drag path.
- Footsteps: a soft two-step shuffle plays whenever you walk to another station.
- Laundry chips in the HUD pop briefly when a shirt changes state (dirty, wet, dry, folded); off under reduced motion.
- Wall notes moved down and right so none sit under the HUD card; long poster lines now shrink to fit instead of clipping (EN and ID).

## Changes in r7 (vs r6, still present)
- Props rebuilt as real turned objects: detergent jug is a rounded lathe body with glossy clearcoat plastic, moulded handle, a printed "lavanda" wrap label and a ribbed cap; the spray bottle is a clear glass-like body with tinted liquid inside, trigger head, trigger and nozzle; the mug is a thick-walled glazed cup with tea inside and a loop handle.
- Wall notes and posters are drawn at 2.4x texture density with anisotropic filtering, so prices and handwritten notes stay crisp on desktop and phone.
- Water in the washer drum: deeper colour, slow swirl, a bright meniscus line where it meets the glass, broken-edge foam and two sizes of rising bubbles.
- Window rain: at night, beads slide down the glass leaving thin trails; by day only a light dew stays on the glass.
- Steam: a soft puff of warm vapour rises from the dryer when you open the door after a finished cycle.
- Machines: rounded front corners, a deep grey rubber gasket inside each porthole, and a brushed metal maker's plate ("bilas PRO 7 KG" on washers, "HEAT 8 KG" on dryers).
- Phone fold view is framed higher and wider, so the whole green board and shirt fit on a 390 px screen with the HUD.

## Changes in this version (r5 + r6, vs r4, still present)
- Guidance on the object itself: when you pause, a small label pins to the exact machine or item for the next step ("Washer 2 · Open the door", "Changer · Feed a note", "Hold to pour" on the bottle), with a soft ring marker. It flips below the object near the top edge and stays inside the screen on phones.
- In-scene done moment: the end card is now a thermal receipt printed by the changer: torn zigzag bottom, it prints out line by line with its own printer sound. It lists shirts x4, Washer 2 (2 coins), Dryer 3 (1 coin), Window line (2 free), time, and a load number with the clock time. The step hint hides while the receipt is open.
- Materials and light: machine enamel is now a clearcoat material (glossy highlights on the washer and dryer bodies); soft contact shadows sit under the washers, dryer, changer, bench, folding table and plant so they rest on the floor; a light film-grain and vignette layer warms the frame (separate night variant).
- Sound: new receipt-printer sound (31 one-shots in total).
- Cloth reads as fabric, not planes: fold shading driven by the drape curvature (ridges catch light, valleys between folds go soft-dark); shallow pull-folds fan out from each wooden peg; on the line, daylight glows through the thin cotton (off at night).
- Wrinkles on the table are thin crisp creases with a lifted highlight instead of blurred smudges, and the table rumple is deeper, so smoothing has a clearer before/after.
- Folding board is now a deep green cutting mat with a light grid and cream thirds guides, so every shirt colour, including white and cream, stands out on desktop and phone.
- Calmer frame: film grain/vignette reduced by a third; brand red softened from #c8442c to #b8503a on the CHANGE sign and machine accents.
- Required vs optional: the red underline marks only a real next task; when the only thing left is waiting for machines, "Sit" gets a quiet dotted mark instead.

## Sound (Web Audio, all synthesized)
29 one-shot sound ids fired in one run: billFeed, bird, button, chime, clothIn, clothOut, coinDrop, coinPickup, coinScoop, coinSlot, doorClose, doorOpen, drain, drip, flap, lintPeel, lintPull, pat, peg, pegOff, pour, receipt, smooth, stack, startBeep, step, swish, thump, wetSlap; plus continuous wash loop, dry loop and rain/room-tone ambience. Each machine sound is placed in space.

## UI
Bottom station bar (Change, Wash, Dry, Hang, Fold, Sit) with a red underline on the next suggested step; one-line hint above it; "This load" card top-left showing each shirt's state; coin purse top-right; settings (volume, time of day, cycle length 45s-3min, language). Calm, warm palette, no gamification beyond the done card.

## Objective gate results (this version)
- G1 0 console errors over http and file:// at 1280x800 and 390x844: PASS
- G2 full real-pointer flow (change -> wash -> dry + lint -> hang -> fold 4 -> done): PASS at both sizes
- G3 29 distinct one-shot sounds + 2 loops + ambient fired in one run: PASS
- G4 no overflow 320-1440, all buttons >= 40px, no clipped text: PASS
- G5 slop_check 0 blockers: PASS
- G6 EN/ID 132/132 keys, both themes contrast >= 4.5: PASS
- G7 no-WebGL message: PASS
