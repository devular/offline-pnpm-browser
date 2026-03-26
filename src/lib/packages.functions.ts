import { createServerFn } from '@tanstack/react-start';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fuse from 'fuse.js';
import {
  getDb,
  getGeneratedPath,
  type PackageRow,
  type DependencyRow,
  type DependentRow,
  type CategoryRow,
  type SearchResult,
  type DbStats,
} from './db.server';

// --- Fuzzy search index (lazy-initialized) ---

interface FusePackage {
  id: number;
  name: string;
  version: string;
  description: string | null;
  keywords: string | null;
  license: string | null;
}

let _fuse: Fuse<FusePackage> | null = null;

function getFuse(): Fuse<FusePackage> {
  if (_fuse) return _fuse;
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, version, description, keywords, license FROM packages')
    .all() as unknown as FusePackage[];
  _fuse = new Fuse(rows, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'description', weight: 1 },
      { name: 'keywords', weight: 1.5 },
    ],
    threshold: 0.4,
    includeScore: true,
  });
  return _fuse;
}

// --- Categories (from generated JSON) ---

export interface CategorySummary {
  name: string;
  slug: string;
  count: number;
}

export interface CategoriesResponse {
  totalPackages: number;
  categories: CategorySummary[];
}

export const getCategories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CategoriesResponse> => {
    const data = JSON.parse(
      await readFile(resolve(getGeneratedPath(), 'all-packages.json'), 'utf-8'),
    );
    return {
      totalPackages: data.totalPackages,
      categories: data.categories,
    };
  },
);

// --- Category detail ---

export interface CategoryDetail {
  name: string;
  slug: string;
  curated: string[];
  discovered: string[];
  totalCount: number;
}

export const getCategoryDetail = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<CategoryDetail | null> => {
    const file = resolve(getGeneratedPath(), `${slug}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(await readFile(file, 'utf-8'));
  });

// --- Search (SQLite FTS5) ---

export interface SearchResultItem {
  name: string;
  latestVersion: string;
  versions: string[];
  description: string | null;
  keywords: string[];
  license: string | null;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchResultItem[];
}

export const searchPackages = createServerFn({ method: 'GET' })
  .inputValidator((input: { q: string; limit?: number }) => input)
  .handler(async ({ data }): Promise<SearchResponse> => {
    const { q, limit: rawLimit } = data;
    const limit = Math.min(rawLimit ?? 50, 200);
    const db = getDb();

    const sanitized = q
      .trim()
      .split(/\s+/)
      .map((term) => `"${term.replace(/"/g, '')}"*`)
      .join(' ');

    const collapseVersions = (
      rows: Array<{
        name: string;
        version: string;
        description: string | null;
        keywords: string | null;
        license: string | null;
      }>,
    ): SearchResultItem[] => {
      const map = new Map<string, SearchResultItem>();
      for (const r of rows) {
        const existing = map.get(r.name);
        if (existing) {
          existing.versions.push(r.version);
        } else {
          map.set(r.name, {
            name: r.name,
            latestVersion: r.version,
            versions: [r.version],
            description: r.description,
            keywords: (r.keywords ?? '').split(', ').filter(Boolean),
            license: r.license,
          });
        }
      }
      // Sort versions descending within each package
      for (const item of map.values()) {
        item.versions.sort(compareSemver);
        item.latestVersion = item.versions[0];
      }
      return Array.from(map.values());
    };

    const sortExactFirst = (results: SearchResultItem[], query: string): SearchResultItem[] => {
      const qLower = query.trim().toLowerCase();
      return results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === qLower ? 0 : 1;
        const bExact = b.name.toLowerCase() === qLower ? 0 : 1;
        return aExact - bExact;
      });
    };

    // 1. Try FTS5 prefix search — fetch more rows to account for version collapsing
    try {
      const rows = db
        .prepare(
          `SELECT p.id, p.name, p.version, p.description, p.keywords, p.license, f.rank
         FROM packages_fts f
         JOIN packages p ON p.id = f.rowid
         WHERE packages_fts MATCH ?
         ORDER BY f.rank
         LIMIT ?`,
        )
        .all(sanitized, limit * 10) as unknown as SearchResult[];

      if (rows.length > 0) {
        const collapsed = collapseVersions(rows);
        const results = sortExactFirst(collapsed, q).slice(0, limit);
        return { query: q, count: results.length, results };
      }
    } catch {
      // FTS5 syntax error — fall through to fuzzy
    }

    // 2. Fuzzy fallback via Fuse.js
    const fuse = getFuse();
    const fuzzyResults = fuse.search(q, { limit: limit * 10 });
    const collapsed = collapseVersions(fuzzyResults.map((r) => r.item));
    const results = sortExactFirst(collapsed, q).slice(0, limit);

    return {
      query: q,
      count: results.length,
      results,
    };
  });

