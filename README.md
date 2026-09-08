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

## Deploy to GitHub Pages

This repo is already configured for **https://github.com/parshitsaini-coder/Mind-Map0.1**:

- `vite.config.js` → `base: '/Mind-Map0.1/'`
- `package.json` → `"homepage": "https://parshitsaini-coder.github.io/Mind-Map0.1"` + `predeploy`/`deploy` scripts
- `gh-pages` is already in `devDependencies`

Steps to go live (run these yourself — pushing to GitHub needs your own git/GitHub access):

1. If you haven't already, push this code to the repo:
   ```bash
   git init
   git remote add origin https://github.com/parshitsaini-coder/Mind-Map0.1.git
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git push -u origin main
   ```
2. Deploy the build to the `gh-pages` branch:
   ```bash
   npm run deploy
   ```
   (this runs `npm run build` automatically via `predeploy`, then publishes `dist/` to the `gh-pages` branch)
3. In the GitHub repo → **Settings → Pages** → set **Source** to the `gh-pages` branch, `/root`.
4. Wait 1–2 minutes, then your live app will be at:
   **https://parshitsaini-coder.github.io/Mind-Map0.1/**

> If you ever rename the repo, update `base` in `vite.config.js` and `homepage` in `package.json` to match the new name before redeploying.

## Current status

All core features (Steps 0–14) are complete: canvas, all 7 layouts, node
shapes/themes, icons/emoji/images/badges, rich text notes/attachments/audio/
video, task management + Gantt view, keyboard shortcuts/focus/presentation/
outline/search, collaboration-lite (comments, version history, share link,
workspaces, activity log), a full animation pass, and a performance +
responsive pass (code-splitting, memoization, O(n) layout fix, mobile-friendly
toolbar/sidebar).

**Step 15 (GitHub Pages deploy config) is complete** — see the deploy section
above. Only the actual `git push` / `npm run deploy` needs to be run on your
own machine, since this environment has no GitHub push access.
