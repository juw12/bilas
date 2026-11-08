# Bilas — coin-laundry ASMR (r2)

A browser-only 3D first-person laundromat (three.js, no build step, no audio files). Sibling of Jeda (Sansa-style calm spaces). EN / ID, day and night themes. Screenshots attached: desktop 1280x800 and phone 390x844.

## What the player does (all verified by a real-pointer Playwright run, desktop and phone)
1. Change: feed a note into the changer, coins cascade into the tray, tap to scoop 4 coins.
2. Wash: open washer door, tap the basket to load 4 dirty shirts one by one, tap the bottle to pour detergent into the drawer, close door, DRAG each coin into the slot (2 coins), press start. Drum agitates with shader water and foam; a timer counts down on the LCD; drain then spin.
3. Unload: 4 wet shirts back into the basket (they look darker and heavier).
4. Dry: choose dryer 3 (1 coin, dragged into a coin ledge), load 2 shirts, tumble with warm light; when done pull the lint trap and drag across it to peel the felt off (canvas-erased texture, peel sound).
5. Hang: the other 2 wet shirts go on a line by the window with wooden pegs; drips slow as they dry; tap to take them down.
6. Fold: lay a shirt on the table, drag across it to smooth wrinkles (hand-on-cotton sound tied to drag speed), then fold left sleeve, right sleeve, bottom up; folded shirts stack. 4 shirts.
7. Done card: "Clean, dry, folded. 4 shirts in 8:35." Option to sit and just listen ("Sit" station) while background machines from other customers keep running.

## Changes in this version (r2, vs v0)
- Shirts: knit bump texture on every shirt (visible cotton weave under the warm lights); wrinkles redrawn as soft blurred creases instead of sketchy lines; crumpled shirts in the drum use a denser, ridged mesh so they read as cloth, not low-poly blobs.
- Room: floor tiles have subtle tone variation and scuffs; window light shafts fall across the floor (brighter by day, faint at night).
- Next-step underline fixed: while lint is still in the trap it points to Dry; wet shirts point to Hang before Fold; only dry shirts point to Fold.

- Folding table: birch-grain top and a folding board with dashed thirds guides (sleeve, sleeve, bottom up) under the shirt.
- Lived-in details: a 'lavanda' detergent box with a scoop, a spray bottle and a red mug on the table; a rolling laundry cart parked behind it; the lost grey sock from the notice board actually sits on the bench; two more hand-written notes on the board ('Dryer 4 runs hot', 'Folding board - please wipe after').
- Done moment is quieter: the card slides up as a paper slip low in the frame, with only a soft bottom fade, so the folded stack stays visible.
- Lint hint now points at the object: 'Drag over the lint screen to peel the felt off.'

## Sound (Web Audio, all synthesized)
30 one-shot sound ids: beep, billFeed, bird, button, chime, clothIn, clothOut, coinCascade, coinDrop, coinPickup, coinScoop, coinSlot, doorClose, doorOpen, drain, drip, flap, lintPeel, lintPull, pat, peg, pegOff, pour, raindrop, smooth, stack, startBeep, swish, thump, wetSlap; plus continuous wash loop, dry loop (buttons ticking against the drum), rain/room-tone ambience. Each machine sound is placed in space.

## UI
Bottom station bar (Change, Wash, Dry, Hang, Fold, Sit) with a red underline on the next suggested step; one-line hint above it; "This load" card top-left showing each shirt's state; coin purse top-right; settings (volume, time of day, cycle length 45s-3min, language). Calm, warm palette, no gamification beyond the done card.

## Objective gate results (this version)
- G1 0 console errors over http and file:// at 1280x800 and 390x844: PASS
- G2 full real-pointer flow (change -> wash -> dry + lint -> hang -> fold 4 -> done): PASS at both sizes
- G3 29 distinct sounds fired in one run + ambient: PASS
- G4 no overflow 320-1440, all buttons >= 40px, no clipped text: PASS
- G5 slop_check 0 blockers: PASS
- G6 EN/ID 105/105 keys, both themes contrast >= 4.5: PASS
- G7 no-WebGL message: PASS
