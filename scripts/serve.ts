import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { createServer as createViteServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GENERATED = resolve(ROOT, 'generated');
const DB_PATH = resolve(ROOT, 'packages.db');

// --- Types ---

interface CategorySummary {
  name: string;
  slug: string;
  count: number;
}

interface AllPackagesJson {
  totalPackages: number;
  packages: string[];
  categories: CategorySummary[];
}

interface CategoryJson {
  name: string;
  slug: string;
  curated: string[];
  discovered: string[];
  all: string[];
  totalCount: number;
}

interface FetchResults {
  success?: string[];
  failed?: string[];
}

interface PackageRow {
  id: number;
  name: string;
  version: string;
  description: string | null;
  keywords: string | null;
  readme: string | null;
  license: string | null;
  repository: string | null;
  homepage: string | null;
  author: string | null;
  has_build: number;
  file_count: number;
  total_size: number;
}

interface DependencyRow {
  dep_name: string;
  dep_version: string;
  dep_type: string;
}

interface DependentRow {
  name: string;
  version: string;
  dep_version: string;
  dep_type: string;
}

interface CategoryRow {
  category_slug: string;
  category_name: string;
  type: string;
}

interface SearchRow {
  id: number;
  name: string;
  version: string;
  description: string | null;
  keywords: string | null;
  license: string | null;
  rank: number;
}

// --- Helpers ---

async function readJSON<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf-8')) as T;
}

