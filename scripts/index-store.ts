import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { Buffer } from 'node:buffer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GENERATED = resolve(ROOT, 'generated');
const DB_PATH = resolve(ROOT, 'packages.db');

// --- Types ---

interface IndexFile {
  name: string;
  version: string;
  requiresBuild?: boolean;
  files: Record<string, {
    checkedAt: number;
    integrity: string;
    mode: number;
    size: number;
  }>;
}

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  license?: string | { type?: string };
  repository?: string | { type?: string; url?: string };
  homepage?: string;
  author?: string | { name?: string; email?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface CategoryFile {
  name: string;
  slug: string;
  curated: string[];
  discovered: string[];
}

// --- Helpers ---

function log(msg: string) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log(`[${t}] ${msg}`);
}

function integrityToPath(storePath: string, integrity: string): string | null {
  // integrity format: "sha512-<base64>"
  const match = integrity.match(/^sha512-(.+)$/);
  if (!match) return null;

  const base64 = match[1];
  const hex = Buffer.from(base64, 'base64').toString('hex');
  const dir = hex.slice(0, 2);
  const file = hex.slice(2);
  const fullPath = resolve(storePath, 'files', dir, file);
  return existsSync(fullPath) ? fullPath : null;
}

async function readStoreFile(storePath: string, integrity: string): Promise<string | null> {
  const filePath = integrityToPath(storePath, integrity);
  if (!filePath) return null;
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function normalizeRepository(repo: PackageJson['repository']): string | null {
  if (!repo) return null;
  if (typeof repo === 'string') return repo;
  return repo.url ?? null;
}

function normalizeLicense(license: PackageJson['license']): string | null {
  if (!license) return null;
  if (typeof license === 'string') return license;
  return license.type ?? null;
}

function normalizeAuthor(author: PackageJson['author']): string | null {
  if (!author) return null;
  if (typeof author === 'string') return author;
  return author.name ?? null;
}

// --- Database setup ---

function createDatabase(): DatabaseSync {
  // Delete existing db for clean rebuild
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
  }

  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    CREATE TABLE packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      description TEXT,
      keywords TEXT,
      readme TEXT,
      license TEXT,
      repository TEXT,
      homepage TEXT,
      author TEXT,
      has_build INTEGER DEFAULT 0,
      file_count INTEGER DEFAULT 0,
      total_size INTEGER DEFAULT 0,
      indexed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(name, version)
    );

    CREATE TABLE dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      dep_name TEXT NOT NULL,
      dep_version TEXT NOT NULL,
      dep_type TEXT NOT NULL CHECK(dep_type IN ('runtime', 'dev', 'peer', 'optional')),
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );

    CREATE TABLE category_packages (
      package_id INTEGER NOT NULL,
      category_slug TEXT NOT NULL,
      category_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('curated', 'discovered')),
      PRIMARY KEY (package_id, category_slug),
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );

    CREATE INDEX idx_packages_name ON packages(name);
    CREATE INDEX idx_deps_package_id ON dependencies(package_id);
    CREATE INDEX idx_deps_dep_name ON dependencies(dep_name);
    CREATE INDEX idx_category_slug ON category_packages(category_slug);
  `);

  // FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE packages_fts USING fts5(
      name,
      description,
      keywords,
      readme,
      content='packages',
      content_rowid='id'
    );
  `);

  return db;
}

// --- Main indexing ---

