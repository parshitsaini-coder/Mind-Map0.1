# 🧠 Mind Map App

Full-featured mind mapping web app built with React, React Flow (`@xyflow/react`), Framer Motion, Zustand, and Tailwind CSS. See `mindmap-master-prompt.md` (or the original spec you supplied) for the complete feature list and progress tracker.

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

## Current status

All core features (Steps 0–14) are complete: canvas, all 7 layouts, node
shapes/themes, icons/emoji/images/badges, rich text notes/attachments/audio/
video, task management + Gantt view, keyboard shortcuts/focus/presentation/
outline/search, collaboration-lite (comments, version history, share link,
workspaces, activity log), a full animation pass, and a performance +
responsive pass (code-splitting, memoization, O(n) layout fix, mobile-friendly
toolbar/sidebar).

**Step 15 (deploy config) is complete** — set up for Vercel. Only the actual
`git push` needs to be run on your own machine, since this environment has no
GitHub push access.
