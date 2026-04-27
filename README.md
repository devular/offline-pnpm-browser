# Offline Package Browser

Browse and search local JavaScript package caches in the browser, entirely offline.

Offline Package Browser indexes packages cached by pnpm, Bun, and Yarn directly in Chromium-based browsers. It uses the File System Access API, Web Workers, ZIP reading for Yarn archives, and IndexedDB so package metadata is processed locally without a filesystem-reading app server.

## Features

- Browser-local indexing from user-selected package caches
- pnpm store, Bun cache, and Yarn Berry zip cache support
- Central IndexedDB package index deduped by `name@version`
- Local package search from IndexedDB
- Category browsing from generated package lists
- Package detail pages with READMEs and copyable install commands
- Dependency and dependent graph navigation from the browser index
- Incremental pnpm re-indexing
- Offline operation after the app loads

## Prerequisites

- pnpm, Bun, or Yarn cache data
- A Chromium-based browser for local directory access

## Quick Start

```bash
pnpm install
pnpm run dev
```

The app runs at `http://localhost:54321`. If no browser index exists, the app opens onboarding so you can choose a cache source.

## Cache Sources

### pnpm

Choose the folder returned by:

```bash
pnpm store path
```

Chrome may refuse to open stores under protected locations such as `~/Library` on macOS. If that happens, mirror the store into a normal user folder:

```bash
mkdir -p ~/pnpm-store-browser
rsync -a --delete "$(pnpm store path)/" ~/pnpm-store-browser/v10/
```

Then choose `~/pnpm-store-browser/v10` in the browser picker.

You can also move pnpm itself to the browser-safe store:

```bash
pnpm config set store-dir ~/pnpm-store-browser/v10
pnpm store path
```

To restore pnpm's default store behavior:

```bash
pnpm config delete store-dir
pnpm store path
```

### Bun

Choose Bun's global install cache. The default is usually:

```text
~/.bun/install/cache
```

If you use a custom cache, choose the folder from `BUN_INSTALL_CACHE_DIR`.

### Yarn

Choose a Yarn Berry cache folder containing `.zip` archives. In many projects this is:

```text
.yarn/cache
```

## Running In Production

```bash
pnpm run build
pnpm run start
```

`start.js` serves the built SPA statically and falls back to `index.html` for client-side routes.

### Environment Variables

| Variable | Default | Description                |
| -------- | ------- | -------------------------- |
| `PORT`   | `54321` | Static preview server port |

## Indexing

The browser indexer scans selected package caches, reads each package's `package.json` and README, and writes normalized package records to IndexedDB. Records from multiple sources are merged by `name@version` and retain source metadata.

For pnpm, the selected folder should be a v10 store with `index` and `files` directories. Check the active pnpm store path with:

```bash
pnpm store path
```

## Scripts

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `pnpm run dev`      | Start Vite dev server           |
| `pnpm run build`    | Build static SPA                |
| `pnpm run start`    | Build and serve static SPA      |
| `pnpm run pipeline` | Run discover -> fetch -> verify |
| `pnpm run backup`   | Backup pnpm store               |
| `pnpm run restore`  | Restore pnpm store backup       |

## Tech Stack

- [TanStack Router](https://tanstack.com/router) + React 19
- [Vite](https://vite.dev) 8
- File System Access API
- Web Workers
- [zip.js](https://github.com/gildas-lormeau/zip.js) for Yarn cache archives
- IndexedDB
- [sugar-high](https://github.com/huozhi/sugar-high) for syntax highlighting
- [marked](https://marked.js.org) for markdown rendering

## License

MIT
