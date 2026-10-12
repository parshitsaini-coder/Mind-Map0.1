# Trade Analysis — Master Prompt (v2)

Paste this whole file into a new chat, with the current mind-map-app project
zip attached, to build this feature. It is split into numbered **STEPS** —
this is the same resume convention already used for the rest of this app: do
the steps in order, mark each `[x]` when it is fully done, and if a session
runs out of room, the next session (even on a different account) picks up
from the first `[ ]` step. Do not skip ahead.

## Progress tracker
- [x] Step 0 — Setup: store, data files, design tokens
- [x] Step 1 — Toolbar icon + full-screen overlay shell
- [x] Step 2 — Left panel shell (collapsible sidebar)
- [x] Step 3 — Left panel form fields
- [x] Step 4 — Instruments data (150 Indian stocks + 30 forex pairs)
- [x] Step 5 — Validation Rules system (manage popup + apply-to-trade)
- [x] Step 6 — Right panel entries table
- [x] Step 7 — Filters popup
- [x] Step 8 — Edit / delete flow
- [x] Step 9 — Persistence (localStorage, optional cloud sync)
- [x] Step 10 — Full animation + polish pass

---

## Design tokens (use everywhere in this feature, no exceptions)
Use this exact palette — https://coolors.co/palette/fffcf2-ccc5b9-403d39-252422-eb5e28
Add these as new CSS variables (don't touch the mind-map app's own
`--color-*` tokens — this feature gets its own scoped variables so it reads
as a distinct, intentional module):

