Bilas queue items 235 + 237: waiting hints say what to do meanwhile, and one flaky test wait is now state-based.

- **Waiting hints (235)**: while the washer, dryer or line is running, the hint now names the next useful station ("Meanwhile: Fold.") instead of repeating the countdown. The countdown stays only on the ticket card, so the ticket and hint no longer show the same timer twice. This is the same in EN and ID (`h_meanwhile`: "Meanwhile: {st}." / "Sambil menunggu: {st}."). `{time}` was removed from `h_washing`, `h_drying` and `h_hang_drying`.
- **Gestures test (237)**: the early-release check no longer depends on timing. The test releases as soon as `MS.washer.soapFill > 0.1`, instead of after a fixed 500 ms sleep plus a WebGL screenshot. The pour fills in 2 s, so a slow screenshot could let the cup fill before the "early" release; a late pour start could release before any soap went in. The `g2-pouring` shot moved to the second (full) pour.
- **flow.py** adds two expects at the hanging step: the hint names the highlighted next station, and the hint's first sentence has no timer.
- sw cache bumped to `bilas-v14`.

Checks:
- gates: G4 no overflow at 5 sizes; G6 i18n 142/142; contrast ok in both themes
- flow 1280x800 and 390x844: 0 fails, 31 sounds
- gestures: pass (0 fails). It ran on system Edge via a launch shim because the shared Playwright browser folder was mid-reinstall by another session.
- dialdrawer: pass
