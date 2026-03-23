# offline-setup

Browse and search your local pnpm store — entirely offline.

**offline-setup** indexes npm packages cached in your local pnpm store into a searchable SQLite database with full-text search. Explore ~10,000 packages by category, read READMEs, inspect dependency graphs, and copy install commands — no network required.

## Features

- Full-text search across package names, descriptions, and keywords
- Category-based browsing (Node.js Core, Modern React, Build Tools, etc.)
- Package detail pages with rendered READMEs, syntax-highlighted code blocks
- Dependency and dependent graph navigation
- Version selector with copy-to-clipboard install commands
- Works completely offline after initial indexing

## Prerequisites

- Node.js >= 22 (uses `node:sqlite`)
- pnpm

## Getting started

```bash
# Install dependencies
pnpm install

# Build the SQLite database from your local pnpm store
pnpm run index

# Start the dev server
pnpm run dev
```

The app runs at `http://localhost:3000`.

For production:

```bash
pnpm run build
pnpm run start
```

## Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Start Vite dev server |
| `pnpm run build` | Build for production |
| `pnpm run start` | Start production server |
| `pnpm run index` | Index pnpm store into SQLite |
| `pnpm run pipeline` | Run discover → fetch → verify |
| `pnpm run backup` | Backup indexed data |
| `pnpm run restore` | Restore from backup |

## Tech stack

- [TanStack Start](https://tanstack.com/start) + React 19
- [Vite](https://vite.dev) 8
- SQLite with FTS5 via `node:sqlite`
- [Fastify](https://fastify.dev) (production server)
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
