# Offline PNPM Browser

Browse and search your local pnpm store — entirely offline.

**Offline PNPM Browser** indexes npm packages cached in your local pnpm store into a searchable SQLite database with full-text search. Explore ~10,000 packages by category, read READMEs, inspect dependency graphs, and copy install commands — no network required.

![Homepage — browse categories and stats](screenshots/homepage.png)

## Features

- Full-text search with prefix matching and fuzzy fallback

  ![Search with live results and keyboard navigation](screenshots/search.png)

- Category-based browsing (Node.js Core, Modern React, Build Tools, etc.)

  ![Category view — Modern React](screenshots/category.png)

- Package detail pages with rendered READMEs, syntax-highlighted code blocks

  ![Package detail — react](screenshots/package-detail.png)

- Dependency and dependent graph navigation
- Version selector with copy-to-clipboard install commands
- Incremental indexing — re-index in ~1 second
- Responsive design for mobile and tablet
- Works completely offline after initial indexing

## Prerequisites

- Node.js >= 22 (uses `node:sqlite`)
- pnpm

## Quick start

```bash
# Install dependencies
pnpm install

# Build the SQLite database from your local pnpm store
pnpm run index

# Start the dev server
pnpm run dev
```

The app runs at `http://localhost:54321`.

## Installation (background service)

The install script sets up Offline PNPM Browser as a persistent background service that starts on boot and re-indexes your pnpm store every hour.

```bash
./scripts/install.sh
```

This will:

1. **Install dependencies** and build the production bundle
2. **Index your pnpm store** (full on first run, incremental if a database exists)
3. **Register a background service** that auto-starts and stays alive:
   - **macOS** — launchd (`~/Library/LaunchAgents/com.offline-pnpm-browser.plist`)
   - **Linux** — systemd user service (`~/.config/systemd/user/offline-pnpm-browser.service`)
4. **Set up hourly incremental indexing** via a separate launchd/systemd timer
5. **Install a git hook** so `git pull` automatically rebuilds and restarts the server

After install, the server is available at:

```
http://localhost:54321
```


### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `54321` | Server port |
| `HOST` | `0.0.0.0` | Bind address |

Override at install time:

```bash
PORT=8080 ./scripts/install.sh
```

## Running in development

```bash
pnpm run dev
```

Starts a Vite dev server at `http://localhost:54321` with HMR.

## Running in production (manual)

If you prefer not to use the install script:

```bash
pnpm run build
pnpm run start
```

Or directly:

```bash
node start.js
```

## Indexing

The indexer scans your local pnpm store (v10 content-addressable layout), reads each package's `package.json` and README from the content store via integrity hashes, and inserts everything into a SQLite database with FTS5 full-text search.

```bash
# First run — full index (~50-60s for ~10,000 packages)
pnpm run index

# Subsequent runs — incremental, only processes changed files (~1s)
pnpm run index

# Force a clean rebuild
pnpm run index:full
```

Incremental indexing compares file mtimes against a stored `last_indexed_at` timestamp. Only store index files modified since the last run are processed. The FTS index is rebuilt in bulk at the end (~1-2 seconds regardless of how many packages changed).

### Force reindex

Use the reindex script to manually trigger a re-index and restart the server:

```bash
# Incremental
./scripts/reindex.sh

# Full rebuild
./scripts/reindex.sh --full
```

This works whether the server is managed by launchd, systemd, or running manually — it will attempt to restart the appropriate service after indexing.

## Maintenance

### Viewing logs

**macOS:**

```bash
# Server logs
tail -f ~/Library/Logs/offline-pnpm-browser/stdout.log
tail -f ~/Library/Logs/offline-pnpm-browser/stderr.log

# Indexer logs
tail -f ~/Library/Logs/offline-pnpm-browser/index-stdout.log
```

**Linux:**

```bash
journalctl --user -u offline-pnpm-browser -f
journalctl --user -u offline-pnpm-browser-index -f
```

### Managing the service

**macOS (launchd):**

```bash
# Stop
launchctl bootout gui/$(id -u)/com.offline-pnpm-browser

# Start
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.offline-pnpm-browser.plist

# Restart
launchctl kickstart -k gui/$(id -u)/com.offline-pnpm-browser
```

**Linux (systemd):**

```bash
# Stop / start / restart
systemctl --user stop offline-pnpm-browser
systemctl --user start offline-pnpm-browser
systemctl --user restart offline-pnpm-browser

# Check status
systemctl --user status offline-pnpm-browser

# Disable on boot
systemctl --user disable offline-pnpm-browser
```

### Uninstalling

**macOS:**

```bash
launchctl bootout gui/$(id -u)/com.offline-pnpm-browser
launchctl bootout gui/$(id -u)/com.offline-pnpm-browser.index
rm ~/Library/LaunchAgents/com.offline-pnpm-browser.plist
rm ~/Library/LaunchAgents/com.offline-pnpm-browser.index.plist
rm -rf ~/Library/Logs/offline-pnpm-browser
```

**Linux:**

```bash
systemctl --user disable --now offline-pnpm-browser.service
systemctl --user disable --now offline-pnpm-browser-index.timer
rm ~/.config/systemd/user/offline-pnpm-browser.*
systemctl --user daemon-reload
```

## Search

Search uses a three-tier strategy:

1. **FTS5 prefix search** — the primary path. Queries are tokenized and wrapped with `*` for prefix matching, so typing "fastif" matches "fastify". Ranked by FTS5 relevance.
2. **Fuzzy fallback (Fuse.js)** — when FTS5 returns zero results, falls back to fuzzy matching with typo tolerance. Handles transpositions ("fsatify"), missing characters ("fstify"), and other typos. The Fuse index is lazy-initialized on first use and kept in memory.
3. Searches across package names (weighted 3x), keywords (1.5x), and descriptions (1x).

Results are collapsed by package name (multiple versions grouped together) with exact name matches sorted to the top.

## Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Start Vite dev server |
| `pnpm run build` | Build for production |
| `pnpm run start` | Build and start production server |
| `pnpm run index` | Index pnpm store into SQLite (incremental) |
| `pnpm run index:full` | Full rebuild of the index |
| `pnpm run pipeline` | Run discover → fetch → verify |
| `pnpm run backup` | Backup indexed data |
| `pnpm run restore` | Restore from backup |
| `./scripts/install.sh` | Set up as background service |
| `./scripts/reindex.sh` | Force reindex and restart server |
| `./scripts/reindex.sh --full` | Force full reindex and restart |

## Tech stack

- [TanStack Start](https://tanstack.com/start) + React 19
- [Vite](https://vite.dev) 8
- SQLite with FTS5 via `node:sqlite`
- [Fuse.js](https://www.fusejs.io) (fuzzy search fallback)
- [sugar-high](https://github.com/huozhi/sugar-high) (syntax highlighting)
- [marked](https://marked.js.org) (markdown rendering)

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your branch (`git checkout -b feature/my-change`)
3. Commit your changes
4. Push to the branch and open a pull request

This project uses [oxlint](https://oxc.rs) for linting and formatting, enforced via pre-commit hooks.

## License

[MIT](LICENSE)
