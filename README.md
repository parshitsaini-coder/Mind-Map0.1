# 🧠 Mind Map App

Full-featured mind mapping web app built with React, React Flow (`@xyflow/react`), Framer Motion, Zustand, and Tailwind CSS. See `mindmap-master-prompt.md` (or the original spec you supplied) for the complete feature list and progress tracker.

## Recent updates

- **Demo Terminal — live XAUUSD data (Phase 14)** — the simulator is gone. The terminal shows **real gold (XAUUSD) prices only** (other symbols removed; multi-chart layouts show XAUUSD on different timeframes). Prices come through your own serverless functions (`api/candles`, `api/quote`, `api/symbols`, `api/health`) that call Twelve Data with a server-side key, with allow-list, caching, rate limit and a daily credit budget. Real market hours (Sun 22:00 → Fri 21:00 UTC, daily break) with a Live / Delayed / Offline / Market closed badge; market orders are refused while closed, SL/TP/pending never trigger on stale prices; offline catch-up replays **real candles** (SL first when one candle touches both SL and TP). Old simulated accounts get a one-time dialog (keep history / start fresh). Setup: `.env.example`, section "Live data" below. See `PHASE-STATUS.md` and `QA-PHASE14.md`.
- **Demo Terminal — drawing tools & indicator settings (Phase 11)** — 22 drawing tools in grouped flyouts (lines, arrows, extended lines, channel, fib retracement / extension, rectangle, ellipse, triangle, text, callout, arrow marker, long / short position with “Place this order”, price / date ranges) with a floating bar, a full settings dialog (Style · Text · Levels · Coordinates · Visibility, live preview, Cancel / Ok), templates and per-tool defaults that sync with your account, right-click menu, object tree, magnet, shortcuts and one Ctrl+Z / Ctrl+Y for everything on the chart. Indicators get a settings dialog (inputs, per-line style, pane size, timeframe range), a legend with live values, and two new ones: Volume and Stochastic RSI. See `PHASE-STATUS.md` and `QA-PHASE11.md`.
- **Demo Terminal — sound engine (Phase 12)** — every terminal event (fills, pending orders, closes, SL / TP, stop-out, margin warning …) goes through one event bus and one catalogue. Sounds are synthesised with Web Audio (no files): Classic / Soft / Arcade / Silent-pro packs, a Settings → Sounds tab with master volume, mute-in-background, vibration, per-event switch / sound / volume / preview, Test all and Reset. Simultaneous events play one sound (the most important), the browser's audio lock is handled with a "Tap to enable sound" chip. Dev playground: `?lab=1`. See `PHASE-STATUS.md` and `QA-PHASE12.md`.
- **Demo Terminal — animations & order popups (Phase 13)** — a fast “Done” popup for every order action (animated tick, P/L count-up, slippage, old → new for modifies, shake on rejection), redesigned stacked toasts, chart effects drawn on one shared canvas (entry sweep, limit / stop trigger pulse, take-profit shockwave with particles, stop-loss crack and shake, margin border pulse, stop-out vignette + banner), animated Positions / Orders / History rows and balance counters. Settings → Animations: Full / Reduced / Off, match system reduced-motion, popup style / time / position, per-effect switches; it also drops to Reduced by itself if the chart gets slow. See `PHASE-STATUS.md` and `QA-PHASE13.md`.
- **Demo Terminal — manage positions on the chart (Phase 10)** — every position and pending order now has a pill on the chart (side + lots, live P/L chip that cycles money / pips / % / R, close, reverse, ⋯ menu with close half / custom lots / break-even / trail / copy id). Drag SL and TP with live tags like `SL −$45.00 (−15.0 pips) −0.45 %`; invalid drags turn amber and spring back; snap to round numbers or recent highs/lows (Shift = fine, Ctrl = coarse); `+SL / +TP` place mode and a ⚡ quick bracket from default distances; Ctrl+Z / Undo toast; right-click / long-press / hover-`+` menu for limit and stop orders and horizontal lines; account strip on the chart with margin warning; execution tooltips. New Trading settings: position pill, reverse button, extend lines, snap, default SL/TP, margin warning. See `PHASE-STATUS.md` and `QA-PHASE10.md`.
- **Demo Terminal — Settings like a real terminal (Phase 9)** — new TradingView-style Settings dialog (gear in the terminal, or `Alt+,`): Symbol (7 chart types: candles, hollow, bars, line, area, baseline, Heikin Ashi; candle colours, colour-by-previous-close, precision, time zone), Status line (OHLC, change, volume, indicators, positions), Scales and lines (log / % / indexed scale, invert, lock, left/right, last / previous-close / bid / ask / high-low lines, countdown to bar close, time-scale spacing, 12/24 h, date format, crosshair), Canvas (6 theme presets + match-system, solid or gradient background, grid, text, watermark), Trading (all Phase 8 options + chart display: positions / orders / executions, P/L unit, line colours), Alerts. Live preview, Cancel reverts, Reset, Export / Import, Templates. Saved per account and synced. Bug fixes: 1W timeframe (key `8` used to crash), Strategy Tester imports, 'Clear all data' now asks for the real account password. Report: `QA-PHASE9.md`.
- **Demo Terminal — polish, offline, QA (Phase 8)** — new Settings panel (gear in the terminal): spread fixed/variable, slippage, commission per lot, stop-out level, one-click, sounds, default lots, keep-screen-on. Desktop shortcuts: `B`/`S` trade, `Enter` confirm, `Esc` cancel, `1`–`8` timeframes, `+`/`−` zoom, `?` help. Offline badge, bigger touch targets, keyboard focus ring. Full pass/fail report: `QA-PHASE8.md` (several items still need a phone / real Supabase — listed there).
- **Demo Terminal → cloud sync (Phase 7)** — your virtual account (balance, positions, pending orders, history, deposits, drawings, indicators, settings) is saved to Supabase (`terminal_accounts`, one row per user, RLS-protected) and follows you across devices. Debounced saves, compare-and-swap writes so a stale device can't overwrite a newer one, newer-`updated_at`-wins on conflict, and an empty local account never overwrites a non-empty cloud one. Works fully offline/local if the table isn't created — the terminal shows a small status pill. Setup SQL: `SUPABASE_SETUP.md` §3f. "Clear all data" now has a Demo Terminal option.
- **Whiteboard → fixed boundary, no more panning** — the board now has a visible black boundary border around its edge, and dragging empty canvas / plain mouse-wheel scroll no longer pans the background (it stays fixed in place). Zoom still works (Ctrl/Cmd + scroll, or the zoom buttons).
- **Whiteboard → custom colors & background** — every color swatch row (toolbar pen/text color, and the per-element selection toolbar) now has an extra rainbow "custom color" swatch that opens the system color picker for any hex color, not just the 8 presets. The dotted-grid background is gone; a new palette-icon button (top-right of the whiteboard toolbar) lets you set the board's own background to a preset or a custom color, saved per-browser.
- **Whiteboard → "Add to node"** — a new toolbar button (image icon, next to the zoom controls) rasterizes everything currently drawn on the whiteboard into one PNG and saves it onto a mind-map node's image, same node-picker search popover as the existing pin/"attach note" flow. Uses the same image-hosting pipeline as manually uploading a node image (Cloudinary → Supabase Storage → base64 fallback).
- **Whiteboard** — a new free-form canvas (pen-square icon in the toolbar), separate from the mind-map tree, where you can write text anywhere, drop sticky notes, and freehand-draw with a pen tool. Full toolset: Select (move/resize), Text, Sticky note, Pen, Eraser, a color palette, adjustable pen width, per-note font size, pan (drag empty space) & zoom (Ctrl/Cmd + scroll, or the zoom buttons), and its own Undo/Redo (Ctrl+Z / Ctrl+Y while the whiteboard is open) plus a "Clear board" button — all with keyboard shortcuts (V/T/S/P/E to switch tools, Del to delete the selected note, Esc to close). Select any text or sticky note and hit the pin (📌) button to **attach it to any node** in your mind map: it's copied onto that node's "Whiteboard notes" section in the Node Inspector (and shown with a small pin badge on the node itself on the canvas), so a freeform note you jotted down anywhere can live permanently with the node it belongs to. Whiteboard content is saved locally in the browser independently of the map itself.
- **Node Linking / Backlinks** — link any node to any other node from the Node Inspector's "Linked nodes" section. See outgoing links, see backlinks (who links to this node), and jump straight to a linked node (auto-expanding any collapsed branch along the way).
- **Mobile touch UI** — the right-hand panel (Node Inspector, Layouts, Tasks, etc.) now renders as a bottom sheet on phone-width screens instead of a cramped side panel. Node action buttons (add child / delete) now also show on tap-select, not just hover, since touch screens have no hover state.
- **Image hosting for nodes** — uploaded node images now go to a real image host instead of being embedded as base64, so they survive share links instead of being silently stripped when the map gets large. Priority order: **Cloudinary** (primary, if `VITE_CLOUDINARY_*` env vars are set) → **Supabase Storage** (fallback, if only `VITE_SUPABASE_*` are set) → embedded base64 (last resort, no backend configured). See "Environment variables" below for setup.
- **JSON backup (Export / Import)** — two new toolbar icons: download the entire current map as a `.json` file (full backup, independent of any cloud service or browser storage), and import one back in later. Recommended as a periodic manual backup on top of cloud sync.
- **Auto login prompt** — signed-out visitors now see the Log in / Sign up modal automatically once per visit (only when Supabase is configured), since a map is only saved to this browser's localStorage until you have an account — clearing site data or switching devices loses an unsaved map otherwise.
- **Per-connector styling/scale** — the Connector Styles panel's line-style and scale slider now target, in priority order: (1) a specifically selected connector line, (2) all of a selected node's own outgoing connectors, (3) every connector on the canvas if nothing is selected — so you can restyle just one branch instead of the whole map.
- **Shared/view-only link fixes** — fixed the collapse/expand toggle not responding to clicks in the shared-link viewer (React Flow was setting `pointer-events: none` on non-interactive nodes), and registered the `demoEdge` connector type in the viewer so custom-styled connectors render correctly there too.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to Vercel

