# Offline PNPM Browser

Browse and search your local pnpm store in the browser, entirely offline.

Offline PNPM Browser indexes packages cached in your local pnpm store directly in Chromium-based browsers. It uses the File System Access API, a Web Worker, and IndexedDB so package metadata is processed locally without a filesystem-reading app server.

## Features

- Browser-local indexing from a user-selected pnpm store
- Local package search from IndexedDB
- Category browsing from generated package lists
- Package detail pages with READMEs and copyable install commands
- Dependency and dependent graph navigation from the browser index
- Incremental browser re-indexing
- Offline operation after the app loads

## Prerequisites

- pnpm
- A Chromium-based browser for local directory access

## Quick Start

```bash
pnpm install
pnpm run dev
```

The app runs at `http://localhost:54321`. Use the Browser index panel to choose your pnpm store.

## Browser-Safe Store

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

The browser indexer scans your selected pnpm store, reads each package's `package.json` and README from the content store via integrity hashes, and writes package records to IndexedDB. Incremental updates compare pnpm index file mtimes against the previous browser index timestamp.

The selected folder should be a pnpm v10 store with `index` and `files` directories. Check the active pnpm store path with:

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
- IndexedDB
- [sugar-high](https://github.com/huozhi/sugar-high) for syntax highlighting
- [marked](https://marked.js.org) for markdown rendering

## License

MIT
