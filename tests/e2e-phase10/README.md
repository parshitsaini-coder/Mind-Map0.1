Real-browser checks for Phase 10 (Playwright, headless Chromium). Not part of tests/all.sh (needs a dev server).

    npm run dev -- --host 127.0.0.1 --port 5173      # terminal 1
    mkdir -p e2e-shots && node tests/e2e-phase10/p10b.mjs   # terminal 2 (needs `playwright` resolvable)

b = place / drag SL+TP, invalid drag, undo, reload, unit cycle · c = pill menu, reverse, partial close, right-click menu, pending order, "+"
d = 360 px touch · e = settings toggles (confirm, pill, R, snap) · f = 10 positions + frame time · g = amber margin strip · h = 2-chart layout
i = SL/TP on pending orders (+SL / +TP / bracket / drag)