This repo is set up for a plain root-domain deploy (`base: '/'` in
`vite.config.js`) — no extra config needed for Vercel.

1. Push this code to your GitHub repo (`https://github.com/parshitsaini-coder/Mind-Map0.1`):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/parshitsaini-coder/Mind-Map0.1.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub.
3. **Add New → Project** → import `Mind-Map0.1`.
4. Vercel auto-detects Vite: Build Command `npm run build`, Output Directory `dist`. Leave as-is.
5. Click **Deploy**. You'll get a live URL like `mind-map0-1.vercel.app`.
6. Every future `git push` to `main` auto-redeploys.

## Environment variables

Copy `.env.example` to `.env` locally, and set the same variables on
**Vercel → Project → Settings → Environment Variables** for the deployed
site (a local `.env` file is never pushed to git, so Vercel needs its own
copy).

| Variable | Used for | Where to get it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Auth + cloud map sync | Supabase Dashboard → Settings → API → **Project URL** (no extra path after `.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Auth + cloud map sync | Supabase Dashboard → Settings → API → **anon public** key |
| `VITE_CLOUDINARY_CLOUD_NAME` | Hosting node images (primary) | Cloudinary Dashboard home page, top of the page |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Hosting node images (primary) | Cloudinary Dashboard → Settings → Upload → Upload presets → create one with **Signing Mode: Unsigned** |
| `FEED_PROVIDER` / `TWELVEDATA_API_KEY` / `ALLOWED_ORIGIN` | Live XAUUSD prices (**server-side**, never `VITE_`) | See "Live data" below |

All four are optional in the sense that the app degrades gracefully without
them (no auth/cloud sync without the Supabase pair; images embed as base64
instead of uploading without the Cloudinary pair) — but for a real deployed
site you'll want all four set.

If using Supabase auth, also set **Authentication → URL Configuration** in
the Supabase dashboard: Site URL and Redirect URLs should point at your
actual deployed domain (e.g. `https://your-app.vercel.app/**`), not
`localhost` — otherwise email confirmation links redirect to `localhost`
and fail on a live site.

If using Supabase Storage as the image-hosting fallback, create a **public**
bucket named exactly `mindmap-media`, then add Storage policies allowing
`INSERT` and `SELECT` for the `anon` (and `authenticated`) roles — a bucket
with zero policies will reject uploads even if it's marked Public.

## Live data (Demo Terminal, Phase 14)

The terminal's gold prices come from **Twelve Data** through serverless functions in `api/` (Vercel runs
them automatically; `npm run dev` serves the same functions locally). The browser only ever calls
same-origin `/api/*` — the provider key lives only in server environment variables.