// --- Package detail ---

export interface PackageDetail {
  id: number;
  name: string;
  version: string;
  description: string | null;
  keywords: string[];
  readme: string | null;
  license: string | null;
  repository: string | null;
  homepage: string | null;
  author: string | null;
  hasBuild: boolean;
  fileCount: number;
  totalSize: number;
  categories: CategoryRow[];
  dependencies: {
    runtime: DependencyRow[];
    dev: DependencyRow[];
    peer: DependencyRow[];
    optional: DependencyRow[];
  };
}

export const getPackageDetail = createServerFn({ method: 'GET' })
  .inputValidator((input: { name: string; version?: string }) => input)
  .handler(async ({ data: { name, version } }): Promise<PackageDetail | null> => {
    const db = getDb();
    const row = version
      ? (db
          .prepare('SELECT * FROM packages WHERE name = ? AND version = ? LIMIT 1')
          .get(name, version) as unknown as PackageRow | undefined)
      : (db
          .prepare('SELECT * FROM packages WHERE name = ? ORDER BY id DESC LIMIT 1')
          .get(name) as unknown as PackageRow | undefined);

    if (!row) return null;

    const deps = db
      .prepare(
        'SELECT dep_name, dep_version, dep_type FROM dependencies WHERE package_id = ? ORDER BY dep_type, dep_name',
      )
      .all(row.id) as unknown as DependencyRow[];

    const categories = db
      .prepare(
        'SELECT category_slug, category_name, type FROM category_packages WHERE package_id = ?',
      )
      .all(row.id) as unknown as CategoryRow[];

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

// --- Dependents ---

export interface DependentsResponse {
  package: string;
  count: number;
  dependents: DependentRow[];
}

export const getDependents = createServerFn({ method: 'GET' })
  .inputValidator((name: string) => name)
  .handler(async ({ data: name }): Promise<DependentsResponse> => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT p.name, p.version, d.dep_version, d.dep_type
       FROM dependencies d
       JOIN packages p ON p.id = d.package_id
       WHERE d.dep_name = ?
       ORDER BY p.name`,
      )
      .all(name) as unknown as DependentRow[];

    return { package: name, count: rows.length, dependents: rows };
  });

// --- Package versions ---

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const getPackageVersions = createServerFn({ method: 'GET' })
  .inputValidator((name: string) => name)
  .handler(async ({ data: name }): Promise<Array<{ id: number; version: string }>> => {
    const db = getDb();
    const rows = db
      .prepare('SELECT id, version FROM packages WHERE name = ? ORDER BY id DESC')
      .all(name) as unknown as Array<{ id: number; version: string }>;
    return rows.sort((a, b) => compareSemver(a.version, b.version));
  });

// --- DB stats ---

export const getDbStats = createServerFn({ method: 'GET' }).handler(async (): Promise<DbStats> => {
  const db = getDb();
  return db
    .prepare(
      `SELECT
      (SELECT COUNT(*) FROM packages) as total_packages,
      (SELECT COUNT(DISTINCT name) FROM packages) as unique_packages,
      (SELECT COUNT(*) FROM dependencies) as total_dependencies,
      (SELECT COUNT(*) FROM category_packages) as total_categorized`,
    )
    .get() as unknown as DbStats;
});
