# QA — Phase 12 (sound engine)

## Automated (all green: `tests/all.sh`)
- `terminal-phase12.test.mjs` — 62 checks: every catalogue event maps to a sound, priorities, sound / pack data valid, volume scales linearly, volume 0 / unknown sound create no nodes, alarm ≤ cap, `resolvePlay` (master, per-event, volume, background, Silent pro), coalescing picks the highest audible priority, rate limit (6 / s, sliding), suspended context → chip, unlock clears it, no-audio / throwing nodes never throw, preview, Test all, vibration, bus behaviour, settings validation + migration of a pre-Phase-12 save.
- `terminal-phase12-store.test.mjs` — 20 checks against the real store: old `sound: false` → master off, every store action emits the right event id (buy, sell, placed, modified w/o toast, cancelled, partial, win, reversed, triggered, SL), settings persist, engine follows the store at play time.
- Real browser (Playwright, headless Chromium, real `AudioContext`, oscillators counted): `tests/e2e-phase12/p12.mjs` 19/19 · `p12-mobile-lab.mjs` 2/2 (360 px, `?lab=1`). Screenshots: `e2e-shots/12-*.png`.

## Acceptance
| Criterion | Result |
| --- | --- |
| buy / sell / win / loss / trigger / cancel / stop-out distinguishable | Different note shapes, pitches, waveforms (rising vs falling chirp, 3-note arpeggio, chime + sparkle, descending triangle, soft thud, alarm). Verified as data + oscillator counts; **not judged by ear in this environment** |
| each can be disabled alone | PASS (TP off → silent, SL still sounds) |
| volume 0 is silent | PASS (master 0 → zero oscillators; event volume 0 → silent) |
| first-gesture unlock + chip | PASS with an emulated autoplay lock (headless Chromium never locks audio) |
| 3 events in 100 ms → one sound, all toasts | PASS (sound); toasts go through a separate subscriber |

## Not built / not verified
- Per-event custom sound upload (≤ 200 KB, IndexedDB): NOT BUILT.
- Price alerts, connection lost / restored, UI click sounds: in the catalogue + playground only; nothing emits them yet.
- Not verified: how the sounds actually *sound* on speakers / phone, `navigator.vibrate` on a real phone, Safari / iOS audio unlock, real Supabase sync of the sounds block, light / paper themes of the new tab.
- Order panel still has its own "Sound on fills" switch (the same master setting).