function getDb(): DatabaseSync {
  if (!existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}. Run: npx tsx scripts/index-store.ts`);
  }
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

// --- Server ---

async function start() {
  const fastify = Fastify({ logger: false });
  const db = getDb();

  // Prepare commonly used statements
  const searchStmt = db.prepare(`
    SELECT p.id, p.name, p.version, p.description, p.keywords, p.license, f.rank
    FROM packages_fts f
    JOIN packages p ON p.id = f.rowid
    WHERE packages_fts MATCH ?
    ORDER BY f.rank
    LIMIT ?
  `);

  const packageByNameStmt = db.prepare(`
    SELECT * FROM packages WHERE name = ? ORDER BY id DESC LIMIT 1
  `);

  const depsStmt = db.prepare(`
    SELECT dep_name, dep_version, dep_type
    FROM dependencies
    WHERE package_id = ?
    ORDER BY dep_type, dep_name
  `);

  const dependentsStmt = db.prepare(`
    SELECT p.name, p.version, d.dep_version, d.dep_type
    FROM dependencies d
    JOIN packages p ON p.id = d.package_id
    WHERE d.dep_name = ?
    ORDER BY p.name
  `);

  const categoriesForPkgStmt = db.prepare(`
    SELECT category_slug, category_name, type
    FROM category_packages
    WHERE package_id = ?
  `);

  const statsStmt = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM packages) as total_packages,
      (SELECT COUNT(DISTINCT name) FROM packages) as unique_packages,
      (SELECT COUNT(*) FROM dependencies) as total_dependencies,
      (SELECT COUNT(*) FROM category_packages) as total_categorized
  `);

  // --- Original endpoints (from generated JSON) ---

  fastify.get('/api/categories', async () => {
    const data = await readJSON<AllPackagesJson>(resolve(GENERATED, 'all-packages.json'));
    return {
      totalPackages: data.totalPackages,
      categories: data.categories,
    };
  });

  fastify.get<{ Params: { slug: string } }>('/api/category/:slug', async (request, reply) => {
    const file = resolve(GENERATED, `${request.params.slug}.json`);
    if (!existsSync(file)) {
      return reply.status(404).send({ error: 'not found' });
    }
    return readJSON<CategoryJson>(file);
  });

  fastify.get('/api/packages', async () => {
    const allPkgs = await readJSON<AllPackagesJson>(resolve(GENERATED, 'all-packages.json'));
    const categoryFiles = await Promise.all(
      allPkgs.categories.map(async (cat) => {
        const file = resolve(GENERATED, `${cat.slug}.json`);
        if (!existsSync(file)) return null;
        return readJSON<CategoryJson>(file);
      }),
    );

    const pkgMap = new Map<string, { name: string; category: string; type: string }>();
    for (const cat of categoryFiles) {
      if (!cat) continue;
      for (const name of cat.curated) {
        pkgMap.set(name, { name, category: cat.slug, type: 'curated' });
      }
      for (const name of cat.discovered) {
        if (!pkgMap.has(name)) {
          pkgMap.set(name, { name, category: cat.slug, type: 'discovered' });
        }
      }
    }

    return { packages: [...pkgMap.values()] };
  });

  fastify.get('/api/status', async (_request, reply) => {
    const resultsFile = resolve(ROOT, 'results', 'fetch-results.json');
    if (!existsSync(resultsFile)) {
      return reply.status(404).send({ error: 'no results yet' });
    }
    const data = await readJSON<FetchResults>(resultsFile);
    return {
      success: data.success?.length ?? 0,
      failed: data.failed?.length ?? 0,
      total: (data.success?.length ?? 0) + (data.failed?.length ?? 0),
    };
  });

  // --- New SQLite-backed endpoints ---

  fastify.get<{ Querystring: { q: string; limit?: string } }>(
    '/api/search',
    async (request, reply) => {
      const { q, limit: limitStr } = request.query;
      if (!q || q.trim().length === 0) {
        return reply.status(400).send({ error: 'query parameter "q" is required' });
      }

      const limit = Math.min(parseInt(limitStr ?? '50', 10), 200);

      // Sanitize FTS5 query — wrap terms in double quotes for safety
      const sanitized = q
        .trim()
        .split(/\s+/)
        .map((term) => `"${term.replace(/"/g, '')}"`)
        .join(' ');

      try {
        const rows = searchStmt.all(sanitized, limit) as SearchRow[];
        return {
          query: q,
          count: rows.length,
          results: rows.map((r) => ({
            id: r.id,
            name: r.name,
            version: r.version,
            description: r.description,
            keywords: r.keywords?.split(', ').filter(Boolean) ?? [],
            license: r.license,
          })),
        };
      } catch {
        // FTS5 query syntax error — fall back to LIKE search
        const likeRows = db
          .prepare(
            `SELECT id, name, version, description, keywords, license
           FROM packages WHERE name LIKE ? OR description LIKE ?
           ORDER BY name LIMIT ?`,
          )
          .all(`%${q}%`, `%${q}%`, limit) as SearchRow[];

        return {
          query: q,
          count: likeRows.length,
          results: likeRows.map((r) => ({
            id: r.id,
            name: r.name,
            version: r.version,
            description: r.description,
            keywords: r.keywords?.split(', ').filter(Boolean) ?? [],
            license: r.license,
          })),
        };
      }
    },
  );

  fastify.get<{ Params: { name: string } }>('/api/package/:name', async (request, reply) => {
    const row = packageByNameStmt.get(request.params.name) as PackageRow | undefined;
    if (!row) {
      return reply.status(404).send({ error: 'package not found' });
    }

    const deps = depsStmt.all(row.id) as DependencyRow[];
    const categories = categoriesForPkgStmt.all(row.id) as CategoryRow[];

    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      keywords: row.keywords?.split(', ').filter(Boolean) ?? [],
      readme: row.readme,
      license: row.license,
      repository: row.repository,
      homepage: row.homepage,
      author: row.author,
      hasBuild: Boolean(row.has_build),
      fileCount: row.file_count,
      totalSize: row.total_size,
      categories,
      dependencies: {
        runtime: deps.filter((d) => d.dep_type === 'runtime'),
        dev: deps.filter((d) => d.dep_type === 'dev'),
        peer: deps.filter((d) => d.dep_type === 'peer'),
        optional: deps.filter((d) => d.dep_type === 'optional'),
      },
    };
  });

  fastify.get<{ Params: { name: string } }>('/api/dependents/:name', async (request, reply) => {
    const rows = dependentsStmt.all(request.params.name) as DependentRow[];
    if (rows.length === 0) {
      // Check if the package exists at all
      const exists = db
        .prepare('SELECT 1 FROM packages WHERE name = ? LIMIT 1')
        .get(request.params.name);
      if (!exists) {
        return reply.status(404).send({ error: 'package not found' });
      }
    }
    return {
      package: request.params.name,
      count: rows.length,
      dependents: rows,
    };
  });

  fastify.get<{ Params: { name: string } }>('/api/dependees/:name', async (request, reply) => {
    const row = packageByNameStmt.get(request.params.name) as PackageRow | undefined;
    if (!row) {
      return reply.status(404).send({ error: 'package not found' });
    }

    const deps = depsStmt.all(row.id) as DependencyRow[];
    return {
      package: request.params.name,
      version: row.version,
      count: deps.length,
      dependencies: deps,
    };
  });

  fastify.get('/api/db/stats', async () => {
    return statsStmt.get();
  });

  // --- Vite dev server (middleware mode with Fastify) ---
  const vite = await createViteServer({
    root: resolve(ROOT, 'web'),
    server: { middlewareMode: true },
  });

  // Use Vite's connect middleware with Fastify
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip API routes
    if (request.url.startsWith('/api/')) return;

    // Let Vite handle everything else
    await new Promise<void>((resolvePromise) => {
      vite.middlewares(request.raw, reply.raw, () => {
        resolvePromise();
      });
    });

    // If Vite handled it (sent headers), tell Fastify not to continue
    if (reply.raw.headersSent) {
      reply.hijack();
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`\n  Package Explorer → http://localhost:${port}\n`);
  console.log(`  API endpoints:`);
  console.log(`    GET /api/categories          — category list`);
  console.log(`    GET /api/category/:slug       — category detail`);
  console.log(`    GET /api/search?q=term        — full-text search (SQLite FTS5)`);
  console.log(`    GET /api/package/:name        — package detail + deps`);
  console.log(`    GET /api/dependents/:name     — who depends on this`);
  console.log(`    GET /api/dependees/:name      — what this depends on`);
  console.log(`    GET /api/db/stats             — database statistics\n`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