1. Create a free account at <https://twelvedata.com> and copy your API key (Dashboard → API keys).
2. **Vercel** → Project → Settings → Environment Variables → add (Production + Preview), then redeploy:
   - `FEED_PROVIDER` = `twelvedata`
   - `TWELVEDATA_API_KEY` = your key (**no `VITE_` prefix**)
   - `ALLOWED_ORIGIN` = `https://your-app.vercel.app` (optional; empty = same-origin only)
3. **Local dev:** copy `.env.example` to `.env`, fill `TWELVEDATA_API_KEY`, run `npm run dev` (a small Vite plugin serves
   `/api/*` from the same files). Alternatively `npx vercel dev`.
4. Check it: open `/api/health` — it should say `"keyConfigured": true`. Then open the terminal: the badge turns **Live**.

**Quota (free plan: 8 credits/minute, 800/day).** One credit per provider call. The functions cache
(live quote 25 s, forming candle 20 s – 10 min by timeframe, older history 24 h), share one upstream call between
all viewers, and stop calling the provider after 700 credits/day (you then see "quota reached" instead of fresh
prices). The browser polls every 30 s while the tab is visible and the market is open (every 5 min when closed, not at
all when the tab is hidden). Roughly: about 6½ hours of continuous viewing per day on the free plan.
**Terms:** Twelve Data's Basic plan is for internal / non-display use; for a public app check their terms or upgrade.
Prices are indicative and delayed; the terminal says "Prices are indicative, for practice only".

