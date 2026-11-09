# Bilas hone lessons

- 2026-11-09 (r9): the 'paper / torn edge' shirt on the fold table was a depth fight, not a shading problem: the board's polygonOffset pulled it through the shirt's far shoulders at grazing angles. Lift the cloth a few mm and use a slope-independent offset before touching textures. Probe cloth looks with a state-injection script (hone/r8/foldlook.py, ~20 s) instead of the 3-minute full flow. Two sessions edited Bilas in parallel; always git fetch before starting a round and judge pairwise against the live main.