async function indexStore() {
  const storePath = execSync('pnpm store path', { encoding: 'utf-8' }).trim();
  log(`pnpm store: ${storePath}`);

  const indexDir = resolve(storePath, 'index');
  if (!existsSync(indexDir)) {
    console.error('No index directory found in pnpm store');
    process.exit(1);
  }

  const db = createDatabase();
  log('Created SQLite database');

  // Prepare statements
  const insertPkg = db.prepare(`
    INSERT OR IGNORE INTO packages (name, version, description, keywords, readme, license, repository, homepage, author, has_build, file_count, total_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDep = db.prepare(`
    INSERT INTO dependencies (package_id, dep_name, dep_version, dep_type)
    VALUES (?, ?, ?, ?)
  `);

  const getPkgId = db.prepare(`SELECT id FROM packages WHERE name = ? AND version = ?`);

  // Scan all 256 hash directories
  const hashDirs = await readdir(indexDir);
  let totalIndexed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const hashDir of hashDirs) {
    const dirPath = resolve(indexDir, hashDir);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      continue; // not a directory
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const jsonFile of jsonFiles) {
      try {
        const indexContent = await readFile(resolve(dirPath, jsonFile), 'utf-8');
        const index: IndexFile = JSON.parse(indexContent);

        if (!index.name || !index.version || !index.files) {
          totalSkipped++;
          continue;
        }

        // Resolve package.json from content store
        const pkgJsonIntegrity = index.files['package.json']?.integrity;
        let pkgJson: PackageJson = { name: index.name, version: index.version };

        if (pkgJsonIntegrity) {
          const content = await readStoreFile(storePath, pkgJsonIntegrity);
          if (content) {
            try {
              pkgJson = JSON.parse(content);
            } catch { /* use defaults */ }
          }
        }

        // Resolve README
        let readme: string | null = null;
        const readmeKey = Object.keys(index.files).find(k => /^readme/i.test(k));
        if (readmeKey) {
          readme = await readStoreFile(storePath, index.files[readmeKey].integrity);
          // Truncate large READMEs to 50KB
          if (readme && readme.length > 50_000) {
            readme = readme.slice(0, 50_000) + '\n\n[truncated]';
          }
        }

        // Calculate totals
        const fileCount = Object.keys(index.files).length;
        const totalSize = Object.values(index.files).reduce((sum, f) => sum + (f.size || 0), 0);

        // Insert package
        insertPkg.run(
          index.name,
          index.version,
          pkgJson.description ?? null,
          pkgJson.keywords?.join(', ') ?? null,
          readme,
          normalizeLicense(pkgJson.license),
          normalizeRepository(pkgJson.repository),
          pkgJson.homepage ?? null,
          normalizeAuthor(pkgJson.author),
          index.requiresBuild ? 1 : 0,
          fileCount,
          totalSize
        );

        // Get the inserted package ID
        const row = getPkgId.get(index.name, index.version) as { id: number } | undefined;
        if (!row) {
          totalSkipped++;
          continue;
        }
        const pkgId = row.id;

        // Insert dependencies
        const depTypes: Array<[keyof PackageJson, string]> = [
          ['dependencies', 'runtime'],
          ['devDependencies', 'dev'],
          ['peerDependencies', 'peer'],
          ['optionalDependencies', 'optional'],
        ];

        for (const [field, type] of depTypes) {
          const deps = pkgJson[field] as Record<string, string> | undefined;
          if (!deps) continue;
          for (const [depName, depVersion] of Object.entries(deps)) {
            insertDep.run(pkgId, depName, depVersion, type);
          }
        }

        totalIndexed++;
        if (totalIndexed % 500 === 0) {
          log(`Indexed ${totalIndexed} packages...`);
        }
      } catch (err) {
        totalErrors++;
      }
    }
  }

  // Populate FTS index
  log('Building full-text search index...');
  db.exec(`
    INSERT INTO packages_fts(rowid, name, description, keywords, readme)
    SELECT id, name, COALESCE(description, ''), COALESCE(keywords, ''), COALESCE(readme, '')
    FROM packages
  `);

  // Load category mappings from generated/ files
  log('Loading category mappings...');
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO category_packages (package_id, category_slug, category_name, type)
    SELECT p.id, ?, ?, ?
    FROM packages p
    WHERE p.name = ?
    AND p.id = (SELECT MAX(id) FROM packages WHERE name = p.name)
  `);

  const categoryFiles = await readdir(GENERATED);
  for (const file of categoryFiles) {
    if (file === 'all-packages.json' || !file.endsWith('.json')) continue;
    const catData: CategoryFile = JSON.parse(
      await readFile(resolve(GENERATED, file), 'utf-8')
    );
    for (const pkg of catData.curated) {
      insertCat.run(catData.slug, catData.name, 'curated', pkg);
    }
    for (const pkg of catData.discovered) {
      insertCat.run(catData.slug, catData.name, 'discovered', pkg);
    }
  }

  // Print stats
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM packages) as packages,
      (SELECT COUNT(*) FROM dependencies) as dependencies,
      (SELECT COUNT(*) FROM category_packages) as categorized
  `).get() as { packages: number; dependencies: number; categorized: number };

  log(`Done!`);
  log(`  Packages indexed: ${stats.packages}`);
  log(`  Dependencies recorded: ${stats.dependencies}`);
  log(`  Category mappings: ${stats.categorized}`);
  log(`  Skipped: ${totalSkipped}`);
  log(`  Errors: ${totalErrors}`);
  log(`  Database: ${DB_PATH}`);

  db.close();
}

indexStore().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