The provider only gives a mid price, so bid/ask = live mid ± half of a **simulated spread** (Settings → Trading →
"Simulated spread over live mid").

## Multiple projects & tabs

The dashboard icon (grid icon, top-left of the toolbar) opens **My Mind
Maps** — a screen to create a brand-new mind map or reopen one you saved
earlier. Each mind map is a fully separate project (its own nodes/edges),
listed with a "last edited" date, and can be renamed or deleted from there.

Opening a project adds it as a **tab** in the strip just under the toolbar
(browser-style) so you can jump between several open mind maps without
losing your place — click a tab to switch, click the `×` to close it, or hit
`+`/the grid icon to open the dashboard again. Everything is saved locally
per-project as you edit (same auto-save behavior as before); if you're
signed in, cloud sync still applies to whichever project is currently
active. Anyone updating from an earlier version of this app will see their
existing map automatically carried over as their first project.

## Current status

All core features (Steps 0–14) are complete: canvas, all 7 layouts, node
shapes/themes, icons/emoji/images/badges, rich text notes/attachments/audio/
video, task management + Gantt view, keyboard shortcuts/focus/presentation/
outline/search, collaboration-lite (comments, version history, share link,
workspaces, activity log), a full animation pass, and a performance +
responsive pass (code-splitting, memoization, O(n) layout fix, mobile-friendly
toolbar/sidebar). Multiple saved projects with browser-style tabs have been
added on top of this.

**Step 15 (deploy config) is complete** — set up for Vercel. Only the actual
`git push` needs to be run on your own machine, since this environment has no
GitHub push access.

On top of the original Step 0–15 build, this session added: Node Linking /
Backlinks, a mobile touch-friendly bottom-sheet UI, hosted (non-base64) node
images via Cloudinary/Supabase Storage, JSON backup export/import, an
auto login prompt for signed-out visitors, per-node connector styling/scale
targeting, shared-link viewer bug fixes (collapse button click, custom
connector rendering), and a full free-form **Whiteboard** (text/sticky
notes anywhere, freehand drawing, pan/zoom, its own undo/redo) with the
ability to attach any whiteboard note to a mind-map node. See "Recent
updates" above for details.
