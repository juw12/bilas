# Bilas design system

Reference: a neighbourhood coin laundry (Korean 코인빨래방 / Indonesian laundry koin) at night: subway tiles,
white enamel machines, chrome portholes, a coin changer, a red plastic basket, rain on the window.
Spirit: Jeda / Sansa, a quiet place you visit, not a game you win.

## Palette
| Token | Hex | Use |
|---|---|---|
| ink | #1d2629 | text on paper, night background |
| paper | #f4f0e7 | cards in day theme |
| night-card | #1f2a2d | cards in night theme |
| night-text | #efe9dc | text on night-card (AA 13:1) |
| tag-red | #c8442c | the single accent: basket, ticket notch, primary button (white text 4.7:1) |
| celadon | #9cc5b5 | wall tiles, progress fill |
| brass | #c9a14a | coins only |

## Type
- Display: Bahnschrift (Windows DIN signage face), then DIN Alternate, Barlow Condensed, Arial Narrow.
- Body: Segoe UI, system-ui. No web fonts (offline).
- Machine displays use a monospace LCD look (Consolas / Menlo) on a dark green screen.

## Shape and motion
- Radius 10 px on cards, 999 px only on the round coin chip. HUD cards look like laundry tickets (notched).
- Motion: ease-in-out 300-600 ms, camera moves 1.1 s. Nothing bounces more than once. No flashing.

## Voice
Plain and quiet. "Feed a note into the changer." Never "Let's go!", never exclamation-heavy copy.
Banned: unlock, supercharge, seamless, magic, journey.

## Signature element
The ticket-tag station bar at the bottom (Change / Wash / Dry / Hang / Fold / Sit), like the paper tags
laundries clip to bags.

## Banned defaults
Purple/indigo gradients, Inter-only type, emoji as icons, glow blobs, glassmorphism, gradient text,
identical icon cards, fake testimonials, audio files (all sound is synthesized).
