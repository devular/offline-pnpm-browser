import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GENERATED = resolve(ROOT, 'generated');

async function readJSON(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function start() {
  const app = express();

  // --- API routes ---

  app.get('/api/categories', async (_req, res) => {
    const data = await readJSON(resolve(GENERATED, 'all-packages.json'));
    res.json({
      totalPackages: data.totalPackages,
      categories: data.categories,
    });
  });

  app.get('/api/category/:slug', async (req, res) => {
    const file = resolve(GENERATED, `${req.params.slug}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    const data = await readJSON(file);
    res.json(data);
  });

  app.get('/api/packages', async (_req, res) => {
    const allPkgs = await readJSON(resolve(GENERATED, 'all-packages.json'));
    // Build a searchable list with category + type info
    const categoryFiles = await Promise.all(
      allPkgs.categories.map(async (cat) => {
        const file = resolve(GENERATED, `${cat.slug}.json`);
        if (!existsSync(file)) return null;
        return readJSON(file);
      })
    );

    const pkgMap = new Map();
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

    res.json({ packages: [...pkgMap.values()] });
  });

  app.get('/api/status', async (_req, res) => {
    const resultsFile = resolve(ROOT, 'results', 'fetch-results.json');
    if (!existsSync(resultsFile)) {
      return res.status(404).json({ error: 'no results yet' });
    }
    const data = await readJSON(resultsFile);
    res.json({
      success: data.success?.length ?? 0,
      failed: data.failed?.length ?? 0,
      total: (data.success?.length ?? 0) + (data.failed?.length ?? 0),
    });
  });

  // --- Vite dev server ---
  const vite = await createViteServer({
    root: resolve(ROOT, 'web'),
    server: { middlewareMode: true },
  });

  app.use(vite.middlewares);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`\n  Package Explorer → http://localhost:${port}\n`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
