# Bilas: /hone rubric v1 (frozen 2026-11-07)

Artifact: Bilas, a 3D coin-laundry ASMR space (web, three.js, offline), in the spirit of Jeda / Sansa.
Done = every hard gate passes AND council weighted score >= 8.5. Changing this file is Juwen's call.

## Hard gates (code checker: tests/check.py; checker overrides judges)

- G1 Loads with 0 console errors and 0 page errors over http:// AND file://, at 1280x800 and 390x844.
- G2 Real-pointer flow passes (mouse clicks / drags on projected 3D objects, no state shortcuts except time
  fast-forward): feed a note + collect coins at the changer; load washer, add detergent, close door, DRAG a coin
  into the slot, start, unload; dry 2 shirts in the dryer (coin, start, unload, clean lint); hang 2 shirts on
  the line (pegs), take them down; smooth + fold all 4 at the table. End state: 4 shirts folded on the stack.
- G3 ASMR coverage: >= 16 distinct synthesized sound ids fire during G2, ambient bed running; the app ships
  no audio files and makes no network requests (offline).
- G4 Layout: no horizontal overflow at 320, 390, 768, 1024, 1440 px; every HUD button >= 40x40 px; HUD text
  never clipped.
- G5 slop_check: 0 blockers.
- G6 Every i18n key exists in EN and ID; night and day themes both render; HUD text contrast >= 4.5:1.
- G7 Without WebGL the page shows a readable explanation (no blank screen, no thrown error).

## Soft criteria (council, screenshots of idle + mid-activity + finished states, desktop and phone)

- C1 ASMR calm and sensory payoff (w=0.30): 4 = works but sterile, interactions feel like plain buttons; 7 = calm palette and pacing, visible feedback for every action, watching the machines is pleasant; 10 = every touch has a tactile visual and sound payoff, the scene invites lingering (rain, hum, tumbling), nothing jarring.
- C2 Interaction richness and fidelity to a real coin laundry (w=0.25): 4 = a few generic clicks; 7 = coins, wash, dry, hang and fold each have their own gesture and believable steps; 10 = feels like a real neighbourhood coin laundry (changer, coin slot, detergent drawer, lint trap, pegs, smoothing, folding in thirds) with gestures matched to each action.
- C3 Visual craft, not AI-generic (w=0.25): 4 = default-looking primitives, HUD unrelated to the place; 7 = coherent art direction, readable 3D objects, HUD matches the place; 10 = distinctive, cohesive look a designer would screenshot; light, materials and type all deliberate.
- C4 Clarity and onboarding (w=0.20): 4 = unclear what to do next; 7 = one clear next-step hint at all times and obvious navigation; 10 = a first-time user finishes a load with no confusion on phone and desktop, progress always visible.

## Loop settings

MAX_ROUNDS = 5, keep a candidate only if score >= best + 0.3 AND it wins the swapped-order pairwise vote,
stop on done / 2 stalls / same gate failing 3 times (blocked).
