# Astrel Local Blog Studio

Astrel is a local-first personal blog and study desktop app. It combines Markdown writing, task check-ins, a photo wall, Pomodoro focus tracking, postgraduate exam planning, vocabulary review, achievements, and customizable anime-style themes.

The project is designed to run locally today and leave a clear path for future online publishing.

## Features

- Markdown writing with live preview, tags, categories, drafts, archives, and a reading-only mode.
- Daily task check-ins with list, month, and schedule views.
- Subtasks, overdue task visibility, task context menu, priorities, categories, and subject binding.
- Free-form photo walls with multiple walls, drag, resize, rotate, layer adjustment, rename, and delete.
- Pomodoro and stopwatch focus modes with pause, custom subjects, focus records, and study-time charts.
- Postgraduate exam dashboard with countdown, weekly reports, review planning, study heatmap, and achievement badges.
- Vocabulary review with import support, memory-curve review planning, overview filters, and reset tools.
- Custom profile, avatar cropping, background images, background music, theme transparency, blur, font size, and cursor effects.
- Electron desktop packaging for Windows.
- Local persistence through the bundled local server and Electron user data directory.

## Privacy Notice

This repository intentionally does not include personal runtime data.

Ignored local-only content includes:

- `data/` - saved posts, tasks, focus records, study data, and settings.
- `uploads/` - uploaded backgrounds, avatars, music, and photo-wall images.
- `dist/` - generated Electron builds.
- `node_modules/` - installed dependencies.
- `*.log` - runtime logs.

Before publishing screenshots or releases, check that they do not expose private study records, personal notes, avatars, background images, or music files.

## Requirements

- Node.js 18 or newer.
- npm.
- Windows is recommended for the current Electron packaging script.

## Local Development

Install dependencies:

```bash
npm install
```

Run as a local web app:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:8766/
```

Run as an Electron desktop app:

```bash
npm run electron
```

Build a Windows portable executable:

```bash
npm run pack:win
```

The generated executable will be placed under `dist/`.

## Project Structure

```text
.
├── index.html              # Main app markup
├── styles.css              # Visual system, layout, animations, and themes
├── app.js                  # Frontend state, rendering, and interactions
├── server.js               # Local HTTP server and local persistence API
├── electron-main.js        # Electron main process, tray, window, and data paths
├── electron-preload.js     # Safe bridge between Electron and the web app
├── assets/                 # Public app icons and static assets
├── start-blog.bat          # Windows helper for starting the local server
├── 词库导入格式.md          # Vocabulary import format guide
└── 联网公开博客改造步骤.md   # Future online blog migration notes
```

## Data Model

The app currently stores runtime data locally:

- Web mode uses the local server APIs under `/api/state` and `/api/upload`.
- Electron mode stores data in Electron's `userData` directory, not in the source repository.

This makes the project safe to publish as source code while keeping personal records on the user's machine.

## Future Online Publishing Plan

The codebase already separates app logic from persistence through the local API layer. A future online version can replace the local API with:

- user authentication,
- a real database,
- object storage for images and music,
- public/private post visibility,
- synchronization between desktop and web,
- deployment through a hosting platform.

See `联网公开博客改造步骤.md` for a staged migration checklist.

## Scripts

```bash
npm start       # Start the local server
npm run electron
npm run pack:win
```

## Repository Status

This is a personal local-first project. It is public for code sharing and future online-blog preparation, but user-generated local data is intentionally excluded.
