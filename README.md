# 🧠 Mind Map App

Full-featured mind mapping web app built with React, React Flow (`@xyflow/react`), Framer Motion, Zustand, and Tailwind CSS. See `mindmap-master-prompt.md` (or the original spec you supplied) for the complete feature list and progress tracker.

## Recent updates

- **Node Whiteboard** — every node now has a "Whiteboard" section in the Node Inspector: opens a full-screen drawing board (pen, eraser, line/rectangle/ellipse/arrow shapes, text tool, color palette + custom color, brush size, undo/redo, clear all, download as PNG) so you can sketch or jot freeform notes and attach them straight to that node. The drawing is saved as editable vector strokes (so reopening it lets you keep drawing) plus a thumbnail image shown in the inspector; nodes with a whiteboard get the same "has notes/attachments" indicator icon.
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

On top of the original Step 0–15 build, this session added: a per-node
Whiteboard (freeform pen/shapes/text drawing board), Node Linking /
Backlinks, a mobile touch-friendly bottom-sheet UI, hosted (non-base64) node
images via Cloudinary/Supabase Storage, JSON backup export/import, an
auto login prompt for signed-out visitors, per-node connector styling/scale
targeting, and shared-link viewer bug fixes (collapse button click, custom
connector rendering). See "Recent updates" above for details.