```css
--ta-bg: #ccc5b9;      /* overlay/page background */
--ta-surface: #fffcf2; /* cards, inputs, table, the left form panel */
--ta-ink: #252422;     /* primary text */
--ta-slate: #403d39;   /* secondary text, icons, borders */
--ta-accent: #eb5e28;  /* primary buttons, active states, highlights, focus rings */
```
Buy/Sell direction badges keep standard trading semantics (green for Buy,
red for Sell) — those two are the only colors outside this palette, since
mixing up buy/sell color-coding hurts usability. Everything else (buttons,
borders, active tab states, the accent on hover/focus, badges other than
buy/sell) uses `--ta-accent` (#eb5e28) as the single accent color.

## Stack (match the existing app — no new tools)
React (Vite) + Tailwind CSS + Zustand + Framer Motion (`motion/react`) +
lucide-react icons + Cloudinary for image hosting (reuse the pattern in
`src/lib/imageUpload.js`). New isolated, persisted store:
`src/store/tradeAnalysisStore.js` (same `persist` pattern as
`whiteboardStore.js`).

---

## Step 0 — Setup
- Create `src/store/tradeAnalysisStore.js` (empty shell: `isOpen`,
  `sidebarOpen`, `trades: []`, `validationRules: []`, `filters: {}`).
- Create `src/data/instruments.js` (empty arrays for now — filled in
  Step 4).
- Add the `--ta-*` CSS variables above to `index.css` (or wherever the
  app's other `--color-*` tokens live), scoped so they don't leak into the
  rest of the app's theme.
- Confirm Cloudinary env vars already work (they do, per the existing node
  image upload feature) — no new upload backend needed, just a second
  helper function `uploadTradeImage(file)` alongside `uploadNodeImage`.

## Step 1 — Toolbar icon + full-screen overlay shell
- Add one new icon button to `TopToolbar.jsx` (lucide's
  `CandlestickChart` or `LineChart`), tooltip **"Trade Analysis"**.
- Clicking it opens a full-screen overlay (`fixed inset-0 z-[60]`, same
  pattern as `Whiteboard.jsx`) with a top bar containing, left to right:
  - **Back button** (closes the overlay, returns to the mind map; also
    close on Esc).
  - *(space for the entries title / count — optional)*
  - **Filters** button (right side) — functionality wired in Step 7.
  - **Add Validation Rule** button, right next to Filters — functionality
    wired in Step 5.
- No real content yet — just the shell, background `--ta-bg`, top bar
  `--ta-surface`, and the open/close transition (fade + slight scale,
  Framer Motion).

## Step 2 — Left panel shell (collapsible sidebar)
- A left sidebar inside the overlay, `--ta-surface` background, that can
  be hidden/shown via a toggle button (small chevron/arrow tab on its
  edge). Width animates 0 ↔ ~300px with a spring, content
  fades/slides with it (Framer Motion, same spring feel as the rest of
  the app's panels).
- Right side of the overlay (next to the sidebar) is reserved for the
  entries table (Step 6) — for now just a placeholder area.

## Step 3 — Left panel form fields
Build the "New Trade" form inside the Step 2 sidebar, top to bottom:

1. **Name** — free-text input, trade/setup name.
2. **Date** — date picker (defaults to today; the reference sketch marks
   this as its own field, separate from the timeframe).
3. **Stock / Forex pair** — searchable select/combobox, sourced from
   `src/data/instruments.js` (Step 4).
4. **Type** — segmented control: **Equity / Forex / Commodity** — filters
   the pair list above to match (equity → stocks, forex → pairs,
   commodity → a short static list: Gold, Silver, Crude Oil, Natural Gas).
5. **Time frame** — select: `1m, 3m, 5m, 15m, 30m, 60m, 75m, 2h, 3h, 4h,
   1D, 1W, 1M`.
6. **Direction** — toggle: **Buy / Sell** (green/red segmented control).
7. **Price** — numeric input, entry price (manual entry for v1).
8. **Notes** — multi-line textarea.
9. **Validation** — multi-select checklist of the currently configured
   validation rules (from Step 5's store) — user ticks which rules this
   trade satisfied. If no rules exist yet, show "No validation rules yet
   — add some from the ✚ button up top" instead of an empty list.
10. **Screenshot upload** — drag-and-drop zone + click-to-browse + paste
    (Ctrl+V) support, preview thumbnail, uploads to Cloudinary on save
    (hosted URL stored, not base64, same fallback-to-base64 behavior as
    the node image upload if Cloudinary isn't configured).
11. **Add** button — validates required fields (pair, type, direction,
    price at minimum), saves to the store, clears the form, toast
    ("Trade added"), animated success pulse on the button.

## Step 4 — Instruments data
Fill `src/data/instruments.js`:
- `INDIAN_STOCKS` — 150 NSE symbols (Nifty 100 + ~50 more liquid
  mid-caps). Each entry: `{ symbol, name }`.
- `FOREX_PAIRS` — 30 major/cross pairs (EUR/USD, GBP/USD, USD/JPY,
  USD/CHF, AUD/USD, NZD/USD, USD/CAD, EUR/GBP, EUR/JPY, GBP/JPY, and the
  other common crosses to reach 30).
- `COMMODITIES` — Gold, Silver, Crude Oil, Natural Gas (short static
  list for the "Commodity" type).
Confirm the exact stock list with the user if precision matters — default
to a sensible, well-known list otherwise so this step isn't a blocker.

## Step 5 — Validation Rules system
This is the **"Add Validation Rule"** button from Step 1's top bar.
- Store shape: `validationRules: [{ id, label, active }]` (e.g. "Trend
  confirmed on higher timeframe", "Risk:Reward ≥ 1:2", "No news in next
  30 min" — user-defined, start empty).
- Clicking **"Add Validation Rule"** opens a popup/modal (centered,
  backdrop blur, spring scale-in/out) titled **"Manage Validation
  Rules"**:
  - List of existing rules, each with an inline-editable label, an
    active/inactive toggle, drag-to-reorder (optional nice-to-have), and
    a delete (trash) button — each row animates in/out (`AnimatePresence`)
    on add/delete.
  - An "Add rule" input + button at the bottom to create a new one.
  - "Done" button closes the popup.
- Once rules exist, they show up as the checklist in Step 3's form
  (field 9) and as tags in the Step 6 table.
- Per-trade **validation score** = (rules checked / total active rules
  at time of entry) — shown as a fraction or % badge (e.g. "4/5" or
  "80%") both in the form (live, as rules are ticked) and in the table.

## Step 6 — Right panel entries table
Table replacing the Step 2 placeholder area. Columns, left to right:

| Column | Notes |
|---|---|
| No. | auto-incrementing index |
| Date | as entered |
| Stock/Forex name | the picked pair |
| Type | Equity / Forex / Commodity badge |
| Time frame | as picked |
| Direction | Buy (green) / Sell (red) badge |
| Price | entry price |
| Screenshot | thumbnail, click → lightbox |
| Status | editable select per row: **Pending / Target Hit / SL Hit** |
| Validation | tags of rules met + the score badge from Step 5 |
| Notes | truncated, click/hover to expand |
| Result image | optional second image (outcome/P&L), same upload flow |
| Actions | Edit (reopens the row in the Step 3 form) and Delete |

- Rows animate in with a staggered fade/slide on mount and on filter
  change (`AnimatePresence` + stagger).
- Sticky header; horizontally scrollable on narrow widths.
- Empty state (no trades yet) — a friendly placeholder illustration/text,
  not just a blank table.

## Step 7 — Filters popup
The **Filters** button from Step 1's top bar opens a popover (not a full
modal — anchored dropdown, similar animation to the whiteboard's node
picker popovers) with: pair, type, timeframe, direction, status,
validation-rule, and date-range filters. Applying updates the Step 6
table live; an active-filter-count badge shows on the Filters button
itself when any filter is set, with a one-click "Clear filters".

## Step 8 — Edit / delete flow
- Clicking **Edit** on a table row loads that trade's data back into the
  Step 3 form (form switches into "editing trade #N" mode, with a
  cancel-edit option); saving updates the existing entry instead of
  adding a new one.
- Clicking **Delete** asks for confirmation, then removes the entry
  (row animates out).

## Step 9 — Persistence
- Persist `trades` and `validationRules` (and `sidebarOpen`) to
  localStorage via `zustand/persist`, same as `whiteboardStore.js`.
- Stretch goal (only after everything above works): if the user is
  signed in (existing Supabase auth), sync `trades`/`validationRules`
  the same way mind maps sync to the cloud. Not a blocker for v1.

## Step 10 — Full animation + polish pass
Do this last, once every step above is functionally complete:
- Re-check every interactive element (buttons, toggles, table rows,
  popups, sidebar) has an intentional Framer Motion transition — nothing
  should pop in/out abruptly.
- Buy/Sell toggle: color-morph + scale-tap feedback.
- Validation checklist ticks: satisfying check-in animation.
- Status badges (SL/Target/Pending): colored pill, color from the
  palette (red-ish/green-ish/amber-ish tints derived from `--ta-accent`
  and the dark tones, not random hex values).
- Responsive check: sidebar collapses automatically on narrow viewports,
  table scrolls instead of breaking layout.
- Full pass to confirm every surface in this feature uses only the
  `--ta-*` palette (no leftover mind-map `--color-*` tokens bleeding in),
  except the intentional Buy/Sell green/red.

---

## Open questions (confirm with the user if they haven't already)
- Is "Price" manual for v1, or should it eventually pull live prices?
  (Default: manual.)
- Are trade entries global (one log across all mind-map projects) or
  per-project? (Default: global, unless told otherwise.)
- Exact 150 Indian stock symbols / 30 forex pairs — use the sensible
  default list in Step 4 unless the user provides their own.
